/** C-Group: группа — роли участников и счётчики общих списков */
import { scopeFilter, selectsOnly, visibleCount } from '@/lib/visibility';
import { nextOpen } from '@/lib/recur';
import type { Group, ID, Task } from '@/lib/types';
import type { GroupMember, GroupRole, GroupScreenProps, SharedListSummary } from '@/screens/account/GroupScreen';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { planIds } from '../common/tasks';
import { isOpenWish } from '../lists/wishes';
import type { Clock, DataOf, Snapshot } from '../snapshot';

export const roleOf = (g: Pick<Group, 'ownerId' | 'adminIds'>, id: ID): GroupRole =>
  id === g.ownerId ? 'owner' : g.adminIds.includes(id) ? 'admin' : 'member';

const RANK: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };

/** Открытое дело: не отмечено; у серии — есть неотмеченный раз впереди. План с подзадачами не считается — считаются они */
function isOpenTask(t: Task, today: string, plans: ReadonlySet<ID>): boolean {
  if (plans.has(t.id)) return false;
  if (t.repeat && t.date) return nextOpen(t, today) !== null;
  return !t.doneAt;
}

/** Срез хранилища C-Group: без ленты, напоминаний и текущей группы */
export type GroupSnapshot = Pick<Snapshot, 'me' | 'users' | 'groups' | 'tasks' | 'wishes' | 'watch' | 'topics' | 'ideas'>;

/** Счётчики «ОБЩИХ СПИСКОВ»: открытые дела, хотелки участников без отметки, фильмы в очереди, идеи открытых группе тем */
export function sharedLists(s: GroupSnapshot, group: Group, clock: Pick<Clock, 'today'>): SharedListSummary[] {
  const tasks = s.tasks.filter(scopeFilter({ viewId: group.id, groups: s.groups, meId: s.me.id }));
  const plans = planIds(tasks);
  const members = new Set(group.memberIds);
  const topics = new Set(s.topics.filter((t) => t.groupIds.includes(group.id)).map((t) => t.id));
  return [
    { key: 'tasks', count: tasks.filter((t) => isOpenTask(t, clock.today, plans)).length },
    { key: 'wishes', count: s.wishes.filter((w) => members.has(w.ownerId) && isOpenWish(w, s.me.id)).length },
    { key: 'watch', count: s.watch.filter((w) => w.groupId === group.id && !w.watchedAt).length },
    { key: 'ideas', count: s.ideas.filter((i) => !!i.topicId && topics.has(i.topicId)).length },
  ];
}

/** «МОИ ДЕЛА В ГРУППЕ»: режим и сколько моих дел группе видно / скрыто (lib/visibility.ts) */
export function shareSummary(s: Pick<GroupSnapshot, 'me' | 'tasks'>, group: Group): { selectOnly: boolean; visible: number; hidden: number } {
  const { visible, total } = visibleCount(s.tasks, group, s.me.id);
  return { selectOnly: selectsOnly(group, s.me.id), visible, hidden: total - visible };
}

/** null — группы нет (вышли из неё или её удалили) */
export function groupProps(s: GroupSnapshot, colors: ColorMap, groupId: ID, clock: Pick<Clock, 'today'>): DataOf<GroupScreenProps> | null {
  const group = s.groups.find((g) => g.id === groupId);
  if (!group) return null;
  const members: GroupMember[] = group.memberIds
    .flatMap((id) => {
      const u = userOf(s, id);
      return u
        ? [
            {
              id,
              name: u.name,
              nick: u.nick ?? null,
              color: colorOf(colors, id),
              ...(u.avatar ? { avatar: u.avatar } : {}),
              role: roleOf(group, id),
              ...(id === s.me.id ? { isMe: true } : {}),
            },
          ]
        : [];
    })
    .sort((a, b) => RANK[a.role] - RANK[b.role] || a.name.localeCompare(b.name, 'ru'));
  return {
    name: group.name,
    category: group.category,
    inviteCode: group.inviteCode,
    myRole: roleOf(group, s.me.id),
    members,
    lists: sharedLists(s, group, clock),
    share: shareSummary(s, group),
  };
}
