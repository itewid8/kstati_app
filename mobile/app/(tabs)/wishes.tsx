import { ChevronDown, ChevronRight, ExternalLink } from '@/components/icons';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useBottomSpace } from '@/components/BottomBar';
import { emptyDraft } from '@/components/CardSheet';
import { Header } from '@/components/Header';
import { openMenu } from '@/components/ActionMenu';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { NoGroup } from '@/components/NoGroup';
import { SwipeRow } from '@/components/SwipeRow';
import { Checkbox, Chip, Divider, T } from '@/components/ui';
import { useCurrentGroup, useStore } from '@/lib/store';
import type { Wish } from '@/lib/types';
import { useDelayedMark } from '@/lib/useMark';
import { ICON, space, useColors } from '@/theme';

export default function Wishes() {
  const c = useColors();
  const me = useStore((s) => s.me)!;
  const users = useStore((s) => s.users);
  const group = useCurrentGroup();
  const wishes = useStore((s) => s.wishes);
  const personId = useStore((s) => s.wishPersonId);
  const { setWishPerson, setCard } = useStore.getState();
  const bottom = useBottomSpace();
  const [showReceived, setShowReceived] = useState(false);

  // Люди текущей группы, кроме меня, по алфавиту
  const people = useMemo(
    () =>
      users
        .filter((u) => u.id !== me.id && group?.memberIds.includes(u.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [users, me.id, group],
  );
  const ownerId = personId && people.some((p) => p.id === personId) ? personId : me.id;
  const own = ownerId === me.id;
  // Хотелки человека — одни и те же во всех группах; группа определяет только, чьи хотелки можно смотреть
  const all = wishes.filter((w) => w.ownerId === ownerId);
  const list = all.filter((w) => !w.receivedAt);
  const received = all.filter((w) => w.receivedAt).sort((a, b) => b.receivedAt!.localeCompare(a.receivedAt!));
  const inset = own ? space.side + 36 : space.side;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header
        title={group?.name ?? 'Хочу'}
        groupSwitch
        onPlus={
          group
            ? () => {
                setWishPerson(null);
                setCard({ source: 'manual', items: [emptyDraft('wish')], editing: true });
              }
            : undefined
        }
      />
      {!group ? (
        <NoGroup />
      ) : (
        <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} style={{ flexGrow: 0 }}>
        <Chip label="Я" selected={own} onPress={() => setWishPerson(null)} />
        {people.map((p) => (
          <Chip key={p.id} label={p.name} selected={ownerId === p.id} onPress={() => setWishPerson(p.id)} />
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        {/* key: при смене человека список перерисовывается без анимаций */}
        <LayoutAnimationConfig skipEntering key={ownerId}>
          {list.length === 0 && (
            <T muted style={{ padding: space.side, paddingTop: 24 }}>
              {own ? 'Список пуст' : 'Пока ничего не хочет'}
            </T>
          )}
          {list.map((w, i) => (
            <ListItem key={w.id}>
              {i > 0 && <Divider inset={inset} />}
              <WishRow wish={w} own={own} />
            </ListItem>
          ))}

          {received.length > 0 && (
            <ListItem>
              <Pressable onPress={() => setShowReceived((v) => !v)} style={styles.toggle}>
                <T variant="caption" muted>
                  Подарили · {received.length}
                </T>
                {showReceived ? (
                  <ChevronDown size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
                ) : (
                  <ChevronRight size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
                )}
              </Pressable>
            </ListItem>
          )}
          {showReceived &&
            received.map((w, i) => (
              <ListItem key={w.id}>
                {i > 0 && <Divider inset={inset} />}
                <WishRow wish={w} own={own} />
              </ListItem>
            ))}
        </LayoutAnimationConfig>
      </ScrollView>
        </>
      )}
    </View>
  );
}

function WishRow({ wish, own }: { wish: Wish; own: boolean }) {
  const c = useColors();
  const { deleteWish, toggleWish, setCard } = useStore.getState();
  const { marked, toggle } = useDelayedMark(!!wish.receivedAt, () => toggleWish(wish.id));

  const edit = () =>
    setCard({
      source: 'edit',
      editing: true,
      items: [{ key: wish.id, id: wish.id, type: 'wish', data: { title: wish.title, note: wish.note, link: wish.link } }],
    });

  const content = (
    <Pressable
      onPress={own ? edit : undefined}
      onLongPress={
        own
          ? () =>
              openMenu({
                title: wish.title,
                actions: [
                  { label: 'Изменить', onPress: edit },
                  { label: 'Удалить', danger: true, onPress: () => deleteWish(wish.id) },
                ],
              })
          : undefined
      }
      delayLongPress={350}
      disabled={!own}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : c.background }]}
    >
      {/* «Подарили» отмечает только владелец */}
      {own && <Checkbox checked={marked} onPress={toggle} />}
      <View style={{ flex: 1 }}>
        <T muted={marked} style={marked ? { textDecorationLine: 'line-through' } : undefined}>
          {wish.title}
        </T>
        {wish.note ? (
          <T variant="caption" muted>
            {wish.note}
          </T>
        ) : null}
      </View>
      {wish.link ? (
        <Pressable hitSlop={12} onPress={() => Linking.openURL(wish.link).catch(() => {})}>
          <ExternalLink size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );

  return own ? (
    <SwipeRow onSwipeRight={toggle} onSwipeLeft={() => deleteWish(wish.id)}>
      {content}
    </SwipeRow>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  people: { paddingHorizontal: space.side, gap: 8, paddingBottom: 8 },
  row: {
    minHeight: space.rowMin,
    paddingHorizontal: space.side,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.side,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
