import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Marquee, size as S, useTheme } from '@/ui';
import { accountText, useAccountPalette } from './accountTheme';

type Props = {
  label: string;
  /** Подпись под названием «ЗА 2 Ч · НАКАНУНЕ В 20:00» */
  meta?: string;
  /** Значение справа «САНЯ», «ПАРА · 2» */
  value?: string;
  /** 9px вместо 9.5 («О ПРИЛОЖЕНИИ») */
  smallValue?: boolean;
  /** Шеврон «перейти» справа (по умолчанию есть) */
  chevron?: boolean;
  /** Своё содержимое справа (образцы цвета) */
  right?: ReactNode;
  /** Красное название — удаление */
  danger?: boolean;
  /** Линия сверху (нет у первой строки без шапки) */
  divider?: boolean;
  /** Подпись для экранного диктора, по умолчанию label */
  accessibilityLabel?: string;
  onPress?: () => void;
};

/** Строка настроек 44px: название, значение, шеврон */
export const AccountRow = memo(function AccountRow({
  label,
  meta,
  value,
  smallValue,
  chevron = true,
  right,
  danger,
  divider = true,
  accessibilityLabel,
  onPress,
}: Props) {
  const { c } = useTheme();
  const pal = useAccountPalette();
  const ink = danger ? pal.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: c.panel }, divider && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}
    >
      {meta ? (
        <View style={styles.main}>
          <Marquee style={[accountText.rowLabelTight, { color: ink }]}>
            {label}
          </Marquee>
          <Marquee style={[accountText.rowMeta, { color: c.muted }]}>
            {meta}
          </Marquee>
        </View>
      ) : (
        <Marquee style={[accountText.rowLabel, styles.label, { color: ink }]}>
          {label}
        </Marquee>
      )}
      {value ? (
        <Marquee style={[smallValue ? accountText.rowValueSmall : accountText.rowValue, { color: c.muted }]}>
          {value}
        </Marquee>
      ) : null}
      {right}
      {chevron ? <Icon name="chevronRight" size={12} color={c.muted} strokeWidth={2} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { height: S.row, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1 },
  main: { flex: 1, gap: 2 },
});
