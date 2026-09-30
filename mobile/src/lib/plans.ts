/**
 * Ответ на вопрос о планах. ИИ только говорит «чьи» и «на какой период» (PlansQuery),
 * а какие группы и дела показать — решает этот код. Выдумать дело он не может.
 */
import { addDays, fromISODate, shortDate, sortKey, toISODate } from './dates';
import { normTitle } from './dupes';
import { instance, occurrences, taskKey } from './recur';
import { CATEGORY_LABEL, type Group, type ID, type PlansQuery, type Task, type User } from './types';

export type PlansAnswer = {
  title: string; // «Сб 3 окт», «Выходные, 3–4 окт», «Когда: «дача»»
  groupNames: string[];
  /** Ключи дел (у повторов — «id@дата», см. taskKey) */
  sections: { groupId: ID; groupName: string; taskIds: string[] }[];
  from: string;
  to: string;
  singleDay: boolean;
};

type State = { me: User; users: User[]; groups: Group[]; tasks: Task[]; currentGroupId: ID | null };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Основа слова для падежей: «Машей» → «маш», «Кариной» → «кари», «дачу» → «дач» */
const stem = (w: string) => {
  const n = normTitle(w);
  return n.slice(0, Math.max(3, n.length - 3));
};

/** Какие группы имеются в виду */
function resolveGroups(q: PlansQuery, s: State): { groups: Group[] } | { error: string } {
  const mine = s.groups.filter((g) => g.memberIds.includes(s.me.id));
  const current = mine.find((g) => g.id === s.currentGroupId);
  const sc = q.scope;

  if (sc.kind === 'current') return current ? { groups: [current] } : { error: 'Нет группы' };

  if (sc.kind === 'us') {
    const couple = mine.filter((g) => g.category === 'couple');
    if (couple.length) return { groups: couple };
    return current ? { groups: [current] } : { error: 'Нет группы' };
  }

  if (sc.kind === 'category') {
    const list = mine.filter((g) => g.category === sc.category);
    return list.length
      ? { groups: list }
      : { error: `Нет групп с категорией «${CATEGORY_LABEL[sc.category]}». Её можно выбрать в настройках группы.` };
  }

  if (sc.kind === 'groups') {
    const want = sc.names.map(normTitle).filter(Boolean);
    const list = mine.filter((g) => want.some((w) => normTitle(g.name).includes(w) || w.includes(normTitle(g.name))));
    return list.length ? { groups: list } : { error: `Не нашёл группу «${sc.names.join(', ')}»` };
  }

  // Люди: «у нас с Кариной» → самая маленькая группа, где есть я и все названные; если таких несколько — все
  const ids: ID[] = [];
  for (const name of sc.names) {
    const st = stem(name);
    const u = s.users.find((x) => x.id !== s.me.id && mine.some((g) => g.memberIds.includes(x.id)) && normTitle(x.name).startsWith(st));
    if (!u) return { error: `Не нашёл человека «${cap(name)}» в ваших группах` };
    ids.push(u.id);
  }
  const common = mine.filter((g) => ids.every((id) => g.memberIds.includes(id)));
  if (!common.length) return { error: 'Нет общей группы со всеми, кого вы назвали' };
  const min = Math.min(...common.map((g) => g.memberIds.length));
  return { groups: common.filter((g) => g.memberIds.length === min) };
}

function periodTitle(from: string, to: string): string {
  if (from === to) return cap(shortDate(from));
  const a = fromISODate(from);
  const b = fromISODate(to);
  const weekend = a.getDay() === 6 && b.getDay() === 0 && +b - +a === 86400000;
  const [, da, ma] = shortDate(from).split(' ');
  const [, db, mb] = shortDate(to).split(' ');
  const range = ma === mb && a.getFullYear() === b.getFullYear() ? `${da}–${db} ${mb}` : `${da} ${ma} – ${db} ${mb}`;
  return weekend ? `Выходные, ${range}` : cap(range);
}

export function answerPlans(q: PlansQuery, s: State): { ok: true; answer: PlansAnswer } | { ok: false; error: string } {
  const r = resolveGroups(q, s);
  if ('error' in r) return { ok: false, error: r.error };

  const words = q.query ? normTitle(q.query).split(' ').filter((w) => w.length > 2).map(stem) : [];
  const matches = (t: Task) => {
    if (!words.length) return true;
    const hay = normTitle(`${t.title} ${t.note ?? ''}`).split(' ');
    return words.every((w) => hay.some((h) => h.startsWith(w)));
  };

  const sections = r.groups.map((g) => {
    const list = s.tasks
      .filter((t) => t.groupId === g.id && matches(t))
      // Повторы серии в периоде — как отдельные дела
      .flatMap((t) => (t.repeat && t.date ? occurrences(t, q.from, q.to).map((o) => instance(t, o)) : [t]))
      // С поиском («когда дача») показываем и дела без даты
      .filter((t) => (t.date ? t.date >= q.from && t.date <= q.to : words.length > 0))
      .sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
    return { groupId: g.id, groupName: g.name, taskIds: list.map(taskKey) };
  });

  return {
    ok: true,
    answer: {
      title: words.length ? `«${q.query}»` : periodTitle(q.from, q.to),
      groupNames: r.groups.map((g) => g.name),
      sections,
      from: q.from,
      to: q.to,
      singleDay: q.from === q.to,
    },
  };
}

/** «1 дело», «2 дела», «5 дел» */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/* ---------- для заглушки без сервера: период из фразы ---------- */

const DOW: [RegExp, number][] = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресен/, 0],
];

export function periodFromText(text: string, now = new Date()): { from: string; to: string } {
  const t = text.toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => toISODate(d);
  const nextWeek = /следующ/.test(t);
  if (/послезавтра/.test(t)) return { from: iso(addDays(today, 2)), to: iso(addDays(today, 2)) };
  if (/завтра/.test(t)) return { from: iso(addDays(today, 1)), to: iso(addDays(today, 1)) };
  if (/сегодня/.test(t)) return { from: iso(today), to: iso(today) };
  if (/выходн/.test(t)) {
    let sat = addDays(today, (6 - today.getDay() + 7) % 7);
    if (today.getDay() === 0) sat = addDays(today, -1); // сегодня воскресенье — эти выходные
    if (nextWeek) sat = addDays(sat, 7);
    return { from: iso(sat), to: iso(addDays(sat, 1)) };
  }
  if (/недел/.test(t)) {
    const mon = addDays(today, -((today.getDay() + 6) % 7) + (nextWeek ? 7 : 0));
    return { from: iso(nextWeek ? mon : today), to: iso(addDays(mon, 6)) };
  }
  for (const [re, dow] of DOW) {
    if (re.test(t)) {
      let diff = (dow - today.getDay() + 7) % 7 || 7;
      if (nextWeek) diff = 7 - ((today.getDay() + 6) % 7) + ((dow + 6) % 7);
      const d = addDays(today, diff);
      return { from: iso(d), to: iso(d) };
    }
  }
  return { from: iso(today), to: iso(addDays(today, 6)) };
}
