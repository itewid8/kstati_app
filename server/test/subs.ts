/** Подписки вручную (src/subs.ts): выдаёт только администратор, лимит голоса от подписки, срок, отзыв */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { hashPassword, signToken } from '../src/auth.js';
import { config } from '../src/config.js';
import { MemoryStore } from '../src/store/memory.js';
import { hasPlan, mskDay } from '../src/subs.js';

config.adminEmails = ['admin@kstati.ru'];
config.voiceDailyLimit = 3;
config.paidDailyLimit = 50;
const store = new MemoryStore();
const add = async (id: string, email: string, name: string) => {
  await store.putUser({ id, email, name, passHash: await hashPassword('secret-123'), createdAt: new Date().toISOString() });
  await store.claimKey(`email#${email}`, id);
  return signToken(id);
};
const APP = await add('a1', 'admin@kstati.ru', 'Саша');
const M = await add('m1', 'mama@kstati.ru', 'Мама');
const F = await add('f1', 'friend@kstati.ru', 'Друг');

const app = await buildApp({ store });
const call = async (method: string, url: string, body?: unknown, token?: string) => {
  const r = await app.inject({ method: method as any, url, payload: body as any, headers: token ? { 'x-kstati-token': token } : {} });
  return { status: r.statusCode, json: r.body ? JSON.parse(r.body) : null };
};

// Страница отдаётся; без входа и не администратору — нельзя
const page = await app.inject({ method: 'GET', url: '/admin' });
assert.equal(page.statusCode, 200);
assert.match(page.body, /Подписки/);
assert.equal((await call('GET', '/admin/subs')).status, 401);
assert.equal((await call('GET', '/admin/subs', undefined, M)).status, 401, 'токен приложения не подходит');
assert.equal((await call('POST', '/admin/subs', { email: 'friend@kstati.ru', until: null }, M)).status, 401, 'токен приложения не подходит');
assert.equal((await call('GET', '/admin/subs', undefined, APP)).status, 401, 'даже токен приложения администратора');

// Вход на страницу: только паролем и только администратору; токен — на час
assert.equal((await call('POST', '/admin/login', { email: 'mama@kstati.ru', password: 'secret-123' })).status, 403);
assert.equal((await call('POST', '/admin/login', { email: 'admin@kstati.ru', password: 'wrong' })).status, 401);
const login = await call('POST', '/admin/login', { email: 'Admin@Kstati.ru', password: 'secret-123' });
assert.equal(login.status, 200);
const A: string = login.json.token;
const exp = JSON.parse(Buffer.from(A.split('.')[1], 'base64url').toString()).exp;
assert.ok(exp - Date.now() / 1000 <= 3600, 'токен страницы — на час');
assert.equal((await call('GET', '/admin/subs', undefined, signToken('m1', 'admin'))).status, 403, 'токен страницы не администратора');

// Без подписки — бесплатный лимит
assert.deepEqual((await call('GET', '/voice/quota', undefined, M)).json, { limit: 3, used: 0, left: 3 });
assert.equal((await call('POST', '/sync', {}, M)).json.me.plan, null);

// Выдать бессрочно — лимит подписки, приложение видит plan
const g = await call('POST', '/admin/subs', { email: ' Mama@Kstati.ru ', until: null, note: 'мама' }, A);
assert.equal(g.status, 200);
assert.deepEqual([g.json.sub.name, g.json.sub.until, g.json.sub.active, g.json.sub.note], ['Мама', null, true, 'мама']);
assert.deepEqual((await call('GET', '/voice/quota', undefined, M)).json, { limit: 50, used: 0, left: 50 });
assert.deepEqual((await call('POST', '/sync', {}, M)).json.me.plan, { until: null });

// Нет такого аккаунта — 404; неверная дата — 400
assert.equal((await call('POST', '/admin/subs', { email: 'nobody@kstati.ru', until: null }, A)).status, 404);
assert.equal((await call('POST', '/admin/subs', { email: 'friend@kstati.ru', until: '01.12.2026' }, A)).status, 400);

// До даты: сегодня включительно — действует; вчера — истекла, но остаётся в списке (можно продлить)
await call('POST', '/admin/subs', { email: 'friend@kstati.ru', until: mskDay() }, A);
assert.equal((await call('GET', '/voice/quota', undefined, F)).json.limit, 50);
const yesterday = new Date(Date.now() + 3 * 3600_000 - 86400_000).toISOString().slice(0, 10);
await call('POST', '/admin/subs', { email: 'friend@kstati.ru', until: yesterday }, A);
assert.equal((await call('GET', '/voice/quota', undefined, F)).json.limit, 3, 'истекла — снова бесплатный лимит');
const list = (await call('GET', '/admin/subs', undefined, A)).json.subs;
assert.deepEqual(list.map((s: any) => [s.name, s.active]), [['Друг', false], ['Мама', true]]);
assert.ok(hasPlan({ id: 'x', name: '', createdAt: '', plan: { until: '2026-12-31', grantedAt: '' } }, '2026-12-31'));
assert.ok(!hasPlan({ id: 'x', name: '', createdAt: '', plan: { until: '2026-12-31', grantedAt: '' } }, '2027-01-01'));

// Забрать — лимит бесплатный, из списка пропал
assert.equal((await call('DELETE', '/admin/subs/m1', undefined, A)).status, 200);
assert.deepEqual((await call('GET', '/voice/quota', undefined, M)).json, { limit: 3, used: 0, left: 3 });
assert.deepEqual((await call('GET', '/admin/subs', undefined, A)).json.subs.map((s: any) => s.name), ['Друг']);
assert.equal((await call('DELETE', '/admin/subs/m1', undefined, signToken('m1', 'admin'))).status, 403);

console.log('✓ подписки вручную: только администратор, лимит, срок, отзыв');
