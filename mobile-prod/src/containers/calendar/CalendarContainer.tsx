import { PhoneEventSheet } from '@/components/PhoneEventSheet';
import { useStore } from '@/lib/store';
import { signedInOnly } from '../common';
import { DayContainer } from './DayContainer';
import { MonthContainer } from './MonthContainer';
import { WeekContainer } from './WeekContainer';
import { YearContainer } from './YearContainer';
import { CalendarZoom } from './CalendarZoom';

/**
 * Вкладка «Дела» в виде календаря: вид — s.tasksView (список рисует TasksListContainer) (INTEGRATION.md 1.1, 5.1).
 * Без групп сюда не попадают — app/(tabs)/tasks/index.tsx ведёт на онбординг
 */
export const CalendarContainer = signedInOnly(function Calendar() {
  const view = useStore((s) => s.tasksView);
  const zoomView = view === 'list' ? 'week' : view;
  return (
    <>
      <CalendarZoom view={zoomView}>{viewOf(zoomView)}</CalendarZoom>
      <PhoneEventSheet />
    </>
  );
});

const viewOf = (view: 'day' | 'week' | 'month' | 'year') => {
  switch (view) {
    case 'day':
      return <DayContainer />;
    case 'month':
      return <MonthContainer />;
    case 'year':
      return <YearContainer />;
    default:
      return <WeekContainer />;
  }
};
