/**
 * Сегменты встык (рамки 1.5px накладываются, margin-left −1.5 как в макете): выбранный — инвертирован.
 * Обычный — 32px, подпись по центру; с caption — 40px, две строки слева («НАЧАЛО / СР 7 ОКТ · 07:00»).
 * flash — короткая подсветка сегмента (конец периода сдвинулся вслед за началом, C-TimeStory 06).
 */
import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { Marquee, size as S, tint, useTheme } from '@/ui';
import { ET } from './text';

export type SegmentItem<K extends string> = {
  key: K;
  label: string;
  /** Подпись сверху мелким — включает двухстрочный вид 40px */
  caption?: string;
};

export type SegmentFlash<K extends string> = {
  key: K;
  /** Меняется — сегмент вспыхивает заново (первое значение не вспыхивает) */
  token: number;
  /** Цвет человека под тему; заливка — с прозрачностью tintAlpha + 0.15 */
  color: string;
};

type Props<K extends string> = {
  items: ReadonlyArray<SegmentItem<K>>;
  /** Выбранный сегмент; массив — выбрано несколько (дни недели) */
  value: K | null | ReadonlyArray<K>;
  onChange?: (key: K) => void;
  flash?: SegmentFlash<K> | null;
  style?: StyleProp<ViewStyle>;
};

const FLASH_IN_MS = 90;
const FLASH_HOLD_MS = 450;
const FLASH_OUT_MS = 350;

/** Подсветка сегмента: быстро проявляется, держится и гаснет */
const Flash = memo(function Flash({ token, color }: { token: number; color: string }) {
  const { c } = useTheme();
  const opacity = useSharedValue(0);
  const shown = useRef(token);
  useEffect(() => {
    if (shown.current === token) return;
    shown.current = token;
    opacity.value = withSequence(
      withTiming(1, { duration: FLASH_IN_MS }),
      withDelay(FLASH_HOLD_MS, withTiming(0, { duration: FLASH_OUT_MS })),
    );
  }, [token, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: tint(color, c.tintAlpha + 0.15) }, style]}
    />
  );
});

function isOn<K extends string>(value: K | null | ReadonlyArray<K>, key: K): boolean {
  return typeof value === 'string' ? value === key : value ? value.includes(key) : false;
}

function SegmentedInner<K extends string>({ items, value, onChange, flash, style }: Props<K>) {
  const { c } = useTheme();
  const tall = items.some((i) => i.caption);
  return (
    <View style={[styles.row, { height: tall ? 40 : 32 }, style]}>
      {items.map((item, i) => {
        const on = isOn(value, item.key);
        const ink = on ? c.bg : c.text;
        return (
          <View key={item.key} style={styles.cell}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.caption ? `${item.caption} ${item.label}` : item.label}
              onPress={onChange ? () => onChange(item.key) : undefined}
              style={[
                styles.button,
                tall ? styles.tall : styles.plain,
                { borderColor: c.border, backgroundColor: on ? c.text : c.panel },
                i > 0 && styles.overlap,
              ]}
            >
              {flash && flash.key === item.key && !on ? <Flash token={flash.token} color={flash.color} /> : null}
              {item.caption ? (
                <>
                  <Marquee style={[ET.segCaption, styles.caption, { color: ink }]}>
                    {item.caption}
                  </Marquee>
                  <Marquee style={[ET.segValue, { color: ink }]}>
                    {item.label}
                  </Marquee>
                </>
              ) : (
                <Text numberOfLines={1} style={[on ? ET.chipStrong : ET.chip, { color: ink }]}>
                  {item.label}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export const Segmented = memo(SegmentedInner) as typeof SegmentedInner;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  button: { flex: 1, borderWidth: S.border },
  plain: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tall: { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8, gap: 2 },
  caption: { opacity: 0.7 },
  overlap: { marginLeft: -S.border },
});
