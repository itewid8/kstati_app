/**
 * Живое превью виджета в настройках: та же раскладка, что у Android-виджета (KstatiWidget.kt, «высокий» вид) —
 * шапка (группа и сегодня), строки дел с полосой людей, время справа, квадратная кнопка REC.
 * Под виджетом — кусок обоев, чтобы была видна прозрачность фона. REC — полоса под списком, как на рабочем столе.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StripColor, WidgetColors } from '@/lib/widgetData';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Marquee, fonts, size as S } from '@/ui';

export type PreviewRow = { key: string; title: string; day: string | null; time: string; strip: readonly StripColor[] };
export type PreviewHeader = { label: string; weekday: string; day: string };

type Props = { colors: WidgetColors; header: PreviewHeader; rows: readonly PreviewRow[]; dark: boolean };

/** Кусок «обоев» рабочего стола: на нём видно, как ляжет виджет с прозрачным фоном */
const Wallpaper = memo(function Wallpaper({ dark }: { dark: boolean }) {
  const [top, bottom] = dark ? ['#1B2433', '#3A2A3F'] : ['#9EC3E6', '#F2C9A8'];
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="360" height="220" fill="url(#sky)" />
      <Circle cx="290" cy="40" r="26" fill={dark ? '#E9E2C9' : '#FFF4D6'} opacity={0.9} />
      <Path d="M0 170 Q 70 120 140 160 T 280 150 T 360 140 L 360 220 L 0 220 Z" fill={dark ? '#24303A' : '#7FA98C'} />
      <Path d="M0 195 Q 90 165 180 190 T 360 180 L 360 220 L 0 220 Z" fill={dark ? '#151C22' : '#4F7D62'} />
    </Svg>
  );
});

export const WidgetPreview = memo(function WidgetPreview({ colors: c, header, rows, dark }: Props) {
  return (
    <View style={styles.stage}>
      <Wallpaper dark={dark} />
      <View style={styles.widget}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card, opacity: c.alpha }]} />
        <View style={[styles.box, { borderColor: c.border }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.panel, opacity: c.alpha }]} />
          <View style={[styles.head, { backgroundColor: c.headBg }]}>
            <Marquee style={[styles.headText, styles.headLabel, { color: c.headInk }]}>{header.label}</Marquee>
            <Text style={[styles.headText, { color: c.headInk }]}>{header.weekday}</Text>
            <View style={[styles.today, { backgroundColor: c.today }]}>
              <Text style={[styles.headText, { color: c.todayInk }]}>{header.day}</Text>
            </View>
          </View>
          {rows.length === 0 ? (
            <View style={[styles.row, { borderTopColor: c.hair }]}>
              <Text style={[styles.title, { color: c.empty }]}>—</Text>
            </View>
          ) : (
            rows.map((r) => (
              <View key={r.key} style={[styles.row, { borderTopColor: c.hair }]}>
                <View style={styles.strip}>
                  {r.strip.map((s, i) => (
                    <View key={i} style={[styles.stripPart, { backgroundColor: dark ? s[1] : s[0] }]} />
                  ))}
                </View>
                <Marquee style={[styles.title, { color: c.title }]}>{r.title}</Marquee>
                {r.day ? <Text style={[styles.day, { color: c.day }]}>{r.day}</Text> : null}
                <Text style={[styles.time, { color: c.time }]}>{r.time}</Text>
              </View>
            ))
          )}
        </View>
        {c.showMic ? (
          <View style={[styles.rec, { backgroundColor: c.recFill, borderColor: c.recBorder }]}>
            <View style={[styles.recGlow, { backgroundColor: c.recDot }]} />
            <View style={[styles.recDot, { backgroundColor: c.recDot }]} />
            <Text style={[styles.recText, { color: c.recInk }]}>REC</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { height: 220, overflow: 'hidden', padding: 18, justifyContent: 'center' },
  widget: { padding: 10, gap: 8, overflow: 'hidden' },
  box: { borderWidth: S.border, overflow: 'hidden' },
  head: { height: 22, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  headLabel: { flex: 1 },
  today: { paddingHorizontal: 4, height: 16, justifyContent: 'center' },
  row: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8, borderTopWidth: 1 },
  strip: { width: 1.5, alignSelf: 'stretch' },
  stripPart: { flex: 1 },
  title: { flex: 1, fontFamily: fonts.sans500, fontSize: 12 },
  day: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.4 },
  time: { fontFamily: fonts.mono600, fontSize: 11 },
  // Как kstati_rec_bar.xml: полоса во всю ширину под списком, точка со свечением и «REC» в строку
  rec: { height: 36, borderWidth: S.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  recGlow: { position: 'absolute', width: 18, height: 18, borderRadius: 9, opacity: 0.25, left: '50%', marginLeft: -24 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recText: { fontFamily: fonts.mono600, fontSize: 8, letterSpacing: 0.8 },
});
