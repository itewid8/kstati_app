/**
 * Виджет на рабочем столе — точная копия раскладок Android-виджета (макеты C-WidgetHome, C-WidgetLarge):
 * превью в настройках рисуется этими же компонентами, а KstatiWidget.kt / res/layout повторяют те же размеры.
 *
 *   1×1 — квадрат REC;  2×1 — ближайшее дело и REC;  2×2 — шапка с кружком REC и дела строкой (день справа);
 *   4×2, 4×4 — шапка с кружком REC и дела по дням (подпись дня, строка: полоса людей, название, время).
 * Внешние углы — системное скругление 22, всё внутри квадратное. Одна поверхность, без рамки в рамке.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { fonts } from '@/ui';

export const WIDGET = {
  radius: 22,
  pad: 10,
  /** Высоты как в макете: шапка без линии снизу, дело — одна строка без разделителей */
  header: 40,
  day: 16,
  row: 20,
  /** Отступ под шапкой 2×2 */
  stackGap: 4,
  strip: 2,
} as const;

import type { FaceColors } from '@/lib/widgetData';

export type { FaceColors };

/** Полоса людей: один цвет или два (верх / низ) */
export type FaceStrip = readonly string[];
export type FaceRow = { key: string; title: string; time: string; strip: FaceStrip; done?: boolean };
export type FaceDay = { key: string; label: string; rows: readonly FaceRow[] };
/** Строка 2×2 / 2×1: название и под ним день и время одной подписью */
export type FaceItem = { key: string; title: string; when: string; strip: FaceStrip };
export type FaceHeader = { label: string; weekday: string; day: string };

const Strip = memo(function Strip({ colors, inset }: { colors: FaceStrip; inset: number }) {
  return (
    <View style={[styles.strip, { top: inset, bottom: inset }]}>
      {colors.map((c, i) => (
        <View key={i} style={[styles.stripPart, { backgroundColor: c }]} />
      ))}
    </View>
  );
});

/**
 * Кнопка REC (макет C-WidgetRec, вариант D): капсула «● REC». Заливка непрозрачная — не зависит от прозрачности
 * фона виджета; контур мягкий, 1 цвета разделителя. Точка 9 со свечением 3. Без подписи — круглая (шапка 2×2)
 */
export const RecCapsule = memo(function RecCapsule({ h, label, c }: { h: number; label: boolean; c: FaceColors }) {
  const big = h >= 30;
  return (
    <View
      style={[
        styles.capsule,
        {
          height: h,
          borderRadius: h / 2,
          paddingLeft: label ? (big ? 10 : 8) : 7,
          paddingRight: label ? (big ? 11 : 9) : 7,
          backgroundColor: c.recFill,
          borderColor: c.recBorder,
        },
      ]}
    >
      <View style={styles.dotBox}>
        <View style={[styles.glow, { backgroundColor: c.recGlow }]} />
        <View style={[styles.dot, { backgroundColor: c.recDot }]} />
      </View>
      {label ? <Text allowFontScaling={false} style={[styles.recLabel, { fontSize: big ? 8.5 : 8, color: c.recInk }]}>REC</Text> : null}
    </View>
  );
});

export const FaceSurface = memo(function FaceSurface({
  width,
  height,
  c,
  children,
  style,
}: {
  width: number;
  height: number;
  c: FaceColors;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.surface, { width, height, backgroundColor: c.card }, style]}>{children}</View>;
});

/** Шапка: группа, день недели, число и капсула D без подписи — только кружок */
const Header = memo(function Header({ h, c }: { h: FaceHeader; c: FaceColors }) {
  return (
    <View style={[styles.header, { backgroundColor: c.headBg }]}>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.headLabel, { color: c.headInk }]}>
        {h.label}
      </Text>
      <Text allowFontScaling={false} style={[styles.headWeekday, { color: c.headMuted }]}>{h.weekday}</Text>
      <View style={[styles.today, { backgroundColor: c.today, marginRight: c.showRec ? 4 : 12 }]}>
        <Text allowFontScaling={false} style={styles.todayText}>{h.day}</Text>
      </View>
      {c.showRec ? <RecCapsule h={24} label={false} c={c} /> : null}
      {c.showRec ? <View style={styles.headEnd} /> : null}
    </View>
  );
});

const DayLabel = memo(function DayLabel({ label, c }: { label: string; c: FaceColors }) {
  return (
    <View style={styles.day}>
      <Text allowFontScaling={false} style={[styles.dayText, { color: c.muted }]}>{label}</Text>
    </View>
  );
});

/** Дело — одна строка: полоса людей, название, справа время (small — 2×2: день мельче и приглушённо) */
const Row = memo(function Row({ r, c, small = false }: { r: FaceRow; c: FaceColors; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Strip colors={r.strip} inset={4} />
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[styles.title, { color: r.done ? c.muted : c.text }, r.done ? styles.done : null]}
      >
        {r.title}
      </Text>
      <Text allowFontScaling={false} style={[small ? styles.timeSmall : styles.time, { color: small ? c.day : c.time }]}>{r.time}</Text>
    </View>
  );
});

/**
 * Сколько дел влезает под шапку (как в виджете Android, KstatiWidget.kt): дни и строки сверху вниз, пока есть место.
 * cut — влезли не все (низ гаснет)
 */
export function fitDays(days: readonly FaceDay[], height: number): { days: FaceDay[]; cut: boolean } {
  let room = height - WIDGET.header - WIDGET.pad;
  const out: FaceDay[] = [];
  let total = 0;
  let shown = 0;
  for (const d of days) {
    total += d.rows.length;
    const rows: FaceRow[] = [];
    for (const r of d.rows) {
      const need = WIDGET.row + (rows.length === 0 ? WIDGET.day : 0);
      if (need > room) break;
      room -= need;
      rows.push(r);
    }
    shown += rows.length;
    if (rows.length) out.push({ ...d, rows });
    if (rows.length < d.rows.length) break;
  }
  return { days: out, cut: shown < total || out.length < days.length };
}

/** 4×2 и 4×4: шапка и дела по дням, сколько влезет; не влезли — низ гаснет (fade — гаснет всегда) */
export const FaceDays = memo(function FaceDays(props: {
  width: number;
  height: number;
  c: FaceColors;
  header: FaceHeader;
  days: readonly FaceDay[];
  fade?: boolean;
  empty?: string;
  style?: ViewStyle;
}) {
  const { width, height, c, header, empty, style } = props;
  const fit = fitDays(props.days, height);
  const days = fit.days;
  const fade = props.fade || fit.cut;
  return (
    <FaceSurface width={width} height={height} c={c} style={style}>
      <Header h={header} c={c} />
      {days.length === 0 ? (
        <View style={styles.empty}>
          <Text allowFontScaling={false} style={[styles.emptyText, { color: c.muted }]}>{empty ?? 'Дел нет'}</Text>
        </View>
      ) : (
        days.map((d) => (
          <View key={d.key}>
            <DayLabel label={d.label} c={c} />
            {d.rows.map((r) => (
              <Row key={r.key} r={r} c={c} />
            ))}
          </View>
        ))
      )}
      {fade ? <Fade c={c} /> : null}
    </FaceSurface>
  );
});

/** Низ гаснет в цвет поверхности: 28px, восемь ступеней прозрачности (без градиентной библиотеки) */
const Fade = memo(function Fade({ c }: { c: FaceColors }) {
  return (
    <View style={styles.fade} pointerEvents="none">
      {[0.06, 0.18, 0.31, 0.44, 0.56, 0.69, 0.81, 0.94].map((a) => (
        <View key={a} style={[styles.fadeStep, { backgroundColor: c.card, opacity: a }]} />
      ))}
    </View>
  );
});

/** 2×2: шапка и дела строкой (сколько влезет) */
export const FaceStack = memo(function FaceStack(props: {
  width: number;
  height: number;
  c: FaceColors;
  header: FaceHeader;
  items: readonly FaceItem[];
  style?: ViewStyle;
}) {
  const { width, height, c, header, items, style } = props;
  return (
    <FaceSurface width={width} height={height} c={c} style={style}>
      <Header h={header} c={c} />
      <View style={styles.stackGap} />
      {items.map((r) => (
        <Row key={r.key} r={{ key: r.key, title: r.title, time: r.when, strip: r.strip }} c={c} small />
      ))}
    </FaceSurface>
  );
});

/** 2×1: ближайшее дело в две строки и REC */
export const FaceNext = memo(function FaceNext(props: { width: number; height: number; c: FaceColors; item: FaceItem | null; style?: ViewStyle }) {
  const { width, height, c, item, style } = props;
  return (
    <FaceSurface width={width} height={height} c={c} style={style}>
      <View style={styles.next}>
        <View style={styles.nextText}>
          {item ? (
            <>
              <Strip colors={item.strip} inset={4} />
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.nextTitle, { color: c.text }]}>
                {item.title}
              </Text>
              <Text allowFontScaling={false} style={[styles.when, { color: c.day }]}>{item.when}</Text>
            </>
          ) : (
            <Text allowFontScaling={false} style={[styles.nextTitle, { color: c.muted }]}>Дел нет</Text>
          )}
        </View>
        {c.showRec ? (
          <View style={styles.center}>
            <RecCapsule h={30} label c={c} />
          </View>
        ) : null}
      </View>
    </FaceSurface>
  );
});

/** 1×1: только REC */
export const FaceRec = memo(function FaceRec(props: { size: number; c: FaceColors; style?: ViewStyle }) {
  const { size, c, style } = props;
  return (
    <FaceSurface width={size} height={size} c={c} style={style}>
      <View style={styles.center}>
        <RecCapsule h={30} label c={c} />
      </View>
    </FaceSurface>
  );
});

const styles = StyleSheet.create({
  surface: { borderRadius: WIDGET.radius, overflow: 'hidden', padding: WIDGET.pad },
  header: {
    height: WIDGET.header,
    marginTop: -WIDGET.pad,
    marginHorizontal: -WIDGET.pad,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headLabel: { flex: 1, minWidth: 0, fontFamily: fonts.mono600, fontSize: 8, letterSpacing: 0.64 },
  headWeekday: { fontFamily: fonts.mono600, fontSize: 8, letterSpacing: 0.64 },
  today: { paddingHorizontal: 4, paddingVertical: 2 },
  headEnd: { width: 2 },
  todayText: { fontFamily: fonts.mono600, fontSize: 8.5, color: '#FFFFFF' },
  capsule: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  // Свечение — кольцо 5 вокруг точки, как box-shadow: места в раскладке не занимает
  dotBox: { width: 9, height: 9 },
  glow: { position: 'absolute', left: -3, top: -3, width: 15, height: 15, borderRadius: 7.5 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  recLabel: { fontFamily: fonts.mono600, letterSpacing: 1.02 },
  day: { height: WIDGET.day, justifyContent: 'flex-end', paddingBottom: 3 },
  dayText: { fontFamily: fonts.mono600, fontSize: 7.5, letterSpacing: 0.6 },
  row: { height: WIDGET.row, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 9 },
  stackGap: { height: WIDGET.stackGap },
  strip: { position: 'absolute', left: 0, width: WIDGET.strip },
  stripPart: { flex: 1 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 10.5 },
  done: { textDecorationLine: 'line-through' },
  time: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.19 },
  timeSmall: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.17 },
  when: { fontFamily: fonts.mono600, fontSize: 8, letterSpacing: 0.32 },
  empty: { height: 120, justifyContent: 'center', paddingLeft: 2 },
  emptyText: { fontFamily: fonts.sans500, fontSize: 10.5 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
  fadeStep: { flex: 1 },
  next: { flex: 1, flexDirection: 'row', gap: 8 },
  nextText: { flex: 1, minWidth: 0, paddingLeft: 9, justifyContent: 'center', gap: 3 },
  nextTitle: { fontFamily: fonts.sans500, fontSize: 10.5, lineHeight: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
