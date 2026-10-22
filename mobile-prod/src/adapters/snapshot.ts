/**
 * Общие типы адаптеров (src/adapters/**): чистые функции (Snapshot, Clock, UiState) → данные пропсов экрана.
 * Без react, react-native, expo и хранилища — тестируются на данных макетов (scripts/test.sh).
 */
import type { DayMinute, IsoDate } from '@/lib/calendarLayout';
import type { Activity, Group, ID, Idea, Me, ReminderSettings, Task, TaskReminderOverride, Topic, User, WatchItem, Wish } from '@/lib/types';

/** Срез хранилища, который нужен адаптерам. me не null: контейнеры живут только после входа */
export type Snapshot = {
  me: Me;
  users: User[];
  groups: Group[];
  currentGroupId: ID | null;
  tasks: Task[];
  wishes: Wish[];
  watch: WatchItem[];
  topics: Topic[];
  ideas: Idea[];
  overrides: Record<ID, TaskReminderOverride>;
  reminders: ReminderSettings;
  activity: Activity[];
  activitySeen: string;
};

/** Время снаружи — адаптеры детерминированы (в макетах сегодня 2026-10-05, 17:52) */
export type Clock = {
  today: IsoDate;
  /** Минуты от полуночи */
  now: DayMinute;
  /** Тот же момент строкой ISO (для сравнения с createdAt, at и т. п.) */
  nowIso: string;
};

/** Пропсы экрана без колбэков и safe area */
export type DataOf<P> = Omit<P, Extract<keyof P, `on${string}`> | 'insets' | 'bottomInset'>;
