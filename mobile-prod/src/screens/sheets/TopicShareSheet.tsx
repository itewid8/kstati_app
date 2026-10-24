/**
 * Кому открыта тема идей: карточка темы, группы с галочками (участники видят тему, менять не могут), «ГОТОВО».
 */
import { memo, useMemo } from 'react';
import type { PersonColor } from '@/lib/types';
import { OptionEmpty, OptionList, type OptionItem } from './components/OptionList';
import { SheetButtons, type SheetButton } from './components/SheetButtons';
import { SheetCard } from './components/SheetCard';

export type ShareGroup = {
  id: string;
  name: string;
  /** «3 УЧАСТНИКА» */
  meta: string;
  shared: boolean;
};

export type TopicShareViewProps = {
  title: string;
  /** «ОТКРЫТА 1 ГРУППЕ» / «ТОЛЬКО ВЫ» */
  meta: string;
  color: PersonColor | null;
  groups: readonly ShareGroup[];
  onToggle?: (id: string) => void;
  onClose?: () => void;
};

export const TopicShareView = memo(function TopicShareView({ title, meta, color, groups, onToggle, onClose }: TopicShareViewProps) {
  const options = useMemo<OptionItem[]>(() => groups.map((g) => ({ key: g.id, label: g.name, meta: g.meta, selected: g.shared })), [groups]);
  const colors = useMemo(() => (color ? [color] : []), [color]);
  const buttons = useMemo<SheetButton[]>(() => [{ key: 'done', label: 'ГОТОВО', tone: 'primary', onPress: onClose }], [onClose]);
  return (
    <>
      <SheetCard title={title} tag="ГРУППЫ" meta={meta} colors={colors} />
      {groups.length ? <OptionList variant="check" options={options} onPress={onToggle} /> : <OptionEmpty text="ГРУПП НЕТ" />}
      <SheetButtons buttons={buttons} />
    </>
  );
});
