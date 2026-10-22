/**
 * Snapshot из данных макетов — для тестов адаптеров (только *.test.ts, приложение его не импортирует).
 * Сегодня понедельник 2026-10-05, 17:52. Люди: Саня (я, s), Карина (k), Олег (o) — как в fixtures/calendar/people.ts
 * (в макетах календаря вкладка Олега стоит в группе «Мы с Кариной»), плюс Дима (d) и Лена (l) из «Друзей».
 */
import type { Group, Task, User } from '@/lib/types';
import type { Clock, Snapshot } from '../snapshot';

export const CLOCK: Clock = { today: '2026-10-05', now: 17 * 60 + 52, nowIso: '2026-10-05T14:52:00.000Z' };

export const SANYA: User = { id: 's', name: 'Саня', gender: 'm' };
export const KARINA: User = { id: 'k', name: 'Карина', gender: 'f' };
export const OLEG: User = { id: 'o', name: 'Олег', gender: 'm' };
export const DIMA: User = { id: 'd', name: 'Дима', gender: 'm' };
export const LENA: User = { id: 'l', name: 'Лена', gender: 'f' };

export const US: Group = { id: 'g1', name: 'Мы с Кариной', category: 'couple', inviteCode: 'KST123', memberIds: ['s', 'k', 'o'], ownerId: 's', adminIds: [] };
export const FRIENDS: Group = { id: 'g2', name: 'Друзья', category: 'friends', inviteCode: 'FRN456', memberIds: ['d', 's', 'l'], ownerId: 'd', adminIds: [] };

/** Дело группы «Мы с Кариной»: автор — первый из people */
export function task(id: string, date: string | null, time: string | null, title: string, people: string[], extra: Partial<Task> = {}): Task {
  return {
    id,
    groupId: 'g1',
    title,
    date,
    time,
    createdBy: people[0] ?? 's',
    doneAt: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    people,
    ...extra,
  };
}

/** Часть недели C-Week: обычные дела, серия, многодневные, планы с подзадачами */
export const TASKS: Task[] = [
  task('dent', '2026-10-05', '09:30', 'Стоматолог', ['s'], { endTime: '10:30', note: 'Клиника на Мира' }),
  task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { endTime: '20:00', repeat: { freq: 'week', every: 1 } }),
  task('gift', '2026-10-05', null, 'Подарок Лене', ['s']),
  task('trip', '2026-10-07', '07:00', 'Командировка в Казань', ['k'], { endDate: '2026-10-09', endTime: '15:00' }),
  task('train1', '2026-10-07', '07:00', 'Поезд в Казань', ['k'], { endTime: '09:00', parentId: 'trip', doneAt: '2026-10-05T10:00:00.000Z' }),
  task('meet', '2026-10-08', '09:00', 'Встреча с заказчиком', ['k'], { endTime: '15:00', parentId: 'trip' }),
  task('mom', '2026-10-08', null, 'Мама в гостях', ['s', 'k'], { endDate: '2026-10-10' }),
  task('lunch', '2026-10-09', '14:00', 'Обед с Олегом', ['s'], { endTime: '16:30' }),
  task('cinema', '2026-10-09', '19:30', 'Кино', ['s', 'k'], { endTime: '22:00' }),
  task('night', '2026-10-09', '23:00', 'Ночной поезд', ['o'], { endDate: '2026-10-10', endTime: '06:00' }),
  task('none', null, null, 'Без даты', ['s']),
];

export function snapshot(patch: Partial<Snapshot> = {}): Snapshot {
  return {
    me: { ...SANYA, email: 'sanya@example.com' },
    users: [SANYA, KARINA, OLEG, DIMA, LENA],
    groups: [US, FRIENDS],
    currentGroupId: 'g1',
    tasks: TASKS,
    wishes: [],
    watch: [],
    topics: [],
    ideas: [],
    overrides: {},
    reminders: { enabled: true, timed: ['m60'], allDay: ['d1@20:00'] },
    activity: [],
    activitySeen: '',
    ...patch,
  };
}
