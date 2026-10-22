/**
 * Snapshot из данных макетов окон редактирования — только для *.test.ts.
 * Саня (я) и Карина в группе «Мы с Кариной»; сегодня пн 2026-10-05.
 *  - «Ужин у родителей» — сб 10 окт 19:00, оба; мои напоминания «за 2 ч» и «накануне в 20:00» (C-EditDate / -Remind / -Who);
 *  - «Йога» вечером в ту же субботу 19:00–20:00 у Карины — пересечение с ужином;
 *  - серия «Йога» по субботам 10:00–11:30 до 31 дек (C-EditRepeat), открыт раз 10 окт;
 *  - план «Командировка в Казань» ср 7 07:00 – пт 9 15:00 с пятью подзадачами, «Сувениры маме» — в сб 10 (C-EditPlan / -Period / -Year).
 */
import type { Group, Task, User } from '@/lib/types';
import type { Clock, Snapshot } from '../snapshot';

export const CLOCK: Clock = { today: '2026-10-05', now: 17 * 60 + 52, nowIso: '2026-10-05T14:52:00.000Z' };

export const SANYA: User = { id: 'sanya', name: 'Саня', gender: 'm' };
export const KARINA: User = { id: 'karina', name: 'Карина', gender: 'f' };

export const US: Group = {
  id: 'g1',
  name: 'Мы с Кариной',
  category: 'couple',
  inviteCode: 'KST123',
  memberIds: ['sanya', 'karina'],
  ownerId: 'sanya',
  adminIds: [],
};

const task = (id: string, date: string | null, time: string | null, title: string, people: string[], extra: Partial<Task> = {}): Task => ({
  id,
  groupId: 'g1',
  title,
  date,
  time,
  createdBy: people[0] ?? 'sanya',
  doneAt: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  people,
  ...extra,
});

export const DINNER = task('dinner', '2026-10-10', '19:00', 'Ужин у родителей', ['sanya', 'karina'], {
  note: 'Взять торт из «Север-Метрополь»',
});
export const YOGA_EVENING = task('yoga-eve', '2026-10-10', '19:00', 'Йога', ['karina'], { endTime: '20:00' });
export const YOGA = task('yoga', '2026-09-05', '10:00', 'Йога', ['karina'], {
  endTime: '11:30',
  note: 'Коврик и вода',
  repeat: { freq: 'week', every: 1, weekdays: [6], until: '2026-12-31' },
});
export const TRIP = task('trip', '2026-10-07', '07:00', 'Командировка в Казань', ['karina'], {
  endDate: '2026-10-09',
  endTime: '15:00',
  note: 'Переговоры с заказчиком. Отель на Баумана, 12',
  reminders: ['d1@20:00'],
});
export const KIDS: Task[] = [
  task('s1', '2026-10-07', '07:00', 'Поезд в Казань', ['karina'], { endTime: '09:00', parentId: 'trip', doneAt: '2026-10-05T10:00:00.000Z' }),
  task('s2', '2026-10-08', '09:00', 'Встреча с заказчиком', ['karina'], { endTime: '15:00', parentId: 'trip' }),
  task('s3', '2026-10-08', '19:00', 'Ужин с командой', ['karina'], { parentId: 'trip' }),
  task('s4', '2026-10-09', '13:00', 'Поезд домой', ['karina'], { endTime: '15:00', parentId: 'trip' }),
  task('s5', '2026-10-10', null, 'Сувениры маме', ['karina'], { parentId: 'trip' }),
];

export function snapshot(patch: Partial<Snapshot> = {}): Snapshot {
  return {
    me: { ...SANYA, email: 'sanya@example.com' },
    users: [SANYA, KARINA],
    groups: [US],
    currentGroupId: 'g1',
    tasks: [DINNER, YOGA_EVENING, YOGA, TRIP, ...KIDS],
    wishes: [],
    watch: [],
    topics: [],
    ideas: [],
    overrides: { dinner: ['m120', 'd1@20:00'] },
    reminders: { enabled: true, timed: ['m60'], allDay: ['d1@20:00'] },
    activity: [],
    activitySeen: '',
    ...patch,
  };
}
