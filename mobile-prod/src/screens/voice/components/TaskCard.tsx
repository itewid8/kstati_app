import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import type { VoiceTaskCard } from '../types';
import { PersonStrip } from './PersonStrip';

type Props = {
  task: VoiceTaskCard;
  /** Название зачёркнуто (дело удаляется) */
  struck?: boolean;
};

/** Карточка дела, о котором команда: полоса цвета людей, название, ярлык справа, подпись */
export const TaskCard = memo(function TaskCard({ task, struck = false }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.panel }]}>
      <PersonStrip colors={task.colors} />
      <View style={styles.top}>
        <Text style={[styles.title, { color: c.text }, struck && styles.struck]}>{task.title}</Text>
        {task.tag ? <Text style={[styles.tag, { color: c.muted }]}>{task.tag}</Text> : null}
      </View>
      <Text style={[styles.meta, { color: c.muted }]}>{task.meta}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: S.border, paddingTop: 9, paddingBottom: 9, paddingLeft: 12, paddingRight: 10, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: fonts.sans600, fontSize: 15 },
  struck: { textDecorationLine: 'line-through' },
  tag: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.51 },
  meta: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.19 },
});
