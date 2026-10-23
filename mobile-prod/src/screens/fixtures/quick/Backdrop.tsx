/**
 * Упрощённый экран под окном быстрых действий — как его рисуют макеты C-Quick*: пустые кнопки панели, заголовок,
 * секция из 6 строк; и поднятая строка (копия строки в рамке). Только для стенда сверки; в приложении под окном
 * настоящий экран, а поднимается копия нажатой строки.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { SectionBox, fonts, size as S, space, type as T, useTheme, type LiftTarget } from '@/ui';
import { PersonStrip } from '../../voice/components/PersonStrip';

export type BackdropRow = { title: string; time: string; colors: PersonColor[] };

export type QuickBackdropProps = {
  /** «Дела», «Хочу» */
  title: string;
  /** Шапка секции: «СЕГОДНЯ» · «ПН 05» */
  head: string;
  count: string;
  rows: readonly BackdropRow[];
};

/** Секция с top 122: рамка 1.5 + шапка 22, строка 44 + разделитель 1 */
const SECTION_TOP = 122;
const ROW_PITCH = S.row + 1;

export const QuickBackdrop = memo(function QuickBackdrop({ title, head, count, rows }: QuickBackdropProps) {
  const { c, person } = useTheme();
  const box = { borderColor: c.border, backgroundColor: c.panel };
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <View style={styles.bar}>
        <View style={[styles.caption, box]}>
          <Text style={[T.caption, { color: c.text }]}>МЫ С КАРИНОЙ</Text>
        </View>
        <View style={[styles.button, box]}>
          <View style={styles.buttonInner} />
        </View>
        <View style={[styles.button, box]}>
          <View style={styles.buttonInner} />
        </View>
        <View style={[styles.button, box, { backgroundColor: person('blue') }]}>
          <View style={styles.buttonInner} />
        </View>
      </View>
      <Text style={[styles.title, T.h1, { color: c.text }]}>{title}</Text>
      <SectionBox title={head} count={count} style={styles.list}>
        {rows.map((r) => (
          <View key={r.title} style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
            <PersonStrip colors={r.colors} />
            <View style={[styles.check, { borderColor: c.border }]} />
            <Text style={[styles.rowTitle, { color: c.text }]}>{r.title}</Text>
            <Text style={[T.rowValue, styles.rowTime, { color: c.text }]}>{r.time}</Text>
          </View>
        ))}
      </SectionBox>
    </View>
  );
});

/** Строка в рамке подъёма (макет: высота 48, поля 16 / 12) */
const LiftRow = memo(function LiftRow({ row }: { row: BackdropRow }) {
  const { c } = useTheme();
  return (
    <View style={styles.liftRow}>
      <PersonStrip colors={row.colors} />
      <View style={[styles.check, { borderColor: c.border }]} />
      <Text style={[styles.rowTitle, { color: c.text }]}>{row.title}</Text>
      <Text style={[T.rowValue, styles.rowTime, { color: c.text }]}>{row.time}</Text>
    </View>
  );
});

/** Поднятая строка index фона: прямоугольник строки в окне и её копия */
export const backdropLift = (b: QuickBackdropProps, index: number): LiftTarget | null => {
  const row = b.rows[index];
  if (!row) return null;
  return {
    rect: { x: space.side + S.border, y: SECTION_TOP + S.border + S.sectionHeader + index * ROW_PITCH, width: 390 - 2 * (space.side + S.border), height: ROW_PITCH },
    shape: 'row',
    node: <LiftRow row={row} />,
  };
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.side,
    right: space.side,
    top: S.topBarTop,
    height: S.topBarHeight,
    flexDirection: 'row',
    gap: space.barGap,
  },
  caption: { flex: 1, borderWidth: S.border, justifyContent: 'center', paddingHorizontal: 10 },
  /** В макете ширина 40 без рамки (content-box) */
  button: { borderWidth: S.border },
  buttonInner: { width: S.iconButton },
  title: { position: 'absolute', left: space.side, top: S.titleTop },
  list: { position: 'absolute', left: space.side, right: space.side, top: SECTION_TOP },
  row: {
    height: ROW_PITCH,
    borderTopWidth: S.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
  },
  liftRow: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 12 },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border },
  rowTitle: { flex: 1, fontFamily: fonts.sans500, fontSize: 13 },
  rowTime: { letterSpacing: 0 },
});
