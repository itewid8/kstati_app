import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Group, Idea, Topic, User, WatchItem, Wish } from '@/lib/types';
import { groupFixture } from '@/screens/fixtures/account/group';
import { profileFixture } from '@/screens/fixtures/account/profile';
import { settingsFixture } from '@/screens/fixtures/account/settings';
import { CLOCK, KARINA, SANYA, snapshot, task } from '../common/fixture';
import { colorMap } from '../common/people';
import { groupProps, roleOf } from './group';
import { profileProps } from './profile';
import { remindersSummary, settingsProps, voiceLangOf } from './settings';

describe('profileProps (C-Profile)', () => {
  test('совпадает с макетом', () => {
    const fx = profileFixture();
    const groups: Group[] = fx.groups.map((g, i) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      inviteCode: '',
      memberIds: ['s', ...['k', 'd', 'l', 'o'].slice(0, g.memberCount - 1)],
      ownerId: i ? 'k' : 's',
      adminIds: [],
    }));
    const s = snapshot({ me: { ...SANYA, nick: 'sasha', email: 'sasha@yandex.ru' }, groups });
    assert.deepEqual(profileProps(s, colorMap(s)), { me: { ...fx.me, avatar: null }, groups: fx.groups });
  });
});

describe('settingsProps (C-Settings)', () => {
  test('совпадает с макетом', () => {
    const fx = settingsFixture();
    const got = settingsProps({
      theme: 'system',
      micMode: 'tap',
      voiceLang: 'ru-RU',
      reminders: { enabled: true, timed: ['d1@20:00', 'm120'], allDay: ['d1@20:00'] },
      voiceQuota: { limit: 30, used: 3 },
      net: 'ok',
      vpnOn: false,
      version: '1.0.3 (42)',
    });
    assert.deepEqual(got, fx);
  });

  test('без счётчика с сервера — 0 из 30; язык; пустые напоминания', () => {
    const got = settingsProps({
      theme: 'dark',
      micMode: 'hold',
      voiceLang: 'auto',
      reminders: { enabled: false, timed: [], allDay: ['d0@09:00', 'd7@20:00'] },
      voiceQuota: null,
      net: 'offline',
      vpnOn: true,
      version: '0.1.0 (1)',
    });
    assert.deepEqual([got.voiceUsed, got.voiceLimit, got.language, got.serverOnline], [0, 30, 'auto', false]);
    assert.equal(got.timedReminders, 'НЕ НАПОМИНАТЬ');
    assert.equal(got.allDayReminders, 'В ДЕНЬ СОБЫТИЯ В 09:00 · ЗА НЕДЕЛЮ В 20:00');
    assert.equal(remindersSummary(['m30', 'm0']), 'В МОМЕНТ НАЧАЛА · ЗА 30 МИН');
    assert.equal(voiceLangOf('en'), 'en-US');
  });
});

describe('groupProps (C-Group)', () => {
  const US: Group = { id: 'g1', name: 'Мы с Кариной', category: 'couple', inviteCode: 'K7P2QX', memberIds: ['k', 's'], ownerId: 's', adminIds: ['k'] };
  const users: User[] = [{ ...SANYA, nick: 'sasha' }, { ...KARINA, nick: 'karina' }, { id: 'd', name: 'Дима' }];
  const wish = (id: string, ownerId: string, extra: Partial<Wish> = {}): Wish => ({ id, ownerId, title: id, note: '', link: '', receivedAt: null, createdAt: '', ...extra });
  const watch = (id: string, groupId: string, watchedAt: string | null = null): WatchItem => ({
    id,
    groupId,
    title: id,
    kind: null,
    genres: [],
    origin: null,
    year: null,
    addedBy: 's',
    watchedAt,
    createdAt: '',
  });
  const topic = (id: string, groupIds: string[]): Topic => ({ id, ownerId: 'k', title: id, groupIds, createdAt: '' });
  const idea = (id: string, topicId: string | null): Idea => ({ id, ownerId: 'k', topicId, text: id, createdAt: '', updatedAt: '' });

  const s = snapshot({
    me: { ...SANYA, nick: 'sasha', email: 'sasha@yandex.ru' },
    users,
    groups: [US],
    tasks: [
      task('open', '2026-10-06', null, 'Открытое', ['s']),
      task('done', '2026-10-01', null, 'Сделано', ['s'], { doneAt: '2026-10-01T10:00:00.000Z' }),
      task('series', '2026-09-07', '19:00', 'Йога', ['k'], { repeat: { freq: 'week', every: 1 } }),
      task('ended', '2026-09-07', '19:00', 'Кончилась', ['k'], { repeat: { freq: 'week', every: 1, until: '2026-09-20' } }),
      task('plan', '2026-10-07', null, 'План', ['k']),
      task('kid', '2026-10-07', null, 'Шаг', ['k'], { parentId: 'plan' }),
      task('foreign', '2026-10-06', null, 'Чужая группа', ['d'], { groupId: 'g2' }),
    ],
    wishes: [
      wish('mine', 's'),
      // Мою подарили втайне — всё ещё открыта (сюрприз)
      wish('mineGifted', 's', { giftedBy: 'k' }),
      wish('mineReceived', 's', { receivedAt: '2026-10-01T00:00:00.000Z' }),
      wish('hers', 'k'),
      wish('hersGifted', 'k', { giftedBy: 's' }),
      wish('dimas', 'd'),
    ],
    watch: [watch('a', 'g1'), watch('b', 'g1', '2026-10-01T00:00:00.000Z'), watch('c', 'g2')],
    topics: [topic('t1', ['g1']), topic('t2', [])],
    ideas: [idea('x1', 't1'), idea('x2', 't1'), idea('y', 't2'), idea('z', null)],
  });

  test('совпадает с макетом, кроме счётчиков списков', () => {
    const fx = groupFixture();
    const got = groupProps(s, colorMap(s), 'g1', CLOCK);
    assert.ok(got);
    const { lists: _a, members, ...rest } = got;
    const { lists: _b, members: fxMembers, ...fxRest } = fx;
    assert.deepEqual(rest, fxRest);
    assert.deepEqual(members.map(({ id: _, ...m }) => m), fxMembers.map(({ id: _, ...m }) => m));
  });

  test('счётчики: открытые дела (серия — одно, план — по шагам), хотелки без отметки, очередь, идеи открытых тем', () => {
    assert.deepEqual(groupProps(s, colorMap(s), 'g1', CLOCK)?.lists, [
      { key: 'tasks', count: 3 },
      { key: 'wishes', count: 3 },
      { key: 'watch', count: 1 },
      { key: 'ideas', count: 2 },
    ]);
  });

  test('роли; нет группы — null', () => {
    assert.equal(roleOf(US, 's'), 'owner');
    assert.equal(roleOf(US, 'k'), 'admin');
    assert.equal(roleOf(US, 'd'), 'member');
    assert.equal(groupProps(s, colorMap(s), 'nope', CLOCK), null);
  });
});
