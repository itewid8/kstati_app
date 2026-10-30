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
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLUMN, fitTextLines, textRoom, timeOptions, titlePlan, type ColumnBlock, type TimeRow } from '@/lib/calendarLayout';
import type { TaskKind } from '@/lib/types';
import { useHatchId, HatchPattern, LONG_PRESS_MS, Marquee, fonts, useLift, useTheme, type LiftHandler } from '@/ui';
import { EventMarks } from './EventMarks';
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
/** Время 7px Geist Mono, трекинг −0.14; значки 7px через 2 */
const MONO_SIZE = 7;
const MONO_TRACKING = -0.14;
const MARK = 7;
const MARK_GAP = 2;
/** Строки: название 9.5, время и кто 8.5, зазор 1 */
const LINE = { title: 9.5, mono: 8.5 } as const;
const LINE_HEIGHTS = [LINE.title, LINE.mono, LINE.mono] as const;
const GAP = 1;

/**
 * Название (titlePlan): переносится по словам, слово шире колонки — по слогам с дефисом (мягкие переносы);
 * если и слог не влезает — одна бегущая строка. Обычный перенос телефона по буквам не нужен — ширина считается заранее
 */
type TitleProps = { title: string; width: number; color: string; done?: boolean; onLayout?: (e: LayoutChangeEvent) => void };

const Title = memo(function Title({ title, width, color, done, onLayout }: TitleProps) {
  const plan = useMemo(() => titlePlan(title, width, TITLE_SIZE, TITLE_TRACKING), [title, width]);
  const style = [styles.title, { color }, done && styles.done];
  if (plan.marquee)
    return (
      <View onLayout={onLayout}>
        <Marquee style={style}>{title}</Marquee>
      </View>
    );
  return (
    <Text onLayout={onLayout} android_hyphenationFrequency="normal" style={style}>
      {plan.text}
    </Text>
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
  /** Значки в строке времени: тип и повтор (и галочка «сделано») */
  kind?: TaskKind;
  repeat?: boolean;
  colors: readonly string[];
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
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
  const hid = useHatchId();
  const { x, y, w, h, bands, path, edgePath, textInsetTop, textInsetLeft } = block;
  const multi = colors.length > 1;
  const textWidth = Math.max(0, w - textInsetLeft - TEXT_RIGHT);

  const [lines, measure] = useTextLines(LINE_HEIGHTS);
  // Время: целиком, двумя строками (начало / конец) или никак — значки стоят перед первой строкой
  const marks = [done, props.kind && props.kind !== 'task', props.repeat].filter(Boolean).length;
  const marksW = marks ? marks * MARK + (marks - 1) * MARK_GAP + MARK_GAP : 0;
  const options = useMemo(() => timeOptions(time, textWidth, marksW, MONO_SIZE, MONO_TRACKING), [time, textWidth, marksW]);
  const room = textRoom(bands, textInsetTop, COLUMN.STRIP);
  const segs = (timeN: number) => [
    { lineHeight: LINE.title, lines: lines[0] ?? 1 },
    { lineHeight: LINE.mono, lines: timeN, gapBefore: GAP },
    { lineHeight: LINE.mono, lines: who ? (lines[2] ?? 1) : 0, gapBefore: GAP },
  ];
  // Первый вариант строк времени, что влезает по высоте целиком; ни один — время не показываем, а не обрезаем
  let rows: TimeRow[] = [];
  let fit = fitTextLines(room, segs(0));
  for (const opt of options) {
    const f = fitTextLines(room, segs(opt.length));
    if (f.lines[1] === opt.length) {
      rows = opt;
      fit = f;
      break;
    }
  }
  /** Текст рисуется в каждой широкой полосе; меряется только в первой */
  const firstText = bands.findIndex((b) => b.right - b.left > COLUMN.STRIP + EPS);
  const text = (measured: boolean) => (
    <View style={[styles.text, { width: textWidth, height: fit.height }]}>
      <Title title={title} width={textWidth} color={c.text} done={done} onLayout={measured ? measure[0] : undefined} />
      {rows.length && fit.lines[1] ? (
        <View>
          {rows.map((r, i) => (
            <View key={i} style={[styles.timeRow, { height: LINE.mono }]}>
              {r.marks ? <EventMarks done={done} kind={props.kind} repeat={props.repeat} size={MARK} lineHeight={LINE.mono} /> : null}
              {r.text ? (
                <Text numberOfLines={1} style={[styles.mono, { color: c.text }]}>
                  {r.text}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
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
          {props.hidden ? <HatchPattern id={hid} color={c.text} /> : null}
        </Defs>
        <Path d={path} fill={multi ? `url(#${fid})` : colors[0]} fillOpacity={multi ? 1 : c.tintAlpha} />
        {props.hidden ? <Path d={path} fill={`url(#${hid})`} /> : null}
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
  title: { fontFamily: fonts.sans600, fontSize: TITLE_SIZE, lineHeight: LINE.title, letterSpacing: TITLE_TRACKING },
  done: { textDecorationLine: 'line-through' },
  timeRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', gap: MARK_GAP },
  mono: { flexShrink: 0, fontFamily: fonts.mono400, fontSize: 7, lineHeight: LINE.mono, letterSpacing: -0.14 },
});
