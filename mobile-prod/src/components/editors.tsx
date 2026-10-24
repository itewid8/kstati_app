/**
 * Запись в окне записей (CardSheet): просмотр полями как в C-Voice или правка в окне — хотелка, «Смотреть», идея, тема.
 * Дело правится в полном окне дела (CardTaskEditor): в окне записей оно всегда показано полями, нажатие — правка.
 */
import { useCallback, useMemo } from 'react';
import { createFields } from '@/adapters/voice/create';
import { draftHead, ownTopics } from '@/adapters/lists/cardSheet';
import type { Snapshot } from '@/adapters/snapshot';
import type { ColorMap } from '@/adapters/common/people';
import type { DraftItem } from '@/lib/types';
import {
  DraftPreview,
  DupNotice,
  IdeaDraftEditor,
  TopicDraftEditor,
  WatchDraftEditor,
  WishDraftEditor,
  type DraftDuplicate,
  type DraftHead,
} from '@/screens/sheets';

type Props = {
  item: DraftItem;
  /** Правка в окне (после «ИЗМЕНИТЬ», ручное добавление) */
  editing: boolean;
  snapshot: Snapshot;
  colors: ColorMap;
  dup: DraftDuplicate | null;
  onChange: (item: DraftItem) => void;
  /** «×» — убрать запись из ответа (только когда записей несколько) */
  onRemove?: () => void;
  /** Дело — открыть полное окно дела */
  onOpenTask: (item: DraftItem) => void;
};

export const DraftItemView = ({ item, editing, snapshot, colors, dup, onChange, onRemove, onOpenTask }: Props) => {
  const base = useMemo(() => draftHead(item, snapshot, colors), [item, snapshot, colors]);
  // Новая запись без названия — фокус сразу в название
  const head = useMemo<DraftHead>(() => ({ ...base, onRemove, autoFocus: !item.id && !item.data.title }), [base, onRemove, item.id, item.data.title]);
  const topics = useMemo(() => ownTopics(snapshot), [snapshot]);
  const fields = useMemo(() => createFields(item, snapshot), [item, snapshot]);
  const openTask = useCallback(() => onOpenTask(item), [onOpenTask, item]);

  if (!editing || item.type === 'task') {
    return <DraftPreview fields={fields} dup={dup} onRemove={onRemove} onPress={item.type === 'task' ? openTask : undefined} />;
  }
  return (
    <>
      {item.type === 'wish' ? (
        <WishDraftEditor head={head} value={item.data} onChange={(data) => onChange({ ...item, data })} />
      ) : item.type === 'watch' ? (
        <WatchDraftEditor head={head} value={item.data} onChange={(data) => onChange({ ...item, data })} />
      ) : item.type === 'idea' ? (
        <IdeaDraftEditor head={head} value={item.data} topics={topics} onChange={(data) => onChange({ ...item, data })} />
      ) : (
        <TopicDraftEditor head={head} value={item.data} onChange={(data) => onChange({ ...item, data })} />
      )}
      {dup ? <DupNotice dup={dup} /> : null}
    </>
  );
};
