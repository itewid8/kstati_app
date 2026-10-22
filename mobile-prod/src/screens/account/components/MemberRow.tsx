import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { Marquee, fonts, size as S, useTheme } from '@/ui';
import { accountText } from './accountTheme';

type Props = {
  /** «Саня (вы)» */
  name: string;
  /** «@SASHA»; пусто — строки нет */
  nick?: string;
  color: PersonColor;
  /** Символ на квадрате */
  symbol: string;
  /** «СОЗДАТЕЛЬ», «АДМИН»; нет — без плашки */
  role?: string;
  onPress?: () => void;
};

/** Участник группы 44px: квадрат цвета человека 28×28, имя и ник, плашка роли */
export const MemberRow = memo(function MemberRow({ name, nick, color, symbol, role, onPress }: Props) {
  const { c, person, personInk } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={role ? `${name}, ${role}` : name}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <View style={[styles.avatar, { backgroundColor: person(color) }]}>
        <Text style={[styles.symbol, { color: personInk(color) }]}>{symbol}</Text>
      </View>
      <View style={styles.main}>
        <Marquee style={[styles.name, { color: c.text }]}>
          {name}
        </Marquee>
        {nick ? (
          <Marquee style={[accountText.rowMeta, { color: c.muted }]}>
            {nick}
          </Marquee>
        ) : null}
      </View>
      {role ? (
        <View style={[styles.role, { borderColor: c.border }]}>
          <Text style={[styles.roleText, { color: c.text }]}>{role}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: S.row,
    paddingHorizontal: 8,
    borderTopWidth: S.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 28, height: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontFamily: fonts.mono600, fontSize: 12 },
  main: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 16 },
  role: { height: 20, paddingHorizontal: 6, borderWidth: S.border, justifyContent: 'center' },
  roleText: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.68, lineHeight: 17 },
});
