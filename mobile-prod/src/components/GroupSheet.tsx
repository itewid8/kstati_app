/**
 * Окно выбора группы (группа в верхней панели списков и календаря, s.groupSheet): мои группы, НАСТРОЙКИ текущей,
 * НОВАЯ ГРУППА. Вступление по коду — в профиле. Отдельное окно (Modal): поверх экранов стека и «назад» Android закрывает его
 */
import { BugButton } from './BugButton';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { groupPickerRows } from '@/adapters/account/groupPicker';
import { accountRoutes } from '@/containers/account/routes';
import { nav, useInsets } from '@/containers/common';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { GroupPickerSheet } from '@/screens/account/GroupPickerSheet';

/** Открыть выбор групп; create / join — сразу страница создания или вступления (как раньше «Новая группа» в профиле) */
export function openGroupSheet(mode: 'list' | 'create' | 'join' = 'list') {
  if (mode === 'create') return router.push(accountRoutes.createGroup());
  if (mode === 'join') return router.push(accountRoutes.joinGroup());
  useStore.getState().setGroupSheet(true);
}

const close = () => useStore.getState().setGroupSheet(false);

export function GroupSheet() {
  const s = useStore(useShallow((st) => ({ visible: st.groupSheet, groups: st.groups, currentGroupId: st.currentGroupId })));
  const insets = useInsets();
  const groups = useMemo(() => groupPickerRows(s), [s]);
  const current = s.groups.some((g) => g.id === s.currentGroupId) ? s.currentGroupId : null;

  const onPick = useCallback((id: ID) => {
    useStore.getState().selectGroup(id);
    close();
  }, []);
  const onOpenSettings = useCallback(() => {
    close();
    if (current) router.push(nav.group(current));
  }, [current]);
  const onCreate = useCallback(() => {
    close();
    router.push(accountRoutes.createGroup());
  }, []);

  return (
    <Modal transparent visible={s.visible} statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={close}>
      <View style={styles.fill}>
        <GroupPickerSheet
          visible
          groups={groups}
          bottomInset={insets.bottom}
          onClose={close}
          onPick={onPick}
          onOpenSettings={current ? onOpenSettings : undefined}
          onCreate={onCreate}
        />
      </View>
      <BugButton />
    </Modal>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
