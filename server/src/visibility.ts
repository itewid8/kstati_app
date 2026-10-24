/**
 * Личный календарь (API 3). Дело принадлежит человеку (createdBy) и лежит в его разделе «u:<id>».
 * Группа видит дела своих участников по правилу:
 *   1. «Только я» (only) — не видит никто;
 *   2. отметка для этой группы (share[groupId]) — как отмечено;
 *   3. иначе — по режиму владельца в группе: «Все, кроме скрытых» (по умолчанию) или «Только выбранные»
 *      (владелец в списке group.selectOnly).
 * Та же функция — в приложении (mobile-prod/src/lib/visibility.ts): держать одинаковыми.
 */
import type { Group, Task } from './store/types.js';

/** groupId дела, созданного в личном календаре (не из группы) */
export const PERSONAL = '@me';
/** Раздел дел человека в таблице items */
export const ownerPart = (userId: string) => `u:${userId}`;

export type Shareable = Pick<Task, 'createdBy' | 'only' | 'share'>;
export type ModeGroup = Pick<Group, 'id' | 'memberIds' | 'selectOnly'>;

export function visibleIn(t: Shareable, g: ModeGroup): boolean {
  if (t.only || !g.memberIds.includes(t.createdBy)) return false;
  const v = t.share?.[g.id];
  if (v !== undefined) return v;
  return !(g.selectOnly ?? []).includes(t.createdBy);
}

/** Режим человека в группе: true — «Только выбранные» */
export const selectsOnly = (g: Pick<Group, 'selectOnly'>, userId: string) => (g.selectOnly ?? []).includes(userId);
