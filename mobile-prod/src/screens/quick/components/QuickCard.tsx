import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marquee, fonts, size as S, useTheme } from '@/ui';
import { PersonStrip } from '../../voice/components/PersonStrip';
import type { QuickCard as Card } from '../types';

/** Карточка записи в окне быстрых действий: полоса цвета людей, название и ярлык в строку, подпись */
export const QuickCard = memo(function QuickCard({ card }: { card: Card }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.panel }]}>
      <PersonStrip colors={card.colors} />
      <View style={styles.top}>
        <Marquee style={[styles.title, { color: c.text }]}>{card.title}</Marquee>
        {card.tag ? <Marquee style={[styles.tag, { color: c.muted }]}>{card.tag}</Marquee> : null}
      </View>
      <Marquee style={[styles.meta, { color: c.muted }]}>{card.meta}</Marquee>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: S.border, paddingTop: 9, paddingBottom: 9, paddingLeft: 12, paddingRight: 10, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans600, fontSize: 15 },
  tag: { flexShrink: 1, maxWidth: '50%', fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.51 },
  meta: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.19 },
});
