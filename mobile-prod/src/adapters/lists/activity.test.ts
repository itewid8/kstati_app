import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { activityText } from '@/lib/activity';
import type { Activity, User } from '@/lib/types';
import { activityFixture } from '@/screens/fixtures/lists/activity';
import { CLOCK, DIMA, KARINA, LENA, SANYA, snapshot } from '../common/fixture';
import { colorMap } from '../common/people';
import { activityProps, feedDayLabel } from './activity';

/** Цвета ленты макета: Карина розовая, Дима зелёный, Лена жёлтая */
const USERS: User[] = [SANYA, KARINA, { ...DIMA, color: 'green' }, { ...LENA, color: 'yellow' }];

let seq = 0;
/** id ленты — «время#случайное», по нему порядок и «просмотрено» */
const ev = (at: string, actor: string, kind: Activity['kind'], extra: Partial<Activity> = {}): Activity => ({
  scope: 'g:g1',
  id: `${at}#${String(++seq).padStart(3, '0')}`,
  at,
  actor,
  kind,
  groupId: 'g1',
  ...extra,
});

/** События макета C-Activity (время московское: UTC+3), новые сверху */
const EVENTS: Activity[] = [
  ev('2026-10-05T14:40:00.000Z', 'k', 'task.add', { title: 'Баня', date: '2026-10-10', time: '15:00' }),
  ev('2026-10-05T11:12:00.000Z', 'k', 'task.done', { title: 'Забрать посылку' }),
  ev('2026-10-05T08:05:00.000Z', 'd', 'task.add', { title: 'Шашлыки на даче', date: '2026-10-17', groupId: 'g2' }),
  ev('2026-10-05T07:00:00.000Z', 's', 'task.add', { title: 'Своё — не показываем' }),
  ev('2026-10-04T18:30:00.000Z', 'k', 'task.edit', { title: 'Йога', date: '2026-10-05', time: '19:00', fields: ['date', 'time'] }),
  ev('2026-10-04T15:02:00.000Z', 'l', 'topic.share', { title: 'Подарки на НГ', groupId: 'g2' }),
  ev('2026-10-04T09:47:00.000Z', 'k', 'watch.add', { title: 'Разделение' }),
  ev('2026-10-04T07:20:00.000Z', 'd', 'wish.add', { title: 'Ручная кофемолка', scope: 'u:d', groupId: undefined }),
  ev('2026-10-03T17:15:00.000Z', 'l', 'task.done', { title: 'Забронировать столик', groupId: 'g2' }),
  ev('2026-10-03T13:48:00.000Z', 'k', 'task.add', { title: 'Стоматолог', date: '2026-10-05', time: '09:30' }),
  ev('2026-10-03T08:32:00.000Z', 'd', 'member.join', { groupId: 'g2' }),
];
// Лента хранится новыми сверху (по id)
EVENTS.sort((a, b) => b.id.localeCompare(a.id));

const s = snapshot({ users: USERS, activity: EVENTS });
const colors = colorMap(s);
const SEEN = EVENTS[3]?.id ?? '';

describe('activityProps (C-Activity)', () => {
  const fx = activityFixture();
  const got = activityProps(s, colors, CLOCK, SEEN);

  test('дни, люди, время, группы и «новое» как в макете', () => {
    assert.equal(got.caption, fx.caption);
    assert.deepEqual(
      got.days.map((d) => [d.label, d.date, d.events.length]),
      fx.days.map((d) => [d.label, d.date, d.events.length]),
    );
    const flat = (days: typeof got.days) => days.flatMap((d) => d.events.map((e) => [e.person, e.time, e.group, !!e.fresh]));
    // Событие ленты хотелок без группы — «ХОЧУ» (в макете у него группа «ДРУЗЬЯ»)
    const want = flat(fx.days).map((row, i) => (i === 6 ? [row[0], row[1], 'ХОЧУ', row[3]] : row));
    assert.deepEqual(flat(got.days), want);
  });

  test('тексты: «перенесла … на …», остальное по activityText (расхождения макета — ниже)', () => {
    const texts = got.days.flatMap((d) => d.events.map((e) => e.text));
    const want = fx.days.flatMap((d) => d.events.map((e) => e.text));
    // Макет: «добавил «Шашлыки…»» без «дело» (рядом — «добавила дело «Баня»»), «добавила в «Смотреть» сериал «Разделение»»,
    // «добавил в «Хочу» ручную кофемолку», событие «создал группу» (его нет)
    const SAME = [0, 1, 3, 4, 7, 8];
    for (const i of SAME) assert.equal(texts[i], want[i], `#${i}`);
    assert.equal(texts[2], 'добавил дело «Шашлыки на даче» на сб 17 окт');
    assert.equal(texts[5], 'добавила в «Смотреть» «Разделение»');
    assert.equal(texts[6], 'добавил в «Хочу» «Ручная кофемолка»');
    assert.equal(texts[9], 'вступил в группу');
  });

  test('без просмотренного всё новое; свои события не показываются', () => {
    const all = activityProps(s, colors, CLOCK, '');
    assert.ok(all.days.every((d) => d.events.every((e) => e.fresh)));
    assert.equal(all.days.flatMap((d) => d.events).length, EVENTS.length - 1);
  });

  test('сюрприз: подарок моей хотелки в ленте не виден (по scope и по id хотелки)', () => {
    const gift = [
      ev('2026-10-05T15:00:00.000Z', 'k', 'wish.done', { title: 'Плед', scope: 'u:s', groupId: undefined }),
      ev('2026-10-05T15:01:00.000Z', 'k', 'wish.done', { title: 'Плед', scope: 'x', itemId: 'w1', groupId: undefined }),
      ev('2026-10-05T15:02:00.000Z', 'k', 'wish.done', { title: 'Шарф', scope: 'u:d', groupId: undefined }),
    ].sort((a, b) => b.id.localeCompare(a.id));
    const wishes = [{ id: 'w1', ownerId: 's', title: 'Плед', note: '', link: '', receivedAt: null, createdAt: '' }];
    const got = activityProps(snapshot({ users: USERS, activity: gift, wishes }), colors, CLOCK, '');
    assert.deepEqual(got.days.flatMap((d) => d.events.map((e) => e.text)), ['отметила хотелку «Шарф» как подаренную']);
  });

  test('подписи дней: сегодня, вчера, дальше день недели', () => {
    assert.equal(feedDayLabel('2026-10-05', CLOCK.today), 'СЕГОДНЯ');
    assert.equal(feedDayLabel('2026-10-04', CLOCK.today), 'ВЧЕРА');
    assert.equal(feedDayLabel('2026-10-03', CLOCK.today), 'СУББОТА');
    assert.equal(feedDayLabel('2026-09-28', CLOCK.today), 'ПОНЕДЕЛЬНИК');
  });
});

describe('activityText: перенос', () => {
  const base = { scope: 'g:g1', id: '1', at: '2026-10-04T18:30:00.000Z', actor: 'o', kind: 'task.edit' as const, title: 'Йога', date: '2026-10-05', time: '19:00' };
  test('только дата, время или длительность — «перенёс(ла)» по полу', () => {
    assert.equal(activityText({ ...base, fields: ['date'] }, { id: 'o', name: 'Олег', gender: 'm' }, []), 'перенёс «Йога» на пн 5 окт · 19:00');
    assert.equal(activityText({ ...base, fields: ['time', 'end'] }, { id: 'k', name: 'Карина', gender: 'f' }, []), 'перенесла «Йога» на пн 5 окт · 19:00');
    assert.equal(activityText({ ...base, fields: ['date'] }, { id: 'x', name: 'Кто-то' }, []), 'перенёс(ла) «Йога» на пн 5 окт · 19:00');
  });
  test('вместе с другими полями — «изменил: …»', () => {
    assert.equal(
      activityText({ ...base, fields: ['title', 'date'] }, { id: 'o', name: 'Олег', gender: 'm' }, []),
      'изменил «Йога»: название, дату → пн 5 окт · 19:00',
    );
  });
});
