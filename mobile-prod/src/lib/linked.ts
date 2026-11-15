/**
 * Связи записей (дело, фильм, хотелка, заметка): концы связи, поиск связанного, видимое.
 * Чистый модуль: без Expo и хранилища.
 */
import type { Idea, Link, LinkRef, LinkType, Task, Topic, WatchItem, Wish } from './types';

export const taskRef = (t: Pick<Task, 'id' | 'createdBy'>): LinkRef => ({ type: 'task', id: t.id, owner: t.createdBy });
export const watchRef = (w: Pick<WatchItem, 'id' | 'groupId'>): LinkRef => ({ type: 'watch', id: w.id, owner: w.groupId });
export const wishRef = (w: Pick<Wish, 'id' | 'ownerId'>): LinkRef => ({ type: 'wish', id: w.id, owner: w.ownerId });
export const noteRef = (n: Pick<Topic | Idea, 'id' | 'ownerId'>): LinkRef => ({ type: 'note', id: n.id, owner: n.ownerId });

export const sameRef = (a: LinkRef, b: LinkRef) => a.type === b.type && a.id === b.id;
export const refKey = (r: LinkRef) => `${r.type}:${r.id}`;

/** Другой конец связи относительно ref; связь не про ref — null */
export function otherEnd(l: Link, ref: LinkRef): LinkRef | null {
  if (sameRef(l.a, ref)) return l.b;
  if (sameRef(l.b, ref)) return l.a;
  return null;
}

/** Записи, которые сейчас есть у человека (видны ему): по ним решается, показывать ли связь */
export type LinkWorld = { tasks: readonly Task[]; watch: readonly WatchItem[]; wishes: readonly Wish[]; topics: readonly Topic[]; ideas: readonly Idea[] };

export function refExists(r: LinkRef, w: LinkWorld): boolean {
  switch (r.type) {
    case 'task':
      return w.tasks.some((t) => t.id === r.id);
    case 'watch':
      return w.watch.some((x) => x.id === r.id);
    case 'wish':
      return w.wishes.some((x) => x.id === r.id && x.ownerId === r.owner);
    case 'note':
      return w.topics.some((x) => x.id === r.id) || w.ideas.some((x) => x.id === r.id);
  }
}

/**
 * Связи записи, у которых видны оба конца: { link, other }. Удалённая или недоступная запись — связь не показываем
 * (а связь остаётся: «Вернуть» после удаления возвращает и её)
 */
export function linksOf(ref: LinkRef, links: readonly Link[], w: LinkWorld): { link: Link; other: LinkRef }[] {
  const out: { link: Link; other: LinkRef }[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    const other = otherEnd(l, ref);
    if (!other || seen.has(refKey(other)) || !refExists(other, w)) continue;
    seen.add(refKey(other));
    out.push({ link: l, other });
  }
  return out;
}

/** Уже связаны ли две записи */
export const linked = (a: LinkRef, b: LinkRef, links: readonly Link[]) => links.some((l) => (sameRef(l.a, a) && sameRef(l.b, b)) || (sameRef(l.a, b) && sameRef(l.b, a)));

/** Можно ли связать: разные типы и ещё не связаны */
export const canLink = (a: LinkRef, b: LinkRef, links: readonly Link[]) => a.type !== b.type && !linked(a, b, links);

/**
 * Записи одной голосовой команды связываются между собой: каждая пара разных типов
 * («дело + список покупок» → дело ↔ список)
 */
export function pairsToLink(refs: readonly LinkRef[]): [LinkRef, LinkRef][] {
  const out: [LinkRef, LinkRef][] = [];
  for (let i = 0; i < refs.length; i++) for (let j = i + 1; j < refs.length; j++) if (refs[i]!.type !== refs[j]!.type) out.push([refs[i]!, refs[j]!]);
  return out;
}

/** Что ещё связано с удаляемыми записями (сами удаляемые не в счёт), без повторов */
export function linkedToDeleted(refs: readonly LinkRef[], links: readonly Link[], w: LinkWorld): LinkRef[] {
  const gone = new Set(refs.map(refKey));
  const out = new Map<string, LinkRef>();
  for (const r of refs) for (const { other } of linksOf(r, links, w)) if (!gone.has(refKey(other))) out.set(refKey(other), other);
  return [...out.values()];
}

export const LINK_TYPE_LABEL: Record<LinkType, string> = { task: 'Дело', watch: 'Смотреть', wish: 'Хотелка', note: 'Заметка' };
