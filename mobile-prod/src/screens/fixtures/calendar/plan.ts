/** Данные макета C-Plan (design/mockups/C-Plan.dc.html): план Карины «Командировка в Казань», 7–9 октября 2026 */
import type { PlanScreenProps, PlanStepEvent } from '../../calendar/PlanScreen';
import { hm } from './people';

const step = (id: string, date: string, a: number, b: number, title: string, note: string, done = false): PlanStepEvent => ({
  id,
  title,
  note,
  date,
  start: hm(a),
  end: hm(b),
  done,
});

export const planSteps: PlanStepEvent[] = [
  step('to-kazan', '2026-10-07', 6, 12, 'Из Москвы в Казань', 'Ласточка, вагон 5', true),
  step('hotel', '2026-10-07', 14, 15, 'Заселение', 'Отель на Баумана'),
  step('meeting', '2026-10-08', 10, 13, 'Встреча с заказчиком', 'Офис на Петербургской'),
  step('team', '2026-10-08', 19, 21, 'Ужин с командой', 'Тюбетей'),
  step('back', '2026-10-09', 9, 15, 'Обратно в Москву', 'Ласточка, вагон 2'),
];

export function planFixture(): PlanScreenProps {
  return {
    caption: 'ПЛАН · МЫ С КАРИНОЙ',
    title: 'Командировка в Казань',
    color: 'pink',
    rangeLabel: '7 ОКТ 06:00 → 9 ОКТ 15:00',
    ownerLabel: 'КАРИНА',
    startDate: '2026-10-07',
    endDate: '2026-10-09',
    steps: planSteps,
  };
}
