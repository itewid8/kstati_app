/**
 * Сквозные тесты сервера без сети и без Яндекса: регистрация, вход, сброс пароля, группы и права,
 * синхронизация, хотелки, голос (распознавание и ИИ подменены), суточный лимит, удаление аккаунта.
 * Один сценарий гоняется дважды: на хранилище в памяти и на YdbStore против поддельного Document API.
 *   npm test
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { MemoryStore } from '../src/store/memory.js';
import type { Store } from '../src/store/types.js';
import { YdbStore } from '../src/store/ydb.js';
import { startFakeDocApi } from './fake-docapi.js';

config.voiceDailyLimit = 3;

// VK ID подменён: обмен кода и данные человека отвечают без сети, остальные запросы (Document API) идут как есть
config.vkClientId = 'test-vk';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === 'https://id.vk.com/oauth2/auth') return Response.json({ access_token: 'vk-token', user_id: 777 });
  if (url === 'https://id.vk.com/oauth2/user_info') return Response.json({ user: { user_id: 777, first_name: 'Вика', sex: 1 } });
  return realFetch(input, init);
}) as typeof fetch;

async function scenario(name: string, store: Store) {
  const parsed: string[] = [];
  const app = await buildApp({
    store,
    recognize: async () => 'хочу наушники',
    toOgg: async () => ({ ogg: Buffer.from('ogg'), seconds: 1.2 }),
    parse: async (text, ctx) => {
      parsed.push(`${text} | people=${ctx.people.map((p) => p.name).join(',')} | tasks=${ctx.existing.tasks.length} | wishes=${ctx.existing.wishes.length}`);
      return { result: { type: 'unknown' }, raw: '{}', usage: { input: 1, output: 1, total: 2 }, attempts: 1 };
    },
  });

  const call = async (method: string, url: string, body?: unknown, token?: string) => {
    const r = await app.inject({ method: method as any, url, payload: body as any, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: r.statusCode, json: r.body ? JSON.parse(r.body) : null, headers: r.headers };
  };
  const ok = async (method: string, url: string, body?: unknown, token?: string) => {
    const r = await call(method, url, body, token);
    assert.equal(r.status, 200, `${method} ${url} → ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  };
  const ops = async (token: string, ...list: unknown[]) => (await ok('POST', '/ops', { ops: list }, token)).results as any[];

  /* ---------- регистрация и вход ---------- */
  const reg = async (email: string, name: string) => {
    const { devCode } = await ok('POST', '/auth/email/code', { email, purpose: 'register' });
    assert.match(devCode, /^\d{6}$/);
    return ok('POST', '/auth/register', { email, code: devCode, name, password: 'secret-123' });
  };
  const sasha = await reg('Sasha@Example.ru', 'Саша');
  assert.equal(sasha.me.email, 'sasha@example.ru');
  assert.equal((await call('POST', '/auth/email/code', { email: 'sasha@example.ru', purpose: 'register' })).status, 409, 'почта уже занята');
  assert.equal((await call('POST', '/auth/login', { email: 'sasha@example.ru', password: 'wrong-pass' })).status, 401);
  const login = await ok('POST', '/auth/login', { email: 'sasha@example.ru', password: 'secret-123' });
  const T1 = login.token as string;
  assert.equal((await call('GET', '/me', undefined, 'garbage')).status, 401);
  assert.equal((await ok('GET', '/me', undefined, T1)).name, 'Саша');

  // Неверный код регистрации
  await ok('POST', '/auth/email/code', { email: 'masha@example.ru', purpose: 'register' });
  assert.equal((await call('POST', '/auth/register', { email: 'masha@example.ru', code: '000000', name: 'Маша', password: 'secret-123' })).status, 400);
  // Повторный код раньше минуты — нельзя
  assert.equal((await call('POST', '/auth/email/code', { email: 'masha@example.ru', purpose: 'register' })).status, 429);
  await store.deleteTemp('cooldown#register#masha@example.ru');
  const masha = await reg('masha@example.ru', 'Маша');
  const T2 = masha.token as string;

  // Сброс пароля
  const { devCode: resetCode } = await ok('POST', '/auth/email/code', { email: 'masha@example.ru', purpose: 'reset' });
  await ok('POST', '/auth/reset', { email: 'masha@example.ru', code: resetCode, password: 'new-secret-456' });
  assert.equal((await call('POST', '/auth/login', { email: 'masha@example.ru', password: 'secret-123' })).status, 401, 'старый пароль больше не подходит');
  await ok('POST', '/auth/login', { email: 'masha@example.ru', password: 'new-secret-456' });
  // Сброс для несуществующего адреса отвечает так же, но без кода
  const ghost = await ok('POST', '/auth/email/code', { email: 'nobody@example.ru', purpose: 'reset' });
  assert.equal(ghost.devCode, undefined);

  /* ---------- VK ID: билет меняется на токен только с code_verifier приложения, начавшего вход ---------- */
  const vkStart = (q: Record<string, string>) => app.inject({ method: 'GET', url: `/auth/vk/start?${new URLSearchParams(q)}` });
  const vkFlow = async (verifier: string, appState: string) => {
    const code_challenge = createHash('sha256').update(verifier).digest('base64url');
    const start = await vkStart({ redirect: 'kstati://auth', code_challenge, code_challenge_method: 'S256', state: appState });
    assert.equal(start.statusCode, 302, start.body);
    const vkState = new URL(String(start.headers.location)).searchParams.get('state')!;
    const cb = await app.inject({ method: 'GET', url: `/auth/vk/callback?${new URLSearchParams({ state: vkState, code: 'c', device_id: 'd' })}` });
    assert.equal(cb.statusCode, 302);
    const back = new URL(String(cb.headers.location).replace(/^kstati:\/\//, 'https://x/')).searchParams;
    assert.equal(back.get('state'), appState, 'приложение получает свой state обратно');
    assert.ok(back.get('ticket'));
    return back.get('ticket')!;
  };
  assert.equal((await vkStart({ redirect: 'kstati://auth' })).statusCode, 400, 'без code_challenge вход не начинается');
  const vkVerifier = randomBytes(32).toString('base64url');
  const vkAppState = randomBytes(16).toString('base64url');
  // Перехваченный билет без verifier или с чужим verifier токен не даёт — и сгорает
  const stolen = await vkFlow(vkVerifier, vkAppState);
  assert.equal((await call('POST', '/auth/vk/finish', { ticket: stolen })).status, 400, 'без code_verifier');
  assert.equal((await call('POST', '/auth/vk/finish', { ticket: stolen, code_verifier: randomBytes(32).toString('base64url') })).status, 400, 'чужой code_verifier');
  assert.equal((await call('POST', '/auth/vk/finish', { ticket: stolen, code_verifier: vkVerifier })).status, 400, 'билет одноразовый');
  const vk = await ok('POST', '/auth/vk/finish', { ticket: await vkFlow(vkVerifier, vkAppState), code_verifier: vkVerifier });
  assert.equal(vk.me.vk, true);
  assert.equal((await ok('GET', '/me', undefined, vk.token)).name, 'Вика');

  /* ---------- группа, приглашение, права ---------- */
  const [created] = await ops(T1, { op: 'group.create', group: { id: 'g1', name: 'Семья', category: 'couple' } });
  assert.equal(created.ok, true);
  const code = created.group.inviteCode as string;
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal((await ops(T2, { op: 'task.put', task: { id: 't0', groupId: 'g1', title: 'x', date: null, time: null, doneAt: null } }))[0].error, 'not_member');
  const [joined] = await ops(T2, { op: 'group.join', code: code.toLowerCase() });
  assert.equal(joined.ok, true);
  assert.deepEqual(joined.group.memberIds.sort(), [sasha.me.id, masha.me.id].sort());
  // Код приглашения видят только создатель и админы
  assert.equal(joined.group.inviteCode, '', 'обычному участнику код не отдаётся при вступлении');
  assert.equal((await ok('POST', '/sync', {}, T2)).groups[0].inviteCode, '', 'и в синхронизации');
  assert.equal((await ops(T2, { op: 'group.create', group: { id: 'g1', name: 'Семья', category: 'couple' } }))[0].group.inviteCode, '', 'и при повторном создании');
  assert.equal((await ok('POST', '/sync', {}, T1)).groups[0].inviteCode, code, 'создатель код видит');
  assert.equal((await ops(T2, { op: 'group.join', code: 'ZZZZZZ' }))[0].error, 'bad_code');

  // Маша не админ — переименовать нельзя; Саша делает её админом — можно
  assert.equal((await ops(T2, { op: 'group.update', id: 'g1', name: 'Наше' }))[0].error, 'forbidden');
  assert.equal((await ops(T2, { op: 'group.admin', id: 'g1', userId: masha.me.id, admin: true }))[0].error, 'forbidden');
  assert.equal((await ops(T1, { op: 'group.admin', id: 'g1', userId: masha.me.id, admin: true }))[0].ok, true);
  assert.equal((await ops(T2, { op: 'group.update', id: 'g1', name: 'Наше' }))[0].ok, true);
  // Админ не может исключить создателя
  assert.equal((await ops(T2, { op: 'group.remove', id: 'g1', userId: sasha.me.id }))[0].error, 'forbidden');

  /* ---------- записи и синхронизация ---------- */
  const r = await ops(
    T1,
    { op: 'task.put', task: { id: 't1', groupId: 'g1', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00', doneAt: null } },
    { op: 'watch.put', watch: { id: 'm1', groupId: 'g1', title: 'Дюна', kind: 'movie', genres: ['scifi'], origin: 'foreign', year: 2021, watchedAt: null } },
    { op: 'wish.put', wish: { id: 'w1', title: 'Наушники', note: '', link: '', receivedAt: null } },
    { op: 'task.put', task: { id: 't2', groupId: 'g1', title: '', date: null, time: null, doneAt: null } },
  );
  assert.deepEqual(r.map((x) => x.ok), [true, true, true, false], 'пустое название — ошибка только этой операции');
  await ops(T2, { op: 'task.put', task: { id: 't3', groupId: 'g1', title: 'Забрать посылку', date: null, time: null, doneAt: null } });

  const s1 = await ok('POST', '/sync', {}, T2);
  assert.equal(s1.groups.length, 1);
  assert.equal(s1.groups[0].name, 'Наше');
  assert.equal(s1.groups[0].inviteCode, code, 'админ код видит');
  assert.deepEqual(s1.items.g1.map((i: any) => i.id).sort(), ['m1', 't1', 't3']);
  assert.equal(s1.items.g1.find((i: any) => i.id === 't1').createdBy, sasha.me.id);
  assert.deepEqual(s1.wishes[sasha.me.id].map((w: any) => w.title), ['Наушники'], 'хотелки Саши видны Маше');
  assert.equal(s1.users.length, 2);
  assert.equal(s1.users[0].passHash, undefined, 'хеш пароля наружу не уходит');

  // Повторная синхронизация с теми же ревизиями — без содержимого
  const s2 = await ok('POST', '/sync', { groups: s1.revs.groups, owners: s1.revs.owners }, T2);
  assert.deepEqual(s2.items, {});
  assert.deepEqual(s2.wishes, {});
  // Изменение в группе — приходит только она
  await ops(T1, { op: 'task.put', task: { id: 't1', groupId: 'g1', title: 'Ужин у родителей', date: '2026-09-26', time: '20:00', doneAt: null } });
  const s3 = await ok('POST', '/sync', { groups: s1.revs.groups, owners: s1.revs.owners }, T2);
  assert.equal(s3.items.g1.find((i: any) => i.id === 't1').time, '20:00');
  assert.equal(s3.items.g1.find((i: any) => i.id === 't1').createdBy, sasha.me.id, 'автор не меняется при правке');
  assert.deepEqual(s3.wishes, {});

  /* ---------- ник и профиль ---------- */
  assert.equal((await ok('GET', '/nick/check?nick=' + encodeURIComponent('саша'), undefined, T2)).status, 'free');
  assert.equal((await ops(T1, { op: 'profile', nick: 'Саша', gender: 'm' }))[0].ok, true);
  assert.equal((await ok('GET', '/nick/check?nick=' + encodeURIComponent('САША'), undefined, T2)).status, 'taken');
  assert.equal((await ops(T2, { op: 'profile', nick: 'саша' }))[0].error, 'nick_taken');
  assert.equal((await ops(T1, { op: 'profile', nick: 'sasha_k' }))[0].ok, true);
  assert.equal((await ok('GET', '/nick/check?nick=' + encodeURIComponent('саша'), undefined, T2)).status, 'free', 'старый ник освободился');

  /* ---------- голос ---------- */
  const v = await ok('POST', '/voice', { groupId: 'g1', today: '2026-09-26', now: '12:00', audio: Buffer.from('m4a').toString('base64') }, T2);
  assert.equal(v.transcript, 'хочу наушники');
  assert.equal(v.left, 2);
  assert.match(parsed[0], /people=Саша \| tasks=2 \| wishes=0/);
  assert.equal((await call('POST', '/voice/text', { groupId: 'nope', today: '2026-09-26', now: '12:00', text: 'x' }, T2)).status, 403);
  await ok('POST', '/voice/text', { groupId: 'g1', today: '2026-09-26', now: '12:00', text: 'купить хлеб' }, T2);
  await ok('POST', '/voice/text', { groupId: 'g1', today: '2026-09-26', now: '12:00', text: 'купить молоко' }, T2);
  const lim = await call('POST', '/voice/text', { groupId: 'g1', today: '2026-09-26', now: '12:00', text: 'ещё' }, T2);
  assert.equal(lim.status, 429);
  assert.equal(lim.json.error, 'daily_limit');
  assert.equal((await call('POST', '/voice/text', { groupId: 'g1', today: '2026-09-26', now: '12:00', text: 'ещё' })).status, 401, 'без входа нельзя');

  /* ---------- исключение: его дела в группе удаляются, хотелки остаются у него ---------- */
  await ops(T2, { op: 'wish.put', wish: { id: 'w2', title: 'Кофемолка', note: '', link: '', receivedAt: null } });
  assert.equal((await ops(T1, { op: 'group.remove', id: 'g1', userId: masha.me.id }))[0].ok, true);
  const s4 = await ok('POST', '/sync', {}, T1);
  assert.deepEqual(s4.items.g1.map((i: any) => i.id).sort(), ['m1', 't1'], 'дело Маши удалено');
  assert.equal(s4.users.length, 1);
  assert.equal(s4.wishes[masha.me.id], undefined, 'хотелки Маши Саше больше не видны');
  const s5 = await ok('POST', '/sync', {}, T2);
  assert.equal(s5.groups.length, 0);
  assert.deepEqual(s5.wishes[masha.me.id].map((w: any) => w.title), ['Кофемолка'], 'свои хотелки у Маши на месте');
  // После исключения у группы новый код, старый не работает — сама Маша вернуться не может
  const code2 = s4.groups[0].inviteCode as string;
  assert.match(code2, /^[A-Z0-9]{6}$/);
  assert.notEqual(code2, code, 'код группы сменился');
  assert.equal((await ops(T2, { op: 'group.join', code }))[0].error, 'bad_code', 'по старому коду не вернуться');
  assert.equal(await store.getKey(`invite#${code}`), null);
  assert.equal(await store.getKey(`invite#${code2}`), 'g1');
  assert.equal((await ok('POST', '/sync', {}, T2)).groups.length, 0);

  /* ---------- выход последнего и удаление аккаунта ---------- */
  await ops(T2, { op: 'group.create', group: { id: 'g2', name: 'Друзья', category: 'friends' } });
  const g2 = (await ok('POST', '/sync', {}, T2)).groups[0];
  await ops(T1, { op: 'group.join', code: g2.inviteCode });
  // Сам вышел — код не меняется, можно вернуться по нему же
  assert.equal((await ops(T1, { op: 'group.leave', id: 'g2' }))[0].ok, true);
  assert.equal((await ops(T1, { op: 'group.join', code: g2.inviteCode }))[0].ok, true);
  await ok('DELETE', '/me', undefined, T2);
  assert.equal((await call('GET', '/me', undefined, T2)).status, 401);
  const s6 = await ok('POST', '/sync', {}, T1);
  const g2now = s6.groups.find((g: any) => g.id === 'g2');
  assert.equal(g2now.ownerId, sasha.me.id, 'группа перешла Саше');
  assert.equal((await call('POST', '/auth/login', { email: 'masha@example.ru', password: 'new-secret-456' })).status, 401);
  await ops(T1, { op: 'group.leave', id: 'g2' });
  assert.equal(await store.getGroup('g2'), null, 'пустая группа удалена');
  assert.equal(await store.getKey(`invite#${g2.inviteCode}`), null);

  await app.close();
  console.log(`✓ ${name}: все проверки пройдены`);
}

await scenario('память', new MemoryStore());
const fake = await startFakeDocApi();
const ydb = new YdbStore({ endpoint: fake.url, accessKeyId: 'test', secretAccessKey: 'test' });
await ydb.ensureTables(() => {});
await scenario('YDB (поддельный Document API)', ydb);
fake.server.close();
console.log(`  операций Document API: ${fake.calls.length} (${[...new Set(fake.calls)].join(', ')})`);

/* ---------- VK ID: куда сервер может вернуть билет ---------- */
// Схему exp+… (dev-клиент Expo) может объявить любое приложение, поэтому в продакшене — только схема приложения
{
  const saved = { isProd: config.isProd, vkClientId: config.vkClientId };
  config.vkClientId ||= 'test-vk';
  const app = await buildApp({ store: new MemoryStore() });
  // PKCE и state приложения передаём на случай, если /auth/vk/start их требует; иначе они игнорируются
  const start = async (redirect: string) => {
    const q = new URLSearchParams({ redirect, code_challenge: 'A'.repeat(43), code_challenge_method: 'S256', state: 'B'.repeat(22) });
    const r = await app.inject({ method: 'GET', url: `/auth/vk/start?${q}` });
    return r.statusCode === 400 ? JSON.parse(r.body).error : r.statusCode;
  };
  const own = `${config.appScheme}://auth`;
  try {
    for (const isProd of [false, true]) {
      config.isProd = isProd;
      assert.equal(await start(own), 302, `схема приложения, isProd=${isProd}`);
      assert.equal(await start(`${config.appScheme}evil://auth`), 'bad_redirect', `похожая схема, isProd=${isProd}`);
      assert.equal(await start('https://evil.example/'), 'bad_redirect', `чужой сайт, isProd=${isProd}`);
    }
    config.isProd = false;
    assert.equal(await start('exp+want-watch-plans://auth'), 302, 'dev-клиент Expo вне продакшена');
    config.isProd = true;
    assert.equal(await start('exp+want-watch-plans://auth'), 'bad_redirect', 'в продакшене exp+… не принимается');
    assert.equal(await start('exp+evil://x'), 'bad_redirect', 'в продакшене exp+… не принимается');
  } finally {
    Object.assign(config, saved);
    await app.close();
  }
  console.log('✓ VK ID: адрес возврата проверяется');
}
