/** Открыть связанную запись: дело — окно дела, фильм и своя хотелка — окно записи, чужая хотелка — вкладка, заметка — тема или окно заметки */
import { router } from 'expo-router';
import { useStore } from '@/lib/store';
import { noteRef, taskRef, watchRef, wishRef } from '@/lib/linked';
import type { ID, LinkRef } from '@/lib/types';
import { nav, openTaskEditor, toTab, toTopic } from '../common';

export function openRef(r: LinkRef) {
  const st = useStore.getState();
  // Окно записей (CardSheet) — поверх экранов: закрываем, иначе новое откроется под ним
  if (st.card) st.setCard(null);
  if (r.type === 'task') return openTaskEditor(r.id);
  if (r.type === 'watch') {
    const w = st.watch.find((x) => x.id === r.id);
    if (!w) return;
    if (st.currentGroupId !== w.groupId) st.selectGroup(w.groupId);
    st.setCard({
      source: 'edit',
      editing: true,
      items: [{ key: w.id, id: w.id, type: 'watch', data: { title: w.title, kind: w.kind, genres: w.genres, origin: w.origin, year: w.year } }],
    });
    return;
  }
  if (r.type === 'wish') {
    const w = st.wishes.find((x) => x.id === r.id && x.ownerId === r.owner);
    if (!w) return;
    if (w.ownerId === st.me?.id) {
      st.setCard({ source: 'edit', editing: true, items: [{ key: w.id, id: w.id, type: 'wish', data: { title: w.title, note: w.note, link: w.link } }] });
      return;
    }
    st.setWishPerson(w.ownerId);
    toTab('wishes');
    return;
  }
  if (st.topics.some((t) => t.id === r.id)) return toTopic(r.id);
  router.push(nav.note(r.id));
}

/** Конец связи по id записи (только что сохранённой): дело, фильм, своя хотелка, заметка */
export function refById(id: ID): LinkRef[] {
  const st = useStore.getState();
  const t = st.tasks.find((x) => x.id === id);
  if (t) return [taskRef(t)];
  const w = st.watch.find((x) => x.id === id);
  if (w) return [watchRef(w)];
  const wi = st.wishes.find((x) => x.id === id && x.ownerId === st.me?.id);
  if (wi) return [wishRef(wi)];
  const n = st.topics.find((x) => x.id === id) ?? st.ideas.find((x) => x.id === id);
  return n ? [noteRef(n)] : [];
}
