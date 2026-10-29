/**
 * Личный календарь (API 3): видимость дел в группах, режимы, права, перенос старых дел, вид для старого приложения.
 *   npm test
 */
import assert from 'node:assert/strict';
import { Data } from '../src/api.js';
import { MemoryStore } from '../src/store/memory.js';
import type { Group, Task, User } from '../src/store/types.js';
import { PERSONAL, visibleIn } from '../src/visibility.js';

/* ---------- правило видимости ---------- */
const G = (id: string, memberIds: string[], selectOnly?: string[]) => ({ id, memberIds, selectOnly });
const fam = G('fam', ['s', 'k']);
const fr = G('fr', ['s', 'p'], ['s']);
assert.equal(visibleIn({ createdBy: 's' }, fam), true, 'режим «Все» — видно');
assert.equal(visibleIn({ createdBy: 's' }, fr), false, '«Только выбранные» — не видно без отметки');
assert.equal(visibleIn({ createdBy: 's', share: { fr: true } }, fr), true, 'отмечено для группы');
assert.equal(visibleIn({ createdBy: 's', share: { fam: false } }, fam), false, 'скрыто от группы');
assert.equal(visibleIn({ createdBy: 's', only: true, share: { fam: true } }, fam), false, '«Только я» сильнее отметок');
assert.equal(visibleIn({ createdBy: 'x' }, fam), false, 'владелец не в группе — не видно');

/* ---------- сценарий ---------- */
const store = new MemoryStore();
const data = new Data(store);
const now = new Date().toISOString();
const user = (id: string, name: string): User => ({ id, name, createdAt: now });
const S = user('s', 'Саня');
const K = user('k', 'Карина');
const P = user('p', 'Петя');
for (const u of [S, K, P]) await store.putUser(u);
const group = async (id: string, owner: User, members: User[], adminIds: string[] = []) => {
  const g: Group = { id, name: id, category: 'family', inviteCode: id.toUpperCase(), ownerId: owner.id, adminIds, memberIds: members.map((m) => m.id), createdAt: now };
  await store.putGroup(g);
  for (const m of members) await store.addMembership(m.id, id);
};
await group('fam', S, [S, K]);
await group('fr', P, [S, P]);

// Старое дело Сани в группе «Семья» (до личного календаря) — лежит в разделе группы
await store.putItem({ type: 'task', id: 'old1', groupId: 'fam', title: 'Старое', date: '2026-10-30', time: null, createdBy: 's', doneAt: null, createdAt: now, updatedAt: now });

const sync = (u: User, api = 3, groups: Record<string, number> = {}) => data.sync(u, { groups, owners: {} }, api) as Promise<any>;
const ids = (r: any) => (r.tasks as Task[]).map((t) => t.id).sort();
const put = (u: User, task: Record<string, unknown>, api = 3) =>
  data.apply(u, { op: 'task.put', task: { date: '2026-10-31', time: null, doneAt: null, ...task } as any }, api);

// Перенос: старое дело теперь в личном календаре Сани, видно только «Семье» (в «Друзьях» — скрыто, хотя режим «Все»)
let rs = await sync(S);
assert.deepEqual(ids(rs), ['old1']);
assert.deepEqual(rs.tasks[0].in, ['fam'], 'старое дело — только своей группе');
assert.equal(rs.tasks[0].groupId, 'fam', 'где создано');
assert.equal(rs.revs.groups[PERSONAL], 1, 'ревизия личного календаря');
assert.deepEqual(ids(await sync(P)), [], 'Петя (Друзья) старое семейное дело не видит');
assert.deepEqual(ids(await sync(K)), ['old1']);
assert.equal(await store.getItem('fam', 'old1'), null, 'из раздела группы убрано');

// Новое личное дело: режим «Все» в обеих группах — видно обеим
await put(S, { id: 't1', groupId: PERSONAL, title: 'Футбол' });
assert.deepEqual(ids(await sync(P)), ['t1']);
assert.deepEqual(ids(await sync(K)), ['old1', 't1']);
// «Только я»
await put(S, { id: 't2', groupId: PERSONAL, title: 'Психолог', only: true });
assert.deepEqual(ids(await sync(K)), ['old1', 't1'], 'личное дело никому не видно');
rs = await sync(S);
assert.deepEqual(ids(rs), ['old1', 't1', 't2'], 'владелец видит все свои');
assert.equal(rs.tasks.find((t: any) => t.id === 't2').only, true);
// Скрыть от «Семьи»
await put(S, { id: 't3', groupId: PERSONAL, title: 'Подарок Карине', share: { fam: false } });
assert.ok(!ids(await sync(K)).includes('t3'), 'Карина подарок не видит');
assert.ok(ids(await sync(P)).includes('t3'), 'Петя видит');
const kView = (await sync(K)).tasks.find((t: any) => t.id === 't1');
assert.equal(kView.share, undefined, 'чужим отметки видимости не отдаются');
assert.equal(kView.only, undefined);
assert.deepEqual(kView.in, ['fam']);

// Режим «Только выбранные» в «Друзьях»: Петя видит только отмеченное
await data.apply(S, { op: 'group.mode', id: 'fr', selectOnly: true });
assert.deepEqual(ids(await sync(P)), [], 'ничего не отмечено');
await put(S, { id: 't1', groupId: PERSONAL, title: 'Футбол', share: { fr: true } });
assert.deepEqual(ids(await sync(P)), ['t1']);
// Создано в группе — видно ей, даже при «Только выбранные»
await put(S, { id: 't4', groupId: 'fr', title: 'Шашлыки' });
assert.deepEqual(ids(await sync(P)), ['t1', 't4']);
assert.equal((await sync(S)).tasks.find((t: any) => t.id === 't4').share.fr, true);
// Чужую группу в отметках сервер не принимает
await put(S, { id: 't5', groupId: PERSONAL, title: 'Тест', share: { xxx: true } });
assert.equal((await sync(S)).tasks.find((t: any) => t.id === 't5').share, undefined);

// Ревизии: правка дела Сани меняет ревизии его групп — Карина узнаёт без лишних запросов
const before = (await sync(K)).revs.groups;
assert.equal((await sync(K, 3, before)).tasks, undefined, 'ничего не менялось — дел не шлём');
await put(S, { id: 't1', groupId: PERSONAL, title: 'Футбол в 18', share: { fr: true } });
assert.ok((await sync(K, 3, before)).tasks, 'поменялось — шлём');

/* ---------- права ---------- */
// Карина (не админ «Семьи») может только отметить «сделано»
await put(K, { id: 't1', ownerId: 's', groupId: 'fam', title: 'Переименовала', doneAt: now });
let t1 = (await sync(S)).tasks.find((t: any) => t.id === 't1');
assert.equal(t1.title, 'Футбол в 18', 'название не поменялось');
assert.equal(t1.doneAt, now, 'отметка прошла');
await assert.rejects(data.apply(K, { op: 'item.delete', groupId: 'fam', id: 't1', ownerId: 's' }), /Удалить дело могут/);
// Петя — создатель «Друзей», значит админ: может править дело, видное группе
await put(P, { id: 't1', ownerId: 's', groupId: 'fr', title: 'Футбол (Петя)', share: {} , only: true });
t1 = (await sync(S)).tasks.find((t: any) => t.id === 't1');
assert.equal(t1.title, 'Футбол (Петя)');
assert.equal(t1.only, undefined, 'видимость админ не меняет');
assert.equal(t1.share.fr, true);
// Дело, которое группе не видно, админ не тронет
await assert.rejects(put(P, { id: 't2', ownerId: 's', groupId: 'fr', title: 'x' }), /Нет доступа/);
// Создать дело «за другого» нельзя
await assert.rejects(put(K, { id: 'n1', ownerId: 's', groupId: 'fam', title: 'x' }), /Дело не найдено/);
// Админ удаляет
await data.apply(P, { op: 'item.delete', groupId: 'fr', id: 't4', ownerId: 's' });
assert.ok(!ids(await sync(S)).includes('t4'));

/* ---------- старое приложение (API 1) ---------- */
const v1 = await sync(K, 1);
assert.equal(v1.tasks, undefined, 'общего списка нет');
assert.equal(v1.revs.groups[PERSONAL], undefined, '«@me» ему не нужен');
assert.deepEqual(v1.items.fam.map((t: any) => t.id).sort(), ['old1', 't1', 't5'], 'дела — в группе');
assert.ok(v1.items.fam.every((t: any) => t.groupId === 'fam' && t.share === undefined && t.in === undefined));
// Каждое дело — в одной группе: у Сани t1 видно обеим, а в старом приложении — один раз
const v1s = await sync(S, 1);
const all = Object.values(v1s.items).flat().map((t: any) => t.id);
assert.equal(all.filter((id) => id === 't1').length, 1);
assert.ok(!all.includes('t2'), 'личное старое приложение не видит');
// Старое приложение создаёт дело в группе — видно только ей
await put(S, { id: 'v1a', groupId: 'fam', title: 'Из старого' }, 1);
assert.ok(ids(await sync(K)).includes('v1a'));
assert.ok(!ids(await sync(P)).includes('v1a'), 'в «Друзьях» скрыто');
// Старое приложение правит чужое дело без ownerId — находим по группе
await put(K, { id: 'v1a', groupId: 'fam', title: 'v1a', doneAt: now }, 1);
assert.equal((await sync(S)).tasks.find((t: any) => t.id === 'v1a').doneAt, now);

/* ---------- выход из группы ---------- */
await data.apply(S, { op: 'group.leave', id: 'fam' });
assert.deepEqual(ids(await sync(K)), [], 'дела ушедшего пропали из группы');
assert.ok(ids(await sync(S)).includes('old1'), 'у владельца остались');

/* ---------- тип дела ---------- */
await put(S, { id: 'bd1', groupId: PERSONAL, title: 'ДР Маши', kind: 'birthday', repeat: { freq: 'year', every: 1 } });
const bd = (await sync(S)).tasks.find((t: Task) => t.id === 'bd1');
assert.equal(bd.kind, 'birthday');
await put(S, { id: 'bd1', groupId: PERSONAL, title: 'ДР Маши (старое приложение)' });
assert.equal((await sync(S)).tasks.find((t: Task) => t.id === 'bd1').kind, 'birthday', 'без поля тип не стирается');
await put(S, { id: 'bd1', groupId: PERSONAL, title: 'ДР Маши', kind: 'task' });
assert.equal((await sync(S)).tasks.find((t: Task) => t.id === 'bd1').kind, undefined, 'обычное дело — поля нет');

/* ---------- именинник ---------- */
const bd2 = async () => (await sync(S)).tasks.find((t: Task) => t.id === 'bd2');
await put(S, { id: 'bd2', groupId: PERSONAL, title: 'ДР Пети', kind: 'birthday', celebrant: { name: 'Петя' } });
assert.deepEqual((await bd2()).celebrant, { name: 'Петя' });
await put(S, { id: 'bd2', groupId: PERSONAL, title: 'ДР Пети' });
assert.deepEqual((await bd2()).celebrant, { name: 'Петя' }, 'без поля именинник не стирается');
await put(S, { id: 'bd2', groupId: PERSONAL, title: 'ДР', kind: 'birthday', celebrant: { id: 'чужой', name: 'Чужой' } });
assert.deepEqual((await bd2()).celebrant, { name: 'Чужой' }, 'id не из круга — только имя');
await put(S, { id: 'bd2', groupId: PERSONAL, title: 'ДР', kind: 'important' });
assert.equal((await bd2()).celebrant, undefined, 'не день рождения — без именинника');

console.log('✓ личный календарь: видимость, режимы, права, перенос, старое приложение, тип дела');
