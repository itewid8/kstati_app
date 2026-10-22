/**
 * Занятость людей: конфликты (красные предупреждения) и свободные окна («что я делаю на выходных»).
 * Занятость — только дела со временем (BusyEvent). Дела на весь день, многодневные полосы и общие дела
 * с подзадачами занятостью не считаются — их сюда не передают (см. переходник в index.ts).
 * Интервалы полуоткрытые [start, end): дела встык (10–11 и 11–12) не пересекаются.
 */
import { dayNo, isoOf } from './days';
import { MIN_DURATION, type AbsMinute, type BusyEvent, type DayMinute, type IsoDate } from './types';

const DAY = 1440;

/** «2026-10-10» + «18:30» → абсолютные минуты; без времени — полночь */
export function absMinute(date: IsoDate, time: string | null = null): AbsMinute {
  const [h = 0, m = 0] = time ? time.split(':').map(Number) : [];
  return dayNo(date) * DAY + h * 60 + m;
}

/** Дата дня, в который попадает минута */
export const isoOfMinute = (m: AbsMinute): IsoDate => isoOf(Math.floor(m / DAY));

const endOf = (e: BusyEvent) => (e.end > e.start ? e.end : e.start + MIN_DURATION);

export interface Conflict {
  /** a началось не позже b */
  readonly a: string;
  readonly b: string;
  /** Общие люди */
  readonly people: readonly string[];
}

/** Пары дел со временем, которые пересекаются и у которых есть хотя бы один общий человек */
export function conflicts(events: readonly BusyEvent[]): Conflict[] {
  const sorted = events.map((e, idx) => ({ e, end: endOf(e), idx })).sort((x, y) => x.e.start - y.e.start || x.idx - y.idx);
  const out: Conflict[] = [];
  let active: typeof sorted = [];
  for (const cur of sorted) {
    active = active.filter((a) => a.end > cur.e.start);
    for (const a of active) {
      const shared = [...new Set(a.e.people.filter((p) => cur.e.people.includes(p)))];
      if (shared.length) out.push({ a: a.e.id, b: cur.e.id, people: shared });
    }
    active.push(cur);
  }
  return out;
}

export interface FreeWindowOptions {
  /** Свободное время ищется только внутри дня dayStart…dayEnd (минуты от полуночи) */
  readonly dayStart?: DayMinute;
  readonly dayEnd?: DayMinute;
  /** Окна короче не показываем, минут */
  readonly minGap?: number;
}

export const FREE_DEFAULTS: Required<FreeWindowOptions> = { dayStart: 8 * 60, dayEnd: 23 * 60, minGap: 60 };

export interface FreeWindow {
  /** День окна */
  readonly date: IsoDate;
  readonly start: AbsMinute;
  readonly end: AbsMinute;
  /** Окно от самого начала дня (dayStart) — «ВС ДО 11:00» */
  readonly atDayStart: boolean;
  /** Окно до самого конца дня (dayEnd) — «СБ 18:30 →» */
  readonly atDayEnd: boolean;
}

/**
 * Свободные окна человека в периоде [from, to).
 * Каждый день периода рассматривается отдельно: окно — промежуток внутри dayStart…dayEnd (по умолчанию 08:00–23:00),
 * обрезанный периодом, в котором у человека нет ни одного дела со временем, длиной не меньше minGap
 * (по умолчанию 60 минут, ровно час подходит). Окна через полночь не склеиваются: ночь — не свободное время.
 * Занятость, начавшаяся вчера и идущая через полночь, учитывается.
 */
export function freeWindows(
  events: readonly BusyEvent[],
  person: string,
  from: AbsMinute,
  to: AbsMinute,
  opts: FreeWindowOptions = {},
): FreeWindow[] {
  const { dayStart, dayEnd, minGap } = { ...FREE_DEFAULTS, ...opts };
  const busy = events
    .filter((e) => e.people.includes(person))
    .map((e): [number, number] => [e.start, endOf(e)])
    .sort((x, y) => x[0] - y[0]);

  const out: FreeWindow[] = [];
  for (let day = Math.floor(from / DAY); day * DAY < to; day++) {
    const d0 = day * DAY + dayStart;
    const d1 = day * DAY + dayEnd;
    const ws = Math.max(d0, from);
    const we = Math.min(d1, to);
    if (we <= ws) continue;
    const push = (start: number, end: number) => {
      if (end - start >= minGap) out.push({ date: isoOfMinute(d0), start, end, atDayStart: start === d0, atDayEnd: end === d1 });
    };
    let cursor = ws;
    for (const [bs, be] of busy) {
      if (be <= cursor || bs >= we) continue;
      push(cursor, bs);
      cursor = Math.max(cursor, be);
      if (cursor >= we) break;
    }
    push(cursor, we);
  }
  return out;
}
