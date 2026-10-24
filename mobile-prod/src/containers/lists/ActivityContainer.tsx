import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { activityProps } from '@/adapters/lists/activity';
import { wishOwnerOf } from '@/adapters/common/people';
import { useStore } from '@/lib/store';
import { fetchActivity } from '@/lib/sync';
import type { ID } from '@/lib/types';
import { ActivityScreen } from '@/screens/lists/ActivityScreen';
import { backOrTab, nav, openTaskEditor, signedInOnly, toTab, toTopic, useClock, useInsets, usePersonColors, useSnapshot } from '../common';

const back = () => backOrTab('tasks');

/**
 * Куда ведёт событие. Лента — корневой экран: во вкладки — toTab / toTopic (лента закрывается, второго (tabs) нет),
 * окна дела и группы — поверх ленты. Хотелки — вишлист ВЛАДЕЛЬЦА хотелки (с API 2 автор подарка — даритель, а не владелец);
 * дело — его окно (удалённое — день в календаре); «Смотреть» — вкладка группы; участники и название — группа
 */
function openEvent(id: ID) {
  const st = useStore.getState();
  const e = st.activity.find((x) => x.id === id);
  if (!e) return;
  if (e.kind.startsWith('wish.')) {
    const owner = wishOwnerOf(e, st.wishes);
    st.setWishPerson(owner === st.me?.id ? null : owner);
    return toTab('wishes');
  }
  if (e.kind === 'topic.share' && e.itemId) return toTopic(e.itemId);
  if (!e.groupId || !st.groups.some((g) => g.id === e.groupId)) return;
  st.selectGroup(e.groupId);
  if (e.kind.startsWith('watch.')) return toTab('watch');
  if (e.kind.startsWith('task.')) {
    const task = e.kind !== 'task.delete' && e.itemId ? st.tasks.find((t) => t.id === e.itemId) : undefined;
    if (task) return openTaskEditor(task.id);
    if (e.date) st.setCalendarDate(e.date);
    return toTab('tasks');
  }
  router.push(nav.group(e.groupId));
}

/** C-Activity: лента всех групп; при открытии — свежие события с сервера, при уходе — всё просмотрено */
export const ActivityContainer = signedInOnly(function Activity() {
  const s = useSnapshot();
  const { today } = useClock();
  const insets = useInsets();
  // Что было непросмотренным при входе, подсвечено до выхода
  const [seenBefore] = useState(() => useStore.getState().activitySeen);
  const colors = usePersonColors(s);
  // Первая загрузка ленты на этом телефоне: старое новым не считается (mergeActivity) — берём отметку после неё
  const seen = seenBefore || s.activitySeen;
  const data = useMemo(() => activityProps(s, colors, { today }, seen), [s, colors, today, seen]);

  useEffect(() => {
    void fetchActivity(true);
    return () => useStore.getState().markActivitySeen();
  }, []);

  return <ActivityScreen {...data} insets={insets} onBack={back} onOpenEvent={openEvent} />;
});
