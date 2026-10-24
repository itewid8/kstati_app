/** Данные и фон рабочего стола макетов C-WidgetHome / C-WidgetLarge / C-WidgetSettings */
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_WIDGET_PREFS, faceColors, type FaceColors } from '@/lib/widgetData';
import { Wallpaper } from '@/screens/widget/Wallpaper';
import type { FaceDay, FaceHeader, FaceItem } from '@/screens/widget/WidgetFace';
import { fonts, type Scheme } from '@/ui';

const PEOPLE = { light: { s: '#2F6BDB', k: '#E2407E' }, dark: { s: '#5B8DEF', k: '#F06A9B' } } as const;

export const faceOf = (theme: Scheme, opacity = DEFAULT_WIDGET_PREFS.opacity): FaceColors => faceColors({ ...DEFAULT_WIDGET_PREFS, opacity }, theme);

export const strips = (theme: Scheme) => {
  const p = PEOPLE[theme];
  return { s: [p.s], k: [p.k], sk: [p.s, p.k] } as const;
};

export const HEAD_BOTH: FaceHeader = { label: 'МЫ С КАРИНОЙ · СЕМЬЯ', weekday: 'СБ', day: '24' };
export const HEAD_ALL: FaceHeader = { label: 'ВСЕ ГРУППЫ', weekday: 'СБ', day: '24' };
export const HEAD_FAMILY: FaceHeader = { label: 'СЕМЬЯ', weekday: 'СБ', day: '24' };

export const days4x2 = (t: Scheme): FaceDay[] => {
  const st = strips(t);
  return [
    { key: 'd25', label: 'ВС 25 · ЗАВТРА', rows: [{ key: 'a', title: 'Аренда Воронеж', time: '—', strip: st.k }] },
    { key: 'd28', label: 'СР 28', rows: [{ key: 'f', title: 'Футбол', time: '18:00', strip: st.k }] },
    { key: 'd1', label: 'ВС 1 НОЯ', rows: [{ key: 'b', title: 'Купить билет в Врн', time: '—', strip: st.s }] },
  ];
};

export const days4x4 = (t: Scheme): FaceDay[] => {
  const st = strips(t);
  return [
    {
      key: 'd24',
      label: 'СБ 24 · СЕГОДНЯ',
      rows: [
        { key: 'p', title: 'Полить цветы', time: '—', strip: st.s, done: true },
        { key: 'u', title: 'Ужин у родителей', time: '19:00', strip: st.sk },
      ],
    },
    ...days4x2(t).slice(0, 2),
    { key: 'd1', label: 'ВС 1 НОЯ', rows: [{ key: 'b', title: 'Купить билет в Врн', time: '—', strip: st.s }] },
    { key: 'd4', label: 'СР 4 НОЯ', rows: [{ key: 'm', title: 'Купить билет обратно в Мск', time: '—', strip: st.s }] },
  ];
};

export const items2x2 = (t: Scheme): FaceItem[] => {
  const st = strips(t);
  return [
    { key: 'a', title: 'Аренда Воронеж', when: 'ЗАВТРА', strip: st.k },
    { key: 'f', title: 'Футбол', when: 'СР 28', strip: st.k },
    { key: 'd', title: 'Стоматолог', when: 'ЧТ 29', strip: st.s },
    { key: 'b', title: 'Купить билет в Врн', when: '1 НОЯ', strip: st.s },
    { key: 'm', title: 'Купить билет обратно в Мск', when: '4 НОЯ', strip: st.s },
  ];
};

const HOME = {
  light: { onWp: '#111111', icon: 'rgba(255,255,255,0.55)', dock: 'rgba(255,255,255,0.35)' },
  dark: { onWp: '#F2F2F0', icon: 'rgba(255,255,255,0.12)', dock: 'rgba(255,255,255,0.08)' },
} as const;

/** Колонки сетки рабочего стола: 4 по 82, шаг 92 */
export const GRID_X = [16, 108, 200, 292] as const;
export const cells = (n: number) => 82 * n + 10 * (n - 1);

/** Обои, строка состояния, два ряда значков (по y) и док */
export function HomeBackdrop({ theme, iconRows }: { theme: Scheme; iconRows: readonly number[] }) {
  const h = HOME[theme];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Wallpaper dark={theme === 'dark'} />
      <View style={styles.status}>
        <Text style={[styles.statusText, { color: h.onWp }]}>00:59</Text>
        <Text style={[styles.statusText, { color: h.onWp }]}>34%</Text>
      </View>
      {iconRows.map((y) =>
        GRID_X.map((x) => <View key={`${y}-${x}`} style={[styles.icon, { left: x + 13, top: y, backgroundColor: h.icon }]} />),
      )}
      <View style={[styles.dock, { backgroundColor: h.dock }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { position: 'absolute', left: 24, right: 24, top: 14, flexDirection: 'row', justifyContent: 'space-between' },
  statusText: { fontFamily: fonts.mono600, fontSize: 12 },
  icon: { position: 'absolute', width: 56, height: 56, borderRadius: 16 },
  dock: { position: 'absolute', left: 16, right: 16, bottom: 26, height: 76, borderRadius: 28 },
});
