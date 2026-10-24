/**
 * Иконка человека: круг его цвета, внутри — выбранный символ (буква или эмодзи) или первая буква имени.
 * Цвет — тот же, что у его дел в календаре текущей группы.
 */
import React from 'react';
import { View } from 'react-native';
import { inkOn, usePalette } from '@/lib/colors';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { font } from '@/theme';
import { T } from './ui';

export const avatarText = (name?: string, avatar?: string) => avatar?.trim() || name?.trim()?.[0]?.toUpperCase() || '·';

export function Avatar({ id, size = 32, color, text }: { id: ID; size?: number; color?: string; text?: string }) {
  const pal = usePalette();
  const user = useStore((s) => s.users.find((u) => u.id === id) ?? (s.me?.id === id ? s.me : undefined));
  const bg = color ?? pal.of(id);
  const label = text ?? avatarText(user?.name, user?.avatar);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <T
        numberOfLines={1}
        style={{ fontFamily: font.semibold, fontSize: Math.round(size * 0.44), lineHeight: Math.round(size * 0.58), color: inkOn(bg) }}
      >
        {label}
      </T>
    </View>
  );
}
