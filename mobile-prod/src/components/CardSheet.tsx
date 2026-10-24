/**
 * Окно записей поверх всего (без макета; собрано из блоков C-Voice / C-Ask* / C-Quick*):
 *  — голосовой ответ из нескольких записей: фраза, записи полями, «ОТМЕНА / ИЗМЕНИТЬ / СОХРАНИТЬ»;
 *  — правка в окне («ИЗМЕНИТЬ», ручное добавление, правка хотелки / «Смотреть» / идеи / темы): карточка с полем названия,
 *    поля и плитки, «ОТМЕНА / СОХРАНИТЬ»; дело — в полном окне дела поверх (CardTaskEditor);
 *  — несколько голосовых правок: карточки «было → стало», «ОТМЕНА / ПРИМЕНИТЬ» (только удаления — «УДАЛИТЬ», красная рамка).
 * Одну запись, одну правку, ответ о планах и ошибки рисует VoiceHost.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { candidateOptions, changesConfirm, changeView, duplicates, savable } from '@/adapters/lists/cardSheet';
import type { Snapshot } from '@/adapters/snapshot';
import { voiceView } from '@/adapters/voice/view';
import { toPlanGrid, toTabRoute, toTopic } from '@/containers/common/go';
import { useClock } from '@/containers/common/useClock';
import { usePersonColors } from '@/containers/common/usePersonColors';
import { pickSnapshot } from '@/containers/common/useSnapshot';
import { track } from '@/lib/analytics';
import { uid } from '@/lib/ids';
import { useStore, type Card } from '@/lib/store';
import { INBOX, type ChangeDraft, type DraftItem, type ItemType, type TaskDraft } from '@/lib/types';
import { TAB_FOR, handleTranscript } from '@/lib/voice';
import { ChangeBlock, Phrase, SheetButtons, type DraftDuplicate, type SheetButton } from '@/screens/sheets';
import { CardTaskEditor } from './CardTaskEditor';
import { DraftItemView } from './editors';
import { Sheet } from './Sheet';

type ItemsCard = Extract<Card, { items: DraftItem[] }>;
type ChangesCard = Extract<Card, { changes: ChangeDraft[] }>;

/** Пустой черновик нужного типа — для «+» и для «добавить как…» */
export const emptyDraft = (type: ItemType, title = ''): DraftItem => {
  if (type === 'task') return { key: uid(), type, data: { title, date: null, time: null } };
  if (type === 'wish') return { key: uid(), type, data: { title, note: '', link: '' } };
  if (type === 'idea') return { key: uid(), type, data: { title, topicId: null, newTopic: null } };
  if (type === 'topic') return { key: uid(), type, data: { title } };
  return { key: uid(), type: 'watch', data: { title, kind: null, genres: [], origin: null, year: null } };
};

const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const reparse = (text: string) => void handleTranscript(text);
const close = () => useStore.getState().setCard(null);

/** Карточка подтверждения: голос, ручное добавление и правка */
export const CardSheet = () => {
  const clock = useClock();
  const raw = useStore((s) => s.card);
  const snap = useStore(useShallow((s) => (s.card ? pickSnapshot(s) : null)));
  // Одну запись, одну правку, ответ о планах и ошибки рисует VoiceHost (новые окна) — здесь только остальное
  const card = useMemo(() => {
    if (!raw || !snap || 'problem' in raw || 'plans' in raw) return null;
    return raw.source === 'voice' && snap.me.id && voiceView(raw, snap, clock) ? null : raw;
  }, [raw, snap, clock]);
  // Держим последнее содержимое, чтобы окно не «пустело» во время закрытия
  const [shown, setShown] = useState<ItemsCard | ChangesCard | null>(card);
  const [lastSnap, setLastSnap] = useState<Snapshot | null>(snap);
  useEffect(() => {
    if (card) setShown(card);
    if (snap) setLastSnap(snap);
  }, [card, snap]);
  // Дело, открытое в полном окне дела (ключ записи)
  const [taskKey, setTaskKey] = useState<string | null>(null);
  useEffect(() => {
    if (!card) setTaskKey(null);
  }, [card]);

  const s = snap ?? lastSnap;
  if (!shown || !s) return null;
  return 'changes' in shown ? (
    <ChangesSheet visible={!!card} card={shown} snapshot={s} />
  ) : (
    <ItemsSheet visible={!!card} card={shown} snapshot={s} taskKey={taskKey} onTask={setTaskKey} />
  );
};

/* ---------- Записи ---------- */

type ItemsProps = {
  visible: boolean;
  card: ItemsCard;
  snapshot: Snapshot;
  taskKey: string | null;
  onTask: (key: string | null) => void;
};

const ItemsSheet = ({ visible, card, snapshot, taskKey, onTask }: ItemsProps) => {
  const colors = usePersonColors(snapshot);
  const setCard = useStore((st) => st.setCard);
  const update = useCallback((items: DraftItem[]) => setCard({ ...card, items }), [card, setCard]);
  const dups = useMemo(() => duplicates(card.items, snapshot), [card.items, snapshot]);
  const { save: toSave, ok } = savable(card.items, dups);
  const many = card.items.length > 1;

  const save = useCallback(() => {
    const created = useStore.getState().saveItems(toSave.map((i): DraftItem => trimmed(i)));
    setCard(null);
    // saveItems возвращает id каждой сохранённой записи. Новые дела и «Смотреть» без группы не сохраняются — не молчим и никуда не уводим
    const missed = created.length < toSave.length;
    if (missed) useStore.getState().notice(created.length ? 'Сохранено не всё: нет группы' : 'Нет группы');
    if (!created.length) return;
    for (const i of toSave) track('save', { type: i.type, source: card.source });
    success();
    const first = toSave[0];
    if (!first || card.source === 'edit' || missed) return;
    // Идея — сразу в её тему
    if (first.type === 'idea') toTopic(useStore.getState().ideas.find((x) => created.includes(x.id))?.topicId ?? INBOX);
    // Подзадача — в её план
    else if (first.type === 'task' && first.data.parentId) toPlanGrid(first.data.parentId);
    else toTabRoute(TAB_FOR[first.type]);
  }, [toSave, card.source, setCard]);

  const buttons = useMemo<SheetButton[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: close },
      ...(card.editing ? [] : [{ key: 'edit', label: 'ИЗМЕНИТЬ', onPress: () => setCard({ ...card, editing: true }) }]),
      { key: 'save', label: toSave.length === 0 ? 'УЖЕ ЕСТЬ' : 'СОХРАНИТЬ', tone: 'primary', flex: 1.3, disabled: !ok, onPress: save },
    ],
    [card, toSave.length, ok, save, setCard],
  );

  const task = taskKey ? card.items.find((i): i is Extract<DraftItem, { type: 'task' }> => i.key === taskKey && i.type === 'task') ?? null : null;
  const saveTask = useCallback(
    (data: TaskDraft) => {
      update(card.items.map((x) => (x.key === taskKey && x.type === 'task' ? { ...x, data } : x)));
      onTask(null);
    },
    [card.items, taskKey, update, onTask],
  );
  const removeTask = useCallback(() => {
    onTask(null);
    const rest = card.items.filter((x) => x.key !== taskKey);
    if (rest.length) update(rest);
    else close();
  }, [card.items, taskKey, update, onTask]);
  const closeTask = useCallback(() => onTask(null), [onTask]);
  const openTask = useCallback((item: DraftItem) => onTask(item.key), [onTask]);

  return (
    <Sheet visible={visible} onClose={close} inset locked={!!task} footer={<SheetButtons buttons={buttons} />}>
      {card.source === 'voice' && card.transcript ? <Phrase text={card.transcript} onReparse={reparse} /> : null}
      {card.items.map((item) => {
        const text = dups.get(item.key);
        const dup: DraftDuplicate | null = text
          ? { text, forced: !!item.force, onToggle: () => update(card.items.map((x) => (x.key === item.key ? { ...x, force: !x.force } : x))) }
          : null;
        return (
          <DraftItemView
            key={item.key}
            item={item}
            editing={card.editing}
            snapshot={snapshot}
            colors={colors}
            dup={dup}
            onChange={(next) => update(card.items.map((x) => (x.key === next.key ? next : x)))}
            onRemove={many ? () => update(card.items.filter((x) => x.key !== item.key)) : undefined}
            onOpenTask={openTask}
          />
        );
      })}
      <CardTaskEditor item={task} onSave={saveTask} onRemove={removeTask} onClose={closeTask} />
    </Sheet>
  );
};

/** Название без пробелов по краям */
const trimmed = (i: DraftItem): DraftItem => {
  switch (i.type) {
    case 'task':
      return { ...i, data: { ...i.data, title: i.data.title.trim() } };
    case 'wish':
      return { ...i, data: { ...i.data, title: i.data.title.trim() } };
    case 'watch':
      return { ...i, data: { ...i.data, title: i.data.title.trim() } };
    case 'idea':
      return { ...i, data: { ...i.data, title: i.data.title.trim() } };
    case 'topic':
      return { ...i, data: { ...i.data, title: i.data.title.trim() } };
  }
};

/* ---------- Правки ---------- */

const ChangesSheet = ({ visible, card, snapshot }: { visible: boolean; card: ChangesCard; snapshot: Snapshot }) => {
  const clock = useClock();
  const setCard = useStore((st) => st.setCard);
  const set = useCallback((changes: ChangeDraft[]) => setCard({ ...card, changes }), [card, setCard]);
  const confirm = changesConfirm(card.changes);

  const apply = useCallback(() => {
    useStore.getState().applyChanges(card.changes);
    success();
    setCard(null);
    const first = card.changes[0];
    if (first) toTabRoute(TAB_FOR[first.type]);
  }, [card.changes, setCard]);

  const buttons = useMemo<SheetButton[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: close },
      { key: 'apply', label: confirm.label, tone: confirm.danger ? 'danger' : 'primary', flex: 1.3, disabled: card.changes.length === 0, onPress: apply },
    ],
    [confirm.label, confirm.danger, card.changes.length, apply],
  );

  return (
    <Sheet visible={visible} onClose={close} inset footer={<SheetButtons buttons={buttons} />}>
      <Phrase text={card.transcript} onReparse={reparse} />
      {card.changes.map((ch) => {
        const view = changeView(ch, snapshot, clock);
        if (!view) return null;
        return (
          <ChangeBlock
            key={ch.key}
            card={view.card}
            badge={view.badge}
            struck={view.struck}
            rows={view.rows}
            conflicts={view.conflicts}
            candidates={candidateOptions(ch, snapshot)}
            onChoose={(id) => set(card.changes.map((x) => (x.key === ch.key ? { ...x, chosen: id } : x)))}
            onRemove={card.changes.length > 1 ? () => set(card.changes.filter((x) => x.key !== ch.key)) : undefined}
          />
        );
      })}
    </Sheet>
  );
};
