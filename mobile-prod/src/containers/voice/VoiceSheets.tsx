/**
 * Голосовые окна по видам (VoiceHost выбирает одно): запись и разбор, ожидание нажатия по ссылке,
 * C-Voice, C-AskDelete, C-AskMove, C-AskWeek / C-AskWeekend, ошибка.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { dayNo } from '@/lib/calendarLayout';
import type { Clock, Snapshot } from '@/adapters/snapshot';
import { agendaSheetProps } from '@/adapters/voice/agenda';
import { deleteSheetProps, moveSheetProps } from '@/adapters/voice/change';
import { createFields } from '@/adapters/voice/create';
import { sheetHeader } from '@/adapters/voice/header';
import { problemSheet, type ProblemCard } from '@/adapters/voice/problem';
import type { PlansAnswer } from '@/lib/plans';
import type { ChangeDraft, DraftItem } from '@/lib/types';
import { beginRecording, cancelVoice, disarmRecording, stopRecording } from '@/lib/voice';
import {
  AskAgendaSheet,
  AskDeleteSheet,
  AskMoveSheet,
  VoiceCreateSheet,
  VoiceSheet,
  type DeleteScope,
  type SheetAction,
} from '@/screens/voice';
import type { Insets } from '../common/useInsets';
import {
  applyDelete,
  applyMove,
  closeCard,
  closeVoice,
  editChange,
  editVoiceItem,
  openAddMenu,
  openAgenda,
  openMicSettings,
  retryVoice,
  saveVoiceItem,
} from './actions';
import { ProblemSheet } from './ProblemSheet';

/** Общее для окон: волна и длительность последней записи, отступ снизу */
export type SheetBase = { levels: readonly number[]; ms: number; bottomInset: number };

/* ---------- Запись и разбор (C-Voice без полей) ---------- */

type RecordingProps = SheetBase & {
  live: boolean;
  /** «Изменить» во время записи: закончить и сразу открыть редактор с результатом */
  onEditAfter: () => void;
};

/**
 * Идёт запись: «REC 00:04», живая волна. ОТМЕНА (и затемнение) — отменить, СОХРАНИТЬ — закончить и показать распознанное,
 * ИЗМЕНИТЬ — закончить и открыть редактор. Разбор: «…», кнопки ждут ответа, ОТМЕНА — не показывать его
 */
export const RecordingSheet = memo(function RecordingSheet({ levels, ms, bottomInset, live, onEditAfter }: RecordingProps) {
  const header = useMemo(() => sheetHeader(levels, ms, undefined, live), [levels, ms, live]);
  const actions = useMemo<SheetAction[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: cancelVoice },
      {
        key: 'edit',
        label: 'ИЗМЕНИТЬ',
        onPress: live
          ? () => {
              onEditAfter();
              void stopRecording();
            }
          : undefined,
      },
      { key: 'save', label: 'СОХРАНИТЬ', tone: 'primary', flex: 1.3, onPress: live ? () => void stopRecording() : undefined },
    ],
    [live, onEditAfter],
  );
  return <VoiceSheet header={header} phrase={live ? '' : '…'} quoted={false} actions={actions} onClose={cancelVoice} bottomInset={bottomInset} />;
});

/* ---------- Ссылка kstatiapp://record: запись только по нажатию ---------- */

const ARM_HEADER = sheetHeader([], 0);
const ARM_ACTIONS: SheetAction[] = [
  { key: 'cancel', label: 'ОТМЕНА', onPress: disarmRecording },
  { key: 'rec', label: 'ЗАПИСАТЬ', tone: 'primary', flex: 1.6, onPress: () => void beginRecording() },
];

export const ArmSheet = memo(function ArmSheet({ bottomInset }: { bottomInset: number }) {
  return (
    <VoiceSheet
      header={ARM_HEADER}
      phrase="Записать команду?"
      quoted={false}
      actions={ARM_ACTIONS}
      onClose={disarmRecording}
      bottomInset={bottomInset}
    />
  );
});

/* ---------- C-Voice ---------- */

type CreateProps = SheetBase & { item: DraftItem; transcript: string; s: Snapshot };

export const CreateSheet = memo(function CreateSheet({ item, transcript, s, levels, ms, bottomInset }: CreateProps) {
  const fields = useMemo(() => createFields(item, s), [item, s]);
  const onSave = useCallback(() => saveVoiceItem(item, transcript), [item, transcript]);
  const onEdit = useCallback(() => editVoiceItem(item, transcript), [item, transcript]);
  return (
    <VoiceCreateSheet
      duration={sheetHeader(levels, ms).duration}
      levels={levels}
      recording={false}
      phrase={transcript}
      fields={fields}
      bottomInset={bottomInset}
      onCancel={closeCard}
      onEdit={onEdit}
      onSave={onSave}
      onClose={closeCard}
    />
  );
});

/* ---------- C-AskDelete ---------- */

type ChangeProps = SheetBase & { change: ChangeDraft; transcript: string; s: Snapshot; clock: Clock };

/** VoiceHost ставит key по команде: новый ответ — выбор «этот раз / все» заново */
export const DeleteSheet = memo(function DeleteSheet({ change, transcript, s, clock, levels, ms, bottomInset }: ChangeProps) {
  const data = useMemo(() => deleteSheetProps(change, s, clock), [change, s, clock]);
  const [scope, setScope] = useState<DeleteScope>(data?.scope ?? 'all');
  const occ = data?.occ ?? null;
  const onDelete = useCallback(() => applyDelete(change, scope, occ), [change, scope, occ]);
  const header = useMemo(() => sheetHeader(levels, ms, 'УДАЛИТЬ'), [levels, ms]);
  if (!data) return null;
  return (
    <AskDeleteSheet
      header={header}
      phrase={transcript}
      task={data.task}
      onceLabel={data.onceLabel}
      scope={scope}
      bottomInset={bottomInset}
      onScopeChange={setScope}
      onCancel={closeCard}
      onDelete={onDelete}
      onClose={closeCard}
    />
  );
});

/* ---------- C-AskMove ---------- */

export const MoveSheet = memo(function MoveSheet({ change, transcript, s, clock, levels, ms, bottomInset }: ChangeProps) {
  const data = useMemo(() => moveSheetProps(change, s, clock), [change, s, clock]);
  const badge = data?.badge;
  const header = useMemo(() => sheetHeader(levels, ms, badge), [levels, ms, badge]);
  const onConfirm = useCallback(() => applyMove(change), [change]);
  const onEdit = useCallback(() => editChange(change, s), [change, s]);
  if (!data) return null;
  return (
    <AskMoveSheet
      header={header}
      phrase={transcript}
      task={data.task}
      changes={data.changes}
      conflicts={data.conflicts}
      confirmLabel={data.confirmLabel}
      bottomInset={bottomInset}
      onCancel={closeCard}
      onEdit={onEdit}
      onConfirm={onConfirm}
      onClose={closeCard}
    />
  );
});

/* ---------- C-AskWeek / C-AskWeekend ---------- */

/** Окно без списка дел: поля и ручка, шапка, фраза в две строки, шапка списка, кнопки (см. VoiceSheet, AgendaList) */
const AGENDA_CHROME = 215;
/** Рамка «Свободно» с отступом */
const FREE_BOX = 58;
const TOP_GAP = 8;

type AgendaProps = SheetBase & { answer: PlansAnswer; transcript: string; s: Snapshot; clock: Clock; insets: Insets };

export const AgendaSheet = memo(function AgendaSheet({ answer, transcript, s, clock, insets, levels, ms, bottomInset }: AgendaProps) {
  const { height } = useWindowDimensions();
  // Окно не прокручивается: что не влезло под верхний край — последним днём «ЕЩЁ N»
  const mayFree = answer.who?.length === 1 && dayNo(answer.to) - dayNo(answer.from) <= 2;
  const maxHeight = height - insets.top - insets.bottom - TOP_GAP - AGENDA_CHROME - (mayFree ? FREE_BOX : 0);
  const data = useMemo(() => agendaSheetProps(answer, s, clock, { maxHeight }), [answer, s, clock, maxHeight]);
  const header = useMemo(() => sheetHeader(levels, ms, 'ПОКАЗАТЬ'), [levels, ms]);
  const groupId = data.groupId;
  const view = data.view;
  const onOpen = useCallback(() => openAgenda(answer, { groupId, view }), [answer, groupId, view]);
  return (
    <AskAgendaSheet
      header={header}
      phrase={transcript}
      title={data.title}
      count={data.count}
      days={data.days}
      free={data.free}
      openLabel={data.openLabel}
      bottomInset={bottomInset}
      onOpen={onOpen}
      onClose={closeCard}
    />
  );
});

/* ---------- Ошибка ---------- */

export const ErrorSheet = memo(function ErrorSheet({ card, levels, ms, bottomInset }: SheetBase & { card: ProblemCard }) {
  const data = useMemo(() => problemSheet(card), [card]);
  const header = useMemo(() => sheetHeader(levels, ms), [levels, ms]);
  const add = data.add;
  const onAdd = useMemo(() => (add ? () => openAddMenu(add.prompt, add.title) : undefined), [add]);
  return (
    <ProblemSheet
      header={header}
      data={data}
      bottomInset={bottomInset}
      onClose={closeVoice}
      onRetry={retryVoice}
      onOpenSettings={openMicSettings}
      onAdd={onAdd}
    />
  );
});
