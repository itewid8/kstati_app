/**
 * Данные макетов окна плана: C-EditPlan, C-EditPeriod, C-EditYear (design/mockups/*.dc.html).
 * «Командировка в Казань» — план Карины, ср 7 – пт 9 октября 2026; сегодня — пн 5 октября.
 */
import type { PlanEditorScreenProps } from '../../editors/PlanEditorScreen';
import type { PeriodPanelProps } from '../../editors/panels/PeriodPanel';

const karina = { id: 'karina', name: 'КАРИНА', color: 'pink' } as const;

const trip: PlanEditorScreenProps = {
  caption: 'ПЛАН · МЫ С КАРИНОЙ',
  title: 'Командировка в Казань',
  colors: ['pink'],
  color: 'pink',
  period: 'СР 7 ОКТ → ПТ 9 ОКТ',
  repeat: null,
  people: [karina],
  remind: 'НАКАНУНЕ В 20:00',
  expanded: null,
};

const period = (view: 'month' | 'year'): PeriodPanelProps => ({
  edge: 'start',
  startLabel: 'СР 7 ОКТ · 07:00',
  endLabel: 'ПТ 9 ОКТ · 15:00',
  view,
  year: 2026,
  month: 9,
  today: '2026-10-05',
  range: { start: '2026-10-07', end: '2026-10-09', color: 'pink' },
  time: { hour: 7, minute: 0 },
  noTime: false,
});

export function editPlanFixture(): PlanEditorScreenProps {
  return {
    ...trip,
    period: 'СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00',
    note: 'Переговоры с заказчиком. Отель на Баумана, 12',
    subtasks: [
      { id: 's1', title: 'Поезд в Казань', meta: 'СР 7 ОКТ · 07:00–09:00', done: true },
      { id: 's2', title: 'Встреча с заказчиком', meta: 'ЧТ 8 ОКТ · 09:00–15:00', done: false },
      { id: 's3', title: 'Ужин с командой', meta: 'ЧТ 8 ОКТ · 19:00', done: false },
      { id: 's4', title: 'Поезд домой', meta: 'ПТ 9 ОКТ · 13:00–15:00', done: false },
      { id: 's5', title: 'Сувениры маме', meta: 'СБ 10 ОКТ · ВНЕ ДАТ ПЛАНА', done: false, outside: true },
    ],
  };
}

export function editPeriodFixture(): PlanEditorScreenProps {
  return {
    ...trip,
    expanded: 'period',
    periodPanel: period('month'),
    subtaskSummary: '05 · 1 СДЕЛАНО',
    notice: { label: 'ВНЕ ПЕРИОДА', text: '«Сувениры маме» · сб 10 окт', tone: 'warn' },
  };
}

export function editYearFixture(): PlanEditorScreenProps {
  return { ...trip, expanded: 'period', periodPanel: period('year') };
}
