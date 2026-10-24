/**
 * Дело в колонке недели (C-Week): форма из layoutDayColumn — SVG-контур со скруглёнными ступеньками,
 * заливка цветом людей (несколько — горизонтальный градиент на всю ширину блока) и полоса 2px по левому краю,
 * повторяющая ступеньки (обводка 4px края, обрезанная контуром).
 *
 * Текст в макете обрезан clip-path по контуру. В RN текст рисуется в каждой полосе формы (Band) отдельно —
 * в окне overflow: hidden со сдвигом на верх полосы, так что вместе полосы показывают один непрерывный столбец
 * текста, обрезанный по ступенькам (без скруглений углов 4px). Каждая полоса — своя зона нажатия:
 * узкий хвост основы под гостем остаётся у основы.
 *
 * По высоте рисуются только строки, которые влезают в блок целиком (fitTextLines): у короткого дела нет
 * обрезанного по высоте куска текста, а если не влезает и строка названия — блок без текста.
 */
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLUMN, fitTextLines, textRoom, type ColumnBlock } from '@/lib/calendarLayout';
import { LONG_PRESS_MS, fonts, useLift, useTheme, type LiftHandler } from '@/ui';
import { hardStops, useSvgId } from './PeopleColor';
import { useTextLines } from './useTextLines';

/** Обводка края 4px, половина обрезается контуром — видимая полоса 2px */
const EDGE_STROKE = 4;
/** Отступ текста от правого края блока */
const TEXT_RIGHT = 1;
const EPS = 1e-3;
/** Название 8px Geist 600: пробел 0.236em плюс трекинг −0.08 — расстояние между словами */
const TITLE_SIZE = 8;
const TITLE_TRACKING = -0.08;
const WORD_GAP = TITLE_SIZE * 0.236 + TITLE_TRACKING;
const SPACES = / +/;
/** Строки: название 9.5, время и кто 8.5, зазор 1 */
const LINE = { title: 9.5, mono: 8.5 } as const;
const LINE_HEIGHTS = [LINE.title, LINE.mono, LINE.mono] as const;
const GAP = 1;
/** react-native-web не знает ellipsizeMode и ставит многоточие — на вебе (стенд сверки) обрезаем так же, как на телефоне */
const WORD = Platform.OS === 'web' ? { flexShrink: 1, textOverflow: 'clip' } : { flexShrink: 1 };

/**
 * Название переносится только по пробелам, а слово шире колонки обрезается её краем — как в макете
 * (CSS без переноса внутри слова, overflow: hidden). Обычный Text на телефоне ломал бы такое слово по буквам.
 * Слова — строки одной строкой в ряду с переносом: зазор колонок (columnGap) — ширина пробела, на краю строки его нет
 */
type TitleWordsProps = { title: string; color: string; done?: boolean; onLayout?: (e: LayoutChangeEvent) => void };

const TitleWords = memo(function TitleWords({ title, color, done, onLayout }: TitleWordsProps) {
  const words = title.split(SPACES).filter(Boolean);
  return (
    <View onLayout={onLayout} style={styles.words}>
      {words.map((w, i) => (
        <Text key={i} numberOfLines={1} ellipsizeMode="clip" style={[styles.title, WORD, { color }, done && styles.done]}>
          {w}
        </Text>
      ))}
    </View>
  );
});

type Props = {
  /** Левый верхний угол колонки дня на экране */
  colX: number;
  gridY: number;
  block: ColumnBlock;
  title: string;
  /** «09:30–10:30» */
  time: string;
  /** «Карина · Казань» */
  who: string;
  done?: boolean;
  colors: readonly string[];
  onPress?: () => void;
  /** Удержание: блок отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
};

export const WeekEventBlock = memo(function WeekEventBlock(props: Props) {
  const { colX, gridY, block, title, time, who, done, colors, onPress, onLongPress } = props;
  const { c } = useTheme();
  // Копия — в начале координат рамки: колонка и сетка сдвинуты на положение блока
  const lift = useLift(onLongPress, 'block', () => (
    <WeekEventBlock {...props} colX={-block.x} gridY={-block.y} onPress={undefined} onLongPress={undefined} />
  ));
  const fid = useSvgId('wf');
  const tid = useSvgId('wt');
  const cid = useSvgId('wc');
  const { x, y, w, h, bands, path, edgePath, textInsetTop, textInsetLeft } = block;
  const multi = colors.length > 1;
  const textWidth = Math.max(0, w - textInsetLeft - TEXT_RIGHT);

  const [lines, measure] = useTextLines(LINE_HEIGHTS);
  const fit = fitTextLines(textRoom(bands, textInsetTop, COLUMN.STRIP), [
    { lineHeight: LINE.title, lines: lines[0] },
    { lineHeight: LINE.mono, lines: time ? lines[1] : 0, gapBefore: GAP },
    { lineHeight: LINE.mono, lines: who ? lines[2] : 0, gapBefore: GAP },
  ]);
  /** Текст рисуется в каждой широкой полосе; меряется только в первой */
  const firstText = bands.findIndex((b) => b.right - b.left > COLUMN.STRIP + EPS);
  const text = (measured: boolean) => (
    <View style={[styles.text, { width: textWidth, height: fit.height }]}>
      <TitleWords title={title} color={c.text} done={done} onLayout={measured ? measure[0] : undefined} />
      {fit.lines[1] ? (
        <Text onLayout={measured ? measure[1] : undefined} style={[styles.mono, { color: c.text }]}>
          {time}
        </Text>
      ) : null}
      {fit.lines[2] ? (
        <Text onLayout={measured ? measure[2] : undefined} style={[styles.mono, { color: c.muted }]}>
          {who}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View ref={lift.ref} pointerEvents="box-none" style={[styles.block, { left: colX + x, top: gridY + y, width: w, height: h }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {multi ? (
            <LinearGradient id={fid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
              {colors.map((col, i) => (
                <Stop key={i} offset={i / (colors.length - 1)} stopColor={col} stopOpacity={c.tintAlpha} />
              ))}
            </LinearGradient>
          ) : null}
          {multi ? (
            <LinearGradient id={tid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
              {hardStops(colors).flatMap(([col, a, b], i) => [
                <Stop key={`${i}a`} offset={a} stopColor={col} />,
                <Stop key={`${i}b`} offset={b} stopColor={col} />,
              ])}
            </LinearGradient>
          ) : null}
          <ClipPath id={cid}>
            <Path d={path} />
          </ClipPath>
        </Defs>
        <Path d={path} fill={multi ? `url(#${fid})` : colors[0]} fillOpacity={multi ? 1 : c.tintAlpha} />
        <Path
          d={edgePath}
          fill="none"
          stroke={multi ? `url(#${tid})` : colors[0]}
          strokeWidth={EDGE_STROKE}
          clipPath={`url(#${cid})`}
        />
      </Svg>
      {bands.map((b, i) => {
        const bw = b.right - b.left;
        return (
          <Pressable
            key={i}
            accessible={i === 0}
            accessibilityRole="button"
            accessibilityLabel={i === 0 ? `${title}, ${time}, ${who}` : undefined}
            onPress={onPress}
            onLongPress={lift.onLongPress}
            delayLongPress={LONG_PRESS_MS}
            style={[styles.band, { left: b.left, top: b.y0, width: bw, height: b.y1 - b.y0 }]}
          >
            {fit.height > 0 && bw > COLUMN.STRIP + EPS ? (
              <View style={[styles.shift, { left: textInsetLeft - b.left, top: textInsetTop - b.y0 }]}>{text(i === firstText)}</View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  block: { position: 'absolute' },
  band: { position: 'absolute', overflow: 'hidden' },
  shift: { position: 'absolute' },
  /** Окно текста высотой в целые строки: что ниже — не видно */
  text: { overflow: 'hidden', gap: GAP },
  words: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: WORD_GAP },
  title: { fontFamily: fonts.sans600, fontSize: TITLE_SIZE, lineHeight: LINE.title, letterSpacing: TITLE_TRACKING },
  done: { textDecorationLine: 'line-through' },
  mono: { flexShrink: 0, fontFamily: fonts.mono400, fontSize: 7, lineHeight: LINE.mono, letterSpacing: -0.14 },
});
