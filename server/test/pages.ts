/** Страница удаления аккаунта (src/pages.ts): отдаётся, а её запросы — вход и DELETE /me — работают без тела */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

const app = await buildApp({ store: new MemoryStore() });
const privacy = await app.inject({ method: 'GET', url: '/privacy' });
assert.equal(privacy.statusCode, 200);
assert.match(String(privacy.headers['content-type']), /text\/html/);
assert.match(privacy.body, /Политика конфиденциальности/);
assert.match(privacy.body, /support@kstati-app\.ru/);
assert.ok(!/github/i.test(privacy.body), 'данные за границу не уходят');
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

/* ---------- лимит входа: адрес из X-Forwarded-For не подделать ---------- */
{
  const app3 = await buildApp({ store: new MemoryStore() });
  const codes: number[] = [];
  for (let i = 0; i < 25; i++) {
    // Клиент подставляет новый адрес в начало заголовка — платформа дописывает настоящий в конец
    const r = await app3.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'x@example.com', password: 'wrong-pass' },
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': `1.2.3.${i}, 5.6.7.8` },
    });
    codes.push(r.statusCode);
  }
  assert.ok(codes.includes(429), 'подставные адреса лимит не обходят');
  assert.equal(codes.indexOf(429), 10, 'после 10 неудачных попыток почта блокируется');
  console.log('✓ лимит входа: X-Forwarded-For не подделать, попытки считаются атомарно');
  await app3.close();
}

/* ---------- смена пароля: прежние входы больше не действуют ---------- */
{
  const app4 = await buildApp({ store: new MemoryStore() });
  const email = 'pw@example.com';
  const code = (await app4.inject({ method: 'POST', url: '/auth/email/code', payload: { email, purpose: 'register' } })).json().devCode;
  const { token: phone } = (await app4.inject({ method: 'POST', url: '/auth/register', payload: { email, code, name: 'Тест', password: 'secret-123' } })).json();
  const me = (t: string) => app4.inject({ method: 'GET', url: '/me', headers: { 'x-kstati-token': t } });
  assert.equal((await me(phone)).statusCode, 200);
  // Токен, выданный раньше смены пароля (секундой раньше)
  const stolen = (await import('../src/auth.js')).signToken((await me(phone)).json().id);
  await new Promise((r) => setTimeout(r, 1100));
  const ch = await app4.inject({ method: 'POST', url: '/me/password', headers: { 'x-kstati-token': phone }, payload: { old: 'secret-123', password: 'secret-456' } });
  assert.equal(ch.statusCode, 200, ch.body);
  assert.equal((await me(stolen)).statusCode, 401, 'старый токен не действует');
  assert.equal((await me(phone)).statusCode, 401);
  assert.equal((await me(ch.json().token)).statusCode, 200, 'новый токен из ответа — действует');
  // Коды: больше 5 попыток не дают даже параллельно
  await app4.inject({ method: 'POST', url: '/auth/email/code', payload: { email, purpose: 'reset' } });
  const tries = await Promise.all(
    Array.from({ length: 8 }, () => app4.inject({ method: 'POST', url: '/auth/reset', payload: { email, code: '000000', password: 'secret-789' } })),
  );
  assert.equal(tries.filter((r) => r.json().error === 'code_wrong').length <= 5, true, 'не больше 5 проверок кода');
  console.log('✓ смена пароля отзывает прежние входы; попытки кода ограничены');
  await app4.close();
}
