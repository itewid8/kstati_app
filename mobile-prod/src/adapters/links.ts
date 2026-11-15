/**
 * Блок «Связи» на карточке записи и выбор записи для связи: строки со связанным и кандидаты по поиску.
 * Чистые функции: данные хранилища → строки экрана.
 */
import { taskWhen } from '@/lib/dates';
import { canLink, linksOf, noteRef, refKey, taskRef, watchRef, wishRef, LINK_TYPE_LABEL, type LinkWorld } from '@/lib/linked';
import { notePreview } from '@/lib/note';
import type { ID, Link, LinkRef, User } from '@/lib/types';

export type LinkData = LinkWorld & { links: readonly Link[]; users: readonly User[]; meId: ID };

/** Строка связанной записи: что это, название, пояснение. linkId — у уже связанной (для «убрать») */
export type LinkRow = { key: string; ref: LinkRef; kind: string; title: string; meta: string; linkId?: ID };

const whoOf = (id: ID, d: LinkData) => (id === d.meId ? 'моя' : (d.users.find((u) => u.id === id)?.name ?? ''));

/** Название и пояснение записи; нет такой — null */
export function describeRef(r: LinkRef, d: LinkData): { title: string; meta: string } | null {
  if (r.type === 'task') {
    const t = d.tasks.find((x) => x.id === r.id);
    if (!t) return null;
    const when = taskWhen(t.date, t.time);
    return { title: t.title, meta: [when, t.doneAt ? 'сделано' : ''].filter(Boolean).join(' · ') };
  }
  if (r.type === 'watch') {
    const w = d.watch.find((x) => x.id === r.id);
    if (!w) return null;
    return { title: w.title, meta: [w.year ? String(w.year) : '', w.watchedAt ? 'посмотрели' : ''].filter(Boolean).join(' · ') };
  }
  if (r.type === 'wish') {
    const w = d.wishes.find((x) => x.id === r.id && x.ownerId === r.owner);
    if (!w) return null;
    return { title: w.title, meta: whoOf(w.ownerId, d) };
  }
  const topic = d.topics.find((x) => x.id === r.id);
  if (topic) {
    const p = topic.body ? notePreview(topic.body) : null;
    return { title: topic.title, meta: p?.checks ? `список ${p.checks}` : 'тема' };
  }
  const idea = d.ideas.find((x) => x.id === r.id);
  if (!idea) return null;
  const p = notePreview(idea.text);
  const inTopic = idea.topicId ? d.topics.find((x) => x.id === idea.topicId)?.title : '';
  return { title: p.title || 'Заметка', meta: [inTopic, p.checks ? `список ${p.checks}` : ''].filter(Boolean).join(' · ') };
}

const row = (r: LinkRef, d: LinkData, linkId?: ID): LinkRow | null => {
  const x = describeRef(r, d);
  return x ? { key: refKey(r), ref: r, kind: LINK_TYPE_LABEL[r.type], ...x, ...(linkId && { linkId }) } : null;
};

/** Что связано с записью: дела по дате, остальное — в порядке связывания */
export function linkRows(self: LinkRef, d: LinkData): LinkRow[] {
  return linksOf(self, d.links, d)
    .map(({ link, other }) => row(other, d, link.id))
    .filter((x): x is LinkRow => x !== null);
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/**
 * Записи, которые можно связать с self: другого типа, ещё не связанные, по поиску (по словам названия).
 * Без поиска — сначала ближайшие дела, потом недавние фильмы, хотелки и заметки
 */
export function linkCandidates(self: LinkRef, d: LinkData, query: string, today: string, limit = 60): LinkRow[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const all: { ref: LinkRef; rank: number }[] = [];
  // Дела: сначала предстоящие (ближайшие выше), потом без даты, потом прошедшие (свежие выше)
  for (const t of d.tasks) {
    const days = t.date ? (Date.parse(t.date) - Date.parse(today)) / 86_400_000 : null;
    all.push({ ref: taskRef(t), rank: days === null ? 400 : days >= 0 ? days : 800 - days });
  }
  d.watch.forEach((w, i) => all.push({ ref: watchRef(w), rank: 1000 + i }));
  d.wishes.forEach((w, i) => all.push({ ref: wishRef(w), rank: 2000 + i }));
  d.topics.forEach((t, i) => all.push({ ref: noteRef(t), rank: 3000 + i }));
  d.ideas.filter((x) => x.ownerId === d.meId).forEach((x, i) => all.push({ ref: noteRef(x), rank: 4000 + i }));
  const out: LinkRow[] = [];
  for (const c of all.sort((a, b) => a.rank - b.rank)) {
    if (!canLink(self, c.ref, d.links)) continue;
    const r = row(c.ref, d);
    if (!r) continue;
    const hay = norm(`${r.title} ${r.meta}`);
    if (words.length && !words.every((w) => hay.includes(w))) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
