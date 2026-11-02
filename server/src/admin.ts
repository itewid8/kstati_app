/**
 * Страница /admin: выдача подписок вручную (src/subs.ts). Вход почтой и паролем администратора (ADMIN_EMAILS).
 * Как /delete-account: отдаётся сервером и копируется при выкладке сайта на kstati-app.ru/admin (var API подставляет выкладка).
 */
export const ADMIN_PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Подписки · Кстати</title>
<style>
:root { --bg:#E7E6E1; --panel:#F4F3EF; --ink:#111; --muted:#5E5E58; --line:#161616; --red:#C8231A; --green:#1F7A3A; color-scheme: light }
@media (prefers-color-scheme: dark) { :root { --bg:#151515; --panel:#1E1E1E; --ink:#F2F2F0; --muted:#9A9A95; --line:#E8E8E4; --red:#FF6B61; --green:#5BD282; color-scheme: dark } }
* { box-sizing: border-box }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif }
main { max-width:560px; margin:0 auto; padding:40px 16px 64px; display:flex; flex-direction:column; gap:16px }
.cap { font:600 10px/1 ui-monospace,Menlo,monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--muted) }
h1 { font-size:30px; line-height:1.1; letter-spacing:-.03em; margin:4px 0 0 }
p { margin:0 }
.box { border:1.5px solid var(--line); background:var(--panel); padding:16px; display:flex; flex-direction:column; gap:12px }
label { display:flex; flex-direction:column; gap:6px }
input, select { font:inherit; color:var(--ink); background:var(--bg); border:1.5px solid var(--line); padding:0 12px; height:44px; border-radius:0; width:100% }
.row { display:flex; gap:8px }
.row > * { flex:1; min-width:0 }
button { font:600 11px/1 ui-monospace,Menlo,monospace; letter-spacing:.08em; text-transform:uppercase; height:44px; border:1.5px solid var(--line); background:var(--ink); color:var(--bg); cursor:pointer; padding:0 12px }
button.ghost { background:transparent; color:var(--ink) }
button.small { height:32px; font-size:10px }
button:disabled { opacity:.5; cursor:default }
button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid #2F6BDB; outline-offset:2px }
.err { color:var(--red); min-height:1.2em }
.ok { color:var(--green) }
ul.subs { list-style:none; margin:0; padding:0; display:flex; flex-direction:column }
ul.subs li { display:flex; gap:12px; align-items:center; padding:12px 0; border-top:1px solid color-mix(in srgb, var(--line) 25%, transparent) }
ul.subs li:first-child { border-top:0 }
.who { flex:1; min-width:0 }
.who b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.who span { color:var(--muted); font-size:13px; overflow-wrap:anywhere }
.state { font:600 10px/1.3 ui-monospace,Menlo,monospace; letter-spacing:.06em; text-transform:uppercase; text-align:right; white-space:nowrap }
.state.off { color:var(--red) }
.acts { display:flex; flex-direction:column; gap:6px }
[hidden] { display:none !important }
</style>
</head>
<body>
<main>
  <div><div class="cap">Кстати</div><h1>Подписки</h1></div>

  <form id="login" class="box">
    <label><span class="cap">Почта</span><input id="email" type="email" autocomplete="email" required></label>
    <label><span class="cap">Пароль</span><input id="password" type="password" autocomplete="current-password" required></label>
    <div class="err" id="loginErr" role="alert"></div>
    <button type="submit">Войти</button>
  </form>

  <form id="grant" class="box" hidden>
    <label><span class="cap">Почта аккаунта</span><input id="gEmail" type="email" required></label>
    <div class="row">
      <label><span class="cap">Срок</span>
        <select id="gTerm">
          <option value="forever">Бессрочно</option>
          <option value="1m">Месяц</option>
          <option value="3m">3 месяца</option>
          <option value="1y">Год</option>
          <option value="date">До даты</option>
        </select>
      </label>
      <label id="gDateBox" hidden><span class="cap">До (включительно)</span><input id="gDate" type="date"></label>
    </div>
    <label><span class="cap">Заметка</span><input id="gNote" maxlength="200"></label>
    <div class="err" id="grantErr" role="alert"></div>
    <button type="submit">Выдать</button>
  </form>

  <div id="list" class="box" hidden>
    <div class="cap" id="count">Выдано</div>
    <ul class="subs" id="subs"></ul>
    <button type="button" class="ghost" id="logout">Выйти</button>
  </div>
</main>
<script>
(function () {
  var API = '';
  var token = null;
  try { token = sessionStorage.getItem('kstati-admin'); } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  function call(method, path, body) {
    var h = body ? { 'content-type': 'application/json' } : {};
    if (token) h['x-kstati-token'] = token;
    return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && token) { signOut(); }
        if (!r.ok) throw new Error(j.message || (r.status === 401 ? 'Неверная почта или пароль' : r.status === 403 ? 'Нет доступа' : 'Не получилось, попробуйте ещё раз'));
        return j;
      });
    }, function () { throw new Error('Нет связи с сервером'); });
  }
  function signOut() { token = null; try { sessionStorage.removeItem('kstati-admin'); } catch (e) {} $('login').hidden = false; $('grant').hidden = true; $('list').hidden = true; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ru(isoDay) { var p = isoDay.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function untilOf(term) {
    if (term === 'forever') return null;
    if (term === 'date') return $('gDate').value || '';
    var d = new Date();
    if (term === '1m') d.setMonth(d.getMonth() + 1);
    if (term === '3m') d.setMonth(d.getMonth() + 3);
    if (term === '1y') d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  function render(subs) {
    var ul = $('subs'); ul.textContent = '';
    $('count').textContent = subs.length ? 'Выдано: ' + subs.length : 'Пока никому не выдано';
    subs.forEach(function (s) {
      var li = document.createElement('li');
      var who = document.createElement('div'); who.className = 'who';
      var b = document.createElement('b'); b.textContent = s.name || s.email || s.id;
      var sp = document.createElement('span'); sp.textContent = (s.email || '') + (s.note ? ' · ' + s.note : '');
      who.appendChild(b); who.appendChild(sp);
      var st = document.createElement('div'); st.className = 'state' + (s.active ? '' : ' off');
      st.textContent = s.until === null ? 'Бессрочно' : (s.active ? 'до ' : 'истекла ') + ru(s.until);
      var acts = document.createElement('div'); acts.className = 'acts';
      var ext = document.createElement('button'); ext.type = 'button'; ext.className = 'ghost small'; ext.textContent = 'Изменить';
      ext.addEventListener('click', function () { $('gEmail').value = s.email || ''; $('gNote').value = s.note || ''; $('gEmail').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      var del = document.createElement('button'); del.type = 'button'; del.className = 'ghost small'; del.textContent = 'Забрать';
      del.addEventListener('click', function () {
        if (!confirm('Забрать подписку у ' + (s.name || s.email) + '?')) return;
        del.disabled = true;
        call('DELETE', '/admin/subs/' + encodeURIComponent(s.id)).then(load, function (err) { alert(err.message); del.disabled = false; });
      });
      if (s.email) acts.appendChild(ext);
      acts.appendChild(del);
      li.appendChild(who); li.appendChild(st); li.appendChild(acts);
      ul.appendChild(li);
    });
  }
  function load() {
    return call('GET', '/admin/subs').then(function (j) {
      $('login').hidden = true; $('grant').hidden = false; $('list').hidden = false; render(j.subs || []);
    });
  }
  $('login').addEventListener('submit', function (e) {
    e.preventDefault(); var b = this.querySelector('button[type=submit]'); b.disabled = true; $('loginErr').textContent = '';
    call('POST', '/admin/login', { email: $('email').value.trim().toLowerCase(), password: $('password').value })
      .then(function (j) { token = j.token; try { sessionStorage.setItem('kstati-admin', token); } catch (e) {} return load(); })
      .catch(function (err) { $('loginErr').textContent = err.message; if (token) signOut(); })
      .then(function () { b.disabled = false; });
  });
  $('gTerm').addEventListener('change', function () { $('gDateBox').hidden = this.value !== 'date'; });
  $('grant').addEventListener('submit', function (e) {
    e.preventDefault(); var b = this.querySelector('button[type=submit]'); var err = $('grantErr');
    var until = untilOf($('gTerm').value);
    if (until === '') { err.textContent = 'Выберите дату'; return; }
    b.disabled = true; err.textContent = ''; err.className = 'err';
    call('POST', '/admin/subs', { email: $('gEmail').value.trim().toLowerCase(), until: until, note: $('gNote').value.trim() })
      .then(function (j) { err.className = 'err ok'; err.textContent = 'Выдано: ' + (j.sub.name || j.sub.email); $('gEmail').value = ''; $('gNote').value = ''; return load(); })
      .catch(function (x) { err.className = 'err'; err.textContent = x.message; })
      .then(function () { b.disabled = false; });
  });
  $('logout').addEventListener('click', signOut);
  if (token) load().catch(signOut);
})();
</script>
</body>
</html>`;
