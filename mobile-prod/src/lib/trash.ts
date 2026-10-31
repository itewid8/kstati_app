/**
 * «Недавно удалённые»: всё, что удалили (дела, хотелки, «Смотреть», темы, заметки), 30 дней лежит здесь.
 * Попадает сюда из одного места — «ВЕРНУТЬ» после удаления (store.withUndo): что исчезло из списков, то и удалено.
 * Вернуть — записи снова в списках (синхронизация отправит их на сервер с теми же id); удалить навсегда — только отсюда.
 * Тема возвращается вместе с заметками, удалёнными вместе с ней; план — с подзадачами.
 */
import type { ID, Idea, Task, Topic, WatchItem, Wish } from './types';
import { splitTitle, plainLine } from './note';

export type TrashKind = 'task' | 'wish' | 'watch' | 'topic' | 'idea';
export type TrashEntry =
  | { kind: 'task'; item: Task; deletedAt: string; batch: string }
  | { kind: 'wish'; item: Wish; deletedAt: string; batch: string }
  | { kind: 'watch'; item: WatchItem; deletedAt: string; batch: string }
  | { kind: 'topic'; item: Topic; deletedAt: string; batch: string }
  | { kind: 'idea'; item: Idea; deletedAt: string; batch: string };

export type TrashLists = { tasks: Task[]; wishes: Wish[]; watch: WatchItem[]; topics: Topic[]; ideas: Idea[] };

export const TRASH_DAYS = 30;
const MAX = 1000;
const DAY_MS = 86_400_000;

export const trashKey = (e: Pick<TrashEntry, 'kind' | 'item'>) => `${e.kind}:${e.item.id}`;

const LIST: Record<TrashKind, keyof TrashLists> = { task: 'tasks', wish: 'wishes', watch: 'watch', topic: 'topics', idea: 'ideas' };

/** Что исчезло из списков между before и after — в корзину (одной пачкой) */
export function removedEntries(before: Partial<TrashLists>, after: TrashLists, now: string, batch: string): TrashEntry[] {
  const out: TrashEntry[] = [];
  (Object.keys(LIST) as TrashKind[]).forEach((kind) => {
    const key = LIST[kind];
    const was = before[key] as { id: ID }[] | undefined;
    if (!was) return;
    const still = new Set((after[key] as { id: ID }[]).map((x) => x.id));
    for (const item of was) if (!still.has(item.id)) out.push({ kind, item, deletedAt: now, batch } as TrashEntry);
  });
  return out;
}

/** Новые записи в начало; одна запись — один раз; старше 30 дней и сверх 1000 — уходят */
export function addToTrash(trash: readonly TrashEntry[], add: readonly TrashEntry[], now = Date.now()): TrashEntry[] {
  const keys = new Set(add.map(trashKey));
  return [...add, ...trash.filter((e) => !keys.has(trashKey(e)))].filter((e) => now - Date.parse(e.deletedAt) < TRASH_DAYS * DAY_MS).slice(0, MAX);
}

/** Выбранные + то, что удалено вместе с ними (заметки темы, подзадачи плана) */
export function withDependents(trash: readonly TrashEntry[], keys: ReadonlySet<string>): Set<string> {
  const out = new Set(keys);
  for (const e of trash) {
    if (!keys.has(trashKey(e))) continue;
    for (const d of trash) {
      if (d.batch !== e.batch) continue;
      if (e.kind === 'topic' && d.kind === 'idea' && d.item.topicId === e.item.id) out.add(trashKey(d));
      if (e.kind === 'task' && d.kind === 'task' && d.item.parentId === e.item.id) out.add(trashKey(d));
    }
  }
  return out;
}

/** Вернуть записи keys в списки: то, что уже есть, не трогаем; потерянные тема/план — заметка «Без темы», дело без плана */
export function restore(lists: TrashLists, trash: readonly TrashEntry[], keys: ReadonlySet<string>): { lists: TrashLists; trash: TrashEntry[]; count: number } {
  const all = withDependents(trash, keys);
  const back = trash.filter((e) => all.has(trashKey(e)));
  const next: TrashLists = { tasks: [...lists.tasks], wishes: [...lists.wishes], watch: [...lists.watch], topics: [...lists.topics], ideas: [...lists.ideas] };
  const has = (k: keyof TrashLists, id: ID) => (next[k] as { id: ID }[]).some((x) => x.id === id);
  for (const e of back) if (e.kind === 'topic' && !has('topics', e.item.id)) next.topics.push(e.item);
  for (const e of back) if (e.kind === 'task' && !e.item.parentId && !has('tasks', e.item.id)) next.tasks.push(e.item);
  for (const e of back) {
    if (e.kind === 'task' && e.item.parentId && !has('tasks', e.item.id))
      next.tasks.push(has('tasks', e.item.parentId) ? e.item : { ...e.item, parentId: null });
    if (e.kind === 'idea' && !has('ideas', e.item.id))
      next.ideas.unshift(e.item.topicId && !has('topics', e.item.topicId) ? { ...e.item, topicId: null } : e.item);
    if (e.kind === 'wish' && !has('wishes', e.item.id)) next.wishes.push(e.item);
    if (e.kind === 'watch' && !has('watch', e.item.id)) next.watch.push(e.item);
  }
  return { lists: next, trash: trash.filter((e) => !all.has(trashKey(e))), count: back.length };
}

/** Название записи для списка корзины */
export function trashTitle(e: TrashEntry): string {
  if (e.kind === 'idea') {
    const { title, body } = splitTitle(e.item.text);
    return title || plainLine(body.split('\n').find((l) => l.trim()) ?? '') || 'Пустая заметка';
  }
  return e.item.title || 'Без названия';
}

export const TRASH_LABEL: Record<TrashKind, string> = { task: 'ДЕЛО', wish: 'ХОЧУ', watch: 'СМОТРЕТЬ', topic: 'ТЕМА', idea: 'ЗАМЕТКА' };

/** Сколько дней осталось до удаления навсегда */
export const daysLeft = (e: Pick<TrashEntry, 'deletedAt'>, now = Date.now()) => Math.max(0, TRASH_DAYS - Math.floor((now - Date.parse(e.deletedAt)) / DAY_MS));
