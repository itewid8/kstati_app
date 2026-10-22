/**
 * Вкладки-фильтры 32px с весами колонок и квадратной кнопкой «Фильтры» справа (C-Watch: ВСЁ · ФИЛЬМЫ · СЕРИАЛЫ).
 * Соседние рамки накладываются (margin-left −1.5), как в общем Tabs.
 * Кандидат в src/ui: Tabs с весом колонки (item.flex) и слотом trailing.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, size as S, type as T, useTheme } from '@/ui';

export type FilterTab<K extends string> = {
  key: K;
  label: string;
  /** Вес колонки (flex-grow), по умолчанию 1 */
  flex?: number;
};

type Props<K extends string> = {
  items: ReadonlyArray<FilterTab<K>>;
  value: K;
  onChange?: (key: K) => void;
  /** Кнопка «Фильтры»; без колбэка всё равно рисуется */
  onOpenFilters?: () => void;
  style?: StyleProp<ViewStyle>;
};

function FilterTabsInner<K extends string>({ items, value, onChange, onOpenFilters, style }: Props<K>) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {items.map((item, i) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            onPress={onChange ? () => onChange(item.key) : undefined}
            style={[
              styles.tab,
              { flex: item.flex ?? 1, borderColor: c.border, backgroundColor: on ? c.text : c.panel },
              i > 0 && styles.overlap,
            ]}
          >
            <Text numberOfLines={1} style={[on ? T.tabActive : T.tab, { color: on ? c.bg : c.text }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Фильтры"
        onPress={onOpenFilters}
        style={[styles.filter, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Icon name="filter" size={15} color={c.text} />
      </Pressable>
    </View>
  );
}

export const FilterTabs = memo(FilterTabsInner) as typeof FilterTabsInner;

const styles = StyleSheet.create({
  row: { height: S.tab, flexDirection: 'row' },
  /** Поля 6 как у кнопки в макете: при весах колонок они входят в ширину до деления остатка */
  tab: { minWidth: 0, paddingHorizontal: 6, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  overlap: { marginLeft: -S.border },
  filter: {
    width: S.tab,
    marginLeft: 6,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
