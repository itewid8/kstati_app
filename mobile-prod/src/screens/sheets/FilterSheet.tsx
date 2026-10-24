/**
 * Фильтр «Смотреть» по одному полю (тип, жанр, страна, новизна): карточка с названием поля и числом выбранных,
 * плитки вариантов (выбранные инвертированы), «ОЧИСТИТЬ» / «ГОТОВО».
 */
import { memo, useMemo } from 'react';
import { pad2 } from '@/ui';
import { ChipGrid, type ChipItem } from '../editors/components/ChipGrid';
import { SheetButtons, type SheetButton } from './components/SheetButtons';
import { SheetCard } from './components/SheetCard';

export type FilterOption = { key: string; label: string; selected: boolean };

export type FilterSheetViewProps = {
  /** «Жанр» */
  title: string;
  options: readonly FilterOption[];
  onToggle?: (key: string) => void;
  onClear?: () => void;
  onDone?: () => void;
};

const upper = (s: string) => s.toLocaleUpperCase('ru-RU');

export const FilterSheetView = memo(function FilterSheetView({ title, options, onToggle, onClear, onDone }: FilterSheetViewProps) {
  const chosen = options.filter((o) => o.selected).length;
  const items = useMemo<ChipItem<string>[]>(
    () => options.map((o) => ({ key: o.key, label: upper(o.label), state: o.selected ? 'selected' : 'normal' })),
    [options],
  );
  const buttons = useMemo<SheetButton[]>(
    () => [
      { key: 'clear', label: 'ОЧИСТИТЬ', disabled: chosen === 0, onPress: onClear },
      { key: 'done', label: 'ГОТОВО', tone: 'primary', flex: 1.3, onPress: onDone },
    ],
    [chosen, onClear, onDone],
  );
  return (
    <>
      <SheetCard title={title} tag={`ВЫБРАНО ${pad2(chosen)}`} />
      <ChipGrid items={items} columns={options.length <= 4 ? 2 : 3} onPress={onToggle} />
      <SheetButtons buttons={buttons} />
    </>
  );
});
