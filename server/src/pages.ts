/**
 * Веб-страницы сервера. /delete-account — удаление аккаунта без приложения (требование Google Play):
 * вход по почте и паролю (или сброс пароля кодом из письма) → подтверждение → DELETE /me.
 * Отдаётся сервером (адрес API) и копируется при выкладке сайта на kstati-app.ru/delete-account: там API — другой
 * адрес (var API подставляет выкладка), сервер разрешает его по CORS. Токен — в X-Kstati-Token, как у приложения.
 */
import type { FastifyInstance } from 'fastify';

const PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Удаление аккаунта · Кстати</title>
<style>
:root { --bg:#E7E6E1; --panel:#F4F3EF; --ink:#111; --muted:#5E5E58; --line:#161616; --red:#C8231A; color-scheme: light }
@media (prefers-color-scheme: dark) { :root { --bg:#151515; --panel:#1E1E1E; --ink:#F2F2F0; --muted:#9A9A95; --line:#E8E8E4; --red:#FF6B61; color-scheme: dark } }
* { box-sizing: border-box }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif }
main { max-width:440px; margin:0 auto; padding:40px 16px 64px; display:flex; flex-direction:column; gap:16px }
.cap { font:600 10px/1 ui-monospace,Menlo,monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--muted) }
h1 { font-size:30px; line-height:1.1; letter-spacing:-.03em; margin:4px 0 0 }
p { margin:0 }
.box { border:1.5px solid var(--line); background:var(--panel); padding:16px; display:flex; flex-direction:column; gap:12px }
label { display:flex; flex-direction:column; gap:6px }
input { font:inherit; color:var(--ink); background:var(--bg); border:1.5px solid var(--line); padding:10px 12px; border-radius:0; width:100% }
button { font:600 11px/1 ui-monospace,Menlo,monospace; letter-spacing:.08em; text-transform:uppercase; height:44px; border:1.5px solid var(--line); background:var(--ink); color:var(--bg); cursor:pointer }
button.ghost { background:transparent; color:var(--ink) }
button.danger { background:var(--red); border-color:var(--red); color:#fff }
button:disabled { opacity:.5; cursor:default }
button:focus-visible, input:focus-visible { outline:2px solid #2F6BDB; outline-offset:2px }
.err { color:var(--red); min-height:1.2em }
ul { margin:0; padding-left:18px }
.link { background:none; border:0; color:var(--muted); height:auto; padding:0; text-decoration:underline; text-transform:none; letter-spacing:0; font:inherit; text-align:left }
[hidden] { display:none !important }
</style>
</head>
<body>
<main>
  <div><div class="cap">Кстати</div><h1>Удаление аккаунта</h1></div>
  <p>Удалить аккаунт можно и в приложении: Профиль → Удалить аккаунт. Если приложения уже нет, войдите здесь.</p>

  <form id="login" class="box">
    <label><span class="cap">Почта</span><input id="email" type="email" autocomplete="email" required></label>
    <label><span class="cap">Пароль</span><input id="password" type="password" autocomplete="current-password" required></label>
    <div class="err" id="loginErr" role="alert"></div>
    <button type="submit">Войти</button>
    <button type="button" class="link" id="toReset">Не помню пароль</button>
  </form>

  <form id="reset" class="box" hidden>
    <p>Пришлём код на почту. С ним можно задать новый пароль и войти.</p>
    <label><span class="cap">Почта</span><input id="rEmail" type="email" autocomplete="email" required></label>
    <button type="button" class="ghost" id="sendCode">Прислать код</button>
    <label><span class="cap">Код из письма</span><input id="rCode" inputmode="numeric" autocomplete="one-time-code"></label>
    <label><span class="cap">Новый пароль</span><input id="rPass" type="password" autocomplete="new-password"></label>
    <div class="err" id="resetErr" role="alert"></div>
    <button type="submit">Войти</button>
    <button type="button" class="link" id="toLogin">Вспомнил пароль</button>
  </form>

  <div id="confirm" class="box" hidden>
    <p><b id="who"></b>, после удаления:</p>
    <ul>
      <li>вы выйдете из всех групп, ваши дела в группах удалятся;</li>
      <li>ваши хотелки, заметки и настройки будут стёрты;</li>
      <li>вернуть аккаунт будет нельзя.</li>
    </ul>
    <div class="err" id="delErr" role="alert"></div>
    <button type="button" class="danger" id="del">Удалить аккаунт навсегда</button>
    <button type="button" class="ghost" id="cancel">Отмена</button>
  </div>

  <div id="done" class="box" hidden>
    <p><b>Аккаунт удалён.</b> Данные стёрты с сервера. Приложение на телефоне можно удалить.</p>
  </div>
</main>
<script>
(function () {
  var API = '';
  var token = null;
  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { ['login', 'reset', 'confirm', 'done'].forEach(function (x) { $(x).hidden = x !== id; }); };
  function call(method, path, body) {
    var h = body ? { 'content-type': 'application/json' } : {};
    if (token) h['x-kstati-token'] = token;
    return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.message || (r.status === 401 ? 'Неверная почта или пароль' : 'Не получилось, попробуйте ещё раз'));
        return j;
      });
    }, function () { throw new Error('Нет связи с сервером'); });
  }
  function signedIn(j) { token = j.token; $('who').textContent = (j.me && (j.me.name || j.me.email)) || 'Аккаунт'; show('confirm'); }
  function busy(btn, on) { btn.disabled = on; }
  $('login').addEventListener('submit', function (e) {
    e.preventDefault(); var b = e.submitter || this.querySelector('button[type=submit]'); busy(b, true); $('loginErr').textContent = '';
    call('POST', '/auth/login', { email: $('email').value.trim().toLowerCase(), password: $('password').value })
      .then(signedIn, function (err) { $('loginErr').textContent = err.message; }).then(function () { busy(b, false); });
  });
  $('toReset').addEventListener('click', function () { $('rEmail').value = $('email').value; show('reset'); });
  $('toLogin').addEventListener('click', function () { show('login'); });
  $('sendCode').addEventListener('click', function () {
    var b = this; busy(b, true); $('resetErr').textContent = '';
    call('POST', '/auth/email/code', { email: $('rEmail').value.trim().toLowerCase(), purpose: 'reset' })
      .then(function () { $('resetErr').textContent = 'Если такой адрес есть, код уже в почте'; }, function (err) { $('resetErr').textContent = err.message; })
      .then(function () { busy(b, false); });
  });
  $('reset').addEventListener('submit', function (e) {
    e.preventDefault(); var b = e.submitter || this.querySelector('button[type=submit]'); busy(b, true); $('resetErr').textContent = '';
    call('POST', '/auth/reset', { email: $('rEmail').value.trim().toLowerCase(), code: $('rCode').value.trim(), password: $('rPass').value })
      .then(signedIn, function (err) { $('resetErr').textContent = err.message; }).then(function () { busy(b, false); });
  });
  $('cancel').addEventListener('click', function () { token = null; show('login'); });
  $('del').addEventListener('click', function () {
    var b = this; busy(b, true); $('delErr').textContent = '';
    call('DELETE', '/me').then(function () { token = null; show('done'); }, function (err) { $('delErr').textContent = err.message; busy(b, false); });
  });
})();
</script>
</body>
</html>`;

export function registerPages(app: FastifyInstance) {
  app.get('/delete-account', async (_req, reply) => reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(PAGE));
}
