/** Подписи событий телефона: когда, повтор, «куда» */
import { eventDays, repeatOf, ruleSupported, ruleText, type PhoneEvent } from '@/lib/phoneCalendar';
import { MONTHS_SHORT, WEEKDAYS, parts, weekday } from '@/screens/calendar/format';

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dayLabel = (iso: string) => {
  const p = parts(iso);
  return `${WEEKDAYS[weekday(iso)]} ${p.d} ${MONTHS_SHORT[p.m - 1]}`;
};

/** «ВТ 27 ОКТ · 14:00–15:00», «ВТ 3 НОЯ · ВЕСЬ ДЕНЬ», «ЧТ 5 НОЯ → СБ 7 НОЯ» */
export function whenText(ev: PhoneEvent): string {
  const { date, endDate } = eventDays(ev);
  if (endDate > date) return ev.allDay ? `${dayLabel(date)} → ${dayLabel(endDate)}` : `${dayLabel(date)} ${hm(ev.start)} → ${dayLabel(endDate)} ${hm(ev.end)}`;
  return ev.allDay ? `${dayLabel(date)} · ВЕСЬ ДЕНЬ` : `${dayLabel(date)} · ${hm(ev.start)}–${hm(ev.end)}`;
}

/** Время в строке списка: «10:00» или «—» */
export const timeText = (ev: PhoneEvent) => (ev.allDay ? '—' : hm(ev.start));

/** «НЕТ», «КАЖДЫЙ ПН», «ТОЛЬКО ЭТОТ РАЗ» (правило не ложится на повтор «Кстати») */
export function repeatLabel(ev: PhoneEvent): string {
  if (!ev.rule) return 'НЕТ';
  if (!ruleSupported(ev.rule)) return 'ТОЛЬКО ЭТОТ РАЗ';
  return ruleText(repeatOf(ev.rule)!, eventDays(ev).date);
}

/** Варианты «куда»: только мне и мои группы */
export type Dest = { key: string; label: string };
export const destsOf = (groups: readonly { id: string; name: string }[]): Dest[] => [
  { key: 'me', label: 'ТОЛЬКО МНЕ' },
  ...groups.map((g) => ({ key: g.id, label: g.name.toUpperCase() })),
];
