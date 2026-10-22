import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size as S, type as T, useTheme } from '@/ui';
import type { SheetAction } from '../types';

type Props = { actions: readonly SheetAction[] };

/** Ряд кнопок окна высотой 44: «ОТМЕНА», «ИЗМЕНИТЬ», «СОХРАНИТЬ» */
export const SheetActions = memo(function SheetActions({ actions }: Props) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, tone = 'default', flex = 1, onPress }) => {
        const fill = tone === 'danger' ? c.red : tone === 'primary' ? c.text : c.panel;
        const ink = tone === 'danger' ? '#FFFFFF' : tone === 'primary' ? c.bg : c.text;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={[styles.button, { flex, backgroundColor: fill, borderColor: tone === 'danger' ? c.red : c.border }]}
          >
            <Text numberOfLines={1} style={[T.action, { color: ink }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, height: 44 },
  button: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
