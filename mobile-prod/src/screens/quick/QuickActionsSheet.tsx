/**
 * Быстрые действия по удержанию (C-QuickTask, C-QuickWish, C-QuickWatch, C-QuickIdea). Презентационный экран поверх
 * всего: затемнение, нижнее окно (ручка, карточка записи, плитки, необязательный ряд «ПЕРЕНЕСТИ» / «В ТЕМУ»,
 * ЗАКРЫТЬ / УДАЛИТЬ) и нажатый элемент, поднятый над затемнением (lift). Окно, как BottomSheet: рамка сверху 1.5,
 * поля 8 / 16 / 18 + safe area, между блоками 10.
 */
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LIFT_GAP, liftFrame, liftShift, size as S, space, type as T, useTheme } from '@/ui';
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
  const shift = lift ? liftShift(liftFrame(lift.rect, lift.shape), sheetTop - LIFT_GAP) : 0;

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
  grabber: { alignSelf: 'center', width: S.grabberWidth, height: S.grabberHeight },
  actions: { flexDirection: 'row', gap: 8, height: 44 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
