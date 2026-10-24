/**
 * Дело по удержанию (C-QuickTask): карточка, плитки ГОТОВО / ИЗМЕНИТЬ / В ПЛАН (у подзадачи и плана — ОТКРЫТЬ ПЛАН) /
 * КОПИЯ и ряд «ПЕРЕНЕСТИ»: ЗАВТРА, +1 ЧАС, ВЫХОДНЫЕ, ДАТА…. Раз серии переносится и отмечается отдельно (occ).
 */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import { instance, nextOpen, weekdayOf } from '@/lib/recur';
import { daysBetween, hhmm, peopleOf, shiftIso, toMin } from '@/lib/span';
import type { ChangePatch, ID, Task } from '@/lib/types';
import { canEditTask } from '@/lib/visibility';
import type { QuickSheetData, QuickTile } from '@/screens/quick/types';
import { isDone, shiftDay } from '../calendar/events';
import { kidsOf } from '../common/tasks';
import { upper } from '../common/ru';
import type { ColorMap } from '../common/people';
import { colorsOf, namesText, periodText, repeatTag } from '../voice/labels';
import { off, type MoveKey, type QuickEnv, type QuickSnapshot } from './types';

const DAY = 24 * 60;
const SATURDAY = 6;

/** Ближайшая суббота после сегодня (в субботу и воскресенье — следующая) */
export const nextSaturday = (today: IsoDate): IsoDate => {
  const ahead = (SATURDAY - weekdayOf(today) + 7) % 7;
  return shiftDay(today, ahead || 7);
};

type Timing = Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>;

/** На другую дату с тем же временем; многодневное везёт конец. Уже там — null */
export const moveToDate = (t: Timing, date: IsoDate): ChangePatch | null => {
  if (t.date === date) return null;
  if (!t.date) return { date };
  return { date, ...(t.endDate ? { endDate: shiftIso(t.endDate, daysBetween(t.date, date)) } : null) };
};

/** На час позже: начало и конец сдвигаются вместе, через полночь — на следующий день. Без времени — null */
const plusHour = (t: Timing): ChangePatch | null => {
  if (!t.date || !t.time) return null;
  const at = (date: IsoDate, time: string) => dayNo(date) * DAY + toMin(time) + 60;
  const start = at(t.date, t.time);
  const date = isoOf(Math.floor(start / DAY));
  const patch: ChangePatch = { date, time: hhmm(start % DAY) };
  if (t.endTime) {
    const end = at(t.endDate ?? t.date, t.endTime);
    const endDate = isoOf(Math.floor(end / DAY));
    return { ...patch, endTime: hhmm(end % DAY), endDate: endDate > date ? endDate : null };
  }
  return t.endDate ? { ...patch, endDate: shiftIso(t.endDate, daysBetween(t.date, date)) } : patch;
};

/** Правки ряда «ПЕРЕНЕСТИ» для показанного раза (t — уже раз серии) */
export const movePatches = (t: Timing, today: IsoDate): Record<Exclude<MoveKey, 'date'>, ChangePatch | null> => {
  return { tomorrow: moveToDate(t, shiftDay(today, 1)), hour: plusHour(t), weekend: moveToDate(t, nextSaturday(today)) };
};

export type QuickTaskView = {
  kind: 'task';
  sheet: QuickSheetData;
  /** Запись в хранилище (у серии — вся серия) */
  task: Task;
  /** Раз серии (нажатый или ближайший несделанный); у обычного дела — null */
  occ: IsoDate | null;
  /** Показанный раз: у серии — instance(task, occ) */
  shown: Task;
  /** План для ОТКРЫТЬ ПЛАН: сам план или план подзадачи */
  planId: ID | null;
  moves: Record<Exclude<MoveKey, 'date'>, ChangePatch | null>;
};

export const quickTaskView = (s: QuickSnapshot, colors: ColorMap, env: QuickEnv, target: { id: ID; occ?: IsoDate }): QuickTaskView | null => {
  const task = s.tasks.find((t) => t.id === target.id);
  if (!task) return null;
  const series = !!task.repeat && !!task.date;
  const occ = series ? (target.occ ?? nextOpen(task, env.today)) : null;
  const shown = occ ? instance(task, occ) : task;
  const kids = kidsOf(s.tasks, task.id);
  const parent = task.parentId ? s.tasks.find((t) => t.id === task.parentId) : undefined;
  const planId = kids.length ? task.id : (parent?.id ?? null);
  const people = peopleOf(task);

  const tag = series
    ? repeatTag(task.repeat, task.date)
    : kids.length
      ? `ПЛАН · ${kids.filter((k) => k.doneAt).length}/${kids.length}`
      : parent
        ? upper(parent.title)
        : undefined;

  const done = isDone(shown);
  const moves = movePatches(shown, env.today);
  const card = { title: task.title, tag, meta: `${periodText(shown)} · ${namesText(s, people)}`, colors: colorsOf(s, colors, people) };
  // Чужое дело без прав админа (C-TaskView): только отметить, свои напоминания и копия себе
  if (!canEditTask(task, s.groups, s.me.id)) {
    return {
      kind: 'task',
      task,
      occ,
      shown,
      planId,
      moves,
      sheet: {
        card,
        tiles: [
          { key: 'done', label: done ? 'ВЕРНУТЬ' : 'ГОТОВО', primary: true },
          { key: 'remind', label: 'НАПОМНИТЬ' },
          { key: 'copy', label: 'КОПИЯ', ...off(kids.length > 0) },
        ],
        deletable: false,
      },
    };
  }
  const tiles: QuickTile[] = [
    { key: 'done', label: done ? 'ВЕРНУТЬ' : 'ГОТОВО', primary: true },
    { key: 'edit', label: 'ИЗМЕНИТЬ' },
    // Серию планом не сделать (как «Сделать планом» в окне дела)
    planId ? { key: 'openPlan', label: 'ОТКРЫТЬ ПЛАН' } : { key: 'plan', label: 'В ПЛАН', ...off(!!task.repeat) },
    // Копия плана без подзадач была бы просто делом — не предлагаем
    { key: 'copy', label: 'КОПИЯ', ...off(kids.length > 0) },
  ];

  return {
    kind: 'task',
    task,
    occ,
    shown,
    planId,
    moves,
    sheet: {
      card,
      tiles,
      section: {
        label: 'ПЕРЕНЕСТИ',
        segments: [
          { key: 'tomorrow', label: 'ЗАВТРА', ...off(!moves.tomorrow) },
          { key: 'hour', label: '+1 ЧАС', ...off(!moves.hour) },
          { key: 'weekend', label: 'ВЫХОДНЫЕ', ...off(!moves.weekend) },
          { key: 'date', label: 'ДАТА…' },
        ],
      },
      deletable: true,
    },
  };
};
