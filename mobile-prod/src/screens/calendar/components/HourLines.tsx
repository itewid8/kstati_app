/**
 * Сетка часов: линия 1px на начале каждого видимого часа и подпись «08» слева (top линии + 2).
 * Линия на конце последнего часа не рисуется — как в макетах C-Week / C-Day / C-Plan.
 */
import { memo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { fonts, useTheme } from '@/ui';
import { pad2 } from '../format';

type Props = {
  /** Верх сетки (линия первого часа), px экрана */
  top: number;
  hourPx: number;
  h0: number;
  hEnd: number;
  /** Отступы линий от краёв экрана */
  lineLeft: number;
  lineRight: number;
  labelLeft: number;
  /** Подпись: по умолчанию моно 9 */
  labelStyle?: TextStyle;
};

export const HourLines = memo(function HourLines({ top, hourPx, h0, hEnd, lineLeft, lineRight, labelLeft, labelStyle }: Props) {
  const { c } = useTheme();
  const out = [];
  for (let h = h0; h < hEnd; h++) {
    const y = top + (h - h0) * hourPx;
    out.push(
      <View key={`l${h}`} pointerEvents="none" style={[styles.line, { top: y, left: lineLeft, right: lineRight, backgroundColor: c.hair }]} />,
      <Text key={`t${h}`} style={[styles.label, labelStyle, { top: y + 2, left: labelLeft, color: c.muted }]}>
        {pad2(h)}
      </Text>,
    );
  }
  return <>{out}</>;
});

const styles = StyleSheet.create({
  line: { position: 'absolute', height: 1 },
  label: { position: 'absolute', fontFamily: fonts.mono400, fontSize: 9 },
});
