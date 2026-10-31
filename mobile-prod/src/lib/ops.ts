/**
 * Операции изменения данных (POST /ops) и ключ записи для очереди. Чистый модуль: без Expo и хранилища,
 * его подключают и net.ts, и тесты синхронизации.
 */
import type { ID, PersonColor, ReminderSettings, Repeat } from './types';

type TaskOp = {
  id: string;
  groupId: string;
  /** API 3: чьё дело (для чужого — владелец) и видимость (сервер берёт её только от владельца) */
  ownerId?: string;
  only?: boolean;
  share?: Record<string, boolean>;
  title: string;
  date: string | null;
  time: string | null;
  note?: string;
  doneAt: string | null;
  repeat: Repeat | null;
  doneDates: string[];
  skipDates: string[];
  reminders: string[] | null;
  endDate: string | null;
  endTime: string | null;
  people: string[];
  parentId: string | null;
  kind?: 'task' | 'birthday' | 'important' | 'trip';
  celebrant?: { id?: string; name: string } | null;
  /** Откуда перенесено (только своё дело); нет поля — сервер оставляет как было */
  ext?: { cal: string; id: string; h: string } | null;
};
type WatchOp = {
  id: string;
  groupId: string;
  title: string;
  kind: string | null;
  genres: string[];
  origin: string | null;
  year: number | null;
  watchedAt: string | null;
};
/** giftedBy новый клиент не шлёт: сервер хранит скрытую отметку сам (тип — для полноты) */
type WishOp = { id: string; title: string; note: string; link: string; receivedAt: string | null; giftedBy?: ID | null };

export type Op =
  | { op: 'task.put'; task: TaskOp }
  | { op: 'watch.put'; watch: WatchOp }
  | { op: 'item.delete'; groupId: string; id: string; ownerId?: string }
  | { op: 'wish.put'; wish: WishOp }
  | { op: 'wish.delete'; id: string }
  /** Подарок чужой хотелки (API 2): снять может только подаривший */
  | { op: 'wish.gift'; ownerId: ID; id: ID; gifted: boolean }
  /** archivedAt: строка — в архив, null — из архива, нет поля — не трогать */
  | { op: 'topic.put'; topic: { id: string; title: string; groupIds: string[]; body?: string; archivedAt?: string | null } }
  | { op: 'topic.delete'; id: string }
  | { op: 'idea.put'; idea: { id: string; topicId: string | null; text: string } }
  | { op: 'idea.delete'; id: string }
  | { op: 'group.create'; group: { id: string; name: string; category: string } }
  | { op: 'group.update'; id: string; name?: string; category?: string }
  | { op: 'group.join'; code: string }
  | { op: 'group.leave'; id: string }
  | { op: 'group.admin'; id: string; userId: string; admin: boolean }
  | { op: 'group.remove'; id: string; userId: string }
  /** Мой режим в группе (API 3): true — «Только выбранные» */
  | { op: 'group.mode'; id: string; selectOnly: boolean }
  | { op: 'profile'; name?: string; nick?: string | null; gender?: 'm' | 'f' | null; color?: PersonColor | null; avatar?: string | null }
  /** Личные напоминания: по умолчанию и для отдельных дел (null — убрать своё) */
  | { op: 'prefs'; reminders?: ReminderSettings; overrides?: Record<string, string[] | null> };

export type OpResult = { ok: boolean; error?: string; message?: string; [k: string]: unknown };

/** Ключ записи, которую меняет операция: повторная правка той же записи заменяет прежнюю в очереди */
export function opKey(o: Op): string | null {
  switch (o.op) {
    case 'task.put':
      return `item:${o.task.id}`;
    case 'watch.put':
      return `item:${o.watch.id}`;
    case 'item.delete':
      return `item:${o.id}`;
    case 'wish.put':
      return `wish:${o.wish.id}`;
    case 'wish.delete':
      return `wish:${o.id}`;
    case 'wish.gift':
      return `gift:${o.ownerId}/${o.id}`;
    case 'topic.put':
      return `topic:${o.topic.id}`;
    case 'topic.delete':
      return `topic:${o.id}`;
    case 'idea.put':
      return `idea:${o.idea.id}`;
    case 'idea.delete':
      return `idea:${o.id}`;
    default:
      return null;
  }
}
