/** Быстрые действия по удержанию: что нажали и что нужно адаптерам */
import type { IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import type { Snapshot } from '../snapshot';

/** Нажатая запись: дело (occ — раз серии), хотелка (у разных людей id могут совпасть), «Смотреть», идея */
export type QuickTarget =
  | { kind: 'task'; id: ID; occ?: IsoDate }
  | { kind: 'wish'; ownerId: ID; id: ID }
  | { kind: 'watch'; id: ID }
  | { kind: 'idea'; id: ID };

export type QuickSnapshot = Pick<Snapshot, 'me' | 'users' | 'groups' | 'tasks' | 'wishes' | 'watch' | 'topics' | 'ideas'>;

/** Сегодня и можно ли дарить (сервер API 2; без него подарок срежется) */
export type QuickEnv = { today: IsoDate; gifts: boolean };

/** Ряд «ПЕРЕНЕСТИ»: date — окно даты, остальное — сразу */
export type MoveKey = 'tomorrow' | 'hour' | 'weekend' | 'date';
export const MOVE_KEYS: readonly MoveKey[] = ['tomorrow', 'hour', 'weekend', 'date'];
export const isMoveKey = (key: string): key is MoveKey => (MOVE_KEYS as readonly string[]).includes(key);

/** Выключенная кнопка — поле disabled есть только у выключенных (данные окна сравниваются с макетами как есть) */
export const off = (disabled: boolean): { disabled?: true } => (disabled ? { disabled: true } : {});
