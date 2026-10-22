/**
 * Подписи голосовых окон (C-Voice, C-Ask*): даты с двузначным числом («ПН 05 ОКТ»), люди заглавными,
 * короткий ярлык повтора («КАЖДУЮ НЕДЕЛЮ») и напоминания («ЗА 2 Ч»).
 */
import type { IsoDate } from '@/lib/calendarLayout';
import { repeatLabel } from '@/lib/recur';
import { duration, parse, presetChip, sortSpecs } from '@/lib/remind';
import { isMulti } from '@/lib/span';
import type { ID, PersonColor, ReminderSpec, Repeat, Task } from '@/lib/types';
import { MONTHS_SHORT, parts } from '@/screens/calendar/format';
import type { Snapshot } from '../snapshot';
import { colorOf, peopleIds, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dayShort, timeSpan } from '../common/when';

/** «ПН 05 ОКТ» — в голосовых окнах число всегда двузначное (как в макетах) */
export function dayLabel(iso: IsoDate): string {
  return `${dayShort(iso)} ${MONTHS_SHORT[parts(iso).m - 1] ?? ''}`;
}

/** «ПН 05 ОКТ · 09:30»; без даты — «БЕЗ ДАТЫ» */
export function whenText(date: IsoDate | null, time: string | null): string {
  if (!date) return time ?? 'БЕЗ ДАТЫ';
  return time ? `${dayLabel(date)} · ${time}` : dayLabel(date);
}

type Timing = Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>;

/** «СБ 10 ОКТ · 10:00–11:30»; многодневное — «СР 07 ОКТ 07:00 → ПТ 09 ОКТ 15:00» */
export function periodText(t: Timing): string {
  if (!t.date) return 'БЕЗ ДАТЫ';
  if (!isMulti(t) || !t.endDate) {
    const time = timeSpan(t.time, t.endTime);
    return time ? `${dayLabel(t.date)} · ${time}` : dayLabel(t.date);
  }
  const edge = (date: IsoDate, time: string | null | undefined) => (time ? `${dayLabel(date)} ${time}` : dayLabel(date));
  return `${edge(t.date, t.time)} → ${edge(t.endDate, t.endTime)}`;
}

/** Конец дела для строки «КОНЕЦ»: «11:30», многодневное — «ПТ 09 ОКТ 15:00», нет — «—» */
export function endText(t: Timing): string {
  if (isMulti(t) && t.endDate) return t.endTime ? `${dayLabel(t.endDate)} ${t.endTime}` : dayLabel(t.endDate);
  return t.endTime ?? '—';
}

/** Люди в порядке экранов: я, затем участники групп по порядку; незнакомые — в конце */
export function orderPeople(s: Pick<Snapshot, 'me' | 'groups'>, ids: readonly ID[]): ID[] {
  const order = peopleIds(s);
  const rank = (id: ID) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b));
}

/** «САНЯ, КАРИНА» */
export function namesText(s: Pick<Snapshot, 'me' | 'users' | 'groups'>, ids: readonly ID[]): string {
  return orderPeople(s, ids)
    .map((id) => upper(userOf(s, id)?.name ?? '—'))
    .join(', ');
}

export const colorsOf = (s: Pick<Snapshot, 'me' | 'groups'>, colors: ColorMap, ids: readonly ID[]): PersonColor[] =>
  orderPeople(s, ids).map((id) => colorOf(colors, id));

/** Ярлык повтора без подробностей: «КАЖДУЮ НЕДЕЛЮ», «ПО БУДНЯМ», «КАЖДЫЕ 2 МЕСЯЦА» */
export function repeatTag(repeat: Repeat | null | undefined, start: IsoDate | null): string | undefined {
  if (!repeat) return undefined;
  const [head = ''] = repeatLabel(repeat, start).split(/[:,]/);
  return upper(head.trim());
}

/** Обрезать длинный текст многоточием */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Одно напоминание коротко: «ЗА 2 Ч», «В НАЧАЛЕ», «НАКАНУНЕ 20:00», «ЗА 2 ДНЯ 18:00» */
export function remindShort(spec: ReminderSpec): string {
  const p = parse(spec);
  if (!p) return upper(spec);
  if (p.kind === 'm') return p.min === 0 ? 'В НАЧАЛЕ' : `ЗА ${upper(duration(p.min))}`;
  return `${upper(presetChip(spec))} ${p.at}`;
}

/** Напоминания одной строкой; «за N минут» у дела без времени не срабатывает и не показывается. Нет — «НЕТ» */
export function remindText(specs: readonly ReminderSpec[], time: string | null): string {
  const live = sortSpecs([...specs]).filter((spec) => time || parse(spec)?.kind !== 'm');
  return live.length ? live.map(remindShort).join(' · ') : 'НЕТ';
}
