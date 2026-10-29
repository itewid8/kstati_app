import { createContext, memo, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { cancelDrag } from '@/adapters/voice/recording';
import { size as S, space, type as T } from './tokens';
import { useTheme } from './useTheme';

export type NavTab = 'tasks' | 'wishes' | 'watch' | 'ideas';

const TABS: ReadonlyArray<{ key: NavTab; label: string }> = [
  { key: 'tasks', label: 'ДЕЛА' },
  { key: 'wishes', label: 'ХОЧУ' },
  { key: 'watch', label: 'СМОТРЕТЬ' },
  { key: 'ideas', label: 'ЗАМЕТКИ' },
];

/**
 * Режим «удерживать» кнопку записи: провайдер (app/_layout.tsx по настройке micMode) даёт начало и конец удержания —
 * тогда REC пишет, пока палец на кнопке, и не вызывает onRec. Без провайдера (реестры сверки) — обычное нажатие.
 * onPressOut(true) — палец увели влево или вверх за порог (запись отменить), false — просто отпустили
 */
export type RecButtonHandlers = { onPressIn?: () => void; onPressOut?: (cancelled: boolean) => void };
export const RecButtonContext = createContext<RecButtonHandlers | null>(null);

/** Сдвиг пальца на REC от точки касания, только влево / вверх (UI-поток): окно записи ведёт за ним «‹ ОТМЕНА» */
export type RecDrag = { x: SharedValue<number>; y: SharedValue<number> };

let activeDrag: RecDrag | null = null;
/**
 * Сдвиг пальца на REC, который держат сейчас (или держали последним). Кнопок много (по одной на экран вкладки) —
 * отдаётся та, на которой началось удержание; запись начинается после касания, так что окно записи уже видит её
 */
export const recDrag = (): RecDrag | null => activeDrag;

type Props = {
  active: NavTab;
  onSelect?: (tab: NavTab) => void;
  onRec?: () => void;
  /** REC нажатым, как при удержании (превью окна записи) */
  recHeld?: boolean;
  style?: StyleProp<ViewStyle>;
};

const RESET = { duration: 120 };

/** Лицо кнопки записи: красная точка и «REC»; on — нажата (удержание) */
const RecFace = ({ on }: { on: boolean }) => {
  const { c } = useTheme();
  return (
    <>
      <View style={[styles.dot, { backgroundColor: c.red, boxShadow: `0 0 10px ${c.glow}` }]} />
      <Text style={[T.rec, { color: on ? c.bg : c.text }]}>REC</Text>
    </>
  );
};

/**
 * REC в режиме «удерживать» — жест gesture-handler: касание — начало, отпускание — конец,
 * увёл палец влево или вверх на CANCEL_DRAG — отмена сразу, не дожидаясь отпускания. Сдвиг считается на UI-потоке
 */
const RecHold = memo(function RecHold({ hold }: { hold: RecButtonHandlers }) {
  const { c } = useTheme();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  /** Удержание уже закончено (отменой) — отпускание не заканчивает его второй раз */
  const ended = useSharedValue(true);
  const [held, setHeld] = useState(false);
  const { onPressIn, onPressOut } = hold;

  const gesture = useMemo(() => {
    const drag: RecDrag = { x, y };
    const begin = () => {
      activeDrag = drag;
      setHeld(true);
      onPressIn?.();
    };
    const end = (cancelled: boolean) => {
      setHeld(false);
      onPressOut?.(cancelled);
    };
    return Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin(() => {
        x.value = 0;
        y.value = 0;
        ended.value = false;
        scheduleOnRN(begin);
      })
      .onUpdate((e) => {
        if (ended.value) return;
        x.value = Math.min(0, e.translationX);
        y.value = Math.min(0, e.translationY);
        if (cancelDrag(e.translationX, e.translationY)) {
          ended.value = true;
          scheduleOnRN(end, true);
        }
      })
      .onFinalize(() => {
        if (!ended.value) {
          ended.value = true;
          scheduleOnRN(end, false);
        }
        x.value = withTiming(0, RESET);
        y.value = withTiming(0, RESET);
      });
  }, [onPressIn, onPressOut, x, y, ended]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Голосовая команда"
        style={[styles.rec, { borderColor: c.border, backgroundColor: held ? c.text : c.panel }]}
      >
        <RecFace on={held} />
      </View>
    </GestureDetector>
  );
});

/** Нижняя навигация: сетка 2×2 разделов и кнопка записи 104px */
export const BottomNav = memo(function BottomNav({ active, onSelect, onRec, recHeld, style }: Props) {
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
      {hold ? (
        <RecHold hold={hold} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Голосовая команда"
          onPress={onRec}
          style={[styles.rec, { borderColor: c.border, backgroundColor: recHeld ? c.text : c.panel }]}
        >
          <RecFace on={!!recHeld} />
        </Pressable>
      )}
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
