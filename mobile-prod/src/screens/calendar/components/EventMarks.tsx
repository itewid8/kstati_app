/**
 * Значки дела в календаре и списке: сделано (зелёная галочка), тип (день рождения, важный день, путешествие),
 * общее дело, повтор. Маленькие и приглушённые — не мешают читать; зелёная только галочка.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TaskKind } from '@/lib/types';
import { Icon, KIND_ICON, useTheme } from '@/ui';

export type EventMarksProps = {
  done?: boolean;
  kind?: TaskKind;
  plan?: boolean;
  repeat?: boolean;
  size: number;
  /** Высота строки, по которой значки центрируются */
  lineHeight: number;
  /** Цвет значков (по умолчанию muted) */
  color?: string;
};

export const hasMarks = (p: Pick<EventMarksProps, 'done' | 'kind' | 'plan' | 'repeat'>) => !!(p.done || (p.kind && p.kind !== 'task') || p.plan || p.repeat);

export const EventMarks = memo(function EventMarks({ done, kind, plan, repeat, size, lineHeight, color }: EventMarksProps) {
  const { c, person } = useTheme();
  if (!hasMarks({ done, kind, plan, repeat })) return null;
  const ink = color ?? c.muted;
  return (
    <View style={[styles.row, { height: lineHeight }]}>
      {done ? <Icon name="check" size={size} color={person('green')} /> : null}
      {kind && kind !== 'task' ? <Icon name={KIND_ICON[kind]} size={size} color={ink} /> : null}
      {plan ? <Icon name="plan" size={size} color={ink} /> : null}
      {repeat ? <Icon name="repeat" size={size} color={ink} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
});
