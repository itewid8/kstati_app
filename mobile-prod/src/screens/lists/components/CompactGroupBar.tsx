/**
 * Верхняя панель «Дел» (C-List): выбор группы, «+», лента, профиль.
 * Плотнее общего TopBar: подпись группы 10px, поля 10, шеврон 11, иконки 16, буква профиля 14.
 * Кандидат в src/ui: TopBar с density="compact".
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { Icon, IconButton, Marquee, fonts, size as S, space, type as T, useTheme } from '@/ui';

type Props = {
  groupLabel: string;
  me: { letter: string; color: PersonColor };
  hasNews?: boolean;
  onPickGroup?: () => void;
  onAdd?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const CompactGroupBar = memo(function CompactGroupBar({
  groupLabel,
  me,
  hasNews,
  onPickGroup,
  onAdd,
  onOpenFeed,
  onOpenSettings,
  style,
}: Props) {
  const { c, person, personInk } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={groupLabel}
        onPress={onPickGroup}
        style={[styles.group, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Marquee style={[T.group, styles.groupText, { color: c.text }]}>
          {groupLabel}
        </Marquee>
        <Icon name="chevronDown" size={11} color={c.text} strokeWidth={2.5} />
      </Pressable>
      <IconButton icon="plus" accessibilityLabel="Добавить" onPress={onAdd} iconSize={S.iconSmall} />
      <IconButton icon="bell" accessibilityLabel="Лента" onPress={onOpenFeed} iconSize={S.iconSmall} badge={hasNews} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Настройки"
        onPress={onOpenSettings}
        style={[styles.avatar, { borderColor: c.border, backgroundColor: person(me.color) }]}
      >
        <Text style={[styles.letter, { color: personInk(me.color) }]}>{me.letter}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap },
  group: {
    flex: 1,
    height: S.topBarHeight,
    borderWidth: S.border,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupText: { flex: 1, fontSize: 10, letterSpacing: 0.8 },
  avatar: {
    width: S.iconButton,
    height: S.iconButton,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: fonts.mono600, fontSize: 14 },
});
