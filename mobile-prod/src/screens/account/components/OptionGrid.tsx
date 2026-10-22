import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size as S, useTheme } from '@/ui';
import { accountText } from './accountTheme';

export type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: ReadonlyArray<Option<K>>;
  value: K;
  onChange?: (key: K) => void;
};

/** Выбор одного варианта: равные кнопки 32px на панели, выбранная залита цветом текста */
function OptionGridInner<K extends string>({ options, value, onChange }: Props<K>) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.grid, { backgroundColor: c.panel }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={onChange ? () => onChange(o.key) : undefined}
            style={[styles.option, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }]}
          >
            <Text numberOfLines={1} style={[on ? accountText.optionActive : accountText.option, { color: on ? c.bg : c.text }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const OptionGrid = memo(OptionGridInner) as typeof OptionGridInner;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', padding: 6, gap: 6 },
  option: {
    flex: 1,
    flexBasis: 0,
    height: 32,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
