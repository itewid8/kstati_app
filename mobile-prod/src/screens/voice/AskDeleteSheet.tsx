/**
 * C-AskDelete — голосовое удаление: карточка дела (зачёркнута), для повторяющегося —
 * выбор «только этот раз / все повторы», красная «Удалить».
 */
import { memo, useMemo } from 'react';
import { VoiceSheet } from './components/VoiceSheet';
import { TaskCard } from './components/TaskCard';
import { ScopeSwitch, type ScopeOption } from './components/ScopeSwitch';
import type { SheetAction, VoiceSheetHeader, VoiceTaskCard } from './types';

export type DeleteScope = 'one' | 'all';

export type AskDeleteSheetProps = {
  header: VoiceSheetHeader;
  /** Фраза команды (без кавычек) */
  phrase: string;
  task: VoiceTaskCard;
  /** Для повторяющегося дела: подпись «только этот раз» — «ТОЛЬКО 10 ОКТ». Нет — выбор не показывается */
  onceLabel?: string;
  scope?: DeleteScope;
  visible?: boolean;
  bottomInset?: number;
  onScopeChange?: (scope: DeleteScope) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
};

export const AskDeleteSheet = memo(function AskDeleteSheet({
  header,
  phrase,
  task,
  onceLabel,
  scope = 'one',
  visible,
  bottomInset,
  onScopeChange,
  onCancel,
  onDelete,
  onClose,
}: AskDeleteSheetProps) {
  const options = useMemo<ScopeOption<DeleteScope>[] | null>(
    () =>
      onceLabel
        ? [
            { key: 'one', label: onceLabel },
            { key: 'all', label: 'ВСЕ ПОВТОРЫ' },
          ]
        : null,
    [onceLabel],
  );
  const actions = useMemo<SheetAction[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: onCancel },
      { key: 'delete', label: 'УДАЛИТЬ', tone: 'danger', flex: 1.3, onPress: onDelete },
    ],
    [onCancel, onDelete],
  );
  return (
    <VoiceSheet header={header} phrase={phrase} actions={actions} visible={visible} onClose={onClose} bottomInset={bottomInset}>
      <TaskCard task={task} struck />
      {options ? <ScopeSwitch options={options} value={scope} onChange={onScopeChange} /> : null}
    </VoiceSheet>
  );
});
