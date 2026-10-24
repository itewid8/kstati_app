/**
 * Список строк в рамке 1.5px через линию 1px:
 *  action — пункты меню 44px моноширинным заглавными (удаление — красным);
 *  radio  — выбор одного: название + подпись, выбранный инвертирован;
 *  check  — несколько: квадрат-галочка слева, название + подпись.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Checkbox, Marquee, size as S, type as T, useTheme } from '@/ui';

export type OptionItem = {
  key: string;
  label: string;
  meta?: string;
  selected?: boolean;
  danger?: boolean;
};

type Props = {
  options: readonly OptionItem[];
  variant?: 'action' | 'radio' | 'check';
  onPress?: (key: string) => void;
};

export const OptionList = memo(function OptionList({ options, variant = 'action', onPress }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
      {options.map((o, i) => {
        const on = variant === 'radio' && !!o.selected;
        const ink = on ? c.bg : o.danger ? c.red : c.text;
        const press = onPress ? () => onPress(o.key) : undefined;
        return (
          <Pressable
            key={o.key}
            accessibilityRole={variant === 'action' ? 'button' : variant === 'radio' ? 'radio' : 'checkbox'}
            accessibilityState={variant === 'action' ? undefined : variant === 'radio' ? { selected: on } : { checked: !!o.selected }}
            accessibilityLabel={o.label}
            onPress={press}
            disabled={!press}
            style={[styles.row, i > 0 && [styles.divided, { borderTopColor: c.hair }], on && { backgroundColor: c.text }]}
          >
            {variant === 'check' ? (
              <Checkbox checked={!!o.selected} onPress={press} accessibilityLabel={o.label} style={styles.check} />
            ) : null}
            {variant === 'action' ? (
              <Marquee style={[T.action, styles.flex, { color: ink }]}>{o.label.toLocaleUpperCase('ru-RU')}</Marquee>
            ) : (
              <View style={styles.flex}>
                <Marquee style={[T.rowTitle, { color: ink }]}>{o.label}</Marquee>
                {o.meta ? <Marquee style={[T.rowMeta, { color: on ? c.bg : c.muted }]}>{o.meta}</Marquee> : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

/** Пустой список: одна строка с текстом */
export const OptionEmpty = memo(function OptionEmpty({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, styles.row, { borderColor: c.border, backgroundColor: c.panel }]}>
      <Text style={[T.fieldValue, { color: c.muted }]}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border },
  row: { minHeight: S.row, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  divided: { minHeight: S.row + S.hairline, borderTopWidth: S.hairline },
  check: { marginLeft: -7 },
  flex: { flex: 1, minWidth: 0 },
});
