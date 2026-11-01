import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useSelection } from '../common/useSelection';
import type { SelectAction } from '@/ui';
import { giftMany, setReceivedMany, wishStates } from './bulk';
import { emptyDraft } from '@/components/CardSheet';
import { ALL_PEOPLE, WISH_SECTIONS, parseWishKey, safeLink, wishesProps, type WishesSnapshot } from '@/adapters/lists/wishes';
import { DEMO, useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { WishesScreen, type WishRow, type WishSection } from '@/screens/WishesScreen';
import { NO_ME, signedInOnly, useChrome, useInsets, usePersonColors, type StoreState } from '../common';
import { holdWish } from '../quick/quickStore';

/** Подарки чужих хотелок — только с сервером API 2 (старый молча срежет giftedBy) */
const giftsOn = (api: number | null) => DEMO || (api ?? 0) >= 2;

/** Почему чужую хотелку отметить нельзя: старый сервер срежет giftedBy; null — /health ещё не ответил */
const giftsOffText = (api: number | null) => (api === null ? 'Подарки недоступны: нет ответа сервера' : 'Подарки недоступны: сервер устарел');

/**
 * Отметка в строке. Своя: «получил» (receivedAt). Чужая: «подарю» — сразу на сервер (отказ надо показать);
 * без API 2 (вкладка «ВСЕ») — сообщение, а не молчание; снять чужой подарок может только подаривший, остальное — без действия
 */
function toggleGift(key: string, gifted: boolean) {
  const ref = parseWishKey(key);
  const st = useStore.getState();
  const meId = st.me?.id;
  if (!ref || !meId) return;
  if (ref.ownerId === meId) return st.setReceived(ref.id, gifted);
  if (!giftsOn(st.serverApi)) return st.notice(giftsOffText(st.serverApi));
  const w = st.wishes.find((x) => x.ownerId === ref.ownerId && x.id === ref.id);
  if (!w || w.receivedAt) return;
  if (gifted ? !!w.giftedBy : w.giftedBy !== meId) return;
  void st.giftWish(ref.ownerId, ref.id, gifted).then((err) => {
    if (err) useStore.getState().notice(err);
  });
}

/** Ссылка чужой хотелки может быть любой строкой — открываем только http(s) */
function openLink(wish: WishRow) {
  const url = safeLink(wish.link);
  if (url) Linking.openURL(url).catch(() => {});
}

/** Своя хотелка — старая карточка правки; чужую не меняем (и из быстрых действий — ИЗМЕНИТЬ) */
export function openWish(key: string) {
  const ref = parseWishKey(key);
  const st = useStore.getState();
  if (!ref || ref.ownerId !== st.me?.id) return;
  const w = st.wishes.find((x) => x.ownerId === ref.ownerId && x.id === ref.id);
  if (!w) return;
  st.setCard({ source: 'edit', editing: true, items: [{ key: w.id, id: w.id, type: 'wish', data: { title: w.title, note: w.note, link: w.link } }] });
}

const toggleSection = (section: WishSection) => useStore.getState().toggleSection(WISH_SECTIONS[section]);

/** Только то, что нужно вишлистам (и цветам людей): дела, идеи и «Смотреть» экран не перерисовывают */
const pickWishes = (s: StoreState): WishesSnapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  wishes: s.wishes,
  activity: s.activity,
  activitySeen: s.activitySeen,
});

/** C-Wishes: вишлисты — я и люди всех моих групп */
export const WishesContainer = signedInOnly(function Wishes() {
  const s = useStore(useShallow(pickWishes));
  const insets = useInsets();
  const { onOpenFeed, onOpenSettings, onNavigate, onRec } = useChrome('wishes');
  const personId = useStore((st) => st.wishPersonId);
  const collapsed = useStore((st) => st.collapsedSections);
  const gifts = useStore((st) => giftsOn(st.serverApi));
  const colors = usePersonColors(s);
  const data = useMemo(() => wishesProps(s, colors, { personId, collapsed }), [s, colors, personId, collapsed]);
  const meId = s.me.id;
  const selected = data.selectedPersonId;
  // Вкладка другого человека: без API 2 отмечать нечего, открывать его хотелки нельзя
  const other = selected !== meId && selected !== ALL_PEOPLE;

  // Выбор: свои — получено / удалить; чужие — подарю (если сервер умеет); из «Подарено» — вернуть
  const pickable = useMemo(
    () => [...data.wishes.map((w) => w.id).filter((k) => parseWishKey(k)?.ownerId === meId || gifts), ...data.gifted.map((g) => g.id)],
    [data.wishes, data.gifted, meId, gifts],
  );
  const sel = useSelection(pickable);
  const deleteSelected = useCallback(() => {
    const ids = (sel.selected ?? [])
      .map((k) => parseWishKey(k))
      .filter((r) => r?.ownerId === meId)
      .map((r) => r!.id);
    if (ids.length) useStore.getState().deleteWishesMany(ids);
    sel.cancel();
  }, [sel, meId]);
  const picked = sel.selected ?? [];
  const wst = wishStates(picked);
  const own = picked.filter((k) => parseWishKey(k)?.ownerId === meId);
  const ownClosed = wst.closed.filter((k) => parseWishKey(k)?.ownerId === meId);
  const otherClosed = wst.closed.filter((k) => parseWishKey(k)?.ownerId !== meId);
  const selectActions: SelectAction[] = [
    ...(wst.mineOpen.length || (!wst.othersOpen.length && !wst.closed.length)
      ? [{ label: 'ПОЛУЧЕНО', n: wst.mineOpen.length, onPress: () => (setReceivedMany(wst.mineOpen, true), sel.cancel()) }]
      : []),
    ...(wst.othersOpen.length ? [{ label: 'ПОДАРЮ', n: wst.othersOpen.length, onPress: () => (void giftMany(wst.othersOpen, true), sel.cancel()) }] : []),
    ...(wst.closed.length
      ? [
          {
            label: 'ВЕРНУТЬ',
            n: wst.closed.length,
            onPress: () => {
              if (ownClosed.length) setReceivedMany(ownClosed, false);
              if (otherClosed.length) void giftMany(otherClosed, false);
              sel.cancel();
            },
          },
        ]
      : []),
    { label: 'УДАЛИТЬ', n: own.length, danger: true, onPress: deleteSelected },
  ];
  const onSelectPerson = useCallback((id: ID) => useStore.getState().setWishPerson(id === meId ? null : id), [meId]);
  const onAdd = useCallback(() => {
    const st = useStore.getState();
    if (other) st.setWishPerson(null);
    st.setCard({ source: 'manual', items: [emptyDraft('wish')], editing: true });
  }, [other]);

  return (
    <WishesScreen
      {...data}
      insets={insets}
      onSelectPerson={onSelectPerson}
      onToggleGift={other && !gifts ? undefined : toggleGift}
      onOpenLink={openLink}
      onOpenWish={other ? undefined : openWish}
      onLongPressWish={holdWish}
      onToggleSection={toggleSection}
      onAdd={onAdd}
      onOpenFeed={onOpenFeed}
      onOpenSettings={onOpenSettings}
      onNavigate={onNavigate}
      onRec={onRec}
      selected={sel.selected}
      pickable={pickable}
      allSelected={sel.allSelected}
      onStartSelect={sel.start}
      onToggleSelect={sel.toggle}
      onSelectAll={sel.selectAll}
      onCancelSelect={sel.cancel}
      onDeleteSelected={deleteSelected}
      selectActions={selectActions}
    />
  );
});
