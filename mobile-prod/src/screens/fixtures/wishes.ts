/**
 * Данные макета C-Wishes (design/mockups/C-Wishes.dc.html) — для стенда сверки и превью.
 * Светлый макет: обе секции открыты; тёмный: «Подарено» свёрнуто.
 */
import type { Scheme } from '@/ui';
import type { GiftedRow, WishPerson, WishRow, WishesScreenProps } from '../WishesScreen';

export const wishPeople: WishPerson[] = [
  { id: 'me', label: 'Я', color: 'blue' },
  { id: 'karina', label: 'КАРИНА', color: 'pink' },
  { id: 'dima', label: 'ДИМА', color: 'green' },
  { id: 'lena', label: 'ЛЕНА', color: 'yellow' },
];

export const wishRows: WishRow[] = [
  {
    id: 'w1',
    title: 'Наушники с шумоподавлением',
    note: 'SONY WH-1000XM5 · OZON.RU',
    link: 'https://www.ozon.ru/product/sony-wh-1000xm5',
    ownerColor: 'blue',
  },
  { id: 'w2', title: 'Шерстяной плед', note: 'СЕРЫЙ, 140×200', link: null, ownerColor: 'blue' },
  {
    id: 'w3',
    title: 'Ручная кофемолка',
    note: 'TIMEMORE C2 · OZON.RU',
    link: 'https://www.ozon.ru/product/timemore-c2',
    ownerColor: 'blue',
  },
  { id: 'w4', title: 'Билеты на «Щелкунчика»', note: 'ДЕКАБРЬ · НА ДВОИХ', link: null, ownerColor: 'blue' },
];

export const giftedRows: GiftedRow[] = [
  { id: 'g1', title: 'Кроссовки для бега', from: 'ОТ КАРИНЫ' },
  { id: 'g2', title: 'Набор для пуэра', from: 'ОТ ДИМЫ' },
  { id: 'g3', title: '«Мастер и Маргарита»', from: 'ОТ ЛЕНЫ' },
];

export function wishesFixture(scheme: Scheme): WishesScreenProps {
  return {
    caption: 'ВИШЛИСТЫ · 4 ЧЕЛОВЕКА',
    me: { letter: 'С', color: 'blue' },
    people: wishPeople,
    selectedPersonId: 'me',
    wishes: wishRows,
    gifted: giftedRows,
    wishesOpen: true,
    giftedOpen: scheme === 'light',
  };
}
