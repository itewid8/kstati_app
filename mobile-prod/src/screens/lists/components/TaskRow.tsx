/**
 * Строка «Дел» (C-List). Три вида:
 *  task — дело 44px, название 13/500;
 *  plan — шапка плана 44px, 13/600, заливка цветом плана;
 *  step — шаг плана 36px, отступ 26, 12/500, та же заливка.
 * Отметка — общий Checkbox: залитый квадрат с галочкой, «щёлкает» при нажатии; строка на миг подсвечивается,
 * название зачёркивается — дело остаётся на месте (полоса из двух цветов есть и в ListRow).
 */
import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { TaskKind } from '@/lib/types';
import { Checkbox, Hatch, Icon, KIND_ICON, LONG_PRESS_MS, Marquee, fonts, size as S, useLift, useTheme, type LiftHandler } from '@/ui';

export type TaskRowKind = 'task' | 'plan' | 'step';

type Props = {
  kind: TaskRowKind;
  title: string;
  /** Справа моноширинным: «09:30», «—», «7—9», «СР 06» */
  time: string;
  /** Полоса слева: цвет человека; два — общее (верх/низ) */
  strip: string | readonly [string, string];
  /** Заливка строки (план и его шаги); по умолчанию panel */
  fill?: string;
  done: boolean;
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
  /** Тип дела и повтор — значки после названия (приглушённые) */
  taskType?: TaskKind;
  repeat?: boolean;
  onToggle?: () => void;
  /** Режим выбора: отмечена ли строка (квадрат — выбор, а не «готово»); undefined — выбора нет */
  selected?: boolean;
  /** План: раскрыт ли (подзадачи под ним) — справа стрелка; undefined — стрелки нет */
  expanded?: boolean;
  onExpand?: () => void;
  onPress?: () => void;
  /** Удержание: строка отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
  style?: StyleProp<ViewStyle>;
};

const STEP_HEIGHT = 36;
/** Копия поднятой строки: без разделителя сверху (вокруг — рамка) */
const LIFTED: ViewStyle = { borderTopWidth: 0 };
/** Подсветка строки после отметки: вспышка цветом текста и затухание */
const FLASH = 0.12;
const FLASH_MS = 700;

/** Вспышка при отметке «сделано» (не при первом показе и не при снятии) */
function useDoneFlash(done: boolean) {
  const flash = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!done) return;
    flash.value = FLASH;
    flash.value = withTiming(0, { duration: FLASH_MS });
  }, [done, flash]);
  return useAnimatedStyle(() => ({ opacity: flash.value }));
}

export const TaskRow = memo(function TaskRow(props: Props) {
  const { kind, title, time, strip, fill, done, hidden, onToggle, onPress, onLongPress, style } = props;
  const { c, person } = useTheme();
  const step = kind === 'step';
  const ink = done ? c.muted : c.text;
  const flash = useDoneFlash(done);
  const lift = useLift(onLongPress, 'row', () => <TaskRow {...props} onToggle={undefined} onPress={undefined} onLongPress={undefined} style={[style, LIFTED]} />);
  return (
    <Pressable
      ref={lift.ref}
      onPress={onPress}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      disabled={!onPress && !lift.onLongPress}
      style={[
        styles.row,
        step ? styles.stepRow : styles.taskRow,
        { backgroundColor: fill ?? c.panel, borderTopColor: c.hair },
        style,
      ]}
    >
      {hidden ? <Hatch /> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.text }, flash]} />
      {typeof strip === 'string' ? (
        <View style={[styles.strip, { backgroundColor: strip }]} />
      ) : (
        <View style={styles.strip}>
          <View style={[styles.half, { backgroundColor: strip[0] }]} />
          <View style={[styles.half, { backgroundColor: strip[1] }]} />
        </View>
      )}
      <Checkbox
        checked={props.selected ?? done}
        onPress={onToggle}
        accessibilityLabel={props.selected !== undefined ? 'Выбрать' : 'Готово'}
        emptyFill="none"
        checkedFill={props.selected !== undefined ? undefined : person('green')}
      />
      <View style={styles.titleBox}>
        <Marquee
          style={[
            step ? styles.stepTitle : styles.title,
            styles.titleShrink,
            kind === 'plan' && styles.planTitle,
            { color: ink },
            done && styles.done,
          ]}
        >
          {title}
        </Marquee>
        {props.taskType && props.taskType !== 'task' ? <Icon name={KIND_ICON[props.taskType]} size={11} color={c.muted} /> : null}
        {props.repeat ? <Icon name="repeat" size={11} color={c.muted} /> : null}
      </View>
      <Text style={[styles.time, step && styles.stepTime, { color: ink }]}>{time}</Text>
      {props.expanded !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.expanded ? 'Свернуть подзадачи' : 'Показать подзадачи'}
          accessibilityState={{ expanded: props.expanded }}
          onPress={props.onExpand}
          hitSlop={10}
          style={styles.expand}
        >
          <Icon name={props.expanded ? 'chevronUp' : 'chevronDown'} size={12} color={ink} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    borderTopWidth: S.hairline,
  },
  taskRow: { height: S.row, paddingLeft: 6 },
  stepRow: { height: STEP_HEIGHT, paddingLeft: 26 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  half: { flex: 1 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 13, lineHeight: 16 },
  planTitle: { fontFamily: fonts.sans600 },
  stepTitle: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 12, lineHeight: 16 },
  done: { textDecorationLine: 'line-through' },
  titleBox: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleShrink: { flex: 0, flexShrink: 1 },
  expand: { width: 22, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  time: { fontFamily: fonts.mono600, fontSize: 12, letterSpacing: -0.24 },
  stepTime: { fontSize: 11, letterSpacing: -0.22 },
});
