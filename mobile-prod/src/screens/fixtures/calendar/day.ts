/** Данные макета C-Day (design/mockups/C-Day.dc.html): понедельник 5 октября 2026, обе темы одинаковые */
import type { DayScreenProps } from '../../calendar/DayScreen';
import type { CalendarBar, TimedEvent } from '../../calendar/types';
import { KARINA, NOW, SANYA, TODAY, chrome, hm } from './people';

export const dayBars: CalendarBar[] = [{ id: 'gift', title: 'Подарок Лене', startDate: TODAY, endDate: TODAY, people: ['s'] }];

const ev = (id: string, a: number, b: number, title: string, note: string, people: string[]): TimedEvent => ({
  id,
  title,
  note,
  start: hm(a),
  end: hm(b),
  people,
});

export const dayEvents: TimedEvent[] = [
  ev('dent', 9.5, 10.5, 'Стоматолог', 'Клиника на Мира, каб. 4', ['s']),
  ev('call', 13, 13.5, 'Созвон с Олегом', 'Бюджет на ноябрь', ['s']),
  ev('parcel', 13, 14, 'Забрать посылку', 'СДЭК на Ленина, 12', ['k']),
  ev('yoga', 19, 20, 'Йога', 'Студия на Гоголя', ['k']),
  ev('series', 21, 22, 'Разделение', '3 сезон, 2 серия', ['s', 'k']),
];

export function dayFixture(): DayScreenProps {
  return {
    ...chrome,
    date: TODAY,
    today: TODAY,
    now: NOW,
    bars: dayBars,
    events: dayEvents,
    people: [SANYA, KARINA],
  };
}
