/** Виджет: раскладки на рабочем столе (C-WidgetHome, C-WidgetLarge) и окно настроек (C-WidgetSettings) */
import { StyleSheet, View } from 'react-native';
import {
  GRID_X,
  HEAD_ALL,
  HEAD_BOTH,
  HEAD_FAMILY,
  HomeBackdrop,
  cells,
  days4x2,
  days4x4,
  faceOf,
  items2x2,
} from '@/screens/fixtures/widget';
import { WidgetSettingsScreen } from '@/screens/widget/WidgetSettingsScreen';
import { FaceDays, FaceNext, FaceRec, FaceStack } from '@/screens/widget/WidgetFace';
import { DEFAULT_WIDGET_PREFS } from '@/lib/widgetData';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };
const at = (left: number, top: number) => ({ position: 'absolute' as const, left, top });

export const screens = {
  'C-WidgetHome': ({ theme }: Props) => {
    const c = faceOf(theme);
    const items = items2x2(theme);
    return (
      <View style={StyleSheet.absoluteFill}>
        <HomeBackdrop theme={theme} iconRows={[500, 590]} />
        <FaceDays style={at(GRID_X[0], 52)} width={cells(4)} height={210} c={c} header={HEAD_BOTH} days={days4x2(theme)} />
        <FaceStack style={at(GRID_X[0], 282)} width={cells(2)} height={182} c={c} header={HEAD_ALL} items={items} />
        <FaceNext style={at(GRID_X[2], 282)} width={cells(2)} height={82} c={c} item={items[0] ?? null} />
        <FaceRec style={at(GRID_X[2], 382)} size={82} c={c} />
      </View>
    );
  },
  'C-WidgetLarge': ({ theme }: Props) => {
    const c = faceOf(theme);
    return (
      <View style={StyleSheet.absoluteFill}>
        <HomeBackdrop theme={theme} iconRows={[660]} />
        <FaceDays style={at(GRID_X[0], 52)} width={cells(4)} height={374} c={c} header={HEAD_BOTH} days={days4x4(theme)} fade />
        <FaceDays style={at(GRID_X[0], 446)} width={cells(4)} height={182} c={c} header={HEAD_FAMILY} days={[]} />
      </View>
    );
  },
  'C-WidgetSettings': ({ theme }: Props) => (
    <WidgetSettingsScreen
      prefs={{ ...DEFAULT_WIDGET_PREFS, opacity: 0.7, groups: ['g1', 'g2'] }}
      size="4x2"
      preview={{ header: HEAD_BOTH, days: days4x2(theme).slice(0, 2), items: items2x2(theme), dark: theme === 'dark' }}
      groups={[
        { id: 'g1', name: 'Мы с Кариной' },
        { id: 'g2', name: 'Семья' },
        { id: 'g3', name: 'Работа' },
      ]}
      canSave
      insets={{ top: 0, bottom: 0 }}
    />
  ),
};
