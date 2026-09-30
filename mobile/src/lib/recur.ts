/**
 * Повторяющиеся дела: какие даты попадают в серию, следующий раз, подписи «Каждую неделю: пн, ср».
 * Даты — строки YYYY-MM-DD; считаем в «номерах дней» от 1970-01-01 (UTC), чтобы переход на летнее время
 * и длина месяцев не сбивали счёт.
 */
import type { Repeat, Task } from './types';

const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

export const dayNo = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const isoOf = (n: number) => {
  const d = new Date(n * DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
/** 1 = пн … 7 = вс */
export const weekdayOf = (iso: string) => ((new Date(dayNo(iso) * DAY).getUTCDay() + 6) % 7) + 1;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const dayFits = (days: number[], y: number, m: number, d: number) => days.some((x) => x === d || (x === -1 && d === daysInMonth(y, m)));

/** Подходит ли день под правило (без учёта конца серии и счётчика) */
function fits(r: Repeat, start: string, iso: string): boolean {
  const n = dayNo(iso);
  const s = dayNo(start);
  if (n < s) return false;
  const every = Math.max(1, r.every || 1);
  const [y, m, d] = parts(iso);
  const [sy, sm, sd] = parts(start);
  switch (r.freq) {
    case 'day':
      return (n - s) % every === 0;
    case 'week': {
      const days = r.weekdays?.length ? r.weekdays : [weekdayOf(start)];
      const monday = s - (weekdayOf(start) - 1);
      return Math.floor((n - monday) / 7) % every === 0 && days.includes(weekdayOf(iso));
    }
    case 'month':
      return ((y - sy) * 12 + (m - sm)) % every === 0 && dayFits(r.monthDays?.length ? r.monthDays : [sd], y, m, d);
    case 'year':
      return (y - sy) % every === 0 && (r.months?.length ? r.months : [sm]).includes(m) && dayFits(r.monthDays?.length ? r.monthDays : [sd], y, m, d);
  }
}

/** Все даты серии в промежутке [from, to] (включительно), кроме удалённых по одному */
export function occurrences(task: Pick<Task, 'date' | 'repeat' | 'skipDates'>, from: string, to: string, limit = 2000): string[] {
  if (!task.date) return [];
  const r = task.repeat;
  if (!r) return task.date >= from && task.date <= to ? [task.date] : [];
  const out: string[] = [];
  const skip = new Set(task.skipDates ?? []);
  const start = dayNo(task.date);
  let end = dayNo(to);
  if (r.until) end = Math.min(end, dayNo(r.until));
  // Со счётчиком повторов считаем с самого начала серии, иначе — с начала промежутка
  let n = r.count ? start : Math.max(start, dayNo(from));
  let seen = 0;
  const fromNo = dayNo(from);
  for (; n <= end && out.length < limit; n++) {
    const iso = isoOf(n);
    // Дата дела — всегда первый раз серии, даже если не подходит под правило (как в Google Календаре):
    // «с сегодня, каждую субботу» в среду — сегодня и дальше по субботам
    if (n !== start && !fits(r, task.date, iso)) continue;
    seen++;
    if (r.count && seen > r.count) break;
    if (n >= fromNo && !skip.has(iso)) out.push(iso);
  }
  return out;
}

/** Повтор серии как отдельное дело: своя дата и своя отметка «сделано» */
export function instance(task: Task, occ: string): Task {
  const done = task.doneDates?.includes(occ);
  return { ...task, date: occ, occ, doneAt: done ? `${occ}T12:00:00.000Z` : null };
}

/** Серия в промежутке — как отдельные дела; обычные дела — как есть */
export function expandTasks(tasks: Task[], from: string, to: string): Task[] {
  return tasks.flatMap((t) => (t.repeat && t.date ? occurrences(t, from, to).map((o) => instance(t, o)) : [t]));
}

/** Ближайший неотмеченный раз, начиная с from (ищем до 3 лет вперёд) */
export function nextOpen(task: Task, from: string): string | null {
  const to = isoOf(dayNo(from) + 366 * 3);
  for (const o of occurrences(task, from, to, 400)) if (!task.doneDates?.includes(o)) return o;
  return null;
}

/**
 * Для списка «Дела»: у серии показываем один раз — ближайший неотмеченный (прошедшие пропуски не висят).
 * Отмеченный сегодня тоже остаётся виден (зачёркнутым), как обычные выполненные дела.
 */
export function listInstances(tasks: Task[], today: string): Task[] {
  return tasks.flatMap((t) => {
    if (!t.repeat || !t.date) return [t];
    const out: Task[] = [];
    if (t.doneDates?.includes(today) && occurrences(t, today, today).length) out.push(instance(t, today));
    const next = nextOpen(t, today);
    if (next) out.push(instance(t, next));
    return out;
  });
}

/**
 * Дату серии поменяли — правило, взятое из старой даты («каждую среду», «каждое 30 число», «каждый год 30 сентября»),
 * переезжает на новую. Правило, настроенное вручную (несколько дней, другие числа), не трогаем.
 */
export function shiftRepeat(r: Repeat | null | undefined, oldDate: string | null, newDate: string | null): Repeat | null {
  if (!r || !oldDate || !newDate || oldDate === newDate) return r ?? null;
  const [, om, od] = parts(oldDate);
  const [, nm, nd] = parts(newDate);
  const one = (list: number[] | undefined, v: number) => !list?.length || (list.length === 1 && list[0] === v);
  if (r.freq === 'week' && one(r.weekdays, weekdayOf(oldDate))) return { ...r, weekdays: [weekdayOf(newDate)] };
  if (r.freq === 'month' && one(r.monthDays, od)) return { ...r, monthDays: [nd] };
  if (r.freq === 'year' && one(r.months, om) && one(r.monthDays, od)) return { ...r, months: [nm], monthDays: [nd] };
  return r;
}

/** Ключ для списков React: у повторов — id и дата */
export const taskKey = (t: Task) => (t.occ ? `${t.id}@${t.occ}` : t.id);

/* ---------- подписи ---------- */

const WD_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAY_SHORT = WD_SHORT;

const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

/** «1, 15 числа», «в последний день», «1 числа и в последний день» */
const daysPhrase = (days: number[]) => {
  const nums = days.filter((x) => x !== -1).sort((a, b) => a - b);
  const last = days.includes(-1);
  const n = nums.length ? `${nums.join(', ')} числа` : '';
  return last ? (n ? `${n} и в последний день` : 'в последний день') : n;
};

const isWorkdays = (w?: number[]) => !!w && w.length === 5 && [1, 2, 3, 4, 5].every((x) => w.includes(x));

/** «Каждую неделю: пн, ср», «Каждые 2 месяца, 1 и 15 числа», «Каждый год, 15 января» */
export function repeatLabel(r: Repeat | null | undefined, start: string | null): string {
  if (!r) return 'Не повторяется';
  const every = Math.max(1, r.every || 1);
  const [, sm, sd] = start ? parts(start) : [0, 1, 1];
  let base: string;
  switch (r.freq) {
    case 'day':
      base = every === 1 ? 'Каждый день' : `Каждые ${every} ${plural(every, 'день', 'дня', 'дней')}`;
      break;
    case 'week': {
      const days = r.weekdays?.length ? r.weekdays : start ? [weekdayOf(start)] : [];
      if (every === 1 && isWorkdays(days)) base = 'По будням';
      else if (every === 1 && days.length === 2 && days.includes(6) && days.includes(7)) base = 'По выходным';
      else {
        const head = every === 1 ? 'Каждую неделю' : `Каждые ${every} ${plural(every, 'неделю', 'недели', 'недель')}`;
        base = days.length ? `${head}: ${[...days].sort().map((d) => WD_SHORT[d - 1]).join(', ')}` : head;
      }
      break;
    }
    case 'month': {
      const head = every === 1 ? 'Каждый месяц' : `Каждые ${every} ${plural(every, 'месяц', 'месяца', 'месяцев')}`;
      base = `${head}, ${daysPhrase(r.monthDays?.length ? r.monthDays : [sd])}`;
      break;
    }
    case 'year': {
      const head = every === 1 ? 'Каждый год' : `Каждые ${every} ${plural(every, 'год', 'года', 'лет')}`;
      const months = (r.months?.length ? r.months : [sm]).slice().sort((a, b) => a - b);
      const days = r.monthDays?.length ? r.monthDays : [sd];
      base =
        months.length === 1 && days.length === 1 && days[0] !== -1
          ? `${head}, ${days[0]} ${MON_GEN[months[0] - 1]}`
          : `${head}: ${months.map((m) => MONTH_SHORT[m - 1]).join(', ')}, ${daysPhrase(days)}`;
      break;
    }
  }
  if (r.until) {
    const [y, m, d] = parts(r.until);
    base += `, до ${d} ${MON_GEN[m - 1]} ${y}`;
  } else if (r.count) base += `, ${r.count} ${plural(r.count, 'раз', 'раза', 'раз')}`;
  return base;
}
