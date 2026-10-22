/**
 * Однострочный текст, который при нехватке места превращается в бегущую строку.
 *
 * - Влезает — обычный <Text numberOfLines={1}>, как раньше.
 * - Не влезает — первую секунду видно начало с многоточием (как в макетах), потом строка непрерывно едет влево:
 *   две копии через зазор, сдвиг на (ширина + зазор) по кругу без остановок. Анимация целиком на UI-потоке
 *   (общее значение Reanimated + withRepeat), JS участвует только в одном переключении «стоит → едет».
 * - Системное «уменьшить движение» — остаётся многоточие.
 *
 * Стиль — тот же, что раньше у <Text>: раскладочные свойства (flex, ширины, отступы снаружи, позиция) уходят
 * на рамку, остальное — на текст. Рамка обрезает содержимое (overflow: hidden) только пока строка едет:
 * в покое не срезает свес первой буквы — рендер как у прежнего <Text>. На вебе обрезает всегда, когда есть
 * невидимая дорожка, иначе её ширина раздует прокрутку.
 * Ширина строки меряется невидимой копией в широкой абсолютной дорожке. Пока строка стоит, на неё приходится
 * один скрытый <Text> и ни одного хука Reanimated; дорожка с анимацией (Ticker) монтируется только на время езды.
 */
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { MARQUEE, marqueeDuration, marqueeGap, marqueeOverflows, marqueeShift, marqueeSpeed } from './marqueeMath';

type Props = {
  children: ReactNode;
  /** Стиль текста как у прежнего <Text numberOfLines={1}> */
  style?: StyleProp<TextStyle>;
  /** false — пока строка стоит, обрезать краем без многоточия (ячейки месяца, шапки секций) */
  ellipsis?: boolean;
  /** Зазор между копиями, px (по умолчанию 2em в пределах 12–24) */
  gap?: number;
  /** Скорость, px/с (по умолчанию 2.5em/с в пределах 18–30) */
  speed?: number;
  /** Пауза перед стартом, мс */
  delay?: number;
  accessibilityLabel?: string;
  testID?: string;
};

/** Свойства, которые раскладывают сам блок в родителе, а не текст внутри */
const BOX_KEYS: ReadonlySet<string> = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'zIndex',
]);

const WEB = Platform.OS === 'web';
/**
 * Обрезка краем на вебе: react-native-web не знает ellipsizeMode="clip" и ставит многоточие (как в WeekEventBlock),
 * а overflow: hidden от numberOfLines срезал бы свес первой буквы — там, где раньше текст ничем не обрезался.
 */
// CSS-свойства без типов RN (overflow: clip, overflowClipMargin) — только для web, где они и нужны
const webOnly = (css: Record<string, string>): TextStyle => Object.assign<TextStyle, Record<string, string>>({}, css);
const WEB_CLIP = WEB ? webOnly({ textOverflow: 'clip', overflow: 'clip', overflowClipMargin: '2px' }) : null;

function splitStyle(style: StyleProp<TextStyle>): { box: ViewStyle; text: TextStyle; fontSize: number | undefined } {
  const flat = StyleSheet.flatten<TextStyle>(style) ?? {};
  const box: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (BOX_KEYS.has(k) ? box : text)[k] = v;
  return { box: box as ViewStyle, text: text as TextStyle, fontSize: typeof flat.fontSize === 'number' ? flat.fontSize : undefined };
}

/** Новое значение ширины, только если оно заметно отличается — без лишних перерисовок от дрожания округления */
const settle = (prev: number, next: number) => (Math.abs(prev - next) > MARQUEE.slack ? next : prev);

type TickerProps = {
  text: StyleProp<TextStyle>;
  children: ReactNode;
  gap: number;
  shift: number;
  duration: number;
  onText: (e: LayoutChangeEvent) => void;
};

/**
 * Едущая дорожка: монтируется только у строк, которые не влезли и уже стартовали, — у остальных нет ни общего
 * значения, ни анимированного стиля. Круг: 0 → −(ширина + зазор) линейно, по кругу без остановок; на этом
 * сдвиге вторая копия встаёт ровно на место первой, поэтому скачка при повторе нет.
 */
const Ticker = memo(function Ticker({ text, children, gap, shift, duration, onText }: TickerProps) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = 0;
    x.value = withRepeat(withTiming(-shift, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [shift, duration, x]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, moving]}
    >
      <Text numberOfLines={1} onLayout={onText} style={text}>
        {children}
      </Text>
      <Text numberOfLines={1} style={[text, { marginLeft: gap }]}>
        {children}
      </Text>
    </Animated.View>
  );
});

export const Marquee = memo(function Marquee({
  children,
  style,
  ellipsis = true,
  gap,
  speed,
  delay = MARQUEE.delayMs,
  accessibilityLabel,
  testID,
}: Props) {
  const reduced = useReducedMotion();
  const { box, text, fontSize } = useMemo(() => splitStyle(style), [style]);

  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [started, setStarted] = useState(false);

  const onBox = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBoxWidth((p) => settle(p, w));
  }, []);
  const onText = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTextWidth((p) => settle(p, w));
  }, []);

  const overflow = !reduced && marqueeOverflows(textWidth, boxWidth);

  // Пауза перед стартом; строка снова влезла (поворот экрана, другой текст) — стоп без задержки
  useEffect(() => {
    if (!overflow) {
      setStarted(false);
      return;
    }
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [overflow, delay]);

  const space = gap ?? marqueeGap(fontSize);
  const shift = marqueeShift(textWidth, space);
  const duration = marqueeDuration(shift, speed ?? marqueeSpeed(fontSize));
  const running = overflow && started && duration > 0;

  return (
    <View style={[box, running || (WEB && !reduced) ? styles.clip : null]} testID={testID}>
      {/* В потоке: задаёт размер блока как прежний <Text>; пока стоит — видна, пока едет — прозрачна (читается скринридером) */}
      <Text
        numberOfLines={1}
        ellipsizeMode={ellipsis ? 'tail' : 'clip'}
        accessibilityLabel={accessibilityLabel}
        onLayout={reduced ? undefined : onBox}
        style={[text, ellipsis ? null : WEB_CLIP, running ? styles.hidden : null]}
      >
        {children}
      </Text>
      {reduced ? null : running ? (
        <Ticker text={text} gap={space} shift={shift} duration={duration} onText={onText}>
          {children}
        </Ticker>
      ) : (
        // Невидимый замер ширины строки без ограничения
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.track, styles.hidden]}
        >
          <Text numberOfLines={1} onLayout={onText} style={text}>
            {children}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  /** Широкая дорожка: строка в ней меряется без ограничения ширины и не переносится */
  track: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MARQUEE.measureWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
