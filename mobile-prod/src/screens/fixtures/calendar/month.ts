/** Данные макета C-Month (design/mockups/C-Month.dc.html): октябрь 2026, выбран сегодняшний понедельник 5-е */
import type { AgendaRow, MonthItem, MonthScreenProps } from '../../calendar/MonthScreen';
import { KARINA, SANYA, TODAY, chrome } from './people';

const S = ['s'];
const K = ['k'];
const SK = ['s', 'k'];

/** Короткие названия по числам октября: [название, кто] */
const byDay: Record<number, [string, string[]][]> = {
  1: [['Отчёт', S]],
  2: [['Отчёт', S], ['Кино', SK]],
  3: [['Дача', SK]],
  5: [['Стоматолог', S], ['Созвон', S], ['Посылка', K], ['Йога', K], ['Сериал', SK]],
  6: [['МФЦ', S], ['Ужин с Леной', SK]],
  7: [['Футбол', S]],
  8: [['Встреча', K]],
  9: [['Поезд домой', K], ['Обед с Олегом', S], ['Кино', SK]],
  10: [['Полить грядки', S], ['Шашлыки', K], ['Созвон', S], ['Звонок маме', S]],
  11: [['Бранч у Ани', SK]],
  13: [['Йога', K]],
  14: [['Футбол', S]],
  15: [['МФЦ', S], ['Стрижка', K], ['Встреча', K], ['Футбол', S], ['Ужин', SK], ['Театр', SK], ['Йога', K]],
  17: [['Дача', SK]],
  20: [['Йога', K]],
  21: [['Футбол', S]],
  22: [['ДР Лены', SK]],
  24: [['Свадьба Ани', SK]],
  27: [['Йога', K]],
  28: [['Футбол', S]],
  31: [['Хэллоуин', SK]],
};

export const monthItems: Record<string, MonthItem[]> = Object.fromEntries(
  Object.entries(byDay).map(([d, list]) => [
    `2026-10-${d.padStart(2, '0')}`,
    list.map(([title, people], i) => ({ id: `${d}-${i}`, title, people })),
  ]),
);

export const monthAgenda: AgendaRow[] = [
  { id: 'dent', time: '09:30', title: 'Стоматолог', people: S },
  { id: 'call', time: '13:00', title: 'Созвон с Олегом', people: S },
  { id: 'parcel', time: '13:00', title: 'Забрать посылку', people: K },
  { id: 'yoga', time: '19:00', title: 'Йога', people: K },
  { id: 'series', time: '21:00', title: 'Сериал', people: SK },
];

export function monthFixture(): MonthScreenProps {
  return {
    ...chrome,
    people: [SANYA, KARINA],
    year: 2026,
    month: 10,
    today: TODAY,
    selectedDate: TODAY,
    items: monthItems,
    plans: [{ id: 'trip', startDate: '2026-10-07', endDate: '2026-10-09', color: 'pink' }],
    agenda: monthAgenda,
  };
}
