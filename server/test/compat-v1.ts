/**
 * Совместимость со старым приложением (mobile/, без x-kstati-api → уровень API 1).
 * Каждый запрос старого клиента (lib/net.ts, auth.ts, sync.ts, api.ts, store.ts) повторяется так, как его шлёт
 * старое приложение: заголовок X-Kstati-Token, Content-Type только с телом, без x-kstati-api. Ответ проверяется
 * по тому, что старый клиент из него читает (он ничего не валидирует zod, а просто приводит типы): поля на месте,
 * типы те же, значения перечислений — только известные ему. Смешанная группа: новое приложение (x-kstati-api: 2)
 * дарит хотелку, архивирует тему, правит один раз повтора — старое читает и не должно запутаться.
 * Сценарий гоняется на памяти и на YdbStore через поддельный Document API.
 *   npm test
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { normalize } from '../src/parse.js';
import { MemoryStore } from '../src/store/memory.js';
import type { Store } from '../src/store/types.js';
import { YdbStore } from '../src/store/ydb.js';
import { startFakeDocApi } from './fake-docapi.js';

/* ================= что знает старое приложение (mobile/src/lib/types.ts, mockParser.ts, store.ts) ================= */

const OLD = {
  categories: ['couple', 'family', 'parents', 'friends', 'other'],
  colors: ['blue', 'pink', 'green', 'yellow', 'orange', 'violet', 'teal'],
  kinds: ['movie', 'series', 'cartoon', 'show', 'standup'],
  genres: ['comedy', 'drama', 'action', 'thriller', 'horror', 'scifi', 'detective', 'romance', 'adventure', 'documentary'],
  origins: ['ru', 'foreign'],
  fresh: ['new', 'old'],
  freq: ['day', 'week', 'month', 'year'],
  activity: ['task.add', 'task.done', 'task.undone', 'task.edit', 'task.delete', 'watch.add', 'watch.done', 'watch.delete', 'wish.add', 'wish.done', 'wish.delete', 'member.join', 'member.leave', 'member.remove', 'group.rename', 'topic.share'],
  resultTypes: ['items', 'queryWatch', 'queryWish', 'unknownPerson', 'changes', 'notFound', 'queryPlans', 'queryIdeas', 'unknown'],
  draftTypes: ['task', 'wish', 'watch', 'idea', 'topic'],
  changeActions: ['update', 'mark', 'unmark', 'delete'],
  /** resolveGroups (lib/plans.ts) на другом kind падает с TypeError */
  scopeKinds: ['us', 'current', 'category', 'groups', 'people'],
  nickStatus: ['free', 'taken', 'invalid', 'same'],
  wishKeys: ['createdAt', 'id', 'link', 'note', 'ownerId', 'receivedAt', 'title', 'updatedAt'],
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;
const SPEC = /^(m\d{1,4}|[dM]\d{1,3}@\d{2}:\d{2})$/;

/* ---------- проверки формы: как старый клиент приводит типы ---------- */

const fail = (where: string, what: string, v: unknown) => assert.fail(`${where}: ${what}, а пришло ${JSON.stringify(v)}`);
const str = (v: unknown, w: string) => typeof v === 'string' || fail(w, 'ожидалась строка', v);
const optStr = (v: unknown, w: string) => v === undefined || str(v, w);
const strOrNull = (v: unknown, w: string) => v === null || str(v, w);
const bool = (v: unknown, w: string) => typeof v === 'boolean' || fail(w, 'ожидался boolean', v);
const num = (v: unknown, w: string) => (typeof v === 'number' && Number.isFinite(v)) || fail(w, 'ожидалось число', v);
const match = (v: unknown, re: RegExp, w: string) => (typeof v === 'string' && re.test(v)) || fail(w, `ожидалось ${re}`, v);
const dayOrNull = (v: unknown, w: string) => v === null || match(v, DAY, w);
const timeOrNull = (v: unknown, w: string) => v === null || match(v, HHMM, w);
const oneOf = (v: unknown, list: readonly string[], w: string) => list.includes(v as string) || fail(w, `ожидалось одно из ${list.join('|')}`, v);
const arr = (v: unknown, w: string, each: (x: unknown, w: string) => unknown) => {
  if (!Array.isArray(v)) fail(w, 'ожидался массив', v);
  (v as unknown[]).forEach((x, i) => each(x, `${w}[${i}]`));
};
const obj = (v: unknown, w: string) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(w, 'ожидался объект', v);
  return v as Record<string, any>;
};
const record = (v: unknown, w: string, each: (x: unknown, w: string) => unknown) => {
  for (const [k, x] of Object.entries(obj(v, w))) each(x, `${w}.${k}`);
};
const strs = (v: unknown, w: string) => arr(v, w, str);

function checkUser(v: unknown, w: string) {
  const u = obj(v, w);
  str(u.id, `${w}.id`);
  str(u.name, `${w}.name`);
  optStr(u.nick, `${w}.nick`);
  if (u.gender !== undefined) oneOf(u.gender, ['m', 'f'], `${w}.gender`);
  if (u.color !== undefined) (OLD.colors.includes(u.color) || /^#[0-9a-fA-F]{6}$/.test(u.color)) || fail(`${w}.color`, 'цвет палитры или #rrggbb', u.color);
  optStr(u.avatar, `${w}.avatar`);
  assert.equal(u.passHash, undefined, `${w}: хеш пароля наружу не уходит`);
  return u;
}
/** Me = User & { email?: string | null; hasPassword?: boolean; vk?: boolean } */
function checkMe(v: unknown, w: string) {
  const me = checkUser(v, w);
  if (me.email !== undefined) strOrNull(me.email, `${w}.email`);
  if (me.hasPassword !== undefined) bool(me.hasPassword, `${w}.hasPassword`);
  if (me.vk !== undefined) bool(me.vk, `${w}.vk`);
  return me;
}
/** Session (auth.ts): { token, me } → signIn(token, me) */
function checkSession(v: unknown, w: string) {
  const s = obj(v, w);
  str(s.token, `${w}.token`);
  checkMe(s.me, `${w}.me`);
  return s as { token: string; me: any };
}
function checkGroup(v: unknown, w: string) {
  const g = obj(v, w);
  str(g.id, `${w}.id`);
  str(g.name, `${w}.name`);
  oneOf(g.category, OLD.categories, `${w}.category`);
  str(g.inviteCode, `${w}.inviteCode`);
  strs(g.memberIds, `${w}.memberIds`);
  str(g.ownerId, `${w}.ownerId`);
  strs(g.adminIds, `${w}.adminIds`);
  return g;
}
function checkRepeat(v: unknown, w: string) {
  const r = obj(v, w);
  oneOf(r.freq, OLD.freq, `${w}.freq`);
  num(r.every, `${w}.every`);
  for (const k of ['weekdays', 'monthDays', 'months']) if (r[k] !== undefined) arr(r[k], `${w}.${k}`, num);
  if (r.until !== undefined) dayOrNull(r.until, `${w}.until`);
  if (r.count !== undefined && r.count !== null) num(r.count, `${w}.count`);
}
/** ServerItem (sync.ts): Task & { type: 'task' } | WatchItem & { type: 'watch' } */
function checkItem(v: unknown, w: string) {
  const it = obj(v, w);
  oneOf(it.type, ['task', 'watch'], `${w}.type`);
  str(it.id, `${w}.id`);
  str(it.groupId, `${w}.groupId`);
  str(it.title, `${w}.title`);
  str(it.createdAt, `${w}.createdAt`);
  if (it.type === 'task') {
    dayOrNull(it.date, `${w}.date`);
    timeOrNull(it.time, `${w}.time`);
    optStr(it.note, `${w}.note`);
    str(it.createdBy, `${w}.createdBy`);
    strOrNull(it.doneAt, `${w}.doneAt`);
    if (it.repeat !== undefined && it.repeat !== null) checkRepeat(it.repeat, `${w}.repeat`);
    if (it.doneDates !== undefined) arr(it.doneDates, `${w}.doneDates`, (x, ww) => match(x, DAY, ww));
    if (it.skipDates !== undefined) arr(it.skipDates, `${w}.skipDates`, (x, ww) => match(x, DAY, ww));
    if (it.reminders !== undefined && it.reminders !== null) arr(it.reminders, `${w}.reminders`, (x, ww) => match(x, SPEC, ww));
    if (it.endDate !== undefined) dayOrNull(it.endDate, `${w}.endDate`);
    if (it.endTime !== undefined) timeOrNull(it.endTime, `${w}.endTime`);
    if (it.people !== undefined) strs(it.people, `${w}.people`);
    if (it.parentId !== undefined) strOrNull(it.parentId, `${w}.parentId`);
    // В старом приложении Task.occ — «развёрнутый» раз серии: с сервера его быть не должно
    assert.equal(it.occ, undefined, `${w}: occ у дела с сервера старое приложение примет за развёрнутый раз`);
  } else {
    if (it.kind !== null) oneOf(it.kind, OLD.kinds, `${w}.kind`);
    arr(it.genres, `${w}.genres`, (x, ww) => oneOf(x, OLD.genres, ww));
    if (it.origin !== null) oneOf(it.origin, OLD.origins, `${w}.origin`);
    if (it.year !== null) num(it.year, `${w}.year`);
    str(it.addedBy, `${w}.addedBy`);
    strOrNull(it.watchedAt, `${w}.watchedAt`);
  }
  return it;
}
function checkWish(v: unknown, w: string) {
  const x = obj(v, w);
  for (const k of ['id', 'ownerId', 'title', 'note', 'link', 'createdAt']) str(x[k], `${w}.${k}`);
  strOrNull(x.receivedAt, `${w}.receivedAt`);
  return x;
}
function checkPrefs(v: unknown, w: string) {
  if (v === null) return;
  const p = obj(v, w);
  if (p.reminders !== null) {
    const r = obj(p.reminders, `${w}.reminders`);
    bool(r.enabled, `${w}.reminders.enabled`);
    strs(r.timed, `${w}.reminders.timed`);
    strs(r.allDay, `${w}.reminders.allDay`);
  }
  record(p.overrides ?? {}, `${w}.overrides`, strs);
}
function checkNotes(v: unknown, w: string) {
  const n = obj(v, w);
  arr(n.topics, `${w}.topics`, (t, ww) => {
    const x = obj(t, ww);
    for (const k of ['id', 'ownerId', 'title', 'createdAt']) str(x[k], `${ww}.${k}`);
    strs(x.groupIds, `${ww}.groupIds`);
  });
  arr(n.ideas, `${w}.ideas`, (t, ww) => {
    const x = obj(t, ww);
    for (const k of ['id', 'ownerId', 'text', 'createdAt', 'updatedAt']) str(x[k], `${ww}.${k}`);
    strOrNull(x.topicId, `${ww}.topicId`);
  });
}
/** SyncResponse (sync.ts) целиком + что pull() делает с ним */
function checkSync(v: unknown, viewer: string) {
  const r = obj(v, 'sync');
  checkMe(r.me, 'sync.me');
  assert.equal(r.me.id, viewer);
  arr(r.groups, 'sync.groups', checkGroup);
  arr(r.users, 'sync.users', checkUser);
  const revs = obj(r.revs, 'sync.revs');
  record(revs.groups, 'sync.revs.groups', num);
  record(revs.owners, 'sync.revs.owners', num);
  record(r.items, 'sync.items', (list, w) => arr(list, w, checkItem));
  for (const [gid, list] of Object.entries(r.items as Record<string, any[]>)) for (const it of list) assert.equal(it.groupId, gid, 'дело лежит в своей группе');
  record(r.wishes, 'sync.wishes', (list, w) => arr(list, w, checkWish));
  for (const [owner, list] of Object.entries(r.wishes as Record<string, any[]>)) {
    for (const x of list) {
      assert.equal(x.ownerId, owner);
      // Свои хотелки до «получил» — ровно прежний набор полей: ни намёка на подарок
      if (owner === viewer && !x.receivedAt) assert.deepEqual(Object.keys(x).sort(), OLD.wishKeys, `своя хотелка ${x.id}: прежний вид`);
    }
  }
  checkPrefs(r.prefs, 'sync.prefs');
  if (r.ideaRevs !== undefined) record(r.ideaRevs, 'sync.ideaRevs', str);
  if (r.notes !== undefined) record(r.notes, 'sync.notes', checkNotes);
  return r as any;
}
function checkEvent(v: unknown, w: string) {
  const e = obj(v, w);
  for (const k of ['scope', 'id', 'at', 'actor']) str(e[k], `${w}.${k}`);
  oneOf(e.kind, OLD.activity, `${w}.kind`);
  optStr(e.groupId, `${w}.groupId`);
  optStr(e.itemId, `${w}.itemId`);
  optStr(e.title, `${w}.title`);
  if (e.date !== undefined) dayOrNull(e.date, `${w}.date`);
  if (e.time !== undefined) timeOrNull(e.time, `${w}.time`);
  if (e.fields !== undefined) strs(e.fields, `${w}.fields`);
  optStr(e.target, `${w}.target`);
  // app/activity.tsx: нажатие на wish.* открывает хотелки e.actor — значит, автор должен быть владельцем хотелки
  if (e.kind.startsWith('wish.')) assert.equal(e.scope, `u:${e.actor}`, `${w}: автор события хотелки — её владелец`);
  return e;
}
function checkOpsResponse(v: unknown, n: number) {
  const r = obj(v, 'ops');
  arr(r.results, 'ops.results', (x, w) => {
    const o = obj(x, w);
    bool(o.ok, `${w}.ok`);
    optStr(o.error, `${w}.error`);
    optStr(o.message, `${w}.message`);
    if (o.me !== undefined) checkMe(o.me, `${w}.me`);
    if (o.group !== undefined) checkGroup(o.group, `${w}.group`);
  });
  assert.equal(r.results.length, n, 'по результату на каждую операцию');
  return r.results as any[];
}
/** ParseResult (mockParser.ts) — что разбирает applyResult в lib/voice.ts */
function checkParse(v: unknown, w = 'result') {
  const r = obj(v, w);
  oneOf(r.type, OLD.resultTypes, `${w}.type`);
  switch (r.type) {
    case 'items':
      arr(r.items, `${w}.items`, (x, ww) => {
        const it = obj(x, ww);
        str(it.key, `${ww}.key`);
        oneOf(it.type, OLD.draftTypes, `${ww}.type`);
        const d = obj(it.data, `${ww}.data`);
        str(d.title, `${ww}.data.title`);
        if (it.type === 'task') {
          dayOrNull(d.date, `${ww}.data.date`);
          timeOrNull(d.time, `${ww}.data.time`);
          optStr(d.note, `${ww}.data.note`);
          if (d.repeat) checkRepeat(d.repeat, `${ww}.data.repeat`);
          if (d.endDate !== undefined) dayOrNull(d.endDate, `${ww}.data.endDate`);
          if (d.endTime !== undefined) timeOrNull(d.endTime, `${ww}.data.endTime`);
          if (d.people !== undefined) strs(d.people, `${ww}.data.people`);
          if (d.parentId !== undefined) strOrNull(d.parentId, `${ww}.data.parentId`);
        }
        if (it.type === 'wish') ['note', 'link'].forEach((k) => str(d[k], `${ww}.data.${k}`));
        if (it.type === 'watch') {
          if (d.kind !== null) oneOf(d.kind, OLD.kinds, `${ww}.data.kind`);
          arr(d.genres, `${ww}.data.genres`, (g, www) => oneOf(g, OLD.genres, www));
          if (d.origin !== null) oneOf(d.origin, OLD.origins, `${ww}.data.origin`);
          if (d.year !== null) num(d.year, `${ww}.data.year`);
        }
        if (it.type === 'idea') {
          strOrNull(d.topicId, `${ww}.data.topicId`);
          strOrNull(d.newTopic, `${ww}.data.newTopic`);
        }
      });
      break;
    case 'queryWatch': {
      const f = obj(r.filters, `${w}.filters`);
      arr(f.kind, `${w}.filters.kind`, (x, ww) => oneOf(x, OLD.kinds, ww));
      arr(f.genre, `${w}.filters.genre`, (x, ww) => oneOf(x, OLD.genres, ww));
      arr(f.origin, `${w}.filters.origin`, (x, ww) => oneOf(x, OLD.origins, ww));
      arr(f.fresh, `${w}.filters.fresh`, (x, ww) => oneOf(x, OLD.fresh, ww));
      break;
    }
    case 'queryWish':
      str(r.personId, `${w}.personId`);
      break;
    case 'unknownPerson':
      str(r.name, `${w}.name`);
      break;
    case 'notFound':
      str(r.query, `${w}.query`);
      break;
    case 'queryIdeas':
      strOrNull(r.topicId, `${w}.topicId`);
      break;
    case 'changes':
      arr(r.changes, `${w}.changes`, (x, ww) => {
        const c = obj(x, ww);
        str(c.key, `${ww}.key`);
        oneOf(c.action, OLD.changeActions, `${ww}.action`);
        oneOf(c.type, OLD.draftTypes, `${ww}.type`);
        strs(c.candidates, `${ww}.candidates`);
        assert.ok(c.candidates.includes(c.chosen), `${ww}: chosen — один из candidates`);
        if (c.patch !== undefined) {
          const p = obj(c.patch, `${ww}.patch`);
          if (p.title !== undefined) str(p.title, `${ww}.patch.title`);
          if (p.date !== undefined) dayOrNull(p.date, `${ww}.patch.date`);
          if (p.time !== undefined) timeOrNull(p.time, `${ww}.patch.time`);
          if (p.repeat) checkRepeat(p.repeat, `${ww}.patch.repeat`);
          if (p.endDate !== undefined) dayOrNull(p.endDate, `${ww}.patch.endDate`);
          if (p.endTime !== undefined) timeOrNull(p.endTime, `${ww}.patch.endTime`);
          if (p.people !== undefined) strs(p.people, `${ww}.patch.people`);
          if (p.topicId !== undefined) strOrNull(p.topicId, `${ww}.patch.topicId`);
          if (p.newTopic !== undefined) strOrNull(p.newTopic, `${ww}.patch.newTopic`);
        }
        // occ (S3) старое приложение не читает: applyChanges и CardSheet берут только action/type/chosen/patch
        if (c.occ !== undefined) match(c.occ, DAY, `${ww}.occ`);
      });
      break;
    case 'queryPlans': {
      const p = obj(r.plans, `${w}.plans`);
      const sc = obj(p.scope, `${w}.plans.scope`);
      oneOf(sc.kind, OLD.scopeKinds, `${w}.plans.scope.kind`);
      if (sc.kind === 'category') oneOf(sc.category, OLD.categories, `${w}.plans.scope.category`);
      if (sc.kind === 'groups' || sc.kind === 'people') strs(sc.names, `${w}.plans.scope.names`);
      match(p.from, DAY, `${w}.plans.from`);
      match(p.to, DAY, `${w}.plans.to`);
      str(p.query, `${w}.plans.query`);
      assert.equal(p.who, undefined, `${w}: who старому клиенту не уходит`);
      break;
    }
  }
  return r as any;
}

/* ---------- то, что старое приложение само делает с данными (sync.ts) ---------- */

const oldTaskOp = (t: any) => ({
  op: 'task.put',
  task: {
    id: t.id, groupId: t.groupId, title: t.title, date: t.date, time: t.time, note: t.note ?? '', doneAt: t.doneAt,
    repeat: t.repeat ?? null, doneDates: t.doneDates ?? [], skipDates: t.skipDates ?? [], reminders: t.reminders ?? null,
    endDate: t.endDate ?? null, endTime: t.endTime ?? null, people: t.people ?? [], parentId: t.parentId ?? null,
  },
});
const oldWishOp = (w: any) => ({ op: 'wish.put', wish: { id: w.id, title: w.title, note: w.note, link: w.link, receivedAt: w.receivedAt } });
const oldTopicOp = (t: any) => ({ op: 'topic.put', topic: { id: t.id, title: t.title, groupIds: t.groupIds } });
/** pull(): у записей убирает type/updatedAt, у хотелок updatedAt, у тем kind/updatedAt */
const oldLocalTask = ({ type: _t, updatedAt: _u, ...rest }: any) => rest;
const oldLocalWish = ({ updatedAt: _u, ...w }: any) => w;
const oldLocalTopic = ({ kind: _k, updatedAt: _u, ...t }: any) => t;

/* ================= сценарий ================= */

// VK ID без сети (как в e2e.ts)
config.vkClientId ||= 'test-vk';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === 'https://id.vk.com/oauth2/auth') return Response.json({ access_token: 'vk-token', user_id: 778 });
  if (url === 'https://id.vk.com/oauth2/user_info') return Response.json({ user: { user_id: 778, first_name: 'Вера', sex: 1 } });
  return realFetch(input, init);
}) as typeof fetch;

const TODAY = '2026-10-06'; // вторник
const H2 = { 'x-kstati-api': '2', 'x-kstati-app': 'ru.kstati.app/1.0.0(1)' };

/** Ответы «модели»: через настоящий normalize — проверяется то, что сервер реально отдаст старому клиенту */
const CANNED: Record<string, Record<string, unknown>[]> = {
  'добавь всё': [
    { intent: 'add', type: 'task', title: 'купить хлеб', date: '2026-10-07', time: '18:00' },
    { intent: 'add', type: 'wish', title: 'наушники', note: 'беспроводные' },
    { intent: 'add', type: 'watch', title: 'Дюна', kind: 'movie', genres: ['scifi', 'аниме'], origin: 'foreign', year: 2021 },
    { intent: 'add', type: 'idea', text: 'погода в виджете', topic: 'Идеи для приложения' },
    { intent: 'add', type: 'topic', title: 'Путешествия' },
  ],
  'что посмотреть': [{ intent: 'query_watch', kind: ['movie', 'anime'], genre: ['comedy'], fresh: ['new'] }],
  'что хочет маша': [{ intent: 'query_wish', person: 'Маша' }],
  'что хочет вася': [{ intent: 'query_wish', person: 'Вася' }],
  'покажи идеи для приложения': [{ intent: 'query_ideas', topic: 'Идеи для приложения' }],
  'удали слона': [{ intent: 'delete', target: ['нет-такого'], query: 'слон' }],
  'удали баню в субботу': [{ intent: 'delete', target: ['t5'], query: 'баня' }],
  'отметь баню в субботу': [{ intent: 'mark', target: ['t5'], query: 'баня' }],
  'перенеси баню в субботу на воскресенье': [{ intent: 'update', target: ['t5'], date: '2026-10-11', query: 'баня' }],
  'больше не повторяй баню': [{ intent: 'update', target: ['t5'], query: 'баня' }],
  'перенеси идею про погоду в без темы': [{ intent: 'update', target: ['i1'], topic: 'Без темы' }],
  'что я делаю на выходных': [{ intent: 'query_plans', scope: 'me', from: '2026-10-10', to: '2026-10-11', query: '' }],
  'что у меня на выходных': [{ intent: 'query_plans', scope: 'people', people: ['я'], from: '2026-10-10', to: '2026-10-11', query: '' }],
  'что у нас с машей на выходных': [{ intent: 'query_plans', scope: 'people', people: ['я', 'Маша'], from: '2026-10-10', to: '2026-10-11', query: '' }],
  'что маша делает в субботу': [{ intent: 'query_plans', scope: 'current', who: ['Маша'], from: '2026-10-10', to: '2026-10-10', query: '' }],
  'что у друзей на неделе': [{ intent: 'query_plans', scope: 'category', category: 'friends', query: '' }],
  'что у нас в футболе': [{ intent: 'query_plans', scope: 'groups', groups: ['Футбол'], query: '' }],
  'когда дача': [{ intent: 'query_plans', scope: 'us', query: 'дача' }],
};

async function scenario(name: string, store: Store) {
  let transcript = 'хочу наушники';
  const app = await buildApp({
    store,
    recognize: async () => transcript,
    toOgg: async () => ({ ogg: Buffer.from('ogg'), seconds: 1.5 }),
    parse: async (text, ctx) => {
      const canned = CANNED[text];
      return { result: canned ? normalize(canned as any, ctx, text) : { type: 'unknown' }, raw: '{}', usage: { input: 1, output: 1, total: 2 }, attempts: 1 };
    },
  });

  // Новый адрес каждые 100 запросов — чтобы не упереться в защиту от перебора (120 в минуту)
  let calls = 0;
  const ip = () => `10.1.${Math.floor(calls++ / 100)}.1`;

  /** Запрос ровно как lib/net.ts request(): без x-kstati-api, токен в X-Kstati-Token, Content-Type только с телом */
  const v1 = async (path: string, opts: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; token?: string | null } = {}) => {
    const r = await app.inject({
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      url: path,
      remoteAddress: ip(),
      headers: {
        ...(opts.body !== undefined && { 'content-type': 'application/json' }),
        ...(opts.token && { 'x-kstati-token': opts.token }),
      },
      payload: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    assert.equal(r.headers['x-kstati-api'], undefined);
    const json = r.body ? JSON.parse(r.body) : null;
    // ApiError(status, json?.error ?? http_<status>, json?.message ?? …): у отказов — код и (для человека) текст
    if (r.statusCode >= 400) {
      str(json?.error, `${path} → ${r.statusCode}: error`);
      if (json?.message !== undefined) str(json.message, `${path}: message`);
    }
    return { status: r.statusCode, json };
  };
  const v1ok = async (path: string, opts: Parameters<typeof v1>[1] = {}) => {
    const r = await v1(path, opts);
    assert.equal(r.status, 200, `${path} → ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  };
  /** Новое приложение: те же запросы с x-kstati-api: 2 */
  const v2 = async (path: string, body: unknown, token: string) => {
    const r = await app.inject({ method: body === undefined ? 'GET' : 'POST', url: path, remoteAddress: ip(), headers: { ...H2, 'x-kstati-token': token, ...(body !== undefined && { 'content-type': 'application/json' }) }, payload: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal(r.statusCode, 200, `${path} (v2) → ${r.statusCode} ${r.body}`);
    return JSON.parse(r.body);
  };
  const ops1 = async (token: string, ...list: unknown[]) => checkOpsResponse(await v1ok('/ops', { token, body: { ops: list } }), list.length);
  const ops2 = async (token: string, ...list: unknown[]) => (await v2('/ops', { ops: list }, token)).results as any[];
  /** pull(): первая синхронизация — пустые ревизии и пустые ревизии идей */
  const sync1 = async (token: string, viewer: string, body: unknown = { groups: {}, owners: {}, ideas: {} }) => checkSync(await v1ok('/sync', { token, body }), viewer);
  const sync2 = (token: string) => v2('/sync', { groups: {}, owners: {}, ideas: {} }, token);

  /* ---------- auth.ts: код, проверка кода, регистрация, вход, сброс ---------- */
  const register = async (email: string, name: string) => {
    const sent = obj(await v1ok('/auth/email/code', { body: { email, purpose: 'register' } }), 'code');
    optStr(sent.devCode, 'devCode');
    match(sent.devCode, /^\d{6}$/, 'devCode');
    const wrong = await v1('/auth/email/verify', { body: { email, purpose: 'register', code: sent.devCode === '000000' ? '111111' : '000000' } });
    assert.deepEqual([wrong.status, wrong.json.error], [400, 'code_wrong']);
    await v1ok('/auth/email/verify', { body: { email, purpose: 'register', code: sent.devCode } });
    return checkSession(await v1ok('/auth/register', { body: { email, code: sent.devCode, name, password: 'secret-123' } }), 'register');
  };
  const sasha = await register('sasha@compat.ru', 'Саша');
  const masha = await register('masha@compat.ru', 'Маша');
  const petya = await register('petya@compat.ru', 'Петя');
  const [SA, MA, PE] = [sasha.me.id, masha.me.id, petya.me.id] as string[];
  const [T1, T2, T3] = [sasha.token, masha.token, petya.token];
  assert.deepEqual([sasha.me.email, sasha.me.hasPassword, sasha.me.vk], ['sasha@compat.ru', true, false]);

  // verifyCode: expired определяется по code === 'code_expired'
  const noCode = await v1('/auth/email/verify', { body: { email: 'nobody@compat.ru', purpose: 'reset', code: '123456' } });
  assert.deepEqual([noCode.status, noCode.json.error], [400, 'code_expired']);
  // Неверный пароль: текст ошибки показывается человеку (errorText → message)
  const bad = await v1('/auth/login', { body: { email: 'sasha@compat.ru', password: 'wrong-pass' } });
  assert.equal(bad.status, 401);
  str(bad.json.message, 'login.message');
  checkSession(await v1ok('/auth/login', { body: { email: 'sasha@compat.ru', password: 'secret-123' } }), 'login');
  const { devCode: resetCode } = await v1ok('/auth/email/code', { body: { email: 'petya@compat.ru', purpose: 'reset' } });
  checkSession(await v1ok('/auth/reset', { body: { email: 'petya@compat.ru', code: resetCode, password: 'secret-456' } }), 'reset');
  // Короткий пароль — 400 с текстом для человека
  const short = await v1('/auth/register', { body: { email: 'x@compat.ru', code: '000000', name: 'Икс', password: '123' } });
  assert.equal(short.status, 400);
  str(short.json.message, 'короткий пароль: message');

  /* ---------- auth.ts loginWithVk: браузер → kstati://auth?state&ticket → /auth/vk/finish ---------- */
  {
    const hex = (n: number) => Array.from({ length: n }, () => randomBytes(16).toString('hex')).join('');
    const verifier = hex(2); // как randomHex(2): 64 символа
    const state = hex(1); // 32 символа
    const redirect = `${config.appScheme}://auth`;
    const challenge = createHash('sha256').update(verifier).digest('base64url'); // challengeS256 (lib/pkce.ts)
    const url = `/auth/vk/start?redirect=${encodeURIComponent(redirect)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    const start = await app.inject({ method: 'GET', url, remoteAddress: ip() });
    assert.equal(start.statusCode, 302, start.body);
    const vkState = new URL(String(start.headers.location)).searchParams.get('state')!;
    const cb = await app.inject({ method: 'GET', url: `/auth/vk/callback?${new URLSearchParams({ state: vkState, code: 'c', device_id: 'd' })}`, remoteAddress: ip() });
    assert.equal(cb.statusCode, 302);
    // Разбор адреса возврата — как в auth.ts
    const params = new URL(String(cb.headers.location).replace(/^[\w+.-]+:\/\/?/, 'https://x/')).searchParams;
    assert.equal(params.get('state'), state);
    const ticket = params.get('ticket');
    assert.ok(ticket);
    const vk = checkSession(await v1ok('/auth/vk/finish', { body: { ticket, code_verifier: verifier } }), 'vk');
    assert.deepEqual([vk.me.vk, vk.me.name, vk.me.gender], [true, 'Вера', 'f']);
  }

  /* ---------- store.ts: группы и профиль (ответы /ops с group и me) ---------- */
  const [created] = await ops1(T1, { op: 'group.create', group: { id: 'g1', name: 'Друзья', category: 'friends' } });
  assert.equal(created.ok, true);
  checkGroup(created.group, 'group.create');
  const code = created.group.inviteCode as string;
  const [joined] = await ops1(T2, { op: 'group.join', code: code.toLowerCase() });
  assert.equal(joined.ok, true, JSON.stringify(joined));
  checkGroup(joined.group, 'group.join');
  assert.equal(joined.group.inviteCode, '', 'обычному участнику код не виден');
  assert.equal((await ops1(T3, { op: 'group.join', code }))[0].ok, true);
  const [badJoin] = await ops1(T3, { op: 'group.join', code: 'ZZZZZZ' });
  assert.deepEqual([badJoin.ok, badJoin.error], [false, 'bad_code']);
  str(badJoin.message, 'joinGroup показывает message');
  await ops1(T1, { op: 'group.create', group: { id: 'g2', name: 'Футбол', category: 'other' } }, { op: 'group.update', id: 'g1', name: 'Друзья', category: 'friends' });
  assert.equal((await ops1(T1, { op: 'group.admin', id: 'g1', userId: MA, admin: true }))[0].ok, true);
  const [prof] = await ops1(T1, { op: 'profile', name: 'Саша', nick: 'sasha_c', gender: 'm' });
  assert.equal(prof.ok, true);
  assert.deepEqual([prof.me.nick, prof.me.gender], ['sasha_c', 'm']);
  assert.equal((await ops1(T1, { op: 'profile', color: '#3A7BD5', avatar: '🐱' }))[0].ok, true);
  assert.equal((await ops1(T2, { op: 'profile', color: 'pink' }))[0].ok, true);
  const [taken] = await ops1(T2, { op: 'profile', name: 'Маша', nick: 'SASHA_C', gender: 'f' });
  assert.deepEqual([taken.ok, taken.error], [false, 'nick_taken']);
  str(taken.message, 'saveProfile показывает message');
  // checkNick
  for (const [nick, token, want] of [['sasha_c', T1, 'same'], ['Sasha_C', T2, 'taken'], ['новый_ник', T2, 'free'], ['x', T2, 'invalid']] as const) {
    const r = obj(await v1ok(`/nick/check?nick=${encodeURIComponent(nick)}`, { token }), 'nick');
    oneOf(r.status, OLD.nickStatus, 'nick.status');
    assert.equal(r.status, want, nick);
  }
  // Неверный формат операции — ошибка только её, очередь идёт дальше
  const mixed = await ops1(T1, { op: 'task.put', task: { id: 'tx', groupId: 'g1', title: '', date: null, time: null, doneAt: null } }, { op: 'nope' }, { op: 'prefs', reminders: { enabled: true, timed: ['m60'], allDay: ['d1@20:00'] }, overrides: { t1: ['m15'] } });
  assert.deepEqual(mixed.map((r) => [r.ok, r.error]), [[false, 'bad_request'], [false, 'bad_request'], [true, undefined]]);

  /* ---------- sync.ts: записи старым форматом (taskOp, watchOp, wishOp, topicOp, ideaOp) ---------- */
  const rep = { freq: 'week', every: 1, weekdays: [6] };
  const put = await ops1(
    T1,
    oldTaskOp({ id: 't1', groupId: 'g1', title: 'Ужин', date: '2026-10-07', time: '19:00', doneAt: null, people: [SA, MA], reminders: ['m60'] }),
    oldTaskOp({ id: 't5', groupId: 'g1', title: 'Баня', date: '2026-10-03', time: '15:00', doneAt: null, repeat: rep }),
    oldTaskOp({ id: 'p1', groupId: 'g1', title: 'Поездка', date: '2026-10-09', time: null, endDate: '2026-10-11', doneAt: null }),
    oldTaskOp({ id: 'p2', groupId: 'g1', title: 'Билеты', date: null, time: null, doneAt: null, parentId: 'p1' }),
    oldTaskOp({ id: 'y1', groupId: 'g1', title: 'Йога', date: '2026-09-01', time: '08:00', doneAt: null, repeat: { freq: 'day', every: 2 } }),
    { op: 'watch.put', watch: { id: 'm1', groupId: 'g1', title: 'Дюна', kind: 'movie', genres: ['scifi'], origin: 'foreign', year: 2021, watchedAt: null } },
    oldWishOp({ id: 'w1', title: 'Наушники', note: '', link: '', receivedAt: null }),
    oldWishOp({ id: 'w2', title: 'Кофемолка', note: 'ручная', link: 'https://example.com', receivedAt: null }),
    oldTopicOp({ id: 'tp1', title: 'Идеи для приложения', groupIds: ['g1'] }),
    { op: 'idea.put', idea: { id: 'i1', topicId: 'tp1', text: 'Погода в виджете' } },
    { op: 'idea.put', idea: { id: 'i2', topicId: null, text: 'Просто мысль' } },
  );
  assert.ok(put.every((r) => r.ok), JSON.stringify(put));
  await ops1(T2, oldWishOp({ id: 'mw1', title: 'Книга', note: '', link: '', receivedAt: null }), oldTaskOp({ id: 'mt1', groupId: 'g1', title: 'Футбол', date: '2026-10-10', time: '12:00', doneAt: null }));

  const s0 = await sync1(T3, PE);
  assert.deepEqual(s0.groups.map((g: any) => g.id), ['g1'], 'Петя только в g1');
  assert.deepEqual(s0.items.g1.map((i: any) => i.id).sort(), ['m1', 'mt1', 'p1', 'p2', 't1', 't5', 'y1']);
  assert.deepEqual(s0.wishes[SA].map((w: any) => w.id).sort(), ['w1', 'w2']);
  assert.deepEqual(s0.notes[SA].topics.map((t: any) => t.id), ['tp1'], 'тема, открытая группе, видна');
  assert.equal(s0.prefs, null, 'у Пети своих напоминаний ещё нет — старое приложение отправит свои');
  assert.deepEqual((await sync1(T1, SA)).prefs.overrides, { t1: ['m15'] });
  // Повтор с теми же ревизиями — без содержимого (pull заменяет только изменившееся)
  const again = await sync1(T3, PE, { groups: s0.revs.groups, owners: s0.revs.owners, ideas: s0.ideaRevs });
  assert.deepEqual([again.items, again.wishes, again.notes], [{}, {}, {}]);
  // Совсем старое приложение без идей (не шлёт ideas) — идей не получает и не падает
  const noIdeas = await sync1(T3, PE, { groups: {}, owners: {} });
  assert.deepEqual(noIdeas.notes, {});

  /* ================= смешанная группа: новое приложение пишет, старое читает ================= */

  /* ---------- S1: Маша (новое приложение) дарит хотелку Саши ---------- */
  const w1Before = (await sync1(T1, SA)).wishes[SA].find((w: any) => w.id === 'w1');
  assert.deepEqual((await ops2(T2, { op: 'wish.gift', ownerId: SA, id: 'w1', gifted: true }))[0], { ok: true });
  // Владелец в старом приложении: ничего не изменилось (сюрприз), набор полей прежний — проверяет checkSync
  const ownView = await sync1(T1, SA);
  const w1Own = ownView.wishes[SA]?.find((w: any) => w.id === 'w1') ?? w1Before;
  assert.deepEqual(w1Own, w1Before, 'владелец (старое приложение) подарка не видит');
  // Третий участник в старом приложении: хотелка уходит в «Подарено» — receivedAt строка (wishes.tsx сортирует localeCompare)
  const w1Petya = (await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w1');
  str(w1Petya.receivedAt, 'подаренная хотелка у старого клиента: receivedAt');
  // Даритель, открывший старое приложение, видит то же
  str((await sync1(T2, MA)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, 'даритель в старом приложении');
  // Новое приложение у Пети по-прежнему видит настоящий вид
  const w1PetyaNew = (await sync2(T3)).wishes[SA].find((w: any) => w.id === 'w1');
  assert.deepEqual([w1PetyaNew.giftedBy, w1PetyaNew.receivedAt], [MA, null]);
  assert.equal(w1Petya.receivedAt, w1PetyaNew.giftedAt);

  // Лента: старое приложение открывает хотелки автора события — событие подарка идёт от имени владельца
  const feedOld = obj(await v1ok('/activity', { token: T3 }), 'activity').events as any[];
  arr(feedOld, 'activity.events', checkEvent);
  const giftOld = feedOld.find((e) => e.kind === 'wish.done' && e.itemId === 'w1');
  assert.ok(giftOld, 'Петя видит событие подарка');
  assert.equal(giftOld.actor, SA, 'старому клиенту — от имени владельца: «Саша отметил хотелку как подаренную»');
  const feedNew = (await v2('/activity', undefined, T3)).events as any[];
  assert.equal(feedNew.find((e: any) => e.kind === 'wish.done' && e.itemId === 'w1').actor, MA, 'новому клиенту — даритель, как раньше');
  // Владелец о подарке из ленты не узнаёт ни в старом, ни в новом приложении; дарителю своё действие не показывается
  for (const token of [T1, T2]) {
    const f = obj(await v1ok('/activity', { token }), 'activity').events as any[];
    arr(f, 'activity.events', checkEvent);
    assert.ok(!f.some((e) => e.kind === 'wish.done' && e.itemId === 'w1'));
  }
  // since — как fetchActivity: свежее последнего известного
  assert.deepEqual((await v1ok(`/activity?since=${encodeURIComponent(feedOld[0].id)}`, { token: T3 })).events, []);

  // Старое приложение владельца правит хотелку (wishOp из локальной копии): подарок не стирается
  await ops1(T1, oldWishOp({ ...oldLocalWish(w1Own), title: 'Наушники Sony' }));
  assert.equal((await sync2(T3)).wishes[SA].find((w: any) => w.id === 'w1').giftedBy, MA, 'старый wish.put не стёр подарок');
  assert.equal((await sync1(T1, SA)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, null, 'и не раскрыл его владельцу');
  // Владелец в старом приложении отмечает «получил»
  const got = '2026-10-06T10:00:00.000Z';
  await ops1(T1, oldWishOp({ ...oldLocalWish(w1Own), title: 'Наушники Sony', receivedAt: got }));
  const w1Got = (await sync1(T1, SA)).wishes[SA].find((w: any) => w.id === 'w1');
  assert.equal(w1Got.receivedAt, got, 'своя отметка — как раньше');
  // Лишние поля после «получил» (giftedBy) старое приложение хранит, но не читает и не отправляет обратно
  assert.deepEqual(Object.keys(oldWishOp(oldLocalWish(w1Got)).wish).sort(), ['id', 'link', 'note', 'receivedAt', 'title']);
  assert.equal((await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, got, 'остальным — отметка владельца');
  // Снял «получил» — подарок снят у всех, хотелка снова открыта
  await ops1(T1, oldWishOp({ ...oldLocalWish(w1Got), receivedAt: null }));
  assert.equal((await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, null);
  assert.equal((await sync2(T3)).wishes[SA].find((w: any) => w.id === 'w1').giftedBy, undefined);
  // Новое приложение владельца: «получил от Маши» — старый клиент Пети видит обычную полученную хотелку
  await ops2(T1, { op: 'wish.put', wish: { id: 'w2', title: 'Кофемолка', note: 'ручная', link: 'https://example.com', receivedAt: got, giftedBy: MA } });
  const w2Petya = (await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w2');
  assert.equal(w2Petya.receivedAt, got);
  // Даритель снимает свою отметку (новое приложение) — у старого клиента хотелка возвращается в список
  await ops2(T2, { op: 'wish.gift', ownerId: SA, id: 'w1', gifted: true });
  str((await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, 'снова подарено');
  await ops2(T2, { op: 'wish.gift', ownerId: SA, id: 'w1', gifted: false });
  assert.equal((await sync1(T3, PE)).wishes[SA].find((w: any) => w.id === 'w1').receivedAt, null, 'отметку сняли — снова в списке');
  // Подарок новым приложением, пока владелец в старом удаляет хотелку
  await ops2(T3, { op: 'wish.gift', ownerId: MA, id: 'mw1', gifted: true });
  assert.equal((await ops1(T2, { op: 'wish.delete', id: 'mw1' }))[0].ok, true);
  assert.deepEqual((await sync1(T3, PE)).wishes[MA], []);

  /* ---------- S2: Саша (новое приложение) архивирует тему, открытую группе ---------- */
  await ops2(T1, { op: 'topic.put', topic: { id: 'tp1', title: 'Идеи для приложения', groupIds: ['g1'], archivedAt: '2026-10-06T09:00:00.000Z' } });
  for (const [token, viewer] of [[T1, SA], [T3, PE]] as const) {
    const n = (await sync1(token, viewer)).notes[SA];
    const tp = n.topics.find((t: any) => t.id === 'tp1');
    assert.ok(tp, 'архивная тема у старого клиента — обычная тема');
    assert.deepEqual(Object.keys(oldLocalTopic(tp)).filter((k) => k !== 'archivedAt').sort(), ['createdAt', 'groupIds', 'id', 'ownerId', 'title']);
    assert.ok(n.ideas.some((i: any) => i.id === 'i1' && i.topicId === 'tp1'), 'идеи архивной темы на месте');
  }
  // Старое приложение владельца сохраняет тему (topicOp из локальной копии) — архив не стирается
  const tpLocal = oldLocalTopic((await sync1(T1, SA)).notes[SA].topics.find((t: any) => t.id === 'tp1'));
  await ops1(T1, oldTopicOp({ ...tpLocal, title: 'Идеи (старое)' }));
  const tpNew = (await sync2(T1)).notes[SA].topics.find((t: any) => t.id === 'tp1');
  assert.deepEqual([tpNew.title, tpNew.archivedAt], ['Идеи (старое)', '2026-10-06T09:00:00.000Z']);
  await ops1(T1, { op: 'idea.put', idea: { id: 'i3', topicId: 'tp1', text: 'Идея в архивной теме' } });
  assert.ok((await sync1(T3, PE)).notes[SA].ideas.some((i: any) => i.id === 'i3'));
  await ops2(T1, { op: 'topic.put', topic: { id: 'tp1', title: 'Идеи для приложения', groupIds: ['g1'], archivedAt: null } });

  /* ---------- S3: новое приложение правит один раз повтора ---------- */
  // «Только этот раз»: удалить 10 октября; перенести 17-е на 18-е = skipDates + новое дело; новое приложение
  // может держать у развёрнутого раза поле occ — сервер не должен пропустить его к старому клиенту
  const t5 = (await sync2(T2)).items.g1.find((i: any) => i.id === 't5');
  const r3 = await ops2(
    T2,
    { op: 'task.put', task: { ...oldTaskOp(t5).task, skipDates: ['2026-10-10', '2026-10-17'], occ: '2026-10-17' } },
    { op: 'task.put', task: { ...oldTaskOp({ id: 't5b', groupId: 'g1', title: 'Баня', date: '2026-10-18', time: '15:00', doneAt: null }).task, occ: '2026-10-18' } },
    // «Этот и все следующие» у йоги — конец серии
    { op: 'task.put', task: { ...oldTaskOp((await sync2(T2)).items.g1.find((i: any) => i.id === 'y1')).task, repeat: { freq: 'day', every: 2, until: '2026-10-20' } } },
  );
  assert.ok(r3.every((r) => r.ok), JSON.stringify(r3));
  const s3 = await sync1(T3, PE); // checkItem: occ у дел нет, повтор старого формата
  const t5Old = s3.items.g1.find((i: any) => i.id === 't5');
  assert.deepEqual([t5Old.repeat, t5Old.skipDates, t5Old.date], [rep, ['2026-10-10', '2026-10-17'], '2026-10-03']);
  assert.equal(s3.items.g1.find((i: any) => i.id === 't5b').repeat ?? null, null, 'перенесённый раз — обычное дело');
  assert.deepEqual(s3.items.g1.find((i: any) => i.id === 'y1').repeat, { freq: 'day', every: 2, until: '2026-10-20' });
  // Старое приложение отмечает раз серии (toggleOcc → doneDates) и шлёт дело целиком — удалённые разы на месте
  await ops1(T3, oldTaskOp({ ...oldLocalTask(t5Old), doneDates: ['2026-10-03'] }));
  const t5Back = (await sync2(T2)).items.g1.find((i: any) => i.id === 't5');
  assert.deepEqual([t5Back.doneDates, t5Back.skipDates, t5Back.createdBy], [['2026-10-03'], ['2026-10-10', '2026-10-17'], SA]);
  const feedS3 = obj(await v1ok('/activity', { token: T1 }), 'activity').events as any[];
  arr(feedS3, 'activity.events', checkEvent);
  assert.ok(feedS3.some((e) => e.kind === 'task.delete' && e.fields?.includes('occurrence') && e.date === '2026-10-17'), 'удалённый раз — знакомое старому приложению событие');

  /* ---------- голос: /voice/text и /voice (lib/api.ts) — разбор глазами старого клиента ---------- */
  const savedLimit = config.voiceDailyLimit;
  config.voiceDailyLimit = 1000;
  // meta(): groupId, today, now, topicId, parentId (voiceTopicId / voiceParentId могут быть null или не заданы)
  const meta = { groupId: 'g1', today: TODAY, now: '12:00', topicId: null, parentId: null };
  const say = async (text: string, extra: Record<string, unknown> = {}) => {
    const r = obj(await v1ok('/voice/text', { token: T1, body: { ...meta, ...extra, text } }), 'voice/text');
    return checkParse(r.result);
  };
  const sayNew = async (text: string) => (await v2('/voice/text', { ...meta, text }, T1)).result;

  const items = await say('добавь всё');
  assert.deepEqual(items.items.map((i: any) => i.type), ['task', 'wish', 'watch', 'idea', 'topic']);
  assert.deepEqual(items.items[2].data.genres, ['scifi'], 'незнакомый жанр не уходит');
  assert.equal(items.items[3].data.topicId, 'tp1');
  const qw = await say('что посмотреть');
  assert.deepEqual(qw.filters, { kind: ['movie'], genre: ['comedy'], origin: [], fresh: ['new'] });
  assert.equal((await say('что хочет маша')).personId, MA);
  assert.equal((await say('что хочет вася')).type, 'unknownPerson');
  assert.equal((await say('покажи идеи для приложения')).topicId, 'tp1');
  assert.equal((await say('удали слона')).type, 'notFound');
  assert.equal((await say('абракадабра')).type, 'unknown');
  const ideaMove = await say('перенеси идею про погоду в без темы');
  assert.deepEqual([ideaMove.changes[0].type, ideaMove.changes[0].patch], ['idea', { topicId: null }]);
  // S3 для старого клиента: действие над всей серией, как раньше; дата переноса — от даты серии
  const del = await say('удали баню в субботу');
  assert.deepEqual([del.changes[0].action, del.changes[0].type, del.changes[0].chosen, del.changes[0].patch], ['delete', 'task', 't5', undefined]);
  assert.equal((await say('отметь баню в субботу')).changes[0].action, 'mark');
  const moveOld = (await say('перенеси баню в субботу на воскресенье')).changes[0];
  const moveNew = (await sayNew('перенеси баню в субботу на воскресенье')).changes[0];
  assert.equal(moveOld.patch.date, '2026-10-11', 'старому — ближайшее воскресенье от даты серии');
  assert.equal(moveNew.patch.date, '2026-10-25', 'новому — после названного раза (17-е и 10-е удалены, ближайшая суббота — 24-е)');
  const stop = (await say('больше не повторяй баню')).changes[0];
  assert.deepEqual([stop.patch.repeat, stop.occ], [null, undefined]);
  // S4: «я» и who старому клиенту не уходят; знакомые виды scope — как раньше
  const plans = async (text: string) => (await say(text)).plans;
  assert.deepEqual((await plans('что я делаю на выходных')).scope, { kind: 'current' });
  assert.deepEqual((await sayNew('что я делаю на выходных')).plans.scope, { kind: 'me' }, 'новому — как было');
  assert.deepEqual((await plans('что у меня на выходных')).scope, { kind: 'current' });
  assert.deepEqual((await plans('что у нас с машей на выходных')).scope, { kind: 'people', names: ['Маша'] });
  assert.deepEqual((await plans('что маша делает в субботу')).scope, { kind: 'current' });
  assert.deepEqual((await sayNew('что маша делает в субботу')).plans.who, [MA]);
  assert.deepEqual((await plans('что у друзей на неделе')).scope, { kind: 'category', category: 'friends' });
  assert.deepEqual((await plans('что у нас в футболе')).scope, { kind: 'groups', names: ['Футбол'] });
  assert.deepEqual((await plans('когда дача')).scope, { kind: 'us' });
  // Открытая тема и план — как раньше
  assert.equal((await say('добавь всё', { topicId: 'tp1', parentId: 'p1' })).items[0].data.parentId, 'p1');
  // Ответ без topicId / parentId (старые сборки их не слали)
  checkParse((await v1ok('/voice/text', { token: T1, body: { groupId: 'g1', today: TODAY, now: '12:00', text: 'что посмотреть' } })).result);
  // /voice: base64 без lang → { transcript, result }
  transcript = 'добавь всё';
  const voice = obj(await v1ok('/voice', { token: T1, body: { ...meta, audio: Buffer.from('m4a').toString('base64') } }), 'voice');
  str(voice.transcript, 'voice.transcript');
  assert.equal(checkParse(voice.result).type, 'items');
  transcript = '';
  const silent = obj(await v1ok('/voice', { token: T1, body: { ...meta, audio: 'AAAA' } }), 'voice');
  assert.deepEqual([silent.transcript, silent.result.type], ['', 'unknown'], 'тишина — пустой transcript');
  // Ошибки голоса: чужая группа — server; лимит — code daily_limit с текстом (voice.ts fail())
  const foreign = await v1('/voice/text', { token: T3, body: { ...meta, groupId: 'g2', text: 'x' } });
  assert.deepEqual([foreign.status, foreign.json.error], [403, 'not_member']);
  config.voiceDailyLimit = 0;
  const lim = await v1('/voice/text', { token: T1, body: { ...meta, text: 'что посмотреть' } });
  assert.deepEqual([lim.status, lim.json.error], [429, 'daily_limit']);
  str(lim.json.message, 'лимит: текст для человека');
  config.voiceDailyLimit = savedLimit;

  /* ---------- выход и удаление аккаунта (store.ts deleteAccount: DELETE /me без тела) ---------- */
  assert.equal((await v1('/sync', { token: 'garbage', body: {} })).status, 401, '401 → старое приложение выходит из аккаунта');
  await v1ok('/me', { method: 'DELETE', token: T3 });
  assert.equal((await v1('/sync', { token: T3, body: {} })).status, 401);
  const after = await sync1(T1, SA);
  assert.ok(!after.users.some((u: any) => u.id === PE), 'Петя ушёл из групп');
  assert.ok(!after.items.g1.some((i: any) => i.createdBy === PE));

  await app.close();
  console.log(`✓ совместимость v1 (${name}): все запросы старого приложения`);
}

await scenario('память', new MemoryStore());
const fake = await startFakeDocApi();
const ydb = new YdbStore({ endpoint: fake.url, accessKeyId: 'test', secretAccessKey: 'test' });
await ydb.ensureTables(() => {});
await scenario('YDB (поддельный Document API)', ydb);
fake.server.close();
