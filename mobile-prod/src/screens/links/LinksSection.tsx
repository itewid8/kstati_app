/**
 * Блок «СВЯЗИ» на карточке записи: связанные дела, фильмы, хотелки и заметки; нажатие — открыть, «×» — убрать связь,
 * «СВЯЗАТЬ» в шапке — выбрать запись. Презентационный: данные и действия — пропсами.
 */
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { LinkRow } from '@/adapters/links';
import { SectionBox, pad2 } from '@/ui';
import { LinkRowView } from './LinkRowView';

export type LinksSectionProps = {
  rows: readonly LinkRow[];
  onOpen?: (row: LinkRow) => void;
  onUnlink?: (row: LinkRow) => void;
  onAdd?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const LinksSection = memo(function LinksSection({ rows, onOpen, onUnlink, onAdd, style }: LinksSectionProps) {
  return (
    <SectionBox
      title="СВЯЗИ"
      variant={rows.length ? 'inverted' : 'muted'}
      count={rows.length ? pad2(rows.length) : undefined}
      action={onAdd ? { label: 'СВЯЗАТЬ', onPress: onAdd } : undefined}
      style={style}
    >
      {rows.map((r) => (
        <LinkRowView key={r.key} row={r} onPress={onOpen ? () => onOpen(r) : undefined} onRemove={onUnlink ? () => onUnlink(r) : undefined} />
      ))}
    </SectionBox>
  );
});
