/**
 * Окно записи голосовой команды и разбора (без макета, в стиле C-Voice). Лежит над нижней навигацией, а не поверх неё:
 * кнопка REC остаётся видна и нажимается — в затемнении над ней прорезь.
 *   hold (палец на REC): шапка «REC 00:04» + волна; на месте кнопок разделов — полоса «‹ ОТМЕНА», она едет за пальцем.
 *     Кнопок нет: отпустить — готово, увести палец влево или вверх — отмена.
 *   tap: шапка и кнопки ОТМЕНА / ГОТОВО (REC ещё раз — тоже ГОТОВО).
 *   Разбор (header.live = false): записанная волна, «…» и только ОТМЕНА; затемнение сплошное.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { dragProgress } from '@/adapters/voice/recording';
import { fonts, size as S, space, type as T, useTheme } from '@/ui';
import type { RecDrag } from '@/ui/BottomNav';
import { SheetActions } from './components/SheetActions';
import { VoiceHeader } from './components/VoiceHeader';
import type { RecordingMode, SheetAction, VoiceSheetHeader } from './types';

export type RecordingSheetProps = {
  /** live — идёт запись; иначе разбор */
  header: VoiceSheetHeader;
  mode: RecordingMode;
  /** Ряд кнопок; пусто — без ряда (запись пальцем) */
  actions: readonly SheetAction[];
  /** Сдвиг пальца на REC (UI-поток): «‹ ОТМЕНА» едет за ним. Нет — стоит на месте */
  drag?: RecDrag | null;
  bottomInset?: number;
  /** Нажатие на затемнение */
  onClose?: () => void;
};

/** Зазор между сеткой разделов и REC в BottomNav, между окном и навигацией */
const GAP = 8;
/** На сколько «‹ ОТМЕНА» блекнет у порога отмены */
const FADE = 0.65;

/** «‹ ОТМЕНА» в полосе на месте кнопок разделов: едет влево за пальцем и блекнет к порогу */
const CancelTrack = memo(function CancelTrack({ drag, bottom }: { drag?: RecDrag | null; bottom: number }) {
  const { c } = useTheme();
  const label = useAnimatedStyle(() => {
    const x = drag ? drag.x.value : 0;
    const y = drag ? drag.y.value : 0;
    return { opacity: 1 - FADE * dragProgress(x, y), transform: [{ translateX: x }] };
  });
  return (
    <View
      pointerEvents="none"
      style={[styles.track, { bottom, borderColor: c.border, backgroundColor: c.panel }]}
    >
      <Animated.View style={label}>
        <Text style={[T.action, { color: c.text }]}>‹ ОТМЕНА</Text>
      </Animated.View>
    </View>
  );
});

export const RecordingSheet = memo(function RecordingSheet({
  header,
  mode,
  actions,
  drag,
  bottomInset = 0,
  onClose,
}: RecordingSheetProps) {
  const { c } = useTheme();
  const live = header.live === true;
  /** Низ навигации и её верх (над ним — окно) */
  const navBottom = bottomInset + S.navBottom;
  const navTop = navBottom + S.navHeight;
  const scrim = { backgroundColor: c.scrim };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {live ? (
        <>
          {/* Затемнение с прорезью над REC: четыре куска вокруг кнопки */}
          <Pressable accessibilityRole="button" accessibilityLabel="Отмена" onPress={onClose} style={[styles.above, scrim, { bottom: navTop }]} />
          <Pressable onPress={onClose} style={[styles.below, scrim, { height: navBottom }]} />
          <Pressable onPress={onClose} style={[styles.beside, scrim, { bottom: navBottom }]} />
          <Pressable onPress={onClose} style={[styles.edge, scrim, { bottom: navBottom }]} />
        </>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Отмена" onPress={onClose} style={[StyleSheet.absoluteFill, scrim]} />
      )}
      {live && mode === 'hold' ? <CancelTrack drag={drag} bottom={navBottom} /> : null}
      <View style={[styles.sheet, { bottom: navTop + GAP, borderColor: c.border, backgroundColor: c.bg }]}>
        <VoiceHeader header={header} />
        {live ? null : <Text style={[styles.wait, { color: c.text }]}>…</Text>}
        {actions.length ? <SheetActions actions={actions} /> : null}
      </View>
    </View>
  );
});

/** Правый край сетки разделов: поле экрана + REC + зазор */
const GRID_RIGHT = space.side + S.recWidth + GAP;

const styles = StyleSheet.create({
  above: { position: 'absolute', left: 0, right: 0, top: 0 },
  below: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /** Слева от REC: сетка разделов и поле экрана */
  beside: { position: 'absolute', left: 0, right: space.side + S.recWidth, height: S.navHeight },
  /** Справа от REC: поле экрана */
  edge: { position: 'absolute', right: 0, width: space.side, height: S.navHeight },
  track: {
    position: 'absolute',
    left: space.side,
    right: GRID_RIGHT,
    height: S.navHeight,
    borderWidth: S.border,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 18,
  },
  sheet: {
    position: 'absolute',
    left: space.side,
    right: space.side,
    borderWidth: S.border,
    padding: 12,
    gap: 10,
  },
  wait: { fontFamily: fonts.sans600, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
});
