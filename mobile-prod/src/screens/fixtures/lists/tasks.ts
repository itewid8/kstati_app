/**
 * Данные макета C-List (design/mockups/C-List.dc.html). Обе темы показывают одно и то же.
 * Цвета: s = blue (Саня), k = pink (Карина).
 */
import type { TaskSection, TasksListScreenProps } from '../../lists/TasksListScreen';

export const taskSections: TaskSection[] = [
  {
    id: 'today',
    label: 'СЕГОДНЯ',
    date: 'ПН 05',
    items: [
      { kind: 'task', id: 't1', title: 'Стоматолог', time: '09:30', owners: ['blue'], done: true },
      { kind: 'task', id: 't2', title: 'Забрать посылку', time: '—', owners: ['pink'], done: true },
      { kind: 'task', id: 't3', title: 'Йога', time: '19:00', owners: ['pink'], done: false },
      { kind: 'task', id: 't4', title: 'Подарок Лене', time: '—', owners: ['blue'], done: false, hidden: true },
    ],
  },
  {
    id: 'tomorrow',
    label: 'ЗАВТРА',
    date: 'ВТ 06',
    items: [
      { kind: 'task', id: 't5', title: 'Оплатить коммуналку', time: '—', owners: ['blue'], done: false },
      { kind: 'task', id: 't6', title: 'Ужин с Леной', time: '19:00', owners: ['blue', 'pink'], done: false },
    ],
  },
  {
    id: 'week',
    label: 'НЕДЕЛЯ',
    date: '07—11',
    items: [
      {
        kind: 'plan',
        id: 'p1',
        title: 'Командировка',
        progress: '1/3',
        range: '7—9',
        color: 'pink',
        steps: [
          { id: 'p1s1', title: 'Из Москвы в Казань', when: 'СР 06', done: true },
          { id: 'p1s2', title: 'Встреча с заказчиком', when: 'ЧТ 10', done: false },
          { id: 'p1s3', title: 'Обратно в Москву', when: 'ПТ 15', done: false },
        ],
      },
      { kind: 'task', id: 't7', title: 'Баня', time: 'СБ 15', owners: ['blue', 'pink'], done: false },
      { kind: 'task', id: 't8', title: 'Закупка на неделю', time: 'ВС 12', owners: ['blue', 'pink'], done: false },
    ],
  },
];

export function tasksListFixture(): TasksListScreenProps {
  return {
    groupLabel: 'МЫ С КАРИНОЙ',
    me: { letter: 'С', color: 'blue' },
    sections: taskSections,
  };
}
