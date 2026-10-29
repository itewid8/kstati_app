/**
 * Ответ на вопрос о планах. ИИ только говорит «чьи» и «на какой период» (PlansQuery),
 * а какие группы и дела показать — решает этот код. Выдумать дело он не может.
 */
import { PERSONAL, PERSONAL_NAME, taskGroups } from './visibility';
import { addDays, fromISODate, shortDate, sortKey, toISODate } from './dates';
import { normTitle } from './dupes';
import { dayNo, instance, isoOf, occurrences, taskKey } from './recur';
import { lastDay, peopleOf } from './span';
import { CATEGORY_LABEL, type Group, type ID, type PlansQuery, type Task, type User } from './types';

export type PlansAnswer = {
  title: string; // «Сб 3 окт», «Выходные, 3–4 окт», «Когда: «дача»»
  groupNames: string[];
  /** Ключи дел (у повторов — «id@дата», см. taskKey) */
  sections: { groupId: ID; groupName: string; taskIds: string[] }[];
  from: string;
  to: string;
  singleDay: boolean;
  /** Чьи дела (участие = peopleOf); нет — всех. «Что я делаю на выходных» — [мой id] */
  who?: ID[];
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
  // Личный календарь — как группа из меня одного (дела, не видные ни одной группе)
  const personal: Group = { id: PERSONAL, name: PERSONAL_NAME, category: 'other', inviteCode: '', memberIds: [s.me.id], ownerId: s.me.id, adminIds: [] };
  const current = s.currentGroupId === PERSONAL ? personal : mine.find((g) => g.id === s.currentGroupId);
  const sc = q.scope;

  if (sc.kind === 'current') return current ? { groups: [current] } : { error: 'Нет группы' };

  // «Что я делаю» — все мои группы (свои дела отбирает who)
  if (sc.kind === 'me') return { groups: [...mine, personal] };

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

  // «Что я делаю» без списка людей — только мои дела
  const who = q.who?.length ? q.who : q.scope.kind === 'me' ? [s.me.id] : undefined;
  const takes = (t: Task) => !who || peopleOf(t).some((p) => who.includes(p));
  // Дело попадает в период, если задевает его хотя бы одним днём: многодневное, начатое раньше, — тоже
  const inPeriod = (t: Task) => !!t.date && t.date <= q.to && (lastDay(t) ?? t.date) >= q.from;
  // Повторы многодневного дела ищем и чуть раньше начала периода: раз мог начаться до него
  const expand = (t: Task): Task[] => {
    if (!t.repeat || !t.date) return [t];
    const span = dayNo(lastDay(t) ?? t.date) - dayNo(t.date);
    return occurrences(t, isoOf(dayNo(q.from) - span), q.to).map((o) => instance(t, o));
  };

  // Каждое дело — в одном разделе: группа, где его создали (если она среди названных и видит его), иначе первая такая;
  // своё, не видное ни одной группе, — «Личное»
  const ids = r.groups.map((g) => g.id);
  const sectionOf = (t: Task): ID | null => {
    const where = taskGroups(t, s.groups, s.me.id).filter((g) => ids.includes(g));
    if (where.includes(t.groupId)) return t.groupId;
    if (where.length) return ids.find((g) => where.includes(g)) ?? null;
    return ids.includes(PERSONAL) && t.createdBy === s.me.id && !taskGroups(t, s.groups, s.me.id).length ? PERSONAL : null;
  };
  const sections = r.groups
    .map((g) => {
      const list = s.tasks
        .filter((t) => sectionOf(t) === g.id && matches(t) && takes(t))
        // Повторы серии в периоде — как отдельные дела
        .flatMap(expand)
        // С поиском («когда дача») показываем и дела без даты
        .filter((t) => (t.date ? inPeriod(t) : words.length > 0))
        .sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
      return { groupId: g.id, groupName: g.name, taskIds: list.map(taskKey) };
    })
    // Пустое «Личное» не показываем
    .filter((x) => x.groupId !== PERSONAL || x.taskIds.length > 0);
  const shown = new Set(sections.map((x) => x.groupId));

  return {
    ok: true,
    answer: {
      title: words.length ? `«${q.query}»` : periodTitle(q.from, q.to),
      groupNames: r.groups.filter((g) => shown.has(g.id)).map((g) => g.name),
      sections,
      from: q.from,
      to: q.to,
      singleDay: q.from === q.to,
      ...(who && { who }),
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
