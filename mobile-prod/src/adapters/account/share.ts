/** «Мои дела в группе» (C-ShareMine) и выбор при вступлении (C-ShareJoin): мои дела и кому они видны */
import { sortKey } from '@/lib/dates';
import { peopleOf } from '@/lib/span';
import type { Group, ID } from '@/lib/types';
import { selectsOnly, visibleCount, visibleIn } from '@/lib/visibility';
import type { ShareAsk, ShareScreenProps, ShareTask } from '@/screens/account/ShareScreen';
import { colorOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { whenLabel } from '../common/when';
import type { DataOf, Snapshot } from '../snapshot';

export type ShareSnapshot = Pick<Snapshot, 'me' | 'groups' | 'tasks'>;

/** Мои несделанные дела: с датой — по времени, без даты — в конце */
export function shareTasks(s: ShareSnapshot, colors: ColorMap, group: Group): ShareTask[] {
  return s.tasks
    .filter((t) => t.createdBy === s.me.id && !t.doneAt)
    .sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)))
    .map((t) => ({
      key: t.id,
      title: t.title,
      meta: whenLabel(t.date, t.time),
      colors: peopleOf(t).slice(0, 2).map((id) => colorOf(colors, id)),
      visible: visibleIn(t, group),
      onlyMe: !!t.only,
    }));
}

/** Сколько станет видно, если перейти на «Все, кроме скрытых» */
export function shareAsk(s: ShareSnapshot, group: Group): ShareAsk {
  const now = visibleCount(s.tasks, group, s.me.id);
  const all = visibleCount(s.tasks, { ...group, selectOnly: (group.selectOnly ?? []).filter((m) => m !== s.me.id) }, s.me.id);
  return { group: group.name, now: now.visible, next: all.visible, total: all.total };
}

export function shareProps(
  s: ShareSnapshot,
  colors: ColorMap,
  groupId: ID,
  variant: ShareScreenProps['variant'],
): DataOf<ShareScreenProps> | null {
  const group = s.groups.find((g) => g.id === groupId);
  if (!group) return null;
  const { visible, total } = visibleCount(s.tasks, group, s.me.id);
  return {
    variant,
    caption: variant === 'join' ? `ВЫ В ГРУППЕ · ${upper(group.name)}` : `ГРУППА · ${upper(group.name)}`,
    title: variant === 'join' ? 'Мои дела' : 'Мои дела в группе',
    color: colorOf(colors, s.me.id),
    selectOnly: selectsOnly(group, s.me.id),
    visible,
    total,
    tasks: shareTasks(s, colors, group),
  };
}
