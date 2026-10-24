/**
 * Меню действий и подтверждение (окно без макета, из src/ui и карточки C-Quick*).
 * Несколько действий — карточка с названием, список пунктов, «ЗАКРЫТЬ».
 * Одно действие — подтверждение: карточка и ряд «ОТМЕНА» + действие (удаление — красная рамка).
 */
import { memo, useMemo } from 'react';
import { SheetButtons, type SheetButton } from './components/SheetButtons';
import { SheetCard } from './components/SheetCard';
import { OptionList, type OptionItem } from './components/OptionList';

export type SheetActionItem = { label: string; danger?: boolean };

export type ActionSheetProps = {
  /** «Удалить «Йога»?», «Фильтры», название темы */
  title: string;
  /** Подпись в карточке под названием */
  meta?: string;
  actions: readonly SheetActionItem[];
  onAction?: (index: number) => void;
  onClose?: () => void;
};

export const ActionSheet = memo(function ActionSheet({ title, meta, actions, onAction, onClose }: ActionSheetProps) {
  const single = actions.length === 1 ? actions[0] : undefined;
  const options = useMemo<OptionItem[]>(
    () => actions.map((a, i) => ({ key: String(i), label: a.label, ...(a.danger ? { danger: true } : null) })),
    [actions],
  );
  const buttons = useMemo<SheetButton[]>(
    () =>
      single
        ? [
            { key: 'cancel', label: 'ОТМЕНА', onPress: onClose },
            {
              key: 'do',
              label: single.label.toLocaleUpperCase('ru-RU'),
              tone: single.danger ? 'danger' : 'primary',
              flex: 1.3,
              onPress: onAction ? () => onAction(0) : undefined,
            },
          ]
        : [{ key: 'close', label: 'ЗАКРЫТЬ', onPress: onClose }],
    [single, onAction, onClose],
  );
  return (
    <>
      <SheetCard title={title} meta={meta} />
      {single ? null : <OptionList options={options} onPress={onAction ? (key) => onAction(Number(key)) : undefined} />}
      <SheetButtons buttons={buttons} />
    </>
  );
});
