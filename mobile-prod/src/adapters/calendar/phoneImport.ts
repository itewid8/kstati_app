/**
 * Список «Перенести»: из разов событий телефона — по одной строке на событие (серия — один раз, первым разом периода).
 * Серии с повтором — отдельным блоком «ПОВТОРЯЮТСЯ», остальное — по дням. Состояние строки — по моим делам с ext:
 * нет — new; есть и отпечаток совпадает — done; отпечаток другой (изменили в телефоне) — changed.
 */
import { eventDays, eventHash, isSeries, repeatOf, ruleText, type PhoneCal, type PhoneEvent } from '@/lib/phoneCalendar';
import type { ID, Task } from '@/lib/types';
import { MONTHS_SHORT, WEEKDAYS, pad2, parts, weekday } from '@/screens/calendar/format';
import type { ImportRow, ImportSection } from '@/screens/phone/PhoneImportScreen';

export type ImportItem = { key: string; ev: PhoneEvent; series: boolean; state: ImportRow['state']; taskId?: ID };

export function importItems(events: readonly PhoneEvent[], tasks: readonly Task[], meId: ID | undefined): ImportItem[] {
  const mine = new Map<string, Task>();
  for (const t of tasks) if (t.ext && t.createdBy === meId) mine.set(t.ext.id, t);
  const first = new Map<string, PhoneEvent>();
  for (const ev of [...events].sort((a, b) => a.start.localeCompare(b.start))) if (!first.has(ev.id)) first.set(ev.id, ev);
  return [...first.values()].map((ev) => {
    const t = mine.get(ev.id);
    const state: ImportRow['state'] = !t ? 'new' : t.ext!.h === eventHash(ev) ? 'done' : 'changed';
    return { key: ev.id, ev, series: isSeries(ev), state, ...(t && { taskId: t.id }) };
  });
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayTitle = (iso: string) => {
  const p = parts(iso);
  return `${WEEKDAYS[weekday(iso)]} ${pad2(p.d)} ${MONTHS_SHORT[p.m - 1]}`;
};

export function importSections(
  items: readonly ImportItem[],
  selected: ReadonlySet<string>,
  cals: ReadonlyMap<string, PhoneCal>,
): ImportSection[] {
  const row = (it: ImportItem, time: string): ImportRow => {
    const cal = cals.get(it.ev.calendarId);
    return {
      key: it.key,
      time,
      title: it.ev.title || 'Без названия',
      cal: (cal?.title ?? '').toUpperCase(),
      ...(it.series && { repeat: true }),
      ...(cal?.birthdays && { birthday: true }),
      state: it.state,
      checked: it.state === 'new' && selected.has(it.key),
    };
  };
  const hm = (ev: PhoneEvent) => {
    if (ev.allDay) return '—';
    const d = new Date(ev.start);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const out: ImportSection[] = [];
  const series = items.filter((i) => i.series);
  if (series.length) {
    out.push({
      key: 'series',
      title: 'ПОВТОРЯЮТСЯ',
      rows: series.map((i) => ({ ...row(i, hm(i.ev)), title: `${i.ev.title || 'Без названия'} · ${ruleText(repeatOf(i.ev.rule)!, eventDays(i.ev).date)}` })),
    });
  }
  const byDay = new Map<string, ImportItem[]>();
  for (const i of items) {
    if (i.series) continue;
    const d = eventDays(i.ev).date;
    byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  for (const d of [...byDay.keys()].sort()) {
    const list = byDay.get(d)!.sort((a, b) => Number(!a.ev.allDay) - Number(!b.ev.allDay) || a.ev.start.localeCompare(b.ev.start));
    out.push({ key: d, title: dayTitle(d), rows: list.map((i) => row(i, hm(i.ev))) });
  }
  return out;
}
