/** Режим выбора на экранах списков (общий принцип: «ВЫБРАТЬ» / «ВЫБРАТЬ ВСЕ» в шапке, действия внизу) */
import type { ID } from '@/lib/types';
import type { SelectAction } from '@/ui';

export type SelectionProps = {
  /** Выбранные id; null/нет — выбора нет */
  selected?: readonly ID[] | null;
  /** Что можно выбрать (свои записи); нет — всё */
  pickable?: readonly ID[];
  allSelected?: boolean;
  onStartSelect?: () => void;
  onToggleSelect?: (id: ID) => void;
  onSelectMany?: (ids: readonly ID[]) => void;
  onSelectAll?: () => void;
  onCancelSelect?: () => void;
  onDeleteSelected?: () => void;
  /** Действия панели выбора — свои у каждого типа (контейнер считает, к скольким применится) */
  selectActions?: readonly SelectAction[];
};

/** Кнопка в шапке списка: «ВЫБРАТЬ» или «ВЫБРАТЬ ВСЕ / СНЯТЬ ВСЕ» */
export function selectAction(p: SelectionProps, hasItems: boolean): { label: string; onPress: () => void } | undefined {
  if (p.selected) return p.onSelectAll ? { label: p.allSelected ? 'СНЯТЬ ВСЕ' : 'ВЫБРАТЬ ВСЕ', onPress: p.onSelectAll } : undefined;
  return p.onStartSelect && hasItems ? { label: 'ВЫБРАТЬ', onPress: p.onStartSelect } : undefined;
}
