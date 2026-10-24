/** Строка «ВИДНО» окна дела и плана (C-EditVisible): кому видно моё дело — lib/visibility.ts */
import { PERSONAL, selectsOnly, visibleIn } from '@/lib/visibility';
import type { Group } from '@/lib/types';
import type { VisibleGroup } from '@/screens/editors/panels/VisiblePanel';
import type { Snapshot } from '../snapshot';
import { upper } from '../common/ru';
import type { EditorDraft } from './draft';

const asTask = (d: EditorDraft) => ({ createdBy: d.createdBy, groupId: d.groupId ?? PERSONAL, only: d.only, share: d.share });

const myGroups = (s: Pick<Snapshot, 'me' | 'groups'>): Group[] => s.groups.filter((g) => g.memberIds.includes(s.me.id));

/** «ДРУЗЬЯ, СЕМЬЯ»; null — никому («ТОЛЬКО Я»); undefined — чужое дело, строки нет */
export function visibleField(d: EditorDraft, s: Pick<Snapshot, 'me' | 'groups'>): string | null | undefined {
  if (d.createdBy !== s.me.id) return undefined;
  if (d.only) return null;
  const names = myGroups(s)
    .filter((g) => visibleIn(asTask(d), g))
    .map((g) => upper(g.name));
  return names.length ? names.join(', ') : null;
}

export function visibleGroups(d: EditorDraft, s: Pick<Snapshot, 'me' | 'groups'>): VisibleGroup[] {
  return myGroups(s).map((g) => ({
    id: g.id,
    name: g.name,
    mode: selectsOnly(g, s.me.id) ? 'ТОЛЬКО ВЫБРАННЫЕ' : 'ВСЕ, КРОМЕ СКРЫТЫХ',
    visible: !d.only && visibleIn(asTask(d), g),
    manual: d.share[g.id] !== undefined,
  }));
}
