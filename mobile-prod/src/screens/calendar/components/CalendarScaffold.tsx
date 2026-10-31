/**
 * Каркас экранов календаря: верхняя панель (группа, список, +, лента, профиль), переключатель вида (top 68),
 * строка периода (top 104, h 40), содержимое и нижняя навигация. Размер экрана меряется onLayout —
 * сетка часов вписывается в высоту без прокрутки (видимые часы подстраиваются под дела).
 *
 * Содержимое вида можно обернуть (CalendarContentWrap — даёт контейнер): щипок между видами масштабирует
 * только содержимое, панели стоят. Вкладки людей (overlay) — поверх содержимого и тоже не масштабируются.
 */
import { createContext, memo, useCallback, useContext, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GRID, type ViewFrame } from '@/lib/calendarLayout';
import { BottomNav, TopBar, size as S, space, useTheme, type TopBarAction } from '@/ui';
import type { CalendarChromeProps, CalendarView } from '../types';
import { ViewSwitch, type TasksSwitchValue } from './ViewSwitch';

/** Вертикальная сетка экрана календаря (макеты C-Day/Week/Month/Year) */
export const CAL = {
  viewTop: 116,
  periodTop: 68,
  periodHeight: 40,
  /** Левый край сетки часов (подписи часов слева) и правое поле под вкладки людей */
  gridLeft: GRID.left,
  gridRight: GRID.right,
  hourLabelLeft: 14,
} as const;

export const NO_INSETS = { top: 0, bottom: 0 };

export type ScreenSize = { width: number; height: number };

/** Кадр вида для общей геометрии (viewGeometry): снизу — навигация и safe area */
export const frameOf = (size: ScreenSize, insets: { top: number; bottom: number }): ViewFrame => ({
  width: size.width,
  height: size.height,
  top: insets.top,
  bottom: insets.bottom + S.contentBottom,
});

/** Обёртка содержимого вида (на весь экран, касания насквозь); нет — содержимое без обёртки */
export type CalendarContentWrapper = ComponentType<{ children?: ReactNode }>;
export const CalendarContentWrap = createContext<CalendarContentWrapper | null>(null);

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
  /** Поверх содержимого, вне масштаба щипка: вкладки людей */
  overlay?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: ReactNode;
};

export const CalendarScaffold = memo(function CalendarScaffold(props: Props) {
  const {
    view,
    period,
    overlay,
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
    phoneOn,
    onTogglePhone,
  } = props;
  const { c, person, personInk } = useTheme();
  const Wrap = useContext(CalendarContentWrap);

  const actions = useMemo<TopBarAction[]>(
    () => [
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
    [onAdd, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk],
  );
  const lead = useMemo(() => ({ kind: 'group' as const, label: groupLabel, onPress: onOpenGroup }), [groupLabel, onOpenGroup]);
  const changeView = useCallback(
    (v: TasksSwitchValue) => (v === 'list' ? onOpenList?.() : onChangeView?.(v)),
    [onOpenList, onChangeView],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]} onLayout={onLayout}>
      {Wrap ? <Wrap>{children}</Wrap> : children}
      {overlay}
      <TopBar lead={lead} actions={actions} style={[styles.side, { top: insets.top + S.topBarTop }]} />
      <ViewSwitch
        value={view}
        onChange={changeView}
        phoneOn={phoneOn}
        onTogglePhone={onTogglePhone}
        style={[styles.side, { top: insets.top + CAL.viewTop }]}
      />
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
