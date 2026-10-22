import { useShallow } from 'zustand/react/shallow';
import type { Snapshot } from '@/adapters/snapshot';
import { useStore } from '@/lib/store';
import type { Me } from '@/lib/types';

export type StoreState = ReturnType<typeof useStore.getState>;

/** Пока выходим из аккаунта, экран может отрисоваться ещё раз без me — адаптеры получают пустого человека */
export const NO_ME: Me = { id: '', name: '' };

/** Срез хранилища для адаптеров: те же ссылки на списки — useShallow не перерисовывает экран зря */
export const pickSnapshot = (s: StoreState): Snapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  currentGroupId: s.currentGroupId,
  tasks: s.tasks,
  wishes: s.wishes,
  watch: s.watch,
  topics: s.topics,
  ideas: s.ideas,
  overrides: s.overrides,
  reminders: s.reminders,
  activity: s.activity,
  activitySeen: s.activitySeen,
});

export const useSnapshot = (): Snapshot => useStore(useShallow(pickSnapshot));
