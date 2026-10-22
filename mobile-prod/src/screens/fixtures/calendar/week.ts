/** Данные макета C-Week (design/mockups/C-Week.dc.html): неделя 05—11 октября 2026, обе темы одинаковые */
import type { CalendarBar, TimedEvent } from '../../calendar/types';
import type { WeekScreenProps } from '../../calendar/WeekScreen';
import { KARINA, NOW, OLEG, SANYA, TODAY, chrome, hm } from './people';

export const weekBars: CalendarBar[] = [
  { id: 'gift', title: 'Подарок Лене', startDate: '2026-10-05', endDate: '2026-10-05', people: ['s'] },
  {
    id: 'trip',
    title: 'Командировка в Казань',
    meta: ' · 7 окт 07:00 → 9 окт 15:00',
    startDate: '2026-10-07',
    endDate: '2026-10-09',
    people: ['k'],
  },
  { id: 'mom', title: 'Мама в гостях', meta: ' · 8–10 окт', startDate: '2026-10-08', endDate: '2026-10-10', people: ['s', 'k'] },
  { id: 'dacha', title: 'Дача', meta: ' 09–20', startDate: '2026-10-10', endDate: '2026-10-10', people: ['s', 'k'] },
];

const ev = (id: string, a: number, b: number, title: string, people: string[], extra: Partial<TimedEvent> = {}): TimedEvent => ({
  id,
  title,
  start: hm(a),
  end: hm(b),
  people,
  ...extra,
});

export const weekEvents: Record<string, TimedEvent[]> = {
  '2026-10-05': [ev('dent', 9.5, 10.5, 'Стоматолог', ['s']), ev('yoga', 19, 20, 'Йога', ['k'])],
  '2026-10-06': [ev('mfc', 16, 17, 'МФЦ', ['s']), ev('dinner', 19, 20.5, 'Ужин с Леной', ['s', 'k'])],
  '2026-10-07': [
    ev('train1', 7, 9, 'Поезд в Казань', ['k'], { parentTitle: 'Казань' }),
    ev('football', 18, 21, 'Футбол', ['s'], { done: true }),
  ],
  '2026-10-08': [
    ev('meet', 9, 15, 'Встреча с заказчиком', ['k'], { parentTitle: 'Казань' }),
    ev('gym', 10.25, 13.75, 'Тренировка', ['s']),
    ev('report', 11.25, 12.75, 'Сдать отчёт', ['o']),
  ],
  '2026-10-09': [
    ev('train2', 13, 15, 'Поезд домой', ['k'], { parentTitle: 'Казань' }),
    ev('lunch', 14, 16.5, 'Обед с Олегом', ['s']),
    ev('cinema', 19.5, 22, 'Кино', ['s', 'k']),
  ],
  '2026-10-10': [
    ev('water', 9, 10.5, 'Полить грядки', ['s'], { parentTitle: 'Дача' }),
    ev('bbq', 13, 15.5, 'Шашлыки', ['k'], { parentTitle: 'Дача' }),
    ev('call', 14, 15, 'Созвон', ['o']),
    ev('mom-call', 17, 18.5, 'Звонок маме', ['s']),
  ],
  '2026-10-11': [ev('brunch', 11, 13, 'Бранч у Ани', ['s', 'k'])],
};

export function weekFixture(): WeekScreenProps {
  return {
    ...chrome,
    hasNews: true,
    weekStart: '2026-10-05',
    today: TODAY,
    now: NOW,
    bars: weekBars,
    events: weekEvents,
    people: [SANYA, KARINA, OLEG],
  };
}
