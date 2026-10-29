/**
 * Голосовые правки одной записи: C-AskDelete (удаление, у серии — «только этот раз / все повторы»)
 * и C-AskMove (перенос, правка, отметка: «было → стало» и занятость людей в новое время).
 * Из candidates берётся chosen; occ (API 2) относится к chosen и только к делу с повтором.
 */
import { instance, nextOpen, repeatLabel } from '@/lib/recur';
import { daysBetween, hhmm, isMulti, normalizeEnd, peopleOf, shiftIso, toMin } from '@/lib/span';
import { INBOX, KIND_LABEL, type ChangeDraft, type ChangePatch, type DraftItem, type ID, type Task, type TaskDraft } from '@/lib/types';
import type { DeleteScope } from '@/screens/voice/AskDeleteSheet';
import type { MoveChange, MoveConflict } from '@/screens/voice/AskMoveSheet';
import type { VoiceTaskCard } from '@/screens/voice/types';
import type { Clock, Snapshot } from '../snapshot';
import { busyFor } from '../common/busy';
import { colorMap, colorOf, userOf, type ColorMap } from '../common/people';
import { busyLabel, upper } from '../common/ru';
import { dayMonthShort } from '../common/when';
import { clip, colorsOf, endText, namesText, orderPeople, periodText, repeatTag, whenText } from './labels';

const OCC = /^\d{4}-\d{2}-\d{2}$/;

/** Раз серии из фразы — только у дела с повтором */
function namedOcc(change: ChangeDraft, task: Task): string | null {
  return task.repeat && task.date && change.occ && OCC.test(change.occ) ? change.occ : null;
}

const taskOf = (s: Pick<Snapshot, 'tasks'>, change: ChangeDraft): Task | undefined =>
  change.type === 'task' ? s.tasks.find((t) => t.id === change.chosen) : undefined;

/** «Все повторы»: правка всей серии */
export function withoutOcc(change: ChangeDraft): ChangeDraft {
  const out: ChangeDraft = { ...change };
  delete out.occ;
  return out;
}

/* ---------- Карточка «о чём речь» ---------- */

function taskCard(s: Snapshot, colors: ColorMap, series: Task, shown: Task): VoiceTaskCard {
  const people = peopleOf(shown);
  const tag = repeatTag(series.repeat, series.date) ?? (series.note?.trim() ? clip(upper(series.note), 24) : undefined);
  return {
    id: series.id,
    title: series.title,
    ...(tag ? { tag } : null),
    meta: `${periodText(shown)} · ${namesText(s, people)}`,
    colors: colorsOf(s, colors, people),
  };
}

const topicName = (s: Pick<Snapshot, 'topics'>, id: ID | null | undefined): string =>
  id && id !== INBOX ? (s.topics.find((t) => t.id === id)?.title ?? 'Без темы') : 'Без темы';

/** Карточка записи не-дела: хотелка, «Смотреть», идея */
function itemCard(s: Snapshot, colors: ColorMap, change: ChangeDraft): VoiceTaskCard | null {
  const id = change.chosen;
  if (change.type === 'wish') {
    const w = s.wishes.find((x) => x.id === id);
    if (!w) return null;
    const meta = ['ХОЧУ', w.note.trim() ? clip(upper(w.note), 32) : ''].filter(Boolean).join(' · ');
    return { id, title: w.title, meta, colors: [colorOf(colors, w.ownerId)] };
  }
  if (change.type === 'watch') {
    const w = s.watch.find((x) => x.id === id);
    if (!w) return null;
    const meta = ['СМОТРЕТЬ', w.kind ? upper(KIND_LABEL[w.kind]) : '', w.year ? String(w.year) : ''].filter(Boolean).join(' · ');
    return { id, title: w.title, meta, colors: [colorOf(colors, w.addedBy)] };
  }
  if (change.type === 'idea') {
    const x = s.ideas.find((i) => i.id === id);
    if (!x) return null;
    return { id, title: clip(x.text, 60), meta: `ЗАМЕТКА · ${clip(upper(topicName(s, x.topicId)), 28)}`, colors: [colorOf(colors, x.ownerId)] };
  }
  return null;
}

/* ---------- C-AskDelete ---------- */

export type DeleteSheetData = {
  task: VoiceTaskCard;
  /** «ТОЛЬКО 10 ОКТ» — у серии; нет — выбора нет */
  onceLabel?: string;
  /** Выбор по умолчанию: день назван во фразе — только этот раз, не назван — вся серия */
  scope: DeleteScope;
  /** Какой раз удалить при «только этот раз» */
  occ: string | null;
};

export function deleteSheetProps(change: ChangeDraft, s: Snapshot, clock: Clock): DeleteSheetData | null {
  if (change.action !== 'delete') return null;
  const colors = colorMap(s);
  if (change.type !== 'task') {
    const card = itemCard(s, colors, change);
    return card ? { task: card, scope: 'all', occ: null } : null;
  }
  const task = taskOf(s, change);
  if (!task) return null;
  const named = namedOcc(change, task);
  // День не назван — «только этот раз» значит ближайший неотмеченный
  const occ = named ?? (task.repeat && task.date ? nextOpen(task, clock.today) : null);
  const shown = occ ? instance(task, occ) : task;
  return {
    task: taskCard(s, colors, task, shown),
    ...(occ ? { onceLabel: `ТОЛЬКО ${dayMonthShort(occ)}` } : null),
    scope: named ? 'one' : 'all',
    occ,
  };
}

/** Правка для applyChanges по выбору «только этот раз / все повторы» */
export function deleteChange(change: ChangeDraft, scope: DeleteScope, occ: string | null): ChangeDraft {
  return scope === 'one' && occ ? { ...change, occ } : withoutOcc(change);
}

/* ---------- C-AskMove ---------- */

type Timing = Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>;

/** Новое время после правки: перенос начала везёт конец на столько же (как keepDuration в хранилище) */
export function movedTiming(base: Timing, p: ChangePatch): Timing {
  const date = p.date !== undefined ? p.date : base.date;
  const time = p.time !== undefined ? p.time : base.time;
  let endDate = p.endDate !== undefined ? p.endDate : (base.endDate ?? null);
  let endTime = p.endTime !== undefined ? p.endTime : (base.endTime ?? null);
  if (p.date !== undefined && p.endDate === undefined && base.date && base.endDate && date) {
    endDate = shiftIso(base.endDate, daysBetween(base.date, date));
  }
  if (p.time !== undefined && p.endTime === undefined && !isMulti(base) && base.time && base.endTime && time) {
    const e = toMin(base.endTime) - toMin(base.time) + toMin(time);
    endTime = e < 1440 ? hhmm(e) : null;
  }
  // Конец не раньше начала (normalizeEnd, как в хранилище)
  return normalizeEnd({ date, time, endDate, endTime });
}

const STATUS: Record<'task' | 'wish' | 'watch', [string, string]> = {
  task: ['НЕ СДЕЛАНО', 'СДЕЛАНО'],
  wish: ['ХОЧУ', 'ПОЛУЧЕНО'],
  watch: ['НЕ ПОСМОТРЕЛИ', 'ПОСМОТРЕЛИ'],
};

export type MoveSheetData = {
  task: VoiceTaskCard;
  changes: MoveChange[];
  conflicts: MoveConflict[];
  confirmLabel: string;
  /** Ярлык в шапке: «ПЕРЕНЕСТИ», «ИЗМЕНИТЬ», «ОТМЕТИТЬ», «СНЯТЬ» */
  badge: string;
};

const row = (key: string, label: string, was: string, now: string): MoveChange => ({ key, label, was, now });

function labels(change: ChangeDraft, moves: boolean): { confirmLabel: string; badge: string } {
  if (change.action === 'mark') return { confirmLabel: 'ОТМЕТИТЬ', badge: 'ОТМЕТИТЬ' };
  if (change.action === 'unmark') return { confirmLabel: 'СНЯТЬ ОТМЕТКУ', badge: 'СНЯТЬ' };
  return moves ? { confirmLabel: 'ПЕРЕНЕСТИ', badge: 'ПЕРЕНЕСТИ' } : { confirmLabel: 'СОХРАНИТЬ', badge: 'ИЗМЕНИТЬ' };
}

/** Что показать «было» у серии: названный раз; без него — ближайший (если дата не меняется — правится время всей серии) */
function shownOf(change: ChangeDraft, task: Task, clock: Clock): Task {
  const occ = namedOcc(change, task);
  if (occ) return instance(task, occ);
  if (!task.repeat || !task.date) return task;
  if (change.action === 'unmark') return task;
  if (change.action === 'update' && change.patch?.date !== undefined) return task;
  const next = nextOpen(task, clock.today);
  return next ? instance(task, next) : task;
}

function taskMove(change: ChangeDraft, task: Task, s: Snapshot, clock: Clock, colors: ColorMap): MoveSheetData | null {
  const shown = shownOf(change, task, clock);
  const card = taskCard(s, colors, task, shown);
  if (change.action === 'mark' || change.action === 'unmark') {
    const [a, b] = STATUS.task;
    const changes = [change.action === 'mark' ? row('status', 'СТАТУС', a, b) : row('status', 'СТАТУС', b, a)];
    return { task: card, changes, conflicts: [], ...labels(change, false) };
  }
  const p = change.patch ?? {};
  const occ = namedOcc(change, task);
  const next = movedTiming(shown, p);
  const changes: MoveChange[] = [];
  const moves = p.date !== undefined || p.time !== undefined;
  if (moves && (next.date !== shown.date || next.time !== shown.time)) {
    changes.push(row('when', 'КОГДА', whenText(shown.date, shown.time), whenText(next.date, next.time)));
  }
  if ((p.endDate !== undefined || p.endTime !== undefined) && endText(next) !== endText(shown)) {
    changes.push(row('end', 'КОНЕЦ', endText(shown), endText(next)));
  }
  const wasPeople = peopleOf(shown);
  const nowPeople = p.people?.length ? p.people : wasPeople;
  const wasNames = namesText(s, wasPeople);
  const nowNames = namesText(s, nowPeople);
  if (p.people && nowNames !== wasNames) changes.push(row('who', 'КТО', wasNames, nowNames));
  if (p.title !== undefined && p.title.trim() && p.title !== task.title) changes.push(row('title', 'НАЗВАНИЕ', task.title, p.title));
  // Повтор меняется только у всей серии
  if (!occ && p.repeat !== undefined) {
    const was = upper(repeatLabel(task.repeat, task.date));
    const now = upper(repeatLabel(p.repeat, next.date));
    if (was !== now) changes.push(row('repeat', 'ПОВТОР', was, now));
  }
  if (!changes.length) return null;
  // Занятость в новое время и с новым составом; само дело (все его разы) не считается
  const order = orderPeople(s, nowPeople);
  const timed = moves || p.people !== undefined || p.endDate !== undefined || p.endTime !== undefined;
  const conflicts = timed
    ? busyFor(s, next, order, task.id)
        .map((c, i) => ({ c, i }))
        .sort((x, y) => order.indexOf(x.c.personId) - order.indexOf(y.c.personId) || x.i - y.i)
        .flatMap(({ c }): MoveConflict[] => {
          const user = userOf(s, c.personId);
          return user ? [{ key: `${c.personId}:${c.key}`, who: busyLabel(user), what: `${c.title} · ${c.range}` }] : [];
        })
        .filter((c, i, all) => all.findIndex((x) => x.key === c.key) === i)
    : [];
  return { task: card, changes, conflicts, ...labels(change, moves) };
}

function itemMove(change: ChangeDraft, s: Snapshot, colors: ColorMap): MoveSheetData | null {
  const card = itemCard(s, colors, change);
  if (!card) return null;
  const p = change.patch ?? {};
  const changes: MoveChange[] = [];
  if (change.type === 'idea') {
    const x = s.ideas.find((i) => i.id === change.chosen);
    if (!x || change.action !== 'update' || (p.topicId === undefined && !p.newTopic?.trim())) return null;
    const now = p.newTopic?.trim() ? p.newTopic.trim() : topicName(s, p.topicId ?? null);
    changes.push(row('topic', 'ТЕМА', upper(topicName(s, x.topicId)), upper(now)));
  } else if (change.type === 'wish' || change.type === 'watch') {
    const [a, b] = STATUS[change.type];
    if (change.action === 'mark') changes.push(row('status', 'СТАТУС', a, b));
    else if (change.action === 'unmark') changes.push(row('status', 'СТАТУС', b, a));
    else if (p.title !== undefined && p.title.trim() && p.title !== card.title) changes.push(row('title', 'НАЗВАНИЕ', card.title, p.title));
  }
  if (!changes.length) return null;
  return { task: card, changes, conflicts: [], ...labels(change, false) };
}

/** C-AskMove: перенос, правка или отметка одной записи. null — показывать нечего (запись пропала, правка пустая) */
export function moveSheetProps(change: ChangeDraft, s: Snapshot, clock: Clock): MoveSheetData | null {
  if (change.action === 'delete') return null;
  const colors = colorMap(s);
  if (change.type !== 'task') return itemMove(change, s, colors);
  const task = taskOf(s, change);
  return task ? taskMove(change, task, s, clock, colors) : null;
}

/* ---------- «Изменить» ---------- */

/** Правка всей серии или обычного дела → черновик окна дела с применённой правкой (s.editorSeed) */
export function editSeed(change: ChangeDraft, s: Snapshot): (TaskDraft & { id: ID }) | null {
  const task = taskOf(s, change);
  if (!task) return null;
  const p: ChangePatch = change.action === 'update' ? (change.patch ?? {}) : {};
  const next = movedTiming(task, p);
  const mine = s.overrides[task.id];
  return {
    id: task.id,
    title: p.title?.trim() ? p.title.trim() : task.title,
    date: next.date,
    time: next.time,
    endDate: next.endDate,
    endTime: next.endTime,
    note: task.note ?? '',
    repeat: next.date ? (p.repeat !== undefined ? p.repeat : (task.repeat ?? null)) : null,
    people: p.people?.length ? p.people : (task.people ?? []),
    parentId: task.parentId ?? null,
    shared: task.reminders ?? null,
    ...(mine ? { mine } : null),
  };
}

/** Раз серии, который правит команда (для «Изменить» после переноса одного раза); иначе null */
export const occOfChange = (change: ChangeDraft, s: Pick<Snapshot, 'tasks'>): string | null => {
  const task = taskOf(s, change);
  return task ? namedOcc(change, task) : null;
};

/** Хотелка, «Смотреть» или идея с применённой правкой — для старого окна правки (CardSheet) */
export function editItem(change: ChangeDraft, s: Snapshot): DraftItem | null {
  const p = change.patch ?? {};
  const id = change.chosen;
  const title = (old: string) => (change.action === 'update' && p.title?.trim() ? p.title.trim() : old);
  if (change.type === 'wish') {
    const w = s.wishes.find((x) => x.id === id);
    return w ? { key: change.key, type: 'wish', id, data: { title: title(w.title), note: w.note, link: w.link } } : null;
  }
  if (change.type === 'watch') {
    const w = s.watch.find((x) => x.id === id);
    return w
      ? { key: change.key, type: 'watch', id, data: { title: title(w.title), kind: w.kind, genres: w.genres, origin: w.origin, year: w.year } }
      : null;
  }
  if (change.type === 'idea') {
    const x = s.ideas.find((i) => i.id === id);
    if (!x) return null;
    const topicId = p.topicId !== undefined ? p.topicId : x.topicId;
    return { key: change.key, type: 'idea', id, data: { title: x.text, topicId, newTopic: p.newTopic?.trim() ? p.newTopic.trim() : null } };
  }
  return null;
}
