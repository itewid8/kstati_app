/** Страница удаления аккаунта (src/pages.ts): отдаётся, а её запросы — вход и DELETE /me — работают без тела */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

const app = await buildApp({ store: new MemoryStore() });
const page = await app.inject({ method: 'GET', url: '/delete-account' });
assert.equal(page.statusCode, 200);
assert.match(String(page.headers['content-type']), /text\/html/);
assert.match(page.body, /Удалить аккаунт навсегда/);

const email = 'del@example.com';
const code = (await app.inject({ method: 'POST', url: '/auth/email/code', payload: { email, purpose: 'register' } })).json().devCode;
await app.inject({ method: 'POST', url: '/auth/register', payload: { email, code, name: 'Тест', password: 'secret-123' } });
const { token } = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'secret-123' } })).json();
// Как на странице: без тела и без content-type
const del = await app.inject({ method: 'DELETE', url: '/me', headers: { 'x-kstati-token': token } });
assert.equal(del.statusCode, 200, del.body);
const again = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'secret-123' } });
assert.equal(again.statusCode, 401);
console.log('✓ страница удаления аккаунта: отдаётся, вход и удаление работают');
await app.close();

/* ---------- CORS для веб-версии ---------- */
{
  const app2 = await buildApp({ store: new MemoryStore() });
  const pre = await app2.inject({ method: 'OPTIONS', url: '/auth/login', headers: { origin: 'https://app.kstati-app.ru', 'access-control-request-method': 'POST' } });
  assert.equal(pre.statusCode, 204);
  assert.equal(pre.headers['access-control-allow-origin'], 'https://app.kstati-app.ru');
  assert.match(String(pre.headers['access-control-allow-headers']), /x-kstati-token/);
  const evil = await app2.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
  console.log('✓ CORS: веб-версии можно, чужим сайтам нельзя');
  await app2.close();
}
