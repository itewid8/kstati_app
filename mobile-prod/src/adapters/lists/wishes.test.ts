import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Group, User, Wish } from '@/lib/types';
import { wishesFixture } from '@/screens/fixtures/wishes';
import { DIMA, KARINA, LENA, SANYA, snapshot } from '../common/fixture';
import { colorMap } from '../common/people';
import { ALL_PEOPLE, isOpenWish, linkDomain, parseWishKey, safeLink, wishKey, wishesProps } from './wishes';

/** Люди макета C-Wishes: Я, Карина, Дима, Лена (цвета — синий, розовый, зелёный, жёлтый) */
const US: Group = { id: 'g1', name: 'Мы с Кариной', category: 'couple', inviteCode: 'KST123', memberIds: ['s', 'k'], ownerId: 's', adminIds: [] };
const FRIENDS: Group = { id: 'g2', name: 'Друзья', category: 'friends', inviteCode: 'FRN456', memberIds: ['d', 's', 'l'], ownerId: 'd', adminIds: [] };
const USERS: User[] = [SANYA, KARINA, { ...DIMA, color: 'green' }, { ...LENA, color: 'yellow' }];

const wish = (id: string, ownerId: string, title: string, extra: Partial<Wish> = {}): Wish => ({
  id,
  ownerId,
  title,
  note: '',
  link: '',
  receivedAt: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  ...extra,
});

const WISHES: Wish[] = [
  wish('w1', 's', 'Наушники с шумоподавлением', { note: 'Sony WH-1000XM5', link: 'https://www.ozon.ru/product/sony-wh-1000xm5' }),
  wish('w2', 's', 'Шерстяной плед', { note: 'серый, 140×200' }),
  wish('w3', 's', 'Ручная кофемолка', { note: 'Timemore C2', link: 'https://www.ozon.ru/product/timemore-c2' }),
  wish('w4', 's', 'Билеты на «Щелкунчика»', { note: 'декабрь · на двоих' }),
  wish('g1', 's', 'Кроссовки для бега', { receivedAt: '2026-10-03T10:00:00.000Z', giftedBy: 'k', giftedAt: '2026-09-30T10:00:00.000Z' }),
  wish('g2', 's', 'Набор для пуэра', { receivedAt: '2026-10-02T10:00:00.000Z', giftedBy: 'd', giftedAt: '2026-09-29T10:00:00.000Z' }),
  wish('g3', 's', '«Мастер и Маргарита»', { receivedAt: '2026-10-01T10:00:00.000Z', giftedBy: 'l', giftedAt: '2026-09-28T10:00:00.000Z' }),
  wish('k1', 'k', 'Серьги', {}),
];

const s = snapshot({ users: USERS, groups: [US, FRIENDS], wishes: WISHES });
const colors = colorMap(s);

describe('wishesProps (C-Wishes)', () => {
  test('совпадает с макетом (светлая тема), кроме id строк', () => {
    const fx = wishesFixture('light');
    const got = wishesProps(s, colors, { personId: null, collapsed: [] });
    assert.equal(got.caption, fx.caption);
    assert.deepEqual(got.me, fx.me);
    assert.deepEqual(got.people.map((p) => [p.label, p.color]), fx.people.map((p) => [p.label, p.color]));
    assert.equal(got.selectedPersonId, 's');
    assert.deepEqual(got.wishes.map(({ id: _, ...w }) => w), fx.wishes.map(({ id: _, ...w }) => w));
    assert.deepEqual(got.gifted.map(({ id: _, ...w }) => w), fx.gifted.map(({ id: _, ...w }) => w));
    assert.equal(got.wishesOpen, fx.wishesOpen);
    assert.equal(got.giftedOpen, fx.giftedOpen);
  });

  test('свёрнутые разделы — из collapsedSections', () => {
    const got = wishesProps(s, colors, { personId: null, collapsed: ['wishes.gifted'] });
    assert.equal(got.giftedOpen, wishesFixture('dark').giftedOpen);
    assert.equal(got.wishesOpen, true);
  });

  test('сюрприз: своя хотелка, подаренная Кариной, остаётся в «Хочу», пока я не отметил получение', () => {
    // Так не приходит с сервера, но и локально (подарок «вслепую») владелец ничего не должен увидеть
    const hidden = snapshot({ users: USERS, groups: [US, FRIENDS], wishes: [wish('x', 's', 'Плед', { giftedBy: 'k', giftedAt: '2026-10-04T10:00:00.000Z' })] });
    const before = wishesProps(hidden, colors, { personId: null, collapsed: [] });
    assert.deepEqual(before.wishes.map((w) => [w.title, w.note]), [['Плед', '']]);
    assert.deepEqual(before.gifted, []);
    // Отметил «получил» — сервер прислал от кого
    const got = snapshot({ users: USERS, groups: [US, FRIENDS], wishes: [wish('x', 's', 'Плед', { receivedAt: '2026-10-05T10:00:00.000Z', giftedBy: 'k' })] });
    assert.deepEqual(wishesProps(got, colors, { personId: null, collapsed: [] }).gifted.map((w) => w.from), ['ОТ КАРИНЫ']);
    // Получил без дарителя
    const self = snapshot({ users: USERS, groups: [US, FRIENDS], wishes: [wish('x', 's', 'Плед', { receivedAt: '2026-10-05T10:00:00.000Z' })] });
    assert.deepEqual(wishesProps(self, colors, { personId: null, collapsed: [] }).gifted.map((w) => w.from), ['ПОЛУЧЕНО']);
  });

  test('чужая подаренная — в «Подарено» (от меня или от другого), неподаренная — в «Хочу»', () => {
    const list = [
      wish('a', 'k', 'Серьги'),
      wish('b', 'k', 'Книга', { giftedBy: 's', giftedAt: '2026-10-04T10:00:00.000Z' }),
      wish('c', 'k', 'Шарф', { giftedBy: 'd', giftedAt: '2026-10-03T10:00:00.000Z' }),
      wish('d', 'k', 'Кружка', { receivedAt: '2026-10-02T10:00:00.000Z' }),
    ];
    const got = wishesProps(snapshot({ users: USERS, groups: [US, FRIENDS], wishes: list }), colors, { personId: 'k', collapsed: [] });
    assert.equal(got.selectedPersonId, 'k');
    assert.deepEqual(got.wishes.map((w) => [w.id, w.ownerColor]), [['k/a', 'pink']]);
    assert.deepEqual(got.gifted.map((w) => [w.id, w.from]), [['k/b', 'ОТ МЕНЯ'], ['k/c', 'ОТ ДИМЫ'], ['k/d', 'ПОЛУЧЕНО']]);
  });

  test('ВСЕ: хотелки всех людей по порядку вкладок; неизвестный человек — снова я', () => {
    const all = wishesProps(s, colors, { personId: ALL_PEOPLE, collapsed: [] });
    assert.equal(all.selectedPersonId, ALL_PEOPLE);
    assert.deepEqual(all.wishes.map((w) => w.id), ['s/w1', 's/w2', 's/w3', 's/w4', 'k/k1']);
    assert.equal(wishesProps(s, colors, { personId: 'nobody', collapsed: [] }).selectedPersonId, 's');
  });

  test('ключ строки — владелец/id', () => {
    assert.equal(wishKey({ ownerId: 'k', id: 'w1' }), 'k/w1');
    assert.deepEqual(parseWishKey('k/w1'), { ownerId: 'k', id: 'w1' });
    assert.equal(parseWishKey('broken'), null);
  });

  test('isOpenWish: своя — до «получил», чужая — до подарка', () => {
    assert.equal(isOpenWish({ ownerId: 's', receivedAt: null, giftedBy: 'k' }, 's'), true);
    assert.equal(isOpenWish({ ownerId: 'k', receivedAt: null, giftedBy: 's' }, 's'), false);
    assert.equal(isOpenWish({ ownerId: 'k', receivedAt: '2026-10-01T00:00:00.000Z' }, 's'), false);
  });
});

describe('ссылки хотелок (F13)', () => {
  test('открываются только http и https; без схемы — как https', () => {
    assert.equal(safeLink(' https://ozon.ru/x '), 'https://ozon.ru/x');
    assert.equal(safeLink('HTTP://ozon.ru'), 'HTTP://ozon.ru');
    assert.equal(safeLink('ozon.ru/product/1'), 'https://ozon.ru/product/1');
    for (const bad of ['javascript:alert(1)', 'tel:+79990000000', 'intent://scan#Intent;end', 'file:///etc/passwd', 'kstatiapp://record', 'sms:1', 'https://', 'просто текст', '', 'https://a.ru/\nx', 'data:text/html,1']) {
      assert.equal(safeLink(bad), null, bad);
    }
  });

  test('чужая хотелка со ссылкой не по http(s) — без кнопки ссылки и без домена', () => {
    const got = wishesProps(
      snapshot({ users: USERS, groups: [US, FRIENDS], wishes: [wish('x', 'k', 'Звонок', { note: 'срочно', link: 'tel:+79990000000' })] }),
      colors,
      { personId: 'k', collapsed: [] },
    );
    assert.deepEqual(got.wishes.map((w) => [w.link, w.note]), [[null, 'СРОЧНО']]);
  });

  test('домен для подписи', () => {
    assert.equal(linkDomain('https://www.ozon.ru/product/1'), 'OZON.RU');
    assert.equal(linkDomain('https://user@market.yandex.ru:443/x'), 'MARKET.YANDEX.RU');
  });
});
