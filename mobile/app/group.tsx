import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openMenu } from '@/components/ActionMenu';
import { BackHeader } from '@/components/Header';
import { Button, Chip, Divider, Field, ListRow, SectionLabel, T } from '@/components/ui';
import { useCurrentGroup, useStore } from '@/lib/store';
import { canManageGroup, canRemoveMember, CATEGORIES, CATEGORY_LABEL, hisHer } from '@/lib/types';
import { space, useColors } from '@/theme';

/** Настройки текущей группы: название, приглашение, участники и роли, выход */
export default function GroupSettings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const group = useCurrentGroup();
  const me = useStore((s) => s.me);
  const users = useStore((s) => s.users);
  const { renameGroup, leaveGroup, setAdmin, removeMember, setGroupCategory } = useStore.getState();
  const [name, setName] = useState(group?.name ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => setName(group?.name ?? ''), [group?.id, group?.name]);

  if (!group || !me) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <BackHeader title="Группа" />
      </View>
    );
  }

  const manage = canManageGroup(group, me.id);
  const isOwner = group.ownerId === me.id;
  const members = group.memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .sort((a, b) => {
      const rank = (id: string) => (id === group.ownerId ? 0 : group.adminIds.includes(id) ? 1 : 2);
      return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'ru');
    });

  const copyCode = async () => {
    await Clipboard.setStringAsync(group.inviteCode).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = () => {
    const last = group.memberIds.length <= 1;
    Alert.alert(
      `Выйти из «${group.name}»?`,
      last
        ? 'Вы последний участник — группа удалится вместе с делами и «Смотреть». Ваши хотелки останутся.'
        : isOwner
          ? 'Группа перейдёт первому админу, а если админов нет — другому участнику.'
          : undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => {
            leaveGroup(group.id);
            router.back();
          },
        },
      ],
    );
  };

  const nameChanged = name.trim() && name.trim() !== group.name;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Группа" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Название</SectionLabel>
        <View style={{ paddingHorizontal: space.side, gap: 8 }}>
          {manage ? (
            <>
              <Field value={name} onChangeText={setName} maxLength={40} returnKeyType="done" />
              {nameChanged ? (
                <Button title="Сохранить" onPress={() => renameGroup(group.id, name.trim())} style={{ alignSelf: 'flex-start' }} />
              ) : null}
            </>
          ) : (
            <T>{group.name}</T>
          )}
        </View>

        <SectionLabel>Кто в группе</SectionLabel>
        <View style={{ paddingHorizontal: space.side, gap: 8 }}>
          {manage ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((k) => (
                <Chip key={k} label={CATEGORY_LABEL[k]} selected={group.category === k} onPress={() => setGroupCategory(group.id, k)} />
              ))}
            </View>
          ) : (
            <T>{CATEGORY_LABEL[group.category]}</T>
          )}
          <T variant="caption" muted>
            По категории ассистент понимает вопросы: «мы», «у нас» — это группа «Пара»; «наши друзья» — все группы «Друзья».
          </T>
        </View>

        {manage ? (
          <>
            <SectionLabel>Приглашение</SectionLabel>
            <Divider />
            {/* Тап по коду — скопировать; дальше его можно отправить в любом мессенджере */}
            <ListRow label="Код" value={copied ? 'Скопирован ✓' : group.inviteCode || 'появится после связи'} mono onPress={group.inviteCode ? copyCode : undefined} />
            <Divider />
          </>
        ) : (
          <T variant="caption" muted style={{ paddingHorizontal: space.side, paddingTop: 16 }}>
            Приглашать участников могут создатель и админы группы.
          </T>
        )}

        <SectionLabel>Участники · {members.length}</SectionLabel>
        <Divider />
        {members.map((u, i) => {
          const role = u.id === group.ownerId ? 'создатель' : group.adminIds.includes(u.id) ? 'админ' : '';
          // Назначать и снимать админов может только создатель; исключать — создатель и админы
          const actions = [
            ...(isOwner && u.id !== me.id
              ? [
                  group.adminIds.includes(u.id)
                    ? { label: 'Снять права админа', onPress: () => setAdmin(group.id, u.id, false) }
                    : { label: 'Сделать админом', onPress: () => setAdmin(group.id, u.id, true) },
                ]
              : []),
            ...(canRemoveMember(group, me.id, u.id)
              ? [
                  {
                    label: 'Исключить из группы',
                    danger: true,
                    onPress: () =>
                      Alert.alert(`Исключить ${u.name}?`, `Все ${hisHer(u)} дела и фильмы в этой группе удалятся. Хотелки личные — здесь их больше не увидят.`, [
                        { text: 'Отмена', style: 'cancel' },
                        { text: 'Исключить', style: 'destructive', onPress: () => removeMember(group.id, u.id) },
                      ]),
                  },
                ]
              : []),
          ];
          return (
            <View key={u.id}>
              {i > 0 && <Divider inset={space.side} />}
              <Pressable
                disabled={!actions.length}
                onPress={() => openMenu({ title: u.name, actions })}
                style={({ pressed }) => [styles.member, { backgroundColor: pressed ? c.surface : 'transparent' }]}
              >
                <View style={{ flex: 1 }}>
                  <T>
                    {u.name}
                    {u.id === me.id ? ' (вы)' : ''}
                  </T>
                  {u.nick ? (
                    <T variant="caption" muted>
                      @{u.nick}
                    </T>
                  ) : null}
                </View>
                {role ? (
                  <T variant="caption" mono muted>
                    {role}
                  </T>
                ) : null}
              </Pressable>
            </View>
          );
        })}
        <Divider />
        {manage && members.length > 1 ? (
          <T variant="caption" muted style={{ paddingHorizontal: space.side, paddingTop: 8 }}>
            {isOwner
              ? 'Нажмите на участника: админ или исключить. При исключении всё, что человек добавил в группу, удаляется.'
              : 'Нажмите на участника, чтобы исключить: всё, что человек добавил в группу, удалится.'}
          </T>
        ) : null}

        <SectionLabel> </SectionLabel>
        <Divider />
        <ListRow label="Выйти из группы" danger onPress={leave} />
        <Divider />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  member: {
    minHeight: space.rowMin,
    paddingHorizontal: space.side,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
