/**
 * Профиль (C-Profile): аватар-квадрат цвета человека, имя, разделы ПРОФИЛЬ / ГРУППЫ / ПРИЛОЖЕНИЕ И АККАУНТ.
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_LABEL, type Gender, type GroupCategory, type ID, type PaletteKey, type PersonColor } from '@/lib/types';
import { Marquee, SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';
import { EditIcon } from './components/AccountIcons';
import { AccountRow } from './components/AccountRow';
import { ColorSwatches } from './components/ColorSwatches';
import { accountText } from './components/accountTheme';

export type ProfileUser = {
  name: string;
  /** Без «@» */
  nick?: string | null;
  email: string;
  gender?: Gender | null;
  color: PersonColor;
  /** Символ на аватаре; нет — первая буква имени */
  avatar?: string | null;
};

export type ProfileGroup = {
  id: ID;
  name: string;
  category: GroupCategory;
  memberCount: number;
};

export type ProfileScreenProps = {
  me: ProfileUser;
  groups: ProfileGroup[];
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  /** Нажатие на аватар — цвет и символ */
  onEditAvatar?: () => void;
  onEditName?: () => void;
  onEditNick?: () => void;
  onEditGender?: () => void;
  onPickColor?: (color: PaletteKey) => void;
  onPickCustomColor?: () => void;
  onOpenGroup?: (id: ID) => void;
  onCreateGroup?: () => void;
  onOpenAppSettings?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

const GENDER_LABEL: Record<Gender, string> = { m: 'МУЖСКОЙ', f: 'ЖЕНСКИЙ' };

const upper = (s: string) => s.toLocaleUpperCase('ru-RU');

export const ProfileScreen = memo(function ProfileScreen(props: ProfileScreenProps) {
  const {
    me,
    groups,
    insets = NO_INSETS,
    onBack,
    onEditAvatar,
    onEditName,
    onEditNick,
    onEditGender,
    onPickColor,
    onPickCustomColor,
    onOpenGroup,
    onCreateGroup,
    onOpenAppSettings,
    onChangePassword,
    onLogout,
    onDeleteAccount,
  } = props;
  const { c, person, personInk } = useTheme();
  const nick = me.nick ? `@${upper(me.nick)}` : '';
  const subline = [nick, upper(me.email)].filter(Boolean).join(' · ');
  const symbol = me.avatar || me.name.slice(0, 1).toLocaleUpperCase('ru-RU');

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <AccountHeader caption="НАСТРОЙКИ" onBack={onBack} />

      <View style={styles.identity}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Цвет и символ"
          onPress={onEditAvatar}
          style={[styles.avatar, { borderColor: c.border, backgroundColor: person(me.color) }]}
        >
          <Text style={[styles.avatarText, { color: personInk(me.color) }]}>{symbol}</Text>
          <View style={[styles.editBadge, { backgroundColor: c.text }]}>
            <EditIcon size={10} color={c.bg} />
          </View>
        </Pressable>
        <View style={styles.names}>
          <Text accessibilityRole="header" style={[styles.name, { color: c.text }]}>
            {me.name}
          </Text>
          <Marquee style={[accountText.rowValue, { color: c.muted }]}>
            {subline}
          </Marquee>
        </View>
      </View>

      <View style={styles.sections}>
        <SectionBox title="ПРОФИЛЬ">
          <AccountRow label="Имя" value={upper(me.name)} onPress={onEditName} />
          <AccountRow label="Никнейм" value={nick} onPress={onEditNick} />
          <AccountRow label="Пол" value={me.gender ? GENDER_LABEL[me.gender] : 'НЕ УКАЗАН'} onPress={onEditGender} />
          <AccountRow
            label="Цвет"
            chevron={false}
            right={<ColorSwatches value={me.color} onPick={onPickColor} onPickCustom={onPickCustomColor} />}
          />
        </SectionBox>

        <SectionBox title="ГРУППЫ">
          {groups.map((g) => (
            <AccountRow
              key={g.id}
              label={g.name}
              value={`${upper(CATEGORY_LABEL[g.category])} · ${g.memberCount}`}
              onPress={onOpenGroup ? () => onOpenGroup(g.id) : undefined}
            />
          ))}
          <AccountRow label="Новая группа" value="+" onPress={onCreateGroup} />
        </SectionBox>

        <SectionBox title="ПРИЛОЖЕНИЕ И АККАУНТ">
          <AccountRow label="Настройки приложения" onPress={onOpenAppSettings} />
          <AccountRow label="Сменить пароль" onPress={onChangePassword} />
          <AccountRow label="Выйти" chevron={false} onPress={onLogout} />
          <AccountRow label="Удалить аккаунт" chevron={false} danger onPress={onDeleteAccount} />
        </SectionBox>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.side },
  identity: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Сдвиг на 1px как в макете: там буква в <button> с хвостом letter-spacing справа */
  avatarText: { fontFamily: fonts.sans700, fontSize: 30, letterSpacing: -1.2, top: 1, left: -1 },
  editBadge: {
    position: 'absolute',
    right: -S.border,
    bottom: -S.border,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.sans700, fontSize: 32, lineHeight: 34, letterSpacing: -1.6 },
  sections: { marginTop: 14, gap: 8 },
});
