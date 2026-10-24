/** Данные макетов C-ShareJoin, C-ShareMine, C-ShareAsk (design/mockups/*.dc.html). Обе темы — одно состояние */
import type { ShareScreenProps, ShareTask } from '../../account/ShareScreen';

/** [название, когда, видно группе, «только я»] — мои дела, полоса моего цвета */
const tasks = (list: ReadonlyArray<readonly [string, string, boolean, boolean?]>): ShareTask[] =>
  list.map(([title, meta, visible, onlyMe = false], i) => ({ key: `t${i}`, title, meta, colors: ['blue'], visible, onlyMe }));

const MINE = tasks([
  ['Футбол', 'СР 28 ОКТ · 18:00', true],
  ['Стоматолог', 'ЧТ 29 ОКТ · 09:30', true],
  ['Подарок Карине', 'СБ 31 ОКТ', false],
  ['Поезд в Казань', 'ПН 2 НОЯ · 07:00', true],
  ['Психолог', 'ВТ 3 НОЯ · 19:00', false, true],
  ['Оплатить коммуналку', 'ПТ 6 НОЯ', true],
]);

export function shareJoinFixture(): ShareScreenProps {
  return { variant: 'join', caption: 'ВЫ В ГРУППЕ · ДРУЗЬЯ', title: 'Мои дела', selectOnly: false, visible: 40, total: 42, tasks: MINE };
}

export function shareMineFixture(): ShareScreenProps {
  return { variant: 'group', caption: 'ГРУППА · МЫ С КАРИНОЙ', title: 'Мои дела в группе', color: 'blue', selectOnly: false, visible: 40, total: 42, tasks: MINE };
}

export function shareAskFixture(): ShareScreenProps {
  return {
    ...shareMineFixture(),
    selectOnly: true,
    visible: 5,
    tasks: tasks([
      ['Футбол', 'СР 28 ОКТ · 18:00', true],
      ['Стоматолог', 'ЧТ 29 ОКТ · 09:30', false],
      ['Подарок Карине', 'СБ 31 ОКТ', false],
      ['Поезд в Казань', 'ПН 2 НОЯ · 07:00', true],
      ['Психолог', 'ВТ 3 НОЯ · 19:00', false, true],
      ['Оплатить коммуналку', 'ПТ 6 НОЯ', false],
    ]),
    ask: { group: 'Мы с Кариной', now: 5, next: 40, total: 42 },
  };
}
