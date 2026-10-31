/**
 * Слой календаря телефона: разы событий (lib/phoneCalendar.ts) → данные экранов недели, дня и месяца.
 * Уже перенесённые в «Кстати» события (ext.id у моего дела) в слое не показываются — дело и так на месте.
 */
import type { IsoDate } from '@/lib/calendarLayout';
import { eventDays, type PhoneEvent } from '@/lib/phoneCalendar';
import type { ID, Task } from '@/lib/types';
import type { AgendaRow, MonthItem } from '@/screens/calendar/MonthScreen';
import type { CalendarBar, PhoneSlot } from '@/screens/calendar/types';

const DAY = 24 * 60;
const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const shift = (iso: IsoDate, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Ключ раза события: «id@начало» */
export const phoneKey = (ev: Pick<PhoneEvent, 'id' | 'start'>) => `${ev.id}@${ev.start}`;

/** События, ещё не перенесённые в мои дела */
export function notImported(events: readonly PhoneEvent[], tasks: readonly Task[], meId: ID | undefined): PhoneEvent[] {
  const done = new Set(tasks.filter((t) => t.ext && t.createdBy === meId).map((t) => t.ext!.id));
  return done.size ? events.filter((e) => !done.has(e.id)) : [...events];
}

/** Полоса над сеткой: весь день или сутки и дольше */
export const isPhoneBar = (ev: PhoneEvent) => ev.allDay || new Date(ev.end).getTime() - new Date(ev.start).getTime() >= DAY * 60000;

/** События со временем в сетке дня day (через полночь — по частям) */
export function phoneSlotsOn(events: readonly PhoneEvent[], day: IsoDate): PhoneSlot[] {
  const out: PhoneSlot[] = [];
  for (const ev of events) {
    if (isPhoneBar(ev)) continue;
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const sd = dayOf(s);
    const ed = e > s && !(minuteOf(e) === 0 && dayOf(e) > sd) ? dayOf(e) : sd;
    if (day < sd || day > ed) continue;
    const start = day === sd ? minuteOf(s) : 0;
    const end = day === ed ? (e > s ? minuteOf(e) || DAY : start) : DAY;
    out.push({ id: phoneKey(ev), title: ev.title || 'Без названия', start, end: Math.max(start, end) });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Полосы событий телефона, задевающие [from, to] */
export function phoneBarsIn(events: readonly PhoneEvent[], from: IsoDate, to: IsoDate): CalendarBar[] {
  const out: CalendarBar[] = [];
  for (const ev of events) {
    if (!isPhoneBar(ev)) continue;
    const { date, endDate } = eventDays(ev);
    if (endDate < from || date > to) continue;
    out.push({ id: phoneKey(ev), title: ev.title || 'Без названия', startDate: date, endDate, people: [], phone: true });
  }
  return out;
}

/** Строки ячеек месяца по дням [from, to] */
export function phoneMonthItems(events: readonly PhoneEvent[], from: IsoDate, to: IsoDate): Record<IsoDate, MonthItem[]> {
  const out: Record<IsoDate, MonthItem[]> = {};
  for (const ev of events) {
    const { date, endDate } = eventDays(ev);
    for (let d = date < from ? from : date; d <= endDate && d <= to; d = shift(d, 1)) {
      (out[d] ??= []).push({ id: phoneKey(ev), title: ev.title || 'Без названия', people: [], phone: true });
    }
  }
  return out;
}

/** Строки панели выбранного дня в месяце */
export function phoneAgendaOn(events: readonly PhoneEvent[], day: IsoDate): AgendaRow[] {
  const rows: (AgendaRow & { at: number })[] = [];
  for (const ev of events) {
    const { date, endDate } = eventDays(ev);
    if (day < date || day > endDate) continue;
    const timed = !ev.allDay && date === day;
    const s = new Date(ev.start);
    rows.push({ id: phoneKey(ev), time: timed ? `${pad(s.getHours())}:${pad(s.getMinutes())}` : '—', title: ev.title || 'Без названия', people: [], phone: true, at: timed ? minuteOf(s) : -1 });
  }
  return rows.sort((a, b) => a.at - b.at).map(({ at: _at, ...r }) => r);
}
