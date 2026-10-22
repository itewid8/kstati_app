/**
 * Подписи окон редактирования заглавными: напоминания («ЗА 2 Ч», «НАКАНУНЕ В 20:00»), повтор
 * («КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК»), конец дела, занятость в «КТО», подзадачи плана.
 */
import type { IsoDate } from '@/lib/calendarLayout';
import { moment, momentText, parse } from '@/lib/remind';
import { repeatLabel } from '@/lib/recur';
import type { Gender, ReminderSpec, Repeat, Task } from '@/lib/types';
import { pad2, parts } from '@/screens/calendar/format';
import { plural, upper } from '../common/ru';
import { dayMonth, dayMonthShort, periodLabel } from '../common/when';

/** «09:00» → «9:00» (в подписях напоминаний час без нуля) */
const clock = (at: string) => at.replace(/^0(\d):/, '$1:');

/** «2 Ч», «1 Ч 30 МИН», «15 МИН» */
function hoursMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} МИН`;
  return m ? `${h} Ч ${m} МИН` : `${h} Ч`;
}

/** Утром / днём / вечером в день дела — по часу напоминания */
function sameDay(at: string): string {
  const hour = Number(at.slice(0, 2));
  const part = hour < 12 ? 'УТРОМ' : hour < 18 ? 'ДНЁМ' : 'ВЕЧЕРОМ';
  return `${part} В ${clock(at)}`;
}

/** Короткая подпись напоминания: «ЗА 15 МИН», «ЗА 1 Ч», «УТРОМ В 9:00», «НАКАНУНЕ В 20:00», «ЗА 2 ДНЯ В 18:00» */
export function remindLabel(spec: ReminderSpec): string {
  const p = parse(spec);
  if (!p) return upper(spec);
  if (p.kind === 'm') return p.min === 0 ? 'В НАЧАЛЕ' : `ЗА ${hoursMinutes(p.min)}`;
  if (p.kind === 'M') {
    const head = p.months === 1 ? 'ЗА МЕСЯЦ' : `ЗА ${p.months} ${plural(p.months, 'МЕСЯЦ', 'МЕСЯЦА', 'МЕСЯЦЕВ')}`;
    return `${head} В ${clock(p.at)}`;
  }
  if (p.days === 0) return sameDay(p.at);
  if (p.days === 1) return `НАКАНУНЕ В ${clock(p.at)}`;
  if (p.days === 7) return `ЗА НЕДЕЛЮ В ${clock(p.at)}`;
  if (p.days === 14) return `ЗА 2 НЕДЕЛИ В ${clock(p.at)}`;
  return `ЗА ${p.days} ${plural(p.days, 'ДЕНЬ', 'ДНЯ', 'ДНЕЙ')} В ${clock(p.at)}`;
}

/** «За N минут» у дела без времени не сработает */
export const applicable = (spec: ReminderSpec, time: string | null) => !!time || parse(spec)?.kind !== 'm';

/** Опорное дело для сравнения правил между собой (как sortSpecs в lib/remind) */
const REF_DATE = '2030-06-15';
const REF_TIME = '12:00';

/**
 * Напоминания по порядку в окне: ближе к началу дела — выше («За 2 ч» над «Накануне»), без повторов
 */
export function orderSpecs(specs: readonly ReminderSpec[]): ReminderSpec[] {
  const key = (s: ReminderSpec) => moment(s, REF_DATE, REF_TIME)?.getTime() ?? 0;
  return [...new Set(specs)].sort((a, b) => key(b) - key(a));
}

/** Сводка строки «НАПОМНИТЬ»: «ЗА 2 Ч · НАКАНУНЕ В 20:00»; нечего напоминать — null («НЕ НАПОМИНАТЬ») */
export function remindSummary(specs: readonly ReminderSpec[], time: string | null): string | null {
  const list = orderSpecs(specs).filter((s) => applicable(s, time));
  return list.length ? list.map(remindLabel).join(' · ') : null;
}

/** Когда именно придёт: «СБ 10 ОКТ, 17:00»; без даты или неприменимо — «—» */
export function remindWhen(spec: ReminderSpec, date: IsoDate | null, time: string | null): string {
  const at = date ? moment(spec, date, time) : null;
  return at ? upper(momentText(at)) : '—';
}

/** «31 ДЕК 2026» — дата окончания повтора на кнопке */
export const untilLabel = (iso: IsoDate) => `${dayMonthShort(iso)} ${parts(iso).y}`;

/**
 * Строка «ПОВТОР»: «КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК» (год — если не тот, что у дела), «КАЖДЫЙ ДЕНЬ · 10 РАЗ»
 */
export function repeatText(r: Repeat, date: IsoDate): string {
  const base = upper(repeatLabel({ ...r, until: null, count: null }, date));
  if (r.until) {
    const year = parts(r.until).y === parts(date).y ? '' : ` ${parts(r.until).y}`;
    return `${base} · ДО ${dayMonthShort(r.until)}${year}`;
  }
  if (r.count) return `${base} · ${r.count} ${plural(r.count, 'РАЗ', 'РАЗА', 'РАЗ')}`;
  return base;
}

/** Строка «КОНЕЦ»: «11:30»; многодневное — «ВС 11 ОКТ · 01:00» / «ВС 11 ОКТ»; нет конца — null */
export function endLabel(t: Pick<Task, 'date' | 'endDate' | 'endTime'>): string | null {
  if (t.endDate && t.date && t.endDate > t.date) return t.endTime ? `${dayMonth(t.endDate)} · ${t.endTime}` : dayMonth(t.endDate);
  return t.endTime ?? null;
}

/** «ЗАНЯТА» / «ЗАНЯТ»; пол не указан — «ЗАНЯТ(А)» */
export const busyWord = (gender?: Gender) => (gender === 'f' ? 'ЗАНЯТА' : gender === 'm' ? 'ЗАНЯТ' : 'ЗАНЯТ(А)');
/** «СВОБОДНА» / «СВОБОДЕН»; пол не указан — «СВОБОДЕН(НА)» */
export const freeWord = (gender?: Gender) => (gender === 'f' ? 'СВОБОДНА' : gender === 'm' ? 'СВОБОДЕН' : 'СВОБОДЕН(НА)');

/** Сводка подзадач: «05 · 1 СДЕЛАНО» */
export const subtaskSummary = (total: number, done: number) => `${pad2(total)} · ${done} СДЕЛАНО`;

/** Когда подзадача: «ЧТ 8 ОКТ · 09:00–15:00»; вне дат плана — «СБ 10 ОКТ · ВНЕ ДАТ ПЛАНА»; без даты — «БЕЗ ДАТЫ» */
export function subtaskMeta(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>, outside: boolean): string {
  if (!t.date) return 'БЕЗ ДАТЫ';
  return outside ? `${dayMonth(t.date)} · ВНЕ ДАТ ПЛАНА` : periodLabel(t);
}
