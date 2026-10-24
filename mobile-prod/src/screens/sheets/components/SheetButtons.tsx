import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size as S, type as T, useTheme } from '@/ui';

export type SheetButtonTone = 'default' | 'primary' | 'danger';

export type SheetButton = {
  key: string;
  label: string;
  /** default — панель, primary — заливка цветом текста, danger — красная рамка и текст */
  tone?: SheetButtonTone;
  /** Доля ширины (по умолчанию 1; главная — 1.3) */
  flex?: number;
  disabled?: boolean;
  onPress?: () => void;
};

type Props = { buttons: readonly SheetButton[] };

/** Нижний ряд окна высотой 44: «ЗАКРЫТЬ», «ОТМЕНА» + главное действие; удаление — красная рамка */
export const SheetButtons = memo(function SheetButtons({ buttons }: Props) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {buttons.map(({ key, label, tone = 'default', flex = 1, disabled = false, onPress }) => {
        const primary = tone === 'primary';
        const danger = tone === 'danger';
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled || !onPress}
            onPress={onPress}
            style={[
              styles.button,
              {
                flex,
                opacity: disabled ? 0.4 : 1,
                borderColor: danger ? c.red : c.border,
                backgroundColor: primary ? c.text : danger ? c.bg : c.panel,
              },
            ]}
          >
            <Text numberOfLines={1} style={[T.action, { color: primary ? c.bg : danger ? c.red : c.text }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, height: S.row },
  button: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
