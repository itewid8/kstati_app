/**
 * Данные для виджета на рабочем столе: ближайшие дела из всех групп (с повторами), только название и когда.
 * Приложение заранее считает список на две недели вперёд; виджет сам отбрасывает то, что уже прошло.
 */
import { addDays, shortDate, toISODate } from '@/lib/dates';
import { expandTasks } from '@/lib/recur';
import type { Task } from '@/lib/types';

export type WidgetItem = {
  title: string;
  date: string;
  time: string | null;
  /** Начало (мс): дело со временем — его время; на весь день — полночь следующего дня (весь день остаётся «ближайшим») */
  until: number;
};

/** Цвета виджета — те же, что в приложении (theme.ts), по выбранной теме */
export type WidgetColors = { bg: string; text: string; muted: string; mic: string; onMic: string; border: string };
export const WIDGET_DARK: WidgetColors = { bg: '#1E1E1E', text: '#E6E6E6', muted: '#8B8B8B', mic: '#E6E6E6', onMic: '#1E1E1E', border: '#333333' };
export const WIDGET_LIGHT: WidgetColors = { bg: '#FFFFFF', text: '#1A1A1A', muted: '#6B6B6B', mic: '#1A1A1A', onMic: '#FFFFFF', border: '#E5E5E5' };

export type WidgetSnapshot = { items: WidgetItem[]; dark: boolean; at: number };

const ms = (date: string, time: string | null) => {
  const [y, m, d] = date.split('-').map(Number);
  if (!time) return new Date(y, m - 1, d + 1).getTime();
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};

/** Ближайшие невыполненные дела с датой: не больше 20, по времени */
export function upcoming(tasks: Task[], groupIds: Set<string>, now = new Date()): WidgetItem[] {
  const from = toISODate(now);
  const to = toISODate(addDays(now, 14));
  return expandTasks(
    tasks.filter((t) => groupIds.has(t.groupId) && t.date),
    from,
    to,
  )
    .filter((t) => !t.doneAt && t.date && t.date >= from && t.date <= to)
    .map((t) => ({ title: t.title, date: t.date!, time: t.time, until: ms(t.date!, t.time) }))
    .filter((x) => x.until > now.getTime())
    .sort((a, b) => a.until - b.until || a.title.localeCompare(b.title, 'ru'))
    .slice(0, 20);
}

/** Что показать в момент now: первые n ещё не прошедших */
export const visibleAt = (items: WidgetItem[], now: number, n: number) => items.filter((x) => x.until > now).slice(0, n);

/** «19:00» сегодня, «завтра 10:00», «сб 4 окт», «сегодня» — коротко, для строки виджета */
export function whenLabel(x: Pick<WidgetItem, 'date' | 'time'>, now: number): string {
  const today = toISODate(new Date(now));
  const tomorrow = toISODate(addDays(new Date(now), 1));
  const day = x.date === today ? '' : x.date === tomorrow ? 'завтра' : shortDate(x.date).split(' ').slice(0, 2).join(' ');
  if (x.time) return day ? `${day} ${x.time}` : x.time;
  return day || 'сегодня';
}
