/**
 * Личный календарь и видимость дел в группах (сервер API 3: server/src/visibility.ts — правило то же).
 *
 * Дело принадлежит человеку (createdBy). Группа видит его, если:
 *   1. не стоит «Только я» (only);
 *   2. есть отметка для этой группы (share) — как отмечено;
 *   3. иначе — дело создано в этой группе или у владельца в группе режим «Все, кроме скрытых».
 * Чужие дела приходят с сервера уже отобранными, с полем in — в каких моих группах они видны.
 */
import type { Group, ID, Task } from './types';

/** «Группа» личного календаря: дела, созданные не из группы, и вид «Я» */
export const PERSONAL = '@me';
/** Как личный календарь называется в выборе группы и в верхней панели */
export const PERSONAL_NAME = 'Я';

type ModeGroup = Pick<Group, 'id' | 'memberIds' | 'selectOnly'>;
type Shareable = Pick<Task, 'createdBy' | 'groupId' | 'only' | 'share'>;

export const selectsOnly = (g: Pick<Group, 'selectOnly'>, userId: ID) => (g.selectOnly ?? []).includes(userId);

export function visibleIn(t: Shareable, g: ModeGroup): boolean {
  if (t.only || !g.memberIds.includes(t.createdBy)) return false;
  const v = t.share?.[g.id];
  if (v !== undefined) return v;
  return t.groupId === g.id || !selectsOnly(g, t.createdBy);
}

/** Где дело видно: своё — считаем по группам, чужое — как прислал сервер (старый сервер — его группа) */
export function taskGroups(t: Pick<Task, 'createdBy' | 'groupId' | 'only' | 'share' | 'in'>, groups: readonly ModeGroup[], meId: ID | undefined): ID[] {
  if (t.createdBy === meId || (!t.in && t.groupId === PERSONAL)) return groups.filter((g) => visibleIn(t, g)).map((g) => g.id);
  const known = new Set(groups.map((g) => g.id));
  return (t.in ?? [t.groupId]).filter((id) => known.has(id));
}

/**
 * Вид (группа или личный календарь): какие дела в нём показывать.
 * groupOnly — только то, что видит сама группа (счётчики группы); иначе в группе мне видны и мои скрытые от неё дела
 */
export type TaskScope = { viewId: ID | null; groups: readonly ModeGroup[]; meId: ID | undefined; groupOnly?: boolean };

/** Личное — мои дела и те, где я занят; группа — дела, видные ей, и мои (скрытые от неё — заштрихованы, hiddenIn) */
export function inScope(t: Task, s: TaskScope): boolean {
  if (!s.viewId) return false;
  if (s.viewId === PERSONAL) return !!s.meId && (t.createdBy === s.meId || !!t.people?.includes(s.meId));
  if (!s.groupOnly && t.createdBy === s.meId && s.groups.some((g) => g.id === s.viewId)) return true;
  return taskGroups(t, s.groups, s.meId).includes(s.viewId);
}

/** Моё дело, которое группа viewId не видит: в её виде оно у меня заштриховано */
export function hiddenIn(t: Task, s: TaskScope): boolean {
  if (!s.viewId || s.viewId === PERSONAL || t.createdBy !== s.meId) return false;
  return !taskGroups(t, s.groups, s.meId).includes(s.viewId);
}

/** Дела вида с пометкой hidden у моих скрытых от группы */
export function scopeTasks(tasks: readonly Task[], s: TaskScope): Task[] {
  const out: Task[] = [];
  for (const t of tasks) {
    if (!inScope(t, s)) continue;
    out.push(hiddenIn(t, s) ? { ...t, hidden: true } : t);
  }
  return out;
}

/** Предикат для списков: (t) => видно ли в виде */
export const scopeFilter = (s: TaskScope) => (t: Task) => inScope(t, s);

/** Можно ли править дело: своё; чужое — если я админ группы, где оно видно. Остальным — только «сделано» */
export function canEditTask(t: Task, groups: readonly Group[], meId: ID | undefined): boolean {
  if (!meId || t.createdBy === meId || !t.createdBy) return true;
  const ids = new Set(taskGroups(t, groups, meId));
  return groups.some((g) => ids.has(g.id) && (g.ownerId === meId || g.adminIds.includes(meId)));
}

/** Новое дело, созданное в виде viewId: из группы — отмечено для неё (видно, даже если режим «Только выбранные») */
export const newTaskShare = (viewId: ID | null): Pick<Task, 'groupId' | 'share'> =>
  !viewId || viewId === PERSONAL ? { groupId: PERSONAL } : { groupId: viewId, share: { [viewId]: true } };

/** Сколько моих дел видно группе */
export function visibleCount(tasks: readonly Task[], g: ModeGroup, meId: ID | undefined): { visible: number; total: number } {
  let visible = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.createdBy !== meId) continue;
    total++;
    if (visibleIn(t, g)) visible++;
  }
  return { visible, total };
}
