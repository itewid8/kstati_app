/**
 * Каркас экранов календаря: верхняя панель (группа, список, +, лента, профиль), переключатель вида (top 68),
 * строка периода (top 104, h 40), содержимое и нижняя навигация. Размер экрана меряется onLayout —
 * сетка часов вписывается в высоту без прокрутки (видимые часы подстраиваются под дела).
 */
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { BottomNav, TopBar, size as S, space, useTheme, type TopBarAction } from '@/ui';
import type { CalendarChromeProps, CalendarView } from '../types';
import { ViewSwitch } from './ViewSwitch';

/** Вертикальная сетка экрана календаря (макеты C-Day/Week/Month/Year) */
export const CAL = {
  viewTop: 68,
  periodTop: 104,
  periodHeight: 40,
  /** Левый край сетки часов (подписи часов слева) и правое поле под вкладки людей */
  gridLeft: 44,
  gridRight: 26,
  hourLabelLeft: 14,
} as const;

export const NO_INSETS = { top: 0, bottom: 0 };

export type ScreenSize = { width: number; height: number };

/** Размер экрана: сначала окно, потом настоящий размер корня из onLayout */
export function useScreenSize(): [ScreenSize, (e: LayoutChangeEvent) => void] {
  const win = useWindowDimensions();
  const [size, setSize] = useState<ScreenSize | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return [size ?? { width: win.width, height: win.height }, onLayout];
}

type Props = CalendarChromeProps & {
  view: CalendarView;
  /** Строка периода: заголовок, стрелки, «СЕГОДНЯ» */
  period: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: ReactNode;
};

export const CalendarScaffold = memo(function CalendarScaffold(props: Props) {
  const {
    view,
    period,
    onLayout,
    children,
    groupLabel,
    me,
    hasNews,
    insets = NO_INSETS,
    onOpenGroup,
    onOpenList,
    onAdd,
    onOpenFeed,
    onOpenSettings,
    onChangeView,
    onNavigate,
    onRec,
  } = props;
  const { c, person, personInk } = useTheme();

  const actions = useMemo<TopBarAction[]>(
    () => [
      { key: 'list', icon: 'list', accessibilityLabel: 'Список', onPress: onOpenList },
      { key: 'add', icon: 'plus', accessibilityLabel: 'Добавить', onPress: onAdd },
      { key: 'feed', icon: 'bell', accessibilityLabel: 'Лента', onPress: onOpenFeed, badge: hasNews },
      {
        key: 'me',
        letter: me.letter,
        fill: person(me.color),
        ink: personInk(me.color),
        accessibilityLabel: 'Настройки',
        onPress: onOpenSettings,
      },
    ],
    [onOpenList, onAdd, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk],
  );
  const lead = useMemo(() => ({ kind: 'group' as const, label: groupLabel, onPress: onOpenGroup }), [groupLabel, onOpenGroup]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]} onLayout={onLayout}>
      {children}
      <TopBar lead={lead} actions={actions} style={[styles.side, { top: insets.top + S.topBarTop }]} />
      <ViewSwitch value={view} onChange={onChangeView} style={[styles.side, { top: insets.top + CAL.viewTop }]} />
      <View style={[styles.side, styles.period, { top: insets.top + CAL.periodTop }]}>{period}</View>
      <BottomNav active="tasks" onSelect={onNavigate} onRec={onRec} style={[styles.side, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  side: { position: 'absolute', left: space.side, right: space.side },
  period: { height: CAL.periodHeight, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
