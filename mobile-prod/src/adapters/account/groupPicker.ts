/** Окно выбора группы: мои группы, текущая отмечена */
import { CATEGORY_LABEL } from '@/lib/types';
import { PERSONAL, PERSONAL_NAME } from '@/lib/visibility';
import type { PickerGroup } from '@/screens/account/GroupPickerSheet';
import { upper } from '../common/ru';
import type { Snapshot } from '../snapshot';

/** Первой строкой — личный календарь (мои дела, lib/visibility.ts), дальше группы */
export function groupPickerRows(s: Pick<Snapshot, 'groups' | 'currentGroupId'>): PickerGroup[] {
  return [
    { id: PERSONAL, name: PERSONAL_NAME, meta: 'МОИ ДЕЛА', current: s.currentGroupId === PERSONAL },
    ...s.groups.map((g) => ({
      id: g.id,
      name: g.name,
      meta: `${upper(CATEGORY_LABEL[g.category])} · ${g.memberIds.length}`,
      current: g.id === s.currentGroupId,
    })),
  ];
}
