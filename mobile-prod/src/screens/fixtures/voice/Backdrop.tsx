/**
 * Упрощённый экран «Дела» под затемнением — как его рисуют макеты голосовых окон
 * (C-Voice, C-Ask*): пустые кнопки панели, заголовок, секция «Сегодня» из 6 строк.
 * Только для стенда сверки и превью; в приложении под окном лежит настоящий экран.
 * nav — нижняя навигация (окно записи лежит над ней): 'held' — REC нажата, как при удержании.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { BottomNav, SectionBox, fonts, size as S, space, type as T, useTheme } from '@/ui';
import { PersonStrip } from '../../voice/components/PersonStrip';

type Row = { title: string; time: string; colors: PersonColor[] };

const ROWS: Row[] = [
  { title: 'Стоматолог', time: '09:30', colors: ['blue'] },
  { title: 'Забрать посылку', time: '—', colors: ['pink'] },
  { title: 'Йога', time: '19:00', colors: ['pink'] },
  { title: 'Подарок Лене', time: '—', colors: ['blue'] },
  { title: 'Сериал', time: '21:00', colors: ['blue', 'pink'] },
  { title: 'Оплатить коммуналку', time: '—', colors: ['blue'] },
];

export const VoiceBackdrop = memo(function VoiceBackdrop({ nav }: { nav?: 'idle' | 'held' }) {
  const { c, person } = useTheme();
  const box = { borderColor: c.border, backgroundColor: c.panel };
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <View style={styles.bar}>
        <View style={[styles.caption, box]}>
          <Text style={[T.caption, { color: c.text }]}>МЫ С КАРИНОЙ</Text>
        </View>
        <View style={[styles.button, box]}>
          <View style={styles.buttonInner} />
        </View>
        <View style={[styles.button, box]}>
          <View style={styles.buttonInner} />
        </View>
        <View style={[styles.button, box, { backgroundColor: person('blue') }]}>
          <View style={styles.buttonInner} />
        </View>
      </View>
      <Text style={[styles.title, T.h1, { color: c.text }]}>Дела</Text>
      <SectionBox title="СЕГОДНЯ" count="ПН 05" style={styles.list}>
        {ROWS.map((r) => (
          <View key={r.title} style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
            <PersonStrip colors={r.colors} />
            <View style={[styles.check, { borderColor: c.border }]} />
            <Text style={[styles.rowTitle, { color: c.text }]}>{r.title}</Text>
            <Text style={[T.rowValue, styles.rowTime, { color: c.text }]}>{r.time}</Text>
          </View>
        ))}
      </SectionBox>
      {nav ? <BottomNav active="tasks" recHeld={nav === 'held'} style={styles.nav} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.side,
    right: space.side,
    top: S.topBarTop,
    height: S.topBarHeight,
    flexDirection: 'row',
    gap: space.barGap,
  },
  caption: { flex: 1, borderWidth: S.border, justifyContent: 'center', paddingHorizontal: 10 },
  /** В макете ширина 40 без рамки (content-box) */
  button: { borderWidth: S.border },
  buttonInner: { width: S.iconButton },
  title: { position: 'absolute', left: space.side, top: S.titleTop },
  list: { position: 'absolute', left: space.side, right: space.side, top: 122 },
  /** 44 + разделитель 1 */
  row: {
    height: S.row + 1,
    borderTopWidth: S.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
  },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border },
  rowTitle: { flex: 1, fontFamily: fonts.sans500, fontSize: 13 },
  rowTime: { letterSpacing: 0 },
  nav: { position: 'absolute', left: space.side, right: space.side, bottom: S.navBottom },
});
