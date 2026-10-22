/**
 * Данные макета C-Activity (design/mockups/C-Activity.dc.html). Обе темы одинаковые.
 * Цвета: Карина = pink, Дима = green, Лена = yellow.
 */
import type { ActivityScreenProps, FeedDay, FeedPerson } from '../../lists/ActivityScreen';

const karina: FeedPerson = { name: 'Карина', letter: 'К', color: 'pink' };
const dima: FeedPerson = { name: 'Дима', letter: 'Д', color: 'green' };
const lena: FeedPerson = { name: 'Лена', letter: 'Л', color: 'yellow' };

const US = 'МЫ С КАРИНОЙ';
const FRIENDS = 'ДРУЗЬЯ';

export const feedDays: FeedDay[] = [
  {
    id: 'd0',
    label: 'СЕГОДНЯ',
    date: 'ПН 05',
    events: [
      { id: 'e1', person: karina, text: 'добавила дело «Баня» на сб 10 окт · 15:00', time: '17:40', group: US, fresh: true },
      { id: 'e2', person: karina, text: 'отметила «Забрать посылку»', time: '14:12', group: US, fresh: true },
      { id: 'e3', person: dima, text: 'добавил «Шашлыки на даче» на сб 17 окт', time: '11:05', group: FRIENDS, fresh: true },
    ],
  },
  {
    id: 'd1',
    label: 'ВЧЕРА',
    date: 'ВС 04',
    events: [
      { id: 'e4', person: karina, text: 'перенесла «Йога» на пн 5 окт · 19:00', time: '21:30', group: US },
      { id: 'e5', person: lena, text: 'открыла тему «Подарки на НГ» группе', time: '18:02', group: FRIENDS },
      { id: 'e6', person: karina, text: 'добавила в «Смотреть» сериал «Разделение»', time: '12:47', group: US },
      { id: 'e7', person: dima, text: 'добавил в «Хочу» ручную кофемолку', time: '10:20', group: FRIENDS },
    ],
  },
  {
    id: 'd2',
    label: 'СУББОТА',
    date: 'СБ 03',
    events: [
      { id: 'e8', person: lena, text: 'отметила «Забронировать столик»', time: '20:15', group: FRIENDS },
      { id: 'e9', person: karina, text: 'добавила дело «Стоматолог» на пн 5 окт · 09:30', time: '16:48', group: US },
      { id: 'e10', person: dima, text: 'создал группу «Друзья» и пригласил Лену', time: '11:32', group: FRIENDS },
    ],
  },
];

export function activityFixture(): ActivityScreenProps {
  return { caption: 'ВСЕ ГРУППЫ · 30 ДНЕЙ', days: feedDays };
}
