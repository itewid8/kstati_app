/**
 * Быстрые действия по удержанию (C-QuickTask, C-QuickWish, C-QuickWatch, C-QuickIdea). Презентационный экран поверх
 * всего: затемнение, нижнее окно (ручка, карточка записи, плитки, необязательный ряд «ПЕРЕНЕСТИ» / «В ТЕМУ»,
 * ЗАКРЫТЬ / УДАЛИТЬ) и нажатый элемент, поднятый над затемнением (lift). Окно, как BottomSheet: рамка сверху 1.5,
 * поля 8 / 16 / 18 + safe area, между блоками 10.
 */
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LIFT_GAP, MENU_WIDTH, liftFrame, liftShift, size as S, space, type as T, useDesktop, useEscape, useTheme } from '@/ui';
import { QuickCard } from './components/QuickCard';
import { QuickLift } from './components/QuickLift';
import { QuickSegments, QuickTiles } from './components/QuickTiles';
import type { QuickActionsSheetProps } from './types';

const SCRIM_MS = 140;
const SHEET_MS = 220;

export const QuickActionsSheet = memo(function QuickActionsSheet(props: QuickActionsSheetProps) {
  const { card, tiles, section, deletable, lift, bottomInset = 0, onTile, onSegment, onClose, onDelete } = props;
  const { c } = useTheme();
  const [sheetTop, setSheetTop] = useState(0);
  const onSheetLayout = useCallback((e: LayoutChangeEvent) => setSheetTop(e.nativeEvent.layout.y), []);
  const desktop = useDesktop();
  const win = useWindowDimensions();
  const [menuH, setMenuH] = useState(0);
  useEscape(onClose, desktop);
  const shift = lift && !desktop ? liftShift(liftFrame(lift.rect, lift.shape), sheetTop - LIFT_GAP) : 0;

  if (desktop) {
    // Меню у дела: под ним, а если не влезает — над ним; не за краем окна
    const r = lift?.rect;
    const gap = 6;
    const below = r ? r.y + r.height + gap : (win.height - menuH) / 2;
    const top = r && below + menuH > win.height - 8 ? Math.max(8, r.y - gap - menuH) : below;
    const left = Math.min(Math.max(8, r ? r.x : (win.width - MENU_WIDTH) / 2), win.width - MENU_WIDTH - 8);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
        {lift ? <QuickLift lift={lift} shift={0} /> : null}
        <Animated.View
          entering={FadeIn.duration(SCRIM_MS)}
          accessibilityViewIsModal
          onLayout={(e) => setMenuH(e.nativeEvent.layout.height)}
          style={[styles.menu, { top, left, borderColor: c.border, backgroundColor: c.bg, opacity: menuH ? 1 : 0 }]}
        >
          <QuickTiles tiles={tiles} onTile={onTile} />
          {section ? <QuickSegments section={section} onSegment={onSegment} /> : null}
          {deletable ? (
            <Pressable accessibilityRole="button" onPress={onDelete} style={[styles.button, styles.menuDelete, { borderColor: c.red }]}>
              <Text style={[T.action, { color: c.red }]}>УДАЛИТЬ</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(SCRIM_MS)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(SHEET_MS)}
        accessibilityViewIsModal
        onLayout={onSheetLayout}
        style={[styles.sheet, { borderTopColor: c.border, backgroundColor: c.bg, paddingBottom: 18 + bottomInset }]}
      >
        <View style={[styles.grabber, { backgroundColor: c.hair }]} />
        <QuickCard card={card} />
        <QuickTiles tiles={tiles} onTile={onTile} />
        {section ? <QuickSegments section={section} onSegment={onSegment} /> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}
          >
            <Text style={[T.action, { color: c.text }]}>ЗАКРЫТЬ</Text>
          </Pressable>
          {deletable ? (
            <Pressable accessibilityRole="button" onPress={onDelete} style={[styles.button, { borderColor: c.red }]}>
              <Text style={[T.action, { color: c.red }]}>УДАЛИТЬ</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
      {lift ? <QuickLift lift={lift} shift={shift} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: S.border,
    paddingTop: 8,
    paddingHorizontal: space.side,
    gap: 10,
  },
  menu: { position: 'absolute', width: MENU_WIDTH, borderWidth: S.border, padding: 10, gap: 10 },
  menuDelete: { flexGrow: 0, flexBasis: 'auto', height: 36 },
  grabber: { alignSelf: 'center', width: S.grabberWidth, height: S.grabberHeight },
  actions: { flexDirection: 'row', gap: 8, height: 44 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
