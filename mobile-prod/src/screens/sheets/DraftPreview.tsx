/**
 * Запись в голосовом ответе из нескольких (до «ИЗМЕНИТЬ»): поля как в C-Voice, «×» — убрать из ответа,
 * нажатие — полный редактор (дело). Такая запись уже есть — плашка «УЖЕ ЕСТЬ» и «ВСЁ РАВНО» / «НЕ ДОБАВЛЯТЬ».
 */
import { memo } from 'react';
import type { RecognizedField } from '../voice/VoiceCreateSheet';
import { RecognizedRows } from './components/FieldRows';
import { Notice } from './components/Notice';

export type DraftDuplicate = {
  /** «Уже есть в «Смотреть»», «Повторяется в этой карточке» */
  text: string;
  /** Добавить всё равно (решение принято) */
  forced: boolean;
  onToggle?: () => void;
};

export type DraftPreviewProps = {
  fields: readonly RecognizedField[];
  dup?: DraftDuplicate | null;
  onRemove?: () => void;
  onPress?: () => void;
};

/** Плашка повтора: «УЖЕ ЕСТЬ … · ВСЁ РАВНО» или «ДОБАВИТСЯ ЕЩЁ РАЗ · НЕ ДОБАВЛЯТЬ» */
export const DupNotice = memo(function DupNotice({ dup }: { dup: DraftDuplicate }) {
  return (
    <Notice
      label={dup.forced ? 'ДОБАВИТСЯ ЕЩЁ РАЗ' : 'УЖЕ ЕСТЬ'}
      text={dup.forced ? '' : dup.text}
      tone={dup.forced ? 'muted' : 'red'}
      action={dup.onToggle ? { label: dup.forced ? 'НЕ ДОБАВЛЯТЬ' : 'ВСЁ РАВНО', onPress: dup.onToggle } : undefined}
    />
  );
});

export const DraftPreview = memo(function DraftPreview({ fields, dup, onRemove, onPress }: DraftPreviewProps) {
  return (
    <>
      <RecognizedRows fields={fields} faded={!!dup && !dup.forced} onRemove={onRemove} onPress={onPress} />
      {dup ? <DupNotice dup={dup} /> : null}
    </>
  );
});
