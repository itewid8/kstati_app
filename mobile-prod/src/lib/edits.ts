/**
 * Правки данных из карточки и голоса: сохранение черновиков (saveDraftItems) и голосовые правки (applyChangeList).
 * Чистый модуль: без Expo и хранилища — хранилище только применяет результат.
 * Перенос плана подзадачи не двигает: вышедшие за период подсвечиваются «вне периода» (docs/redesign/DECISIONS.md)
 */
import { toISODate } from './dates';
import { normTitle } from './dupes';
import { uid } from './ids';
import { newTaskShare } from './visibility';
import { instance, nextOpen } from './recur';
import { daysBetween, hhmm, normalizeEnd, shiftIso, toMin } from './span';
import type { ChangeDraft, ChangePatch, DraftItem, ID, Idea, Task, TaskReminderOverride, Topic, WatchItem, Wish } from './types';

/** Списки, которые меняют карточка и голос */
export type Lists = {
  tasks: Task[];
  wishes: Wish[];
  watch: WatchItem[];
  topics: Topic[];
  ideas: Idea[];
  overrides: Record<ID, TaskReminderOverride>;
};

/* ---------- общие помощники ---------- */

/** Отметить (или снять отметку) у одного повтора серии */
export function toggleOcc(t: Task, occ: string | null, done: boolean): Task {
  if (!occ) return t;
  const set = new Set(t.doneDates ?? []);
  if (done) set.add(occ);
  else set.delete(occ);
  // Храним только недавние отметки: старше года — не нужны
  const yearAgo = toISODate(new Date(Date.now() - 366 * 86400000));
  return { ...t, doneDates: [...set].filter((d) => d >= yearAgo).sort() };
}

/** Удалить один раз серии («только этот раз») */
export const skipOcc = (t: Task, occ: string): Task => ({ ...t, skipDates: [...new Set([...(t.skipDates ?? []), occ])].sort() });

/** Поля дела из голосовой правки (без повтора — его серия меняет отдельно) */
function taskPatch(p: ChangePatch): Partial<Task> {
  return {
    ...(p.title !== undefined && { title: p.title }),
    ...(p.date !== undefined && { date: p.date }),
    ...(p.time !== undefined && { time: p.time }),
    ...(p.endDate !== undefined && { endDate: p.endDate }),
    ...(p.endTime !== undefined && { endTime: p.endTime }),
    ...(p.people !== undefined && { people: p.people }),
  };
}

/** Перенос голосом меняет только начало — конец едет на столько же (длительность не теряется) */
function keepDuration(old: Task, next: Task, p: { date?: string | null; time?: string | null; endDate?: string | null; endTime?: string | null }): Task {
  const out = { ...next };
  if (p.date !== undefined && p.endDate === undefined && old.date && old.endDate && next.date) out.endDate = shiftIso(old.endDate, daysBetween(old.date, next.date));
  const multi = !!old.endDate && !!old.date && old.endDate > old.date;
  if (p.time !== undefined && p.endTime === undefined && !multi && old.time && old.endTime && next.time) {
    const e = toMin(old.endTime) - toMin(old.time) + toMin(next.time);
    out.endTime = e < 24 * 60 ? hhmm(e) : null;
  }
  return out;
}

/** Все подзадачи плана сделаны — план отмечается сам; подзадачу вернули — план снова открыт */
export function syncParent(tasks: Task[], parentId: ID | null | undefined): Task[] {
  if (!parentId) return tasks;
  const kids = tasks.filter((t) => t.parentId === parentId);
  if (!kids.length) return tasks;
  const all = kids.every((t) => t.doneAt);
  return tasks.map((t) => {
    if (t.id !== parentId || t.repeat) return t;
    if (all && !t.doneAt) return { ...t, doneAt: new Date().toISOString() };
    if (!all && t.doneAt) return { ...t, doneAt: null };
    return t;
  });
}

/** Моя тема с таким названием (без учёта регистра и знаков) */
export const ownTopic = (topics: Topic[], meId: ID, title: string) => topics.find((t) => t.ownerId === meId && normTitle(t.title) === normTitle(title));

const lastDone = (t: Task): string | null => t.doneDates?.[t.doneDates.length - 1] ?? null;

/* ---------- сохранение карточки ---------- */

/** id сохранённых записей (новых и изменённых) по порядку карточки; ideaTopicId — тема первой идеи */
export type SavedIds = ID[] & { ideaTopicId?: ID | null };

export type SaveCtx = { meId: ID; currentGroupId: ID | null; now: string };

/**
 * Сохранить черновики. ids — по одному на каждую запись, которую удалось сохранить:
 * новый id у созданной, прежний у изменённой. Не сохраняется: новое дело или «Смотреть» без группы
 * (нет текущей группы и нет плана), правка записи, которой уже нет
 */
export function saveDraftItems(lists: Lists, items: readonly DraftItem[], ctx: SaveCtx): { lists: Lists; ids: SavedIds } {
  const { meId, currentGroupId, now } = ctx;
  let { tasks, wishes, watch, overrides, topics, ideas } = lists;
  const ids: ID[] = [];
  let ideaTopicId: ID | null | undefined;
  // Новая тема из карточки создаётся один раз, даже если её назвали у нескольких идей
  const topicFor = (title: string): ID => {
    const name = title.trim();
    const found = ownTopic(topics, meId, name);
    if (found) return found.id;
    const t: Topic = { id: uid(), ownerId: meId, title: name, groupIds: [], createdAt: now };
    topics = [...topics, t];
    return t.id;
  };
  const has = <T extends { id: ID }>(arr: T[], id: ID) => arr.some((x) => x.id === id);
  for (const it of items) {
    if (it.type === 'task') {
      const { mine, shared, repeat, ...data } = it.data;
      // Повтор без даты не бывает; повторяющееся дело не отмечается целиком
      const rep = data.date ? (repeat ?? null) : null;
      const fields = normalizeEnd({ ...data, repeat: rep, ...(shared !== undefined && { reminders: shared }) });
      // Подзадача живёт в группе своего плана
      const parent = fields.parentId ? tasks.find((t) => t.id === fields.parentId && !t.parentId) : null;
      if (!parent) fields.parentId = null;
      // Новое: подзадача — в группе плана и с его видимостью, иначе — по текущему виду (группа или личный календарь)
      const place: Pick<Task, 'groupId' | 'share' | 'only'> = parent
        ? { groupId: parent.groupId, ...(parent.share && { share: parent.share }), ...(parent.only && { only: true }) }
        : newTaskShare(currentGroupId);
      let id = it.id;
      // Подзадачу вынули из плана или перенесли в другой — прежний план пересчитываем
      const oldParent = id ? tasks.find((t) => t.id === id)?.parentId : null;
      if (id) {
        if (has(tasks, id)) ids.push(id);
        tasks = tasks.map((t) => (t.id === id ? { ...t, ...fields, ...(rep && { doneAt: null }) } : t));
      } else {
        id = uid();
        tasks = [...tasks, { id, ...place, createdBy: meId, doneAt: null, createdAt: now, ...fields }];
        ids.push(id);
      }
      // Видимость плана — у его подзадач та же
      if (id && !parent && (data.only !== undefined || data.share !== undefined)) {
        const planId = id;
        tasks = tasks.map((k) => (k.parentId === planId ? { ...k, only: !!fields.only, share: fields.share ?? {} } : k));
      }
      if (parent) tasks = syncParent(tasks, parent.id);
      if (oldParent && oldParent !== parent?.id) tasks = syncParent(tasks, oldParent);
      if (id) {
        overrides = { ...overrides };
        if (mine) overrides[id] = mine;
        else delete overrides[id];
      }
    } else if (it.type === 'wish') {
      const wid = it.id;
      if (wid) {
        if (has(wishes, wid)) ids.push(wid);
        wishes = wishes.map((w) => (w.id === wid ? { ...w, ...it.data } : w));
      } else {
        const w: Wish = { id: uid(), ownerId: meId, receivedAt: null, createdAt: now, ...it.data };
        wishes = [w, ...wishes];
        ids.push(w.id);
      }
    } else if (it.type === 'watch') {
      const wid = it.id;
      if (wid) {
        if (has(watch, wid)) ids.push(wid);
        watch = watch.map((w) => (w.id === wid ? { ...w, ...it.data } : w));
      } else if (currentGroupId) {
        const w: WatchItem = { id: uid(), groupId: currentGroupId, addedBy: meId, watchedAt: null, createdAt: now, ...it.data };
        watch = [w, ...watch];
        ids.push(w.id);
      }
    } else if (it.type === 'topic') {
      const title = it.data.title.trim();
      const tid = it.id;
      if (tid) {
        if (has(topics, tid)) ids.push(tid);
        topics = topics.map((t) => (t.id === tid ? { ...t, title } : t));
      } else ids.push(topicFor(title));
    } else {
      const topicId = it.data.newTopic?.trim() ? topicFor(it.data.newTopic) : it.data.topicId;
      const text = it.data.title.trim();
      const iid = it.id;
      if (iid) {
        if (has(ideas, iid)) ids.push(iid);
        ideas = ideas.map((x) => (x.id === iid ? { ...x, text, topicId, updatedAt: now } : x));
      } else {
        const x: Idea = { id: uid(), ownerId: meId, topicId, text, createdAt: now, updatedAt: now };
        ideas = [x, ...ideas];
        ids.push(x.id);
      }
      if (ideaTopicId === undefined) ideaTopicId = topicId;
    }
  }
  const saved: SavedIds = ideaTopicId === undefined ? ids : Object.assign(ids, { ideaTopicId });
  return { lists: { tasks, wishes, watch, overrides, topics, ideas }, ids: saved };
}

/* ---------- голосовые правки ---------- */

export type ChangeCtx = { meId: ID | undefined; now: string };

/** Рабочее состояние правок: списки меняются по ходу, single — дела, где правили отдельный раз серии */
type Work = Lists & { single: Set<ID> };

/** Раз серии из фразы (occ, API 2) — только у дела с повтором; «все повторы» — вызывающий убирает occ */
const occOf = (tasks: Task[], ch: ChangeDraft): string | null =>
  ch.type === 'task' && ch.occ && tasks.some((t) => t.id === ch.chosen && t.repeat && t.date) ? ch.occ : null;

const stampOf = (ch: ChangeDraft, now: string): string | null | undefined =>
  ch.action === 'mark' ? now : ch.action === 'unmark' ? null : undefined;

/** Дело: удалить (целиком или один раз), отметить, перенести один раз серии, править */
export function applyTaskChange(w: Work, ch: ChangeDraft, occ: string | null, ctx: ChangeCtx): void {
  const id = ch.chosen;
  if (ch.action === 'delete') {
    if (occ) w.tasks = w.tasks.map((t) => (t.id === id ? skipOcc(t, occ) : t));
    else {
      const parentId = w.tasks.find((t) => t.id === id)?.parentId;
      w.tasks = syncParent(w.tasks.filter((t) => t.id !== id && t.parentId !== id), parentId);
    }
    return;
  }
  const stamp = stampOf(ch, ctx.now);
  const p = ch.patch ?? {};
  if (occ) {
    const t0 = w.tasks.find((t) => t.id === id);
    if (!t0) return;
    if (stamp !== undefined) {
      w.tasks = w.tasks.map((t) => (t.id === id ? toggleOcc(t, occ, !!stamp) : t));
      return;
    }
    // Перенос одного раза: из серии он выпадает, вместо него — отдельное дело без повтора на новую дату
    const { occ: _occ, ...once } = instance(t0, occ);
    const moved: Task = normalizeEnd(
      keepDuration(once, { ...once, ...taskPatch(p), id: uid(), createdAt: ctx.now, repeat: null, doneDates: [], skipDates: [] }, p),
    );
    w.tasks = [...w.tasks.map((t) => (t.id === id ? skipOcc(t, occ) : t)), moved];
    const mine = w.overrides[id];
    if (mine) w.overrides = { ...w.overrides, [moved.id]: mine };
    w.tasks = syncParent(w.tasks, moved.parentId);
    return;
  }
  w.tasks = w.tasks.map((t) =>
    t.id !== id
      ? t
      : t.repeat && stamp !== undefined
        ? // Серия без названного раза: голосом отмечается ближайший раз
          toggleOcc(t, stamp ? nextOpen(t, toISODate(new Date())) : lastDone(t), !!stamp)
        : {
            ...t,
            ...taskPatch(p),
            ...(p.repeat !== undefined && { repeat: p.repeat, doneAt: null }),
            ...(stamp !== undefined && { doneAt: stamp }),
          },
  );
}

/** Хотелка и «Смотреть»: удалить, отметить, переименовать (тема голосом не правится) */
export function applyItemChange(w: Work, ch: ChangeDraft, ctx: ChangeCtx): void {
  const id = ch.chosen;
  if (ch.action === 'delete') {
    if (ch.type === 'wish') w.wishes = w.wishes.filter((x) => x.id !== id);
    if (ch.type === 'watch') w.watch = w.watch.filter((x) => x.id !== id);
    return;
  }
  const stamp = stampOf(ch, ctx.now);
  const p = ch.patch ?? {};
  if (ch.type === 'wish')
    w.wishes = w.wishes.map((x) =>
      x.id !== id ? x : { ...x, ...(p.title !== undefined && { title: p.title }), ...(stamp !== undefined && { receivedAt: stamp }) },
    );
  if (ch.type === 'watch')
    w.watch = w.watch.map((x) =>
      x.id !== id ? x : { ...x, ...(p.title !== undefined && { title: p.title }), ...(stamp !== undefined && { watchedAt: stamp }) },
    );
}

/** Идея: удалить или перенести в другую тему (новая тема создаётся) */
export function applyIdeaChange(w: Work, ch: ChangeDraft, ctx: ChangeCtx): void {
  const id = ch.chosen;
  if (ch.action === 'delete') {
    w.ideas = w.ideas.filter((x) => x.id !== id);
    return;
  }
  const p = ch.patch ?? {};
  let topicId = p.topicId ?? null;
  if (p.newTopic?.trim() && ctx.meId) {
    const found = ownTopic(w.topics, ctx.meId, p.newTopic);
    if (found) topicId = found.id;
    else {
      const t: Topic = { id: uid(), ownerId: ctx.meId, title: p.newTopic.trim(), groupIds: [], createdAt: ctx.now };
      w.topics = [...w.topics, t];
      topicId = t.id;
    }
  }
  if (p.topicId !== undefined || p.newTopic) w.ideas = w.ideas.map((x) => (x.id === id ? { ...x, topicId, updatedAt: ctx.now } : x));
}

/**
 * После правок: у изменённых дел конец не раньше начала, перенос всей серии / дела везёт конец (keepDuration);
 * отметки подзадач пересчитывают план
 */
export function normalizeTasks(before: Task[], tasks: Task[], changes: readonly ChangeDraft[], single: Set<ID>): Task[] {
  const prev = new Map(before.map((t) => [t.id, t]));
  const patchOf = new Map(
    changes.filter((ch) => ch.type === 'task' && ch.action === 'update' && !single.has(ch.chosen)).map((ch) => [ch.chosen, ch.patch ?? {}]),
  );
  let out = tasks.map((t) => {
    const o = prev.get(t.id);
    if (!o || o === t) return t;
    const p = patchOf.get(t.id);
    return normalizeEnd(p ? keepDuration(o, t, p) : t);
  });
  for (const ch of changes) if (ch.type === 'task' && (ch.action === 'mark' || ch.action === 'unmark')) out = syncParent(out, out.find((t) => t.id === ch.chosen)?.parentId);
  return out;
}

/** Применить голосовые правки. deleted — сколько удалений (для «Удалено · ОТМЕНИТЬ») */
export function applyChangeList(lists: Lists, changes: readonly ChangeDraft[], ctx: ChangeCtx): { lists: Lists; deleted: number } {
  const w: Work = { ...lists, single: new Set<ID>() };
  let deleted = 0;
  for (const ch of changes) {
    const occ = occOf(w.tasks, ch);
    if (occ) w.single.add(ch.chosen);
    if (ch.action === 'delete') deleted++;
    if (ch.type === 'task') applyTaskChange(w, ch, occ, ctx);
    else if (ch.type === 'idea') applyIdeaChange(w, ch, ctx);
    else applyItemChange(w, ch, ctx);
  }
  const { single, ...rest } = w;
  return { lists: { ...rest, tasks: normalizeTasks(lists.tasks, w.tasks, changes, single) }, deleted };
}
