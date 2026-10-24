import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { openMenu } from '@/components/ActionMenu';
import { groupProps, type GroupSnapshot } from '@/adapters/account/group';
import { useStore, type MenuAction } from '@/lib/store';
import { canManageGroup, canRemoveMember, hisHer, type GroupCategory, type ID } from '@/lib/types';
import { GroupScreen, type SharedListKey } from '@/screens/account/GroupScreen';
import { InputSheet } from '@/ui';
import { NO_ME, signedInOnly, toTab, useClock, useInsets, usePersonColors, type StoreState } from '../common';
import { backToProfile } from './back';
import { accountRoutes } from './routes';

export type GroupContainerProps = { id: ID };

const back = backToProfile;

/** Создатель назначает и снимает админов; исключают создатель и админы (canRemoveMember) */
function memberMenu(groupId: ID, userId: ID) {
  const st = useStore.getState();
  const g = st.groups.find((x) => x.id === groupId);
  const me = st.me;
  const u = st.users.find((x) => x.id === userId);
  if (!g || !me || !u) return;
  const actions: MenuAction[] = [];
  if (g.ownerId === me.id && userId !== me.id) {
    const admin = g.adminIds.includes(userId);
    actions.push({ label: admin ? 'Снять права админа' : 'Сделать админом', onPress: () => useStore.getState().setAdmin(groupId, userId, !admin) });
  }
  if (canRemoveMember(g, me.id, userId)) {
    actions.push({
      label: 'Исключить из группы',
      danger: true,
      onPress: () =>
        Alert.alert(`Исключить ${u.name}?`, `Все ${hisHer(u)} дела и фильмы в этой группе удалятся. Хотелки личные — здесь их больше не увидят.`, [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Исключить', style: 'destructive', onPress: () => useStore.getState().removeMember(groupId, userId) },
        ]),
    });
  }
  if (actions.length) openMenu({ title: u.name, actions });
}

/** Выход: последний участник удаляет группу; создатель передаёт её первому админу или участнику */
function leave(groupId: ID) {
  const st = useStore.getState();
  const g = st.groups.find((x) => x.id === groupId);
  if (!g) return;
  const last = g.memberIds.length <= 1;
  Alert.alert(
    `Выйти из «${g.name}»?`,
    last
      ? 'Вы последний участник — группа удалится вместе с делами и «Смотреть». Ваши хотелки останутся.'
      : g.ownerId === st.me?.id
        ? 'Группа перейдёт первому админу, а если админов нет — другому участнику.'
        : undefined,
    [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        // Группа пропадёт из хранилища — экран уйдёт сам (эффект в GroupContainer), второй back() увёл бы ещё на экран
        onPress: () => useStore.getState().leaveGroup(groupId),
      },
    ],
  );
}

/** Только то, что нужно C-Group: лента и напоминания экран не перерисовывают */
const pickGroup = (s: StoreState): GroupSnapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  tasks: s.tasks,
  wishes: s.wishes,
  watch: s.watch,
  topics: s.topics,
  ideas: s.ideas,
});

/**
 * C-Group: настройки группы id. Название (окно ввода) и категория — черновик: снизу появляется ОТМЕНА / СОХРАНИТЬ.
 * Код, участники, списки и выход действуют сразу. Группы не стало (исключили, удалили) — назад
 */
export const GroupContainer = signedInOnly(function GroupSettings({ id }: GroupContainerProps) {
  const s = useStore(useShallow(pickGroup));
  const { today } = useClock();
  const insets = useInsets();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState<{ name?: string; category?: GroupCategory }>({});
  const colors = usePersonColors(s);
  const data = useMemo(() => groupProps(s, colors, id, { today }), [s, colors, id, today]);
  const group = s.groups.find((g) => g.id === id);
  const manage = !!group && canManageGroup(group, s.me.id);
  const code = group?.inviteCode ?? '';

  const onRename = useCallback(() => setRenaming(true), []);
  const onCloseRename = useCallback(() => setRenaming(false), []);
  const onSubmitRename = useCallback((name: string) => {
    setRenaming(false);
    if (name) setDraft((d) => ({ ...d, name }));
  }, []);
  const onChangeCategory = useCallback((category: GroupCategory) => setDraft((d) => ({ ...d, category })), []);
  const draftName = draft.name ?? group?.name ?? '';
  const draftCategory = draft.category ?? group?.category ?? 'other';
  const dirty = !!group && (draftName !== group.name || draftCategory !== group.category);
  const onSave = useCallback(() => {
    const g = useStore.getState().groups.find((x) => x.id === id);
    if (!g) return;
    if (draftName && draftName !== g.name) useStore.getState().renameGroup(id, draftName);
    if (draftCategory !== g.category) useStore.getState().setGroupCategory(id, draftCategory);
    setDraft({});
  }, [id, draftName, draftCategory]);
  const onCopyCode = useCallback(async () => {
    await Clipboard.setStringAsync(code).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useStore.getState().notice('Скопировано');
  }, [code]);
  const groupName = group?.name ?? '';
  const onShareCode = useCallback(() => {
    Share.share({ message: `Код группы «${groupName}» в «Кстати»: ${code}` }).catch(() => {});
  }, [code, groupName]);
  const onOpenMember = useCallback((userId: ID) => memberMenu(id, userId), [id]);
  const onOpenList = useCallback(
    (key: SharedListKey) => {
      useStore.getState().selectGroup(id);
      toTab(key);
    },
    [id],
  );
  const onLeave = useCallback(() => leave(id), [id]);
  const onOpenShare = useCallback(() => router.push(accountRoutes.share(id)), [id]);

  // Как PlanContainer: экран без группы пуст и без шапки — уходим
  const missing = data === null;
  useEffect(() => {
    if (missing) back();
  }, [missing]);

  if (!data) return null;

  return (
    <View style={styles.screen}>
      <GroupScreen
        {...data}
        name={draftName}
        category={draftCategory}
        insets={insets}
        onBack={back}
        onRename={manage ? onRename : undefined}
        onChangeCategory={manage ? onChangeCategory : undefined}
        // Код приглашения видят только создатель и админы; пока сервер не прислал его, копировать нечего
        onCopyCode={code ? onCopyCode : undefined}
        onShareCode={code ? onShareCode : undefined}
        onOpenMember={onOpenMember}
        onOpenList={onOpenList}
        onOpenShare={onOpenShare}
        onLeave={onLeave}
        dirty={dirty}
        onCancel={back}
        onSave={onSave}
      />
      <InputSheet visible={renaming} value={draftName} maxLength={40} bottomInset={insets.bottom} onSubmit={onSubmitRename} onClose={onCloseRename} />
    </View>
  );
});

const styles = StyleSheet.create({ screen: { flex: 1 } });
