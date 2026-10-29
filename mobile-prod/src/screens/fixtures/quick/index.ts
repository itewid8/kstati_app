/**
 * Данные макетов C-QuickTask, C-QuickWish, C-QuickWatch, C-QuickIdea (design/mockups/C-Quick*.dc.html):
 * фон (упрощённый список), какая строка поднята и окно быстрых действий. Обе темы показывают одно и то же.
 * Цвета: s = blue (Саня), k = pink (Карина), sk — общее. Фон и поднятая строка — ./Backdrop.tsx (только данные здесь:
 * их читают тесты адаптеров).
 */
import type { PersonColor } from '@/lib/types';
import type { QuickSheetData } from '../../quick/types';
import type { BackdropRow, QuickBackdropProps } from './Backdrop';

const S: PersonColor[] = ['blue'];
const K: PersonColor[] = ['pink'];
const SK: PersonColor[] = ['blue', 'pink'];

const rows = (list: ReadonlyArray<readonly [string, string, PersonColor[]]>): BackdropRow[] =>
  list.map(([title, time, colors]) => ({ title, time, colors }));

export type QuickFixture = { backdrop: QuickBackdropProps; lift: number; sheet: QuickSheetData };

export const quickTaskFixture: QuickFixture = {
  backdrop: {
    title: 'Дела',
    head: 'СЕГОДНЯ',
    count: 'ПН 05',
    rows: rows([
      ['Стоматолог', '09:30', S],
      ['Забрать посылку', '—', K],
      ['Йога', '19:00', K],
      ['Подарок Лене', '—', S],
      ['Сериал', '21:00', SK],
      ['Оплатить коммуналку', '—', S],
    ]),
  },
  lift: 2,
  sheet: {
    card: { title: 'Йога', tag: 'КАЖДУЮ НЕДЕЛЮ', meta: 'ПН 05 ОКТ · 19:00–20:00 · КАРИНА', colors: K },
    tiles: [
      { key: 'done', label: 'ГОТОВО', primary: true },
      { key: 'edit', label: 'ИЗМЕНИТЬ' },
      { key: 'plan', label: 'В ПЛАН' },
      { key: 'copy', label: 'КОПИЯ' },
    ],
    section: {
      label: 'ПЕРЕНЕСТИ',
      segments: [
        { key: 'tomorrow', label: 'ЗАВТРА' },
        { key: 'hour', label: '+1 ЧАС' },
        { key: 'weekend', label: 'ВЫХОДНЫЕ' },
        { key: 'date', label: 'ДАТА…' },
      ],
    },
    deletable: true,
  },
};

export const quickWishFixture: QuickFixture = {
  backdrop: {
    title: 'Хочу',
    head: 'КАРИНА ХОЧЕТ',
    count: '06',
    rows: rows([
      ['Кофемолка', '—', K],
      ['Наушники Sony WH-1000XM5', '—', K],
      ['Книга «Тень ветра»', '—', K],
      ['Плед', '—', K],
      ['Билеты в театр', '—', K],
      ['Свеча с инжиром', '—', K],
    ]),
  },
  lift: 1,
  sheet: {
    card: { title: 'Наушники Sony WH-1000XM5', tag: 'OZON.RU', meta: 'КАРИНА · ДОБАВЛЕНО 28 СЕН', colors: K },
    tiles: [
      { key: 'gift', label: 'ПОДАРЮ', primary: true },
      { key: 'link', label: 'ССЫЛКА' },
      { key: 'toTask', label: 'В ДЕЛА' },
    ],
    deletable: false,
  },
};

export const quickWatchFixture: QuickFixture = {
  backdrop: {
    title: 'Смотреть',
    head: 'СМОТРЕТЬ',
    count: '05',
    rows: rows([
      ['Разделение', 'S2', SK],
      ['Дюна: Часть вторая', '—', S],
      ['Медведь', 'S3', SK],
      ['Аноры', '—', K],
      ['Тед Лассо', 'S1', SK],
      ['Бруталист', '—', S],
    ]),
  },
  lift: 0,
  sheet: {
    card: { title: 'Разделение', tag: 'СЕРИАЛ · S2', meta: 'САНЯ, КАРИНА · ТРИЛЛЕР', colors: SK },
    tiles: [
      { key: 'watched', label: 'ПОСМОТРЕЛИ', primary: true },
      { key: 'edit', label: 'ИЗМЕНИТЬ' },
      { key: 'toTask', label: 'В ДЕЛА' },
    ],
    deletable: true,
  },
};

export const quickIdeaFixture: QuickFixture = {
  backdrop: {
    title: 'Заметки',
    head: 'РЕМОНТ',
    count: '04',
    rows: rows([
      ['Покрасить стены в спальне', '—', S],
      ['Полки над столом', '—', K],
      ['Новый смеситель', '—', S],
      ['Шторы блэкаут', '—', K],
      ['Лампа для чтения', '—', S],
      ['Ковёр в коридор', '—', K],
    ]),
  },
  lift: 1,
  sheet: {
    card: { title: 'Полки над столом', tag: 'РЕМОНТ', meta: 'КАРИНА · 12 ОКТ', colors: K },
    tiles: [
      { key: 'edit', label: 'ИЗМЕНИТЬ' },
      { key: 'toTask', label: 'В ДЕЛА', primary: true },
      { key: 'copy', label: 'КОПИЯ' },
    ],
    section: {
      label: 'В ТЕМУ',
      segments: [
        { key: 't-vacation', label: 'ОТПУСК' },
        { key: 't-gifts', label: 'ПОДАРКИ' },
        { key: 'inbox', label: 'БЕЗ ТЕМЫ' },
      ],
    },
    deletable: true,
  },
};

/** C-TaskView: чужое дело у участника без прав админа — то же окно, только ГОТОВО / НАПОМНИТЬ / КОПИЯ и ЗАКРЫТЬ */
export const quickTaskViewFixture: QuickFixture = {
  ...quickTaskFixture,
  sheet: {
    card: quickTaskFixture.sheet.card,
    tiles: [
      { key: 'done', label: 'ГОТОВО', primary: true },
      { key: 'remind', label: 'НАПОМНИТЬ' },
      { key: 'copy', label: 'КОПИЯ' },
    ],
    deletable: false,
  },
};
