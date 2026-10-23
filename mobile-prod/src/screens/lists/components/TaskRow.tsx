/**
 * Строка «Дел» (C-List). Три вида:
 *  task — дело 44px, название 13/500;
 *  plan — шапка плана 44px, 13/600, заливка цветом плана;
 *  step — шаг плана 36px, отступ 26, 12/500, та же заливка.
 * Галочка без знака: отмеченное — квадрат, залитый цветом текста (как в макете).
 * Кандидаты в src/ui: Checkbox с mark={false} и emptyFill="none"; полоса из двух цветов уже есть в ListRow.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LONG_PRESS_MS, Marquee, fonts, size as S, useLift, useTheme, type LiftHandler } from '@/ui';

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
  onToggle?: () => void;
  onPress?: () => void;
  /** Удержание: строка отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
  style?: StyleProp<ViewStyle>;
};

const STEP_HEIGHT = 36;
/** Копия поднятой строки: без разделителя сверху (вокруг — рамка) */
const LIFTED: ViewStyle = { borderTopWidth: 0 };

export const TaskRow = memo(function TaskRow(props: Props) {
  const { kind, title, time, strip, fill, done, onToggle, onPress, onLongPress, style } = props;
  const { c } = useTheme();
  const step = kind === 'step';
  const ink = done ? c.muted : c.text;
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
      {typeof strip === 'string' ? (
        <View style={[styles.strip, { backgroundColor: strip }]} />
      ) : (
        <View style={styles.strip}>
          <View style={[styles.half, { backgroundColor: strip[0] }]} />
          <View style={[styles.half, { backgroundColor: strip[1] }]} />
        </View>
      )}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel="Готово"
        onPress={onToggle}
        hitSlop={4}
        style={styles.tap}
      >
        <View style={[styles.box, { borderColor: c.border, backgroundColor: done ? c.text : 'transparent' }]} />
      </Pressable>
      <Marquee
        style={[
          step ? styles.stepTitle : styles.title,
          kind === 'plan' && styles.planTitle,
          { color: ink },
          done && styles.done,
        ]}
      >
        {title}
      </Marquee>
      <Text style={[styles.time, step && styles.stepTime, { color: ink }]}>{time}</Text>
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
  tap: { width: S.checkTap, height: S.checkTap, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  box: { width: S.checkbox, height: S.checkbox, borderWidth: S.border },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 13, lineHeight: 16 },
  planTitle: { fontFamily: fonts.sans600 },
  stepTitle: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 12, lineHeight: 16 },
  done: { textDecorationLine: 'line-through' },
  time: { fontFamily: fonts.mono600, fontSize: 12, letterSpacing: -0.24 },
  stepTime: { fontSize: 11, letterSpacing: -0.22 },
});
