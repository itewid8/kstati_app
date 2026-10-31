/**
 * Событие календаря телефона в сетке (неделя, день): серое, пунктирная рамка, значок телефона у времени.
 * Узкая полоса (рядом стоит дело) — без текста: видно только, что время занято.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhoneBlock as Block } from '@/lib/calendarLayout';
import { Icon, fonts, tint, useTheme } from '@/ui';

export type PhoneBlockSize = { title: number; time: number; icon: number; padding: number };
export const WEEK_PHONE: PhoneBlockSize = { title: 8, time: 7, icon: 7, padding: 3 };
export const DAY_PHONE: PhoneBlockSize = { title: 12, time: 9.5, icon: 10, padding: 6 };

type Props = {
  block: Block;
  left: number;
  top: number;
  title: string;
  time: string;
  size: PhoneBlockSize;
  onPress?: () => void;
};

export const PhoneBlock = memo(function PhoneBlock({ block, left, top, title, time, size, onPress }: Props) {
  const { c } = useTheme();
  const box = { left: left + block.x, top: top + block.y, width: block.w, height: block.h };
  if (block.strip) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Из телефона: ${title}, ${time}`}
        hitSlop={{ left: 8, right: 4 }}
        onPress={onPress}
        style={[styles.abs, box, { backgroundColor: tint(c.muted, 0.35), borderColor: c.muted }, styles.strip]}
      />
    );
  }
  const lines = Math.max(1, Math.floor((block.h - size.padding - size.time * 1.4) / (size.title * 1.2)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Из телефона: ${title}, ${time}`}
      onPress={onPress}
      style={[styles.abs, box, styles.block, { borderColor: c.muted, backgroundColor: tint(c.panel, 0.75), padding: size.padding, paddingTop: size.padding - 1 }]}
    >
      <Text numberOfLines={lines} style={[styles.title, { color: c.muted, fontSize: size.title, lineHeight: size.title * 1.2 }]}>
        {title}
      </Text>
      {block.h > size.title * 1.2 + size.time * 1.4 + size.padding ? (
        <View style={styles.row}>
          <Icon name="phone" size={size.icon} color={c.muted} />
          <Text numberOfLines={1} style={[styles.time, { color: c.muted, fontSize: size.time }]}>
            {time}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  strip: { borderWidth: 1, borderStyle: 'dashed' },
  block: { borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden' },
  title: { fontFamily: fonts.sans600 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  time: { fontFamily: fonts.mono400, flexShrink: 1 },
});
