/**
 * Ряды кнопок окна быстрых действий: плитки 60px (значок 18 + подпись) и ряд «ПЕРЕНЕСТИ» / «В ТЕМУ» 32px.
 * Колонки равные, соседние кнопки делят рамку 1.5px (сдвиг −1.5, как margin-left в макете поверх сетки колонок).
 */
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Marquee, fonts, size as S, useTheme } from '@/ui';
import type { QuickSection, QuickSegment, QuickTile, QuickTileKey } from '../types';

type Glyph = 'check' | 'edit' | 'plan' | 'copy' | 'gift' | 'link' | 'toTask';

/** Значки 18×18 из макетов C-Quick* (прямоугольники — замкнутыми путями) */
const GLYPHS: Record<Glyph, readonly string[]> = {
  check: ['M3 9.5l4 4 8-9'],
  edit: ['M3 15h3l8.5-8.5-3-3L3 12z', 'M10 5l3 3'],
  plan: ['M2.5 3.5h13v11h-13z', 'M2.5 7.5h13M7 7.5v7'],
  copy: ['M5.5 5.5h10v10h-10z', 'M2.5 12.5v-10h10'],
  gift: ['M2.5 7h13v8.5h-13z', 'M2.5 7h13M9 7v8.5M9 7C7 3 4 4 5.5 7M9 7c2-4 5-3 3.5 0'],
  link: ['M7 4H3.5v10.5H14V11', 'M10 3h5v5M15 3l-7 7'],
  toTask: ['M2.5 2.5h13v13h-13z', 'M5.5 9l2.5 2.5 4.5-5'],
};

const GLYPH_OF: Record<QuickTileKey, Glyph> = {
  done: 'check',
  watched: 'check',
  received: 'check',
  gift: 'gift',
  edit: 'edit',
  plan: 'plan',
  openPlan: 'plan',
  copy: 'copy',
  link: 'link',
  toTask: 'toTask',
};

const TileGlyph = memo(function TileGlyph({ glyph, color }: { glyph: Glyph; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="square">
      {GLYPHS[glyph].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
});

type TileProps = { tile: QuickTile; first: boolean; onTile?: (key: QuickTileKey) => void };

const Tile = memo(function Tile({ tile, first, onTile }: TileProps) {
  const { c } = useTheme();
  const press = useCallback(() => onTile?.(tile.key), [onTile, tile.key]);
  const filled = !!tile.primary && !tile.disabled;
  const ink = tile.disabled ? c.faint : filled ? c.bg : c.text;
  return (
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tile.label}
        accessibilityState={{ disabled: !!tile.disabled }}
        disabled={tile.disabled || !onTile}
        onPress={press}
        style={[styles.tile, !first && styles.joined, { borderColor: c.border, backgroundColor: filled ? c.text : c.panel }]}
      >
        <TileGlyph glyph={GLYPH_OF[tile.key]} color={ink} />
        <Text style={[styles.tileLabel, { color: ink }]}>{tile.label}</Text>
      </Pressable>
    </View>
  );
});

export const QuickTiles = memo(function QuickTiles({ tiles, onTile }: { tiles: readonly QuickTile[]; onTile?: (key: QuickTileKey) => void }) {
  return (
    <View style={styles.row}>
      {tiles.map((t, i) => (
        <Tile key={t.key} tile={t} first={i === 0} onTile={onTile} />
      ))}
    </View>
  );
});

type SegmentProps = { segment: QuickSegment; first: boolean; onSegment?: (key: string) => void };

const Segment = memo(function Segment({ segment, first, onSegment }: SegmentProps) {
  const { c } = useTheme();
  const press = useCallback(() => onSegment?.(segment.key), [onSegment, segment.key]);
  return (
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={segment.label}
        accessibilityState={{ disabled: !!segment.disabled }}
        disabled={segment.disabled || !onSegment}
        onPress={press}
        style={[styles.segment, !first && styles.joined, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Marquee style={[styles.segmentLabel, { color: segment.disabled ? c.faint : c.text }]}>{segment.label}</Marquee>
      </Pressable>
    </View>
  );
});

/** Подпись («ПЕРЕНЕСТИ») и ряд кнопок под ней */
export const QuickSegments = memo(function QuickSegments({ section, onSegment }: { section: QuickSection; onSegment?: (key: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: c.muted }]}>{section.label}</Text>
      <View style={styles.row}>
        {section.segments.map((s, i) => (
          <Segment key={s.key} segment={s} first={i === 0} onSegment={onSegment} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  /** Колонка сетки; кнопка в ней — на всю ширину плюс 1.5 влево (общая рамка с соседом) */
  cell: { flex: 1, minWidth: 0, flexDirection: 'row' },
  joined: { marginLeft: -S.border },
  tile: { flex: 1, height: 60, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', gap: 7 },
  tileLabel: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  section: { gap: 5 },
  sectionLabel: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  segment: { flex: 1, minWidth: 0, height: 32, borderWidth: S.border, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { maxWidth: '100%', fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.36 },
});
