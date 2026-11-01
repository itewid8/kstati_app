/**
 * Действия над несколькими выбранными записями — те же, что в быстрых действиях одной записи, разом и с одной
 * «ВЕРНУТЬ». Дела — по ключам «id@раз» (у серии — только этот раз).
 */
import * as Clipboard from 'expo-clipboard';
import { shiftDay } from '@/adapters/calendar/events';
import { parseKey } from '@/adapters/common/tasks';
import { parseWishKey } from '@/adapters/lists/wishes';
import { moveChange } from '@/adapters/quick/convert';
import { moveToDate, nextSaturday } from '@/adapters/quick/task';
import { toISODate } from '@/lib/dates';
import { syncParent, toggleOcc } from '@/lib/edits';
import { notePlain } from '@/lib/note';
import { instance } from '@/lib/recur';
import { useStore } from '@/lib/store';
import type { ID, Task } from '@/lib/types';
import { withUndo } from '../quick/actions';

/* ---------- Дела ---------- */

const resolve = (key: string, tasks: readonly Task[]) => {
  const { id, occ } = parseKey(key);
  const t = tasks.find((x) => x.id === id);
  return t ? { t, occ: t.repeat && occ ? occ : null } : null;
};
const isDone = (t: Task, occ: string | null) => (occ ? !!t.doneDates?.includes(occ) : !!t.doneAt);

/** Выбранные дела: ещё открытые и уже сделанные */
export function taskStates(keys: readonly string[]): { open: string[]; done: string[] } {
  const tasks = useStore.getState().tasks;
  const open: string[] = [];
  const done: string[] = [];
  for (const k of keys) {
    const r = resolve(k, tasks);
    if (r) (isDone(r.t, r.occ) ? done : open).push(k);
  }
  return { open, done };
}

/** ЗАКРЫТЬ (done) / ОТКРЫТЬ: план пересчитывается по подзадачам */
export function setTasksDone(keys: readonly string[], done: boolean) {
  const now = new Date().toISOString();
  withUndo(done ? `Готово: ${keys.length}` : `Снова в работе: ${keys.length}`, () => {
    let tasks = useStore.getState().tasks;
    const parents = new Set<ID>();
    for (const k of keys) {
      const r = resolve(k, tasks);
      if (!r || isDone(r.t, r.occ) === done) continue;
      tasks = tasks.map((x) => (x.id !== r.t.id ? x : r.occ ? toggleOcc(x, r.occ, done) : { ...x, doneAt: done ? now : null }));
      if (r.t.parentId) parents.add(r.t.parentId);
    }
    for (const p of parents) tasks = syncParent(tasks, p);
    useStore.setState({ tasks });
  });
}

export type MoveTarget = 'today' | 'tomorrow' | 'weekend' | 'week';
export const MOVE_LABELS: Record<MoveTarget, string> = { today: 'На сегодня', tomorrow: 'На завтра', weekend: 'На выходные', week: 'На неделю позже' };

/** ПЕРЕНЕСТИ: время прежнее; «на неделю позже» — от своей даты */
export function moveTasks(keys: readonly string[], to: MoveTarget) {
  const st = useStore.getState();
  const today = toISODate(new Date());
  const changes = keys.flatMap((k) => {
    const r = resolve(k, st.tasks);
    if (!r) return [];
    const base = r.occ ? instance(r.t, r.occ) : r.t;
    const date =
      to === 'today' ? today : to === 'tomorrow' ? shiftDay(today, 1) : to === 'weekend' ? nextSaturday(today) : shiftDay(base.date ?? today, 7);
    const patch = moveToDate(base, date);
    return patch ? [{ ...moveChange(r.t, r.occ, patch), key: `bulk:${k}` }] : [];
  });
  if (!changes.length) return st.notice('Уже там');
  withUndo(`Перенесено: ${changes.length}`, () => useStore.getState().applyChanges(changes));
}

/* ---------- Смотреть ---------- */

export function watchStates(ids: readonly ID[]): { queue: ID[]; watched: ID[] } {
  const all = useStore.getState().watch;
  const queue: ID[] = [];
  const watched: ID[] = [];
  for (const id of ids) {
    const w = all.find((x) => x.id === id);
    if (w) (w.watchedAt ? watched : queue).push(id);
  }
  return { queue, watched };
}

export function setWatched(ids: readonly ID[], watched: boolean) {
  withUndo(watched ? `Посмотрели: ${ids.length}` : `Снова в очереди: ${ids.length}`, () => {
    const st = useStore.getState();
    for (const id of ids) {
      const w = st.watch.find((x) => x.id === id);
      if (w && !!w.watchedAt !== watched) useStore.getState().toggleWatched(id);
    }
  });
}

/* ---------- Хочу ---------- */

/** Выбранные хотелки по действиям: свои открытые (получено), чужие открытые (подарю), уже в «Подарено» (вернуть) */
export function wishStates(keys: readonly string[]): { mineOpen: string[]; othersOpen: string[]; closed: string[] } {
  const st = useStore.getState();
  const meId = st.me?.id;
  const out = { mineOpen: [] as string[], othersOpen: [] as string[], closed: [] as string[] };
  for (const k of keys) {
    const ref = parseWishKey(k);
    const w = ref ? st.wishes.find((x) => x.ownerId === ref.ownerId && x.id === ref.id) : undefined;
    if (!w || !ref) continue;
    const mine = ref.ownerId === meId;
    const closed = mine ? !!w.receivedAt : !!w.receivedAt || (!!w.giftedBy && w.giftedBy === meId);
    if (closed) out.closed.push(k);
    else if (mine) out.mineOpen.push(k);
    else if (!w.giftedBy) out.othersOpen.push(k);
  }
  return out;
}

export function setReceivedMany(keys: readonly string[], received: boolean) {
  withUndo(received ? `Получено: ${keys.length}` : `Снова в списке: ${keys.length}`, () => {
    for (const k of keys) {
      const ref = parseWishKey(k);
      if (ref) useStore.getState().setReceived(ref.id, received);
    }
  });
}

/** ПОДАРЮ / не подарю — чужие хотелки, по одной на сервер (отказ показываем) */
export async function giftMany(keys: readonly string[], gifted: boolean) {
  let ok = 0;
  for (const k of keys) {
    const ref = parseWishKey(k);
    if (!ref) continue;
    const err = await useStore.getState().giftWish(ref.ownerId, ref.id, gifted);
    if (err) useStore.getState().notice(err);
    else ok++;
  }
  if (ok) useStore.getState().notice(gifted ? `Подарю: ${ok}` : `Снова в списке: ${ok}`);
}

/* ---------- Темы и заметки ---------- */

export function archiveTopicsMany(ids: readonly ID[], archived: boolean) {
  const st = useStore.getState();
  ids.forEach((id) => st.archiveTopic(id, archived));
  st.notice(archived ? `В архиве: ${ids.length}` : `Из архива: ${ids.length}`);
}

/** Заметки — в тему (null — «Без темы») */
export function moveIdeasMany(ids: readonly ID[], topicId: ID | null) {
  const st = useStore.getState();
  const topic = topicId ? st.topics.find((t) => t.id === topicId) : undefined;
  if (topicId && !topic) return;
  withUndo(`Перенесено: ${ids.length} · ${topic ? topic.title : 'Без темы'}`, () => {
    const items = useStore
      .getState()
      .ideas.filter((i) => ids.includes(i.id))
      .map((i) => ({ key: i.id, id: i.id, type: 'idea' as const, data: { title: i.text, topicId, newTopic: null } }));
    useStore.getState().saveItems(items);
  });
}

/** Текст выбранных заметок — в буфер обмена, через пустую строку */
export function copyIdeasMany(ids: readonly ID[]) {
  const ideas = useStore.getState().ideas.filter((i) => ids.includes(i.id));
  const text = ideas.map((i) => notePlain(i.text)).join('\n\n');
  void Clipboard.setStringAsync(text)
    .then(() => useStore.getState().notice(`Скопировано: ${ideas.length}`))
    .catch(() => useStore.getState().notice('Не скопировалось'));
}
