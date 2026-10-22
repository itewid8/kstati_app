import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { profileProps } from '@/adapters/account/profile';
import { openGroupSheet } from '@/components/GroupSheet';
import { useStore } from '@/lib/store';
import type { ID, PaletteKey } from '@/lib/types';
import { ProfileScreen } from '@/screens/account/ProfileScreen';
import { NO_ME, backOrTab, nav, resetTo, signedInOnly, useInsets, usePersonColors, type ProfileField, type StoreState } from '../common';

const back = () => backOrTab('tasks');
const editAvatar = () => router.push(nav.avatar());
const edit = (field: ProfileField) => () => router.push(nav.profileEdit(field));
const editName = edit('name');
const editNick = edit('nick');
const editGender = edit('gender');
const changePassword = edit('password');
const openGroup = (id: ID) => router.push(nav.group(id));
/** «Новая группа» — сразу форма создания, а не список групп (там случайное касание переключает текущую) */
const createGroup = () => openGroupSheet('create');
const openAppSettings = () => router.push(nav.appSettings());

const pickColor = (color: PaletteKey) => {
  void useStore
    .getState()
    .setLook({ color })
    .then((err) => {
      if (err) useStore.getState().notice(err);
    });
};

/** Выход стирает данные с телефона (они на сервере и вернутся при входе). Вход — с чистого стека: под ним не остаются вкладки */
const logout = () =>
  Alert.alert('Выйти из аккаунта?', undefined, [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Выйти',
      style: 'destructive',
      onPress: () => {
        useStore.getState().logout();
        resetTo('/login');
      },
    },
  ]);

const deleteAccount = () =>
  Alert.alert('Удалить аккаунт?', 'Удалятся аккаунт, ваши хотелки и всё, что вы добавили в группы. Это нельзя отменить.', [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Удалить',
      style: 'destructive',
      onPress: async () => {
        const err = await useStore.getState().deleteAccount();
        if (err) return Alert.alert('Не удалось удалить', err);
        resetTo('/login');
      },
    },
  ]);

/** C-Profile: имя, ник, пол и пароль — в старой форме settings/edit.tsx, цвет и символ — settings/avatar.tsx */
const pickProfile = (s: StoreState) => ({ me: s.me ?? NO_ME, users: s.users, groups: s.groups });

export const ProfileContainer = signedInOnly(function Profile() {
  const s = useStore(useShallow(pickProfile));
  const insets = useInsets();
  const colors = usePersonColors(s);
  const data = useMemo(() => profileProps(s, colors), [s, colors]);

  return (
    <ProfileScreen
      {...data}
      insets={insets}
      onBack={back}
      onEditAvatar={editAvatar}
      onEditName={editName}
      onEditNick={editNick}
      onEditGender={editGender}
      onPickColor={pickColor}
      onPickCustomColor={editAvatar}
      onOpenGroup={openGroup}
      onCreateGroup={createGroup}
      onOpenAppSettings={openAppSettings}
      onChangePassword={changePassword}
      onLogout={logout}
      onDeleteAccount={deleteAccount}
    />
  );
});
