/**
 * C-AskWeek / C-AskWeekend: ответ «что у нас…» по дням (AUDIT-2 §4.6).
 *  - Строки — дела со временем и подзадачи (по времени).
 *  - Планы с подзадачами, дела без времени и длиннее суток: период ≤ 2 дней — строками «ВЕСЬ» в каждый свой день,
 *    длиннее — заметкой дня начала «КОМАНДИРОВКА → ПТ» (однодневное — просто «ДАЧА»). Начатое до периода — в первый день.
 *  - «N ДЕЛ» — разные дела в ответе; план, показанный только заметкой, не считается (считаются его подзадачи).
 *  - «Свободно» — только для одного человека и периода не длиннее 3 дней (free.ts).
 */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import type { PlansAnswer } from '@/lib/plans';
import { taskKey } from '@/lib/recur';
import { isLong, lastDay, peopleOf } from '@/lib/span';
import type { ID, Task } from '@/lib/types';
import type { AgendaDay, AgendaItem } from '@/screens/voice/components/AgendaList';
import { MONTHS_SHORT, WEEKDAYS, parts, weekday } from '@/screens/calendar/format';
import type { Clock, Snapshot } from '../snapshot';
import { colorMap, userOf, type ColorMap } from '../common/people';
import { plural, upper } from '../common/ru';
import { instancesIn, planIds } from '../common/tasks';
import { dayMonthShort, dayShort, rangeDays } from '../common/when';
import { freeText } from './free';
import { clip, colorsOf, dayLabel, namesText } from './labels';

/** Высота блоков списка (AgendaList): шапка дня, строка, строка «ВЕСЬ» */
const DAY_H = 19;
const ROW_H = 27;
const MULTI_H = 23;
/** Все дни периода показываются, если он не длиннее недели; иначе только дни с делами */
const ALL_DAYS_MAX = 7;
const UNDATED = 'none';

export type AgendaSheetData = {
  /** «05—11 ОКТ · МЫ С КАРИНОЙ», «СБ 10 — ВС 11 ОКТ · САНЯ» */
  title: string;
  /** «16 ДЕЛ» */
  count: string;
  days: AgendaDay[];
  free?: string;
  /** «ОТКРЫТЬ НЕДЕЛЮ» (от 3 дней) / «ОТКРЫТЬ ДЕНЬ» */
  openLabel: string;
  /** Какой вид календаря открыть */
  view: 'week' | 'day';
  /** Ответ про одну другую группу — её выбрать перед открытием календаря; иначе null */
  groupId: ID | null;
};

export type AgendaOptions = {
  /** Сколько места под список (без шапки окна, фразы, «Свободно» и кнопок). Не влезло — последним днём «ЕЩЁ N» */
  maxHeight?: number;
};

type Row = { item: AgendaItem; height: number; rank: number };
type Bucket = { notes: string[]; wide: Row[]; timed: Row[] };

const periodDays = (from: IsoDate, to: IsoDate): IsoDate[] => {
  const n = Math.max(0, dayNo(to) - dayNo(from)) + 1;
  return Array.from({ length: Math.min(n, 366) }, (_, i) => isoOf(dayNo(from) + i));
};

const mon = (iso: IsoDate) => MONTHS_SHORT[parts(iso).m - 1] ?? '';

/** Период в шапке: один день — «СБ 10 ОКТ», два — «СБ 10 — ВС 11 ОКТ», дольше — «05—11 ОКТ» */
function periodTitle(answer: PlansAnswer, days: number): string {
  const { from, to } = answer;
  // Поиск по названию: «когда дача» → «ДАЧА»
  if (answer.title.startsWith('«')) return upper(answer.title.replace(/[«»]/g, ''));
  if (from === to) return dayLabel(from);
  if (days === 2) return mon(from) === mon(to) ? `${dayShort(from)} — ${dayShort(to)} ${mon(to)}` : `${dayLabel(from)} — ${dayLabel(to)}`;
  return rangeDays(from, to, { pad: true, month: true });
}

function whoTitle(answer: PlansAnswer, s: Snapshot): string {
  const [only, ...rest] = answer.who ?? [];
  const person = only && !rest.length ? userOf(s, only) : undefined;
  return person ? upper(person.name) : upper(answer.groupNames.join(', '));
}

/** Заметка дня: «КОМАНДИРОВКА → ПТ»; кончается после периода — «→ 14 ОКТ» */
function noteOf(t: Task, day: IsoDate, to: IsoDate): string {
  const last = lastDay(t) ?? day;
  const title = clip(upper(t.title), 24);
  if (last <= day) return title;
  const end = last <= to ? (WEEKDAYS[weekday(last)] ?? '') : dayMonthShort(last);
  return `${title} → ${end}`;
}

export function agendaSheetProps(answer: PlansAnswer, s: Snapshot, clock: Clock, opts: AgendaOptions = {}): AgendaSheetData {
  const { from, to } = answer;
  const colors: ColorMap = colorMap(s);
  const groupIds = answer.sections.map((x) => x.groupId);
  const byKey = new Map(instancesIn(s.tasks, groupIds, from, to).map((t) => [taskKey(t), t]));
  const keys = [...new Set(answer.sections.flatMap((x) => x.taskIds))];
  // Ключ без повтора, которого нет в периоде, — дело без даты из поиска («когда дача»)
  const found = keys.flatMap((k): Task[] => {
    const t = byKey.get(k) ?? s.tasks.find((x) => x.id === k);
    return t ? [t] : [];
  });
  const plans = planIds(s.tasks);
  const days = periodDays(from, to);
  const short = days.length <= 2;

  const buckets = new Map<IsoDate, Bucket>();
  const bucket = (day: IsoDate): Bucket => {
    const b = buckets.get(day) ?? { notes: [], wide: [], timed: [] };
    buckets.set(day, b);
    return b;
  };
  const counted = new Set<string>();
  const itemOf = (t: Task, day: IsoDate, time: string, multiDay: boolean): AgendaItem => {
    const people = peopleOf(t);
    return {
      id: `${taskKey(t)}/${day}`,
      time,
      title: t.title,
      who: namesText(s, people),
      colors: colorsOf(s, colors, people),
      ...(t.doneAt ? { done: true } : null),
      ...(multiDay ? { multiDay: true } : null),
    };
  };

  found.forEach((t, rank) => {
    const key = taskKey(t);
    if (!t.date) {
      bucket(UNDATED).timed.push({ item: itemOf(t, UNDATED, t.time ?? '—', false), height: ROW_H, rank });
      counted.add(key);
      return;
    }
    const first = t.date < from ? from : t.date;
    const wide = plans.has(t.id) || !t.time || isLong(t);
    if (!wide) {
      // Начатое накануне периода (через полночь) — без времени начала
      bucket(first).timed.push({ item: itemOf(t, first, t.date < from ? '—' : (t.time ?? '—'), false), height: ROW_H, rank });
      counted.add(key);
      return;
    }
    if (!short) {
      bucket(first).notes.push(noteOf(t, first, to));
      if (!plans.has(t.id)) counted.add(key);
      return;
    }
    const last = lastDay(t) ?? t.date;
    for (const day of days) {
      if (day < t.date || day > last) continue;
      // Начавшиеся в этот день — выше продолжающихся
      bucket(day).wide.push({ item: itemOf(t, day, 'ВЕСЬ', true), height: MULTI_H, rank: (day === t.date ? 0 : 1e6) + rank });
    }
    counted.add(key);
  });

  const shownDays = [...(days.length <= ALL_DAYS_MAX ? days : days.filter((d) => buckets.has(d))), ...(buckets.has(UNDATED) ? [UNDATED] : [])];
  const byRank = (a: Row, b: Row) => a.rank - b.rank;
  let budget = opts.maxHeight ?? Infinity;
  let hidden = 0;
  const out: AgendaDay[] = [];
  for (const day of shownDays) {
    const b = buckets.get(day) ?? { notes: [], wide: [], timed: [] };
    const rows = [...b.wide.sort(byRank), ...b.timed.sort(byRank)];
    if (hidden || budget < DAY_H + (rows[0]?.height ?? 0)) {
      hidden += rows.length;
      continue;
    }
    budget -= DAY_H;
    const items: AgendaItem[] = [];
    for (const r of rows) {
      if (hidden || r.height > budget) {
        hidden++;
        continue;
      }
      budget -= r.height;
      items.push(r.item);
    }
    const today = day === clock.today;
    const label = day === UNDATED ? 'БЕЗ ДАТЫ' : today ? `${dayShort(day)} · СЕГОДНЯ` : dayShort(day);
    out.push({
      key: day,
      label,
      ...(b.notes.length ? { note: b.notes.join(' · ') } : null),
      ...(today ? { today: true } : null),
      items,
    });
  }
  if (hidden) out.push({ key: 'more', label: `ЕЩЁ ${hidden}`, items: [] });

  const n = counted.size;
  const [person, ...others] = answer.who ?? [];
  const free = person && !others.length && days.length <= 3 ? freeText(s, person, from, to, clock) : undefined;
  const filled = answer.sections.filter((x) => x.taskIds.length);
  const [single] = filled;
  return {
    title: `${periodTitle(answer, days.length)} · ${whoTitle(answer, s)}`,
    count: n ? `${n} ${plural(n, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ')}` : 'НЕТ ДЕЛ',
    days: out,
    ...(free ? { free } : null),
    openLabel: days.length >= 3 ? 'ОТКРЫТЬ НЕДЕЛЮ' : 'ОТКРЫТЬ ДЕНЬ',
    view: days.length >= 3 ? 'week' : 'day',
    groupId: filled.length === 1 && single && single.groupId !== s.currentGroupId ? single.groupId : null,
  };
}

