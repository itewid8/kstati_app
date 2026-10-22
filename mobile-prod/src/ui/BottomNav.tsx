import { createContext, memo, useContext } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { size as S, space, type as T } from './tokens';
import { useTheme } from './useTheme';

export type NavTab = 'tasks' | 'wishes' | 'watch' | 'ideas';

const TABS: ReadonlyArray<{ key: NavTab; label: string }> = [
  { key: 'tasks', label: 'ДЕЛА' },
  { key: 'wishes', label: 'ХОЧУ' },
  { key: 'watch', label: 'СМОТРЕТЬ' },
  { key: 'ideas', label: 'ИДЕИ' },
];

/**
 * Режим «удерживать» кнопку записи: провайдер (app/_layout.tsx по настройке micMode) даёт начало и конец удержания —
 * тогда REC пишет, пока палец на кнопке, и не вызывает onRec. Без провайдера (реестры сверки) — обычное нажатие
 */
export type RecButtonHandlers = { onPressIn?: () => void; onPressOut?: () => void };
export const RecButtonContext = createContext<RecButtonHandlers | null>(null);

type Props = {
  active: NavTab;
  onSelect?: (tab: NavTab) => void;
  onRec?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Нижняя навигация: сетка 2×2 разделов и кнопка записи 104px */
export const BottomNav = memo(function BottomNav({ active, onSelect, onRec, style }: Props) {
  const { c } = useTheme();
  const hold = useContext(RecButtonContext);
  return (
    <View style={[styles.bar, style]}>
      <View style={styles.grid}>
        {[TABS.slice(0, 2), TABS.slice(2)].map((line) => (
          <View key={line[0].key} style={styles.line}>
            {line.map(({ key, label }) => {
              const on = key === active;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  onPress={onSelect ? () => onSelect(key) : undefined}
                  style={[styles.tab, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }]}
                >
                  <Text style={[on ? T.navActive : T.nav, { color: on ? c.bg : c.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Голосовая команда"
        onPress={hold ? undefined : onRec}
        onPressIn={hold?.onPressIn}
        onPressOut={hold?.onPressOut}
        style={[styles.rec, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <View style={[styles.dot, { backgroundColor: c.red, boxShadow: `0 0 10px ${c.glow}` }]} />
        <Text style={[T.rec, { color: c.text }]}>REC</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.navHeight, flexDirection: 'row', gap: 8 },
  grid: { flex: 1, gap: space.navGap },
  line: { flex: 1, flexDirection: 'row', gap: space.navGap },
  tab: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  rec: {
    width: S.recWidth,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: S.recDot, height: S.recDot, borderRadius: S.recDot / 2 },
});
