/**
 * Дела из макетов календаря (design/mockups/C-Day, C-Week, C-Month, C-Plan) — для тестов адаптеров calendar/*
 * (только *.test.ts, приложение этот файл не импортирует). Сегодня понедельник 2026-10-05, 17:52.
 * Макеты между собой не согласованы (в неделе и дне в понедельник разные дела), поэтому у каждого вида свой набор.
 */
import type { Group, Task } from '@/lib/types';
import { planFixture } from '@/screens/fixtures/calendar/plan';
import { US, snapshot, task } from '../common/fixture';
import type { Snapshot } from '../snapshot';

/** Сделано заранее (до «сейчас») */
const DONE = '2026-10-04T10:00:00.000Z';
const WEEKLY = { freq: 'week', every: 1 } as const;

/** C-Week: неделя 05—11 октября */
export const WEEK_TASKS: Task[] = [
  task('gift', '2026-10-05', null, 'Подарок Лене', ['s']),
  task('dent', '2026-10-05', '09:30', 'Стоматолог', ['s'], { endTime: '10:30' }),
  task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { endTime: '20:00', repeat: WEEKLY }),
  task('mfc', '2026-10-06', '16:00', 'МФЦ', ['s'], { endTime: '17:00' }),
  task('dinner', '2026-10-06', '19:00', 'Ужин с Леной', ['s', 'k'], { endTime: '20:30' }),
  task('trip', '2026-10-07', '07:00', 'Командировка в Казань', ['k'], { endDate: '2026-10-09', endTime: '15:00' }),
  task('train1', '2026-10-07', '07:00', 'Поезд в Казань', ['k'], { endTime: '09:00', parentId: 'trip' }),
  task('football', '2026-10-07', '18:00', 'Футбол', ['s'], { endTime: '21:00', doneAt: DONE }),
  task('mom', '2026-10-08', null, 'Мама в гостях', ['s', 'k'], { endDate: '2026-10-10' }),
  task('meet', '2026-10-08', '09:00', 'Встреча с заказчиком', ['k'], { endTime: '15:00', parentId: 'trip' }),
  task('gym', '2026-10-08', '10:15', 'Тренировка', ['s'], { endTime: '13:45' }),
  task('report', '2026-10-08', '11:15', 'Сдать отчёт', ['o'], { endTime: '12:45' }),
  task('train2', '2026-10-09', '13:00', 'Поезд домой', ['k'], { endTime: '15:00', parentId: 'trip' }),
  task('lunch', '2026-10-09', '14:00', 'Обед с Олегом', ['s'], { endTime: '16:30' }),
  task('cinema', '2026-10-09', '19:30', 'Кино', ['s', 'k'], { endTime: '22:00' }),
  task('dacha', '2026-10-10', '09:00', 'Дача', ['s', 'k'], { endTime: '20:00' }),
  task('water', '2026-10-10', '09:00', 'Полить грядки', ['s'], { endTime: '10:30', parentId: 'dacha' }),
  task('bbq', '2026-10-10', '13:00', 'Шашлыки', ['k'], { endTime: '15:30', parentId: 'dacha' }),
  task('call', '2026-10-10', '14:00', 'Созвон', ['o'], { endTime: '15:00' }),
  task('mom-call', '2026-10-10', '17:00', 'Звонок маме', ['s'], { endTime: '18:30' }),
  task('brunch', '2026-10-11', '11:00', 'Бранч у Ани', ['s', 'k'], { endTime: '13:00' }),
  task('none', null, null, 'Без даты', ['s']),
];

/** C-Day: понедельник 5 октября */
export const DAY_TASKS: Task[] = [
  task('gift', '2026-10-05', null, 'Подарок Лене', ['s']),
  task('dent', '2026-10-05', '09:30', 'Стоматолог', ['s'], { endTime: '10:30', note: 'Клиника на Мира, каб. 4' }),
  task('call', '2026-10-05', '13:00', 'Созвон с Олегом', ['s'], { endTime: '13:30', note: 'Бюджет на ноябрь' }),
  task('parcel', '2026-10-05', '13:00', 'Забрать посылку', ['k'], { endTime: '14:00', note: 'СДЭК на Ленина, 12' }),
  task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { endTime: '20:00', note: 'Студия на Гоголя', repeat: WEEKLY }),
  task('series', '2026-10-05', '21:00', 'Разделение', ['s', 'k'], { endTime: '22:00', note: '3 сезон, 2 серия' }),
];

/** В макетах C-Day и C-Month вкладок двое: Саня и Карина */
export const PAIR: Group = { ...US, memberIds: ['s', 'k'] };

/** C-Plan: план Карины 7–9 октября и его подзадачи (одна — вне периода, одна — без времени) */
export function planTasks(): Task[] {
  const f = planFixture();
  const plan = task('trip', '2026-10-07', '06:00', f.title, ['k'], { endDate: '2026-10-09', endTime: '15:00' });
  const kids = f.steps.map((st) =>
    task(st.id, st.date, hhmmOf(st.start), st.title, ['k'], {
      endTime: hhmmOf(st.end),
      parentId: 'trip',
      ...(st.note ? { note: st.note } : {}),
      ...(st.done ? { doneAt: DONE } : {}),
    }),
  );
  return [
    plan,
    ...kids,
    task('souvenir', '2026-10-10', '12:00', 'Сувениры маме', ['k'], { endTime: '13:00', parentId: 'trip' }),
    task('tickets', null, null, 'Купить билеты', ['k'], { parentId: 'trip' }),
  ];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmmOf = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const calendarSnapshot = (tasks: Task[], patch: Partial<Snapshot> = {}): Snapshot => snapshot({ tasks, ...patch });
