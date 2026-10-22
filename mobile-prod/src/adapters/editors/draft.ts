/**
 * Черновик окна дела / плана (C-Edit*): правки идут в черновик, в хранилище — только по «СОХРАНИТЬ»
 * (draftToItem → saveItems), «назад» черновик выбрасывает. Здесь же — что раскрыто в окне (EditorUi)
 * и общий редьюсер reduceEditor. Чистые функции, без react и хранилища.
 *
 * Правила (docs/redesign/INTEGRATION.md 1.2, DECISIONS.md):
 *  - начало сдвинули — конец едет на столько же (periodMath.moveStart), у плана тоже; подзадачи плана не двигаются;
 *  - без даты нет ни времени, ни конца, ни повтора; повтор, выбранный без даты, ставит дату на сегодня;
 *  - открытый раз серии (occ) показывается своей датой, но правка меняет всю серию: сдвиг даты переносится на начало серии.
 */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import { shiftRepeat, weekdayOf } from '@/lib/recur';
import { hhmm, normalizeEnd, peopleOf, toMin } from '@/lib/span';
import type { DraftItem, ID, ReminderSpec, Repeat, Task, TaskDraft } from '@/lib/types';
import type { DateView } from '@/screens/editors/panels/DatePanel';
import type { PeriodEdge } from '@/screens/editors/panels/PeriodPanel';
import type { RemindScope } from '@/screens/editors/panels/RemindPanel';
import type { RepeatEnd, RepeatPreset, RepeatUnit } from '@/screens/editors/panels/RepeatPanel';
import type { WhoMode } from '@/screens/editors/panels/WhoPanel';
import type { PlanField } from '@/screens/editors/PlanEditorScreen';
import type { TaskField } from '@/screens/editors/TaskEditorScreen';
import { moveEnd, moveStart, type Period, type PeriodPoint } from '@/screens/editors/periodMath';
import type { Snapshot } from '../snapshot';

/* ---------- Черновик ---------- */

export type EditorDraft = {
  /** null — новое дело */
  id: ID | null;
  groupId: ID | null;
  createdBy: ID;
  title: string;
  date: IsoDate | null;
  time: string | null;
  endDate: IsoDate | null;
  endTime: string | null;
  repeat: Repeat | null;
  /** Кто занят; пусто — автор */
  people: ID[];
  note: string;
  /** Мои личные напоминания (undefined — как у всех) */
  mine: ReminderSpec[] | undefined;
  /** Общие напоминания группы (null — у каждого свои по умолчанию) */
  shared: ReminderSpec[] | null;
  parentId: ID | null;
  /** Открытый раз серии: черновик показывает его дату */
  occ: IsoDate | null;
  /** Дата начала серии (когда открыт раз occ) */
  seriesDate: IsoDate | null;
  /** Время колеса, когда «БЕЗ ВРЕМЕНИ» (вернётся при снятии) */
  lastTime: string;
  lastEndTime: string | null;
};

/** Черновик из голоса или «Изменить» (store.EditorSeed): id — правка существующего */
export type SeedDraft = TaskDraft & { id?: ID };

/** Время колеса по умолчанию, пока у дела времени нет */
export const DEFAULT_TIME = '09:00';

const shiftDay = (iso: IsoDate, n: number) => isoOf(dayNo(iso) + n);

/** Группа нового дела: группа плана (подзадача), иначе текущая */
function groupFor(s: Pick<Snapshot, 'tasks' | 'currentGroupId'>, parentId: ID | null): { groupId: ID | null; parentId: ID | null } {
  const parent = parentId ? s.tasks.find((t) => t.id === parentId && !t.parentId) : undefined;
  return parent ? { groupId: parent.groupId, parentId: parent.id } : { groupId: s.currentGroupId, parentId: null };
}

/** Новое дело: из «+» (без даты), из календаря (дата дня, время), подзадача плана (parentId) */
export function emptyDraft(
  s: Pick<Snapshot, 'me' | 'tasks' | 'currentGroupId'>,
  at: { date?: IsoDate | null; time?: string | null; parentId?: ID | null } = {},
): EditorDraft {
  const date = at.date ?? null;
  const time = date ? (at.time ?? null) : null;
  return {
    id: null,
    ...groupFor(s, at.parentId ?? null),
    createdBy: s.me.id,
    title: '',
    date,
    time,
    endDate: null,
    endTime: null,
    repeat: null,
    people: [s.me.id],
    note: '',
    mine: undefined,
    shared: null,
    occ: null,
    seriesDate: null,
    lastTime: time ?? DEFAULT_TIME,
    lastEndTime: null,
  };
}

/** Черновик существующего дела. occ — открытый раз серии: дата и конец — этого раза */
export function draftFromTask(task: Task, s: Pick<Snapshot, 'overrides'>, occ?: IsoDate | null): EditorDraft {
  const series = !!task.repeat && !!task.date && !!occ;
  const date = series && occ ? occ : task.date;
  const shift = series && occ && task.date ? dayNo(occ) - dayNo(task.date) : 0;
  return {
    id: task.id,
    groupId: task.groupId,
    createdBy: task.createdBy,
    title: task.title,
    date,
    time: date ? task.time : null,
    endDate: task.endDate ? shiftDay(task.endDate, shift) : null,
    endTime: task.endTime ?? null,
    repeat: task.repeat ?? null,
    people: peopleOf(task),
    note: task.note ?? '',
    mine: s.overrides[task.id],
    shared: task.reminders ?? null,
    parentId: task.parentId ?? null,
    occ: series && occ ? occ : null,
    seriesDate: series ? task.date : null,
    lastTime: task.time ?? DEFAULT_TIME,
    lastEndTime: task.endTime ?? null,
  };
}

/**
 * Черновик из голоса / «Изменить» в голосовом окне: поверх существующего дела (seed.id) или нового.
 * Поля seed, которых нет (undefined), остаются как были
 */
export function draftFromSeed(seed: SeedDraft, s: Pick<Snapshot, 'me' | 'tasks' | 'currentGroupId' | 'overrides'>): EditorDraft {
  const task = seed.id ? s.tasks.find((t) => t.id === seed.id) : undefined;
  const base = task ? draftFromTask(task, s) : emptyDraft(s, { parentId: seed.parentId ?? null });
  const group = task ? {} : groupFor(s, seed.parentId ?? null);
  return clean({
    ...base,
    ...group,
    title: seed.title,
    ...(seed.date !== undefined && { date: seed.date }),
    ...(seed.time !== undefined && { time: seed.time, lastTime: seed.time ?? base.lastTime }),
    ...(seed.endDate !== undefined && { endDate: seed.endDate }),
    ...(seed.endTime !== undefined && { endTime: seed.endTime }),
    ...(seed.repeat !== undefined && { repeat: seed.repeat }),
    ...(seed.people !== undefined && seed.people.length > 0 && { people: seed.people }),
    ...(seed.note !== undefined && { note: seed.note }),
    ...(seed.mine !== undefined && { mine: seed.mine }),
    ...(seed.shared !== undefined && { shared: seed.shared }),
  });
}

/** Конец не раньше начала (normalizeEnd, как в хранилище); без даты — ни времени, ни конца, ни повтора */
function clean(d: EditorDraft): EditorDraft {
  if (!d.date) {
    return d.time === null && d.endDate === null && d.endTime === null && d.repeat === null
      ? d
      : { ...d, time: null, endDate: null, endTime: null, repeat: null };
  }
  return normalizeEnd(d);
}

/* ---------- Период: начало и конец ---------- */

/** Начало и конец черновика для periodMath (без конца — конец в начале) */
export function periodOf(d: Pick<EditorDraft, 'date' | 'time' | 'endDate' | 'endTime'>, today: IsoDate): Period {
  const date = d.date ?? today;
  return { start: { date, time: d.time }, end: { date: d.endDate ?? date, time: d.endTime } };
}

function withPeriod(d: EditorDraft, p: Period): EditorDraft {
  return clean({
    ...d,
    date: p.start.date,
    time: p.start.time,
    endDate: p.end.date,
    endTime: p.end.time,
    repeat: d.date ? shiftRepeat(d.repeat, d.date, p.start.date) : d.repeat,
    lastTime: p.start.time ?? d.lastTime,
    lastEndTime: p.end.time ?? d.lastEndTime,
  });
}

/** Новое начало: конец едет на столько же. Без даты — просто ставим дату */
function moveStartTo(d: EditorDraft, start: PeriodPoint): EditorDraft {
  if (!d.date) return clean({ ...d, date: start.date, time: start.time, lastTime: start.time ?? d.lastTime });
  return withPeriod(d, moveStart(periodOf(d, start.date), start));
}

function moveEndTo(d: EditorDraft, end: PeriodPoint): EditorDraft {
  if (!d.date) return d;
  return withPeriod(d, moveEnd(periodOf(d, d.date), end));
}

/** Час после начала (или следующий день, если у дела нет времени) — конец по умолчанию */
function defaultEnd(d: EditorDraft): Pick<EditorDraft, 'endDate' | 'endTime'> {
  if (!d.date) return { endDate: null, endTime: null };
  if (!d.time) return { endDate: shiftDay(d.date, 1), endTime: null };
  const end = toMin(d.time) + 60;
  return end < 1440 ? { endDate: null, endTime: hhmm(end) } : { endDate: shiftDay(d.date, 1), endTime: hhmm(end - 1440) };
}

/* ---------- Повтор ---------- */

const WORKDAYS = [1, 2, 3, 4, 5];
/** Окончание «ДО ДАТЫ» по умолчанию — конец года (если до него меньше месяца — конец следующего) */
export function defaultUntil(date: IsoDate): IsoDate {
  const y = Number(date.slice(0, 4));
  const end = `${y}-12-31`;
  return dayNo(end) - dayNo(date) < 30 ? `${y + 1}-12-31` : end;
}
export const DEFAULT_COUNT = 10;

/** Правило пресета; custom — текущее правило или «каждую неделю» в день даты */
export function presetRepeat(preset: RepeatPreset, date: IsoDate, current: Repeat | null): Repeat | null {
  switch (preset) {
    case 'none':
      return null;
    case 'day':
      return { freq: 'day', every: 1 };
    case 'weekdays':
      return { freq: 'week', every: 1, weekdays: WORKDAYS };
    case 'week':
      return { freq: 'week', every: 1, weekdays: [weekdayOf(date)] };
    case 'month':
      return { freq: 'month', every: 1 };
    case 'year':
      return { freq: 'year', every: 1 };
    case 'custom':
      return current ?? { freq: 'week', every: 1, weekdays: [weekdayOf(date)] };
  }
}

const sameDays = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x) => b.includes(x));
const plainList = (list: readonly number[] | undefined, v: number) => !list?.length || (list.length === 1 && list[0] === v);

/** Какой пресет показывает правило; с окончанием, шагом больше 1 и прочим — «НАСТРОИТЬ…» */
export function repeatPresetOf(r: Repeat | null, date: IsoDate | null): RepeatPreset {
  if (!r) return 'none';
  if (!date || (r.every || 1) !== 1 || r.until || r.count) return 'custom';
  const [, m = 0, d = 0] = date.split('-').map(Number);
  switch (r.freq) {
    case 'day':
      return 'day';
    case 'week': {
      const days = r.weekdays?.length ? r.weekdays : [weekdayOf(date)];
      if (sameDays(days, WORKDAYS)) return 'weekdays';
      return sameDays(days, [weekdayOf(date)]) ? 'week' : 'custom';
    }
    case 'month':
      return plainList(r.monthDays, d) ? 'month' : 'custom';
    case 'year':
      return plainList(r.months, m) && plainList(r.monthDays, d) ? 'year' : 'custom';
  }
}

/** Конец повтора: никогда / до даты / N раз */
export const repeatEndOf = (r: Repeat): RepeatEnd => (r.until ? 'until' : r.count ? 'count' : 'never');

/** Правка правила из «НАСТРОИТЬ…» */
export type RepeatEdit =
  | { kind: 'every'; every: number }
  | { kind: 'unit'; unit: RepeatUnit }
  | { kind: 'weekday'; weekday: number }
  | { kind: 'end'; end: RepeatEnd }
  | { kind: 'until'; until: IsoDate }
  | { kind: 'count'; count: number };

export function editRepeat(r: Repeat, edit: RepeatEdit, date: IsoDate): Repeat {
  switch (edit.kind) {
    case 'every':
      return { ...r, every: Math.max(1, edit.every) };
    case 'unit': {
      if (edit.unit === r.freq) return r;
      const { weekdays: _w, monthDays: _d, months: _m, ...rest } = r;
      return edit.unit === 'week' ? { ...rest, freq: 'week', weekdays: [weekdayOf(date)] } : { ...rest, freq: edit.unit };
    }
    case 'weekday': {
      const days = r.weekdays?.length ? r.weekdays : [weekdayOf(date)];
      const next = days.includes(edit.weekday) ? days.filter((x) => x !== edit.weekday) : [...days, edit.weekday];
      // Хотя бы один день недели остаётся
      return next.length ? { ...r, weekdays: [...next].sort((a, b) => a - b) } : r;
    }
    case 'end':
      if (edit.end === 'never') return { ...r, until: null, count: null };
      if (edit.end === 'until') return { ...r, until: r.until ?? defaultUntil(date), count: null };
      return { ...r, until: null, count: r.count ?? DEFAULT_COUNT };
    case 'until':
      return { ...r, until: edit.until < date ? date : edit.until, count: null };
    case 'count':
      return { ...r, until: null, count: Math.max(1, edit.count) };
  }
}

/* ---------- Действия ---------- */

export type DraftAction =
  | { type: 'title'; title: string }
  | { type: 'note'; note: string }
  /** День в «КОГДА» */
  | { type: 'day'; date: IsoDate }
  /** «Без даты»: вместе с датой уходят время, конец и повтор */
  | { type: 'clearDate' }
  | { type: 'time'; time: string }
  | { type: 'noTime' }
  /** Конец: день, время, «без времени», очистить, конец по умолчанию (если его нет) */
  | { type: 'endDay'; date: IsoDate }
  | { type: 'endTime'; time: string }
  | { type: 'endNoTime' }
  | { type: 'clearEnd' }
  | { type: 'initEnd' }
  /** Повтор целиком (пресет) или правка правила; today — дата для повтора у дела без даты */
  | { type: 'repeat'; repeat: Repeat | null; today: IsoDate }
  | { type: 'repeatEdit'; edit: RepeatEdit }
  | { type: 'togglePerson'; id: ID }
  | { type: 'people'; people: ID[] }
  /** Список напоминаний «для меня» (mine) или «для всех» (shared) */
  | { type: 'reminders'; scope: RemindScope; specs: ReminderSpec[] }
  /** Края периода плана */
  | { type: 'periodDay'; edge: PeriodEdge; date: IsoDate }
  | { type: 'periodTime'; edge: PeriodEdge; time: string }
  | { type: 'periodNoTime'; edge: PeriodEdge };

export function reduceDraft(d: EditorDraft, a: DraftAction): EditorDraft {
  switch (a.type) {
    case 'title':
      return { ...d, title: a.title };
    case 'note':
      return { ...d, note: a.note };
    case 'day':
      return moveStartTo(d, { date: a.date, time: d.date ? d.time : null });
    case 'clearDate':
      return d.date ? clean({ ...d, date: null, lastTime: d.time ?? d.lastTime }) : d;
    case 'time':
      if (!d.date) return d;
      return moveStartTo(d, { date: d.date, time: a.time });
    case 'noTime':
      if (!d.date) return d;
      return d.time ? clean({ ...d, time: null, lastTime: d.time }) : moveStartTo(d, { date: d.date, time: d.lastTime });
    case 'endDay':
      return moveEndTo(d, { date: a.date, time: d.endTime });
    case 'endTime': {
      if (!d.date) return d;
      // Конец «ночью следующего дня» сам себя не держит: снова в тот же день, если время позже начала
      const overnight = d.endDate === shiftDay(d.date, 1) && !!d.time && !!d.endTime && d.endTime < d.time;
      return clean({ ...d, endDate: overnight ? null : d.endDate, endTime: a.time, lastEndTime: a.time });
    }
    case 'endNoTime':
      if (!d.date) return d;
      if (d.endTime) return clean({ ...d, endTime: null, lastEndTime: d.endTime });
      return clean({ ...d, endTime: d.lastEndTime ?? defaultEnd(d).endTime ?? d.time });
    case 'clearEnd':
      return { ...d, endDate: null, endTime: null };
    case 'initEnd':
      return d.endDate || d.endTime ? d : clean({ ...d, ...defaultEnd(d) });
    case 'repeat': {
      if (!a.repeat) return { ...d, repeat: null };
      const date = d.date ?? a.today;
      return clean({ ...d, date, repeat: a.repeat });
    }
    case 'repeatEdit':
      return d.repeat && d.date ? { ...d, repeat: editRepeat(d.repeat, a.edit, d.date) } : d;
    case 'togglePerson': {
      const cur = d.people.length ? d.people : [d.createdBy];
      const next = cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id];
      // Кто-то занят делом всегда
      return next.length ? { ...d, people: next } : d;
    }
    case 'people':
      return a.people.length ? { ...d, people: [...a.people] } : d;
    case 'reminders':
      return a.scope === 'me' ? { ...d, mine: [...a.specs] } : { ...d, shared: a.specs.length ? [...a.specs] : null };
    case 'periodDay':
      if (a.edge === 'start') return moveStartTo(d, { date: a.date, time: d.time });
      return moveEndTo(d, { date: a.date, time: d.endTime });
    case 'periodTime':
      if (a.edge === 'start') return d.date ? moveStartTo(d, { date: d.date, time: a.time }) : d;
      return moveEndTo(d, { date: d.endDate ?? d.date ?? '', time: a.time });
    case 'periodNoTime':
      if (a.edge === 'start') return reduceDraft(d, { type: 'noTime' });
      if (!d.date) return d;
      return d.endTime
        ? clean({ ...d, endTime: null, lastEndTime: d.endTime })
        : moveEndTo(d, { date: d.endDate ?? d.date, time: d.lastEndTime ?? d.time ?? DEFAULT_TIME });
  }
}

/* ---------- Что раскрыто ---------- */

export type EditorField = TaskField | PlanField;
export type Cursor = { year: number; month: number };

export type EditorUi = {
  /** Раскрытая строка — не больше одной */
  expanded: EditorField | null;
  dateView: DateView;
  /** Месяц календаря в раскрытой строке (0 — январь) */
  cursor: Cursor;
  whoMode: WhoMode;
  remindScope: RemindScope;
  /** Какой край периода правим */
  edge: PeriodEdge;
  /** Счётчик подсветки «КОНЕЦ»: начало сдвинуло конец */
  endFlash: number | undefined;
  /** «НАСТРОИТЬ…» открыт, даже если правило совпадает с пресетом */
  repeatCustom: boolean;
};

export const cursorOf = (iso: IsoDate): Cursor => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 });

export function initialUi(d: EditorDraft, today: IsoDate, expanded: EditorField | null = null): EditorUi {
  return {
    expanded,
    dateView: 'month',
    cursor: cursorOf(d.date ?? today),
    whoMode: 'pick',
    remindScope: 'me',
    edge: 'start',
    endFlash: undefined,
    repeatCustom: false,
  };
}

export type UiAction =
  /** Тап по строке: раскрыть / свернуть; today — куда смотрит календарь у дела без даты */
  | { type: 'toggle'; field: EditorField; today: IsoDate }
  | { type: 'collapse' }
  | { type: 'dateView' }
  | { type: 'shift'; dir: -1 | 1 }
  | { type: 'pickMonth'; month: number }
  | { type: 'edge'; edge: PeriodEdge; today: IsoDate }
  /** «ВСЕ В ГРУППЕ» — снимок участников группы; «ВЫБРАТЬ» */
  | { type: 'whoMode'; mode: WhoMode; members: readonly ID[] }
  | { type: 'remindScope'; scope: RemindScope }
  | { type: 'repeatPreset'; preset: RepeatPreset; today: IsoDate };

export type EditorAction = DraftAction | UiAction;
export type EditorState = { draft: EditorDraft; ui: EditorUi };

const UI_ACTIONS: ReadonlySet<EditorAction['type']> = new Set<EditorAction['type']>([
  'toggle',
  'collapse',
  'dateView',
  'shift',
  'pickMonth',
  'edge',
  'whoMode',
  'remindScope',
  'repeatPreset',
]);
const isUi = (a: EditorAction): a is UiAction => UI_ACTIONS.has(a.type);

/** Дата края периода */
const edgeDate = (d: EditorDraft, edge: PeriodEdge, today: IsoDate) =>
  (edge === 'end' ? (d.endDate ?? d.date) : d.date) ?? today;

function shiftCursor(c: Cursor, view: DateView, dir: -1 | 1): Cursor {
  if (view === 'year') return { year: c.year + dir, month: c.month };
  const m = c.year * 12 + c.month + dir;
  return { year: Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

function reduceUi(state: EditorState, a: UiAction): EditorState {
  const { draft, ui } = state;
  switch (a.type) {
    case 'toggle': {
      if (ui.expanded === a.field) return { draft, ui: { ...ui, expanded: null } };
      const date = a.field === 'period' ? edgeDate(draft, 'start', a.today) : (draft.date ?? a.today);
      return {
        draft,
        ui: { ...ui, expanded: a.field, dateView: 'month', cursor: cursorOf(date), edge: 'start', repeatCustom: false },
      };
    }
    case 'collapse':
      return ui.expanded ? { draft, ui: { ...ui, expanded: null } } : state;
    case 'dateView':
      return { draft, ui: { ...ui, dateView: ui.dateView === 'month' ? 'year' : 'month' } };
    case 'shift':
      return { draft, ui: { ...ui, cursor: shiftCursor(ui.cursor, ui.dateView, a.dir) } };
    case 'pickMonth':
      return { draft, ui: { ...ui, dateView: 'month', cursor: { year: ui.cursor.year, month: a.month } } };
    case 'edge':
      return { draft, ui: { ...ui, edge: a.edge, cursor: cursorOf(edgeDate(draft, a.edge, a.today)) } };
    case 'whoMode':
      return {
        draft: a.mode === 'all' ? reduceDraft(draft, { type: 'people', people: [...a.members] }) : draft,
        ui: { ...ui, whoMode: a.mode },
      };
    case 'remindScope':
      return { draft, ui: { ...ui, remindScope: a.scope } };
    case 'repeatPreset': {
      const date = draft.date ?? a.today;
      const repeat = presetRepeat(a.preset, date, draft.repeat);
      return {
        draft: reduceDraft(draft, { type: 'repeat', repeat, today: a.today }),
        ui: { ...ui, repeatCustom: a.preset === 'custom' },
      };
    }
  }
}

/** Изменилась ли дата, на которую смотрит календарь: туда же листается месяц */
function follow(ui: EditorUi, before: IsoDate | null, after: IsoDate | null): EditorUi {
  if (!after || after === before) return ui;
  const c = cursorOf(after);
  return c.year === ui.cursor.year && c.month === ui.cursor.month ? ui : { ...ui, cursor: c };
}

/** Общий редьюсер окна: черновик + что раскрыто */
export function reduceEditor(state: EditorState, a: EditorAction): EditorState {
  if (isUi(a)) return reduceUi(state, a);
  const draft = reduceDraft(state.draft, a);
  if (draft === state.draft) return state;
  let ui = state.ui;
  const before = state.draft;
  if (a.type === 'day') ui = follow(ui, before.date, draft.date);
  if (a.type === 'periodDay') ui = follow(ui, a.edge === 'end' ? (before.endDate ?? before.date) : before.date, a.date);
  // Начало плана сдвинуло конец — «КОНЕЦ» коротко подсвечивается
  const endMoved = (draft.endDate ?? draft.date) !== (before.endDate ?? before.date) || draft.endTime !== before.endTime;
  if ((a.type === 'periodDay' || a.type === 'periodTime') && a.edge === 'start' && endMoved) {
    ui = { ...ui, endFlash: (ui.endFlash ?? 0) + 1 };
  }
  // Повтор сняли — «НАСТРОИТЬ…» закрывается
  if (!draft.repeat && ui.repeatCustom) ui = { ...ui, repeatCustom: false };
  return { draft, ui };
}

/* ---------- Сохранение ---------- */

/** Кто занят делом черновика (пусто — автор) */
export const draftPeople = (d: Pick<EditorDraft, 'people' | 'createdBy'>): ID[] => peopleOf(d);

/**
 * Черновик → запись для saveItems. Раз серии: сдвиг даты от открытого раза переносится на начало серии
 * (правка меняет всю серию). Повтор сняли — дело остаётся на дате открытого раза
 */
export function draftToItem(d: EditorDraft): Extract<DraftItem, { type: 'task' }> {
  let date = d.date;
  let endDate = d.endDate;
  if (d.occ && d.seriesDate && d.repeat && d.date) {
    const start = shiftDay(d.seriesDate, dayNo(d.date) - dayNo(d.occ));
    const delta = dayNo(start) - dayNo(d.date);
    endDate = endDate ? shiftDay(endDate, delta) : null;
    date = start;
  }
  const data: TaskDraft = {
    title: d.title.trim(),
    date,
    time: d.time,
    note: d.note.trim(),
    repeat: date ? d.repeat : null,
    mine: d.mine,
    shared: d.shared,
    endDate,
    endTime: d.endTime,
    people: draftPeople(d),
    parentId: d.parentId,
  };
  return d.id ? { key: d.id, type: 'task', id: d.id, data } : { key: 'new', type: 'task', data };
}
