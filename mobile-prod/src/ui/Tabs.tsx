import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Marquee } from './Marquee';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

export type TabItem<K extends string> = {
  key: K;
  label: string;
  /** Цветной квадрат 7×7 перед подписью (цвет человека) */
  dot?: string;
};

type Props<K extends string> = {
  items: ReadonlyArray<TabItem<K>>;
  value: K;
  onChange?: (key: K) => void;
  /**
   * tabs — равные колонки 32px (люди, фильтры);
   * view — переключатель вида 28px по ширине подписи (СПИСОК / НЕДЕЛЯ)
   */
  variant?: 'tabs' | 'view';
  style?: StyleProp<ViewStyle>;
};

/**
 * Сегменты встык: соседние рамки 1.5px накладываются (margin-left −1.5 как в макете),
 * поэтому каждая ячейка — равная колонка, а кнопка в ней шире на толщину рамки.
 */
function TabsInner<K extends string>({ items, value, onChange, variant = 'tabs', style }: Props<K>) {
  const { c } = useTheme();
  const view = variant === 'view';
  return (
    <View style={[styles.row, { height: view ? S.viewSwitch : S.tab }, style]}>
      {items.map((item, i) => {
        const on = item.key === value;
        const text = view ? (on ? T.viewActive : T.view) : on ? T.tabActive : T.tab;
        return (
          <View key={item.key} style={view ? styles.fitCell : styles.cell}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.label}
              onPress={onChange ? () => onChange(item.key) : undefined}
              style={[
                styles.button,
                view && styles.fitButton,
                { borderColor: c.border, backgroundColor: on ? c.text : c.panel },
                i > 0 && (view ? styles.noLeft : styles.overlap),
              ]}
            >
              {item.dot ? <View style={[styles.dot, { backgroundColor: item.dot }]} /> : null}
              <Marquee style={[text, styles.label, { color: on ? c.bg : c.text }]}>{item.label}</Marquee>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export const Tabs = memo(TabsInner) as typeof TabsInner;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  fitCell: {},
  button: {
    flex: 1,
    borderWidth: S.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  fitButton: { paddingHorizontal: 9 },
  overlap: { marginLeft: -S.border },
  noLeft: { borderLeftWidth: 0 },
  dot: { width: 7, height: 7 },
  /** Длинное имя сжимается до ширины колонки и едет */
  label: { flexShrink: 1 },
});
