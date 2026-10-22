/**
 * Отмена удаления и правки («Удалено · ОТМЕНИТЬ»). Запоминаем не списки целиком, а только затронутые записи:
 * за время, пока висит «ОТМЕНИТЬ», синхронизация могла принести чужие правки — отмена их не откатывает
 * и не отправляет на сервер устаревшие версии.
 *  - удалённые записи возвращаются (если их ещё нет), на прежнее место;
 *  - добавленные действием (перенос одного раза серии) — убираются;
 *  - изменённые — по полям: поле откатывается, только если в нём всё ещё наше значение;
 *    списки строк (skipDates, doneDates, people) — по элементам: отмена «удалить один раз» убирает только эту дату.
 * Чистый модуль: без Expo и хранилища.
 */
import { same } from './merge';
import type { ID } from './types';

type Rec = { id: ID };

export type ListUndo<T extends Rec> = {
  removed: { item: T; index: number }[];
  added: ID[];
  changed: { before: T; after: T }[];
};

/** Что изменило действие в одном списке: before — до, after — после */
export function captureList<T extends Rec>(before: readonly T[], after: readonly T[]): ListUndo<T> {
  const u: ListUndo<T> = { removed: [], added: [], changed: [] };
  if (before === after) return u;
  const next = new Map(after.map((x) => [x.id, x]));
  const prev = new Set(before.map((x) => x.id));
  before.forEach((item, index) => {
    const now = next.get(item.id);
    if (!now) u.removed.push({ item, index });
    else if (now !== item) u.changed.push({ before: item, after: now });
  });
  for (const x of after) if (!prev.has(x.id)) u.added.push(x.id);
  return u;
}

export const isEmptyUndo = <T extends Rec>(u: ListUndo<T>) => !u.removed.length && !u.added.length && !u.changed.length;

/** Список строк; нет списка (undefined / null) — пустой; не список строк — null */
const strings = (v: unknown): string[] | null =>
  v === undefined || v === null ? [] : Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
const sorted = (a: readonly string[]) => a.every((x, i) => i === 0 || (a[i - 1] ?? '') <= x);

/** Обратная правка списка строк: убрать то, что действие добавило, вернуть то, что убрало */
function revertStrings(cur: readonly string[], before: readonly string[], after: readonly string[]): string[] {
  const added = new Set(after.filter((x) => !before.includes(x)));
  const removed = before.filter((x) => !after.includes(x));
  const out = cur.filter((x) => !added.has(x));
  for (const x of removed) if (!out.includes(x)) out.push(x);
  return sorted(before) ? out.sort() : out;
}

/** Откатить в текущей записи поля, которые поменяло действие (чужие правки остаются) */
function revertRecord<T extends Rec>(cur: T, before: T, after: T): T {
  const c = cur as Record<string, unknown>;
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const out: Record<string, unknown> = { ...c };
  let changed = false;
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (same(b[k], a[k])) continue;
    let v: unknown;
    const [cl, bl, al] = [strings(c[k]), strings(b[k]), strings(a[k])];
    if ((Array.isArray(b[k]) || Array.isArray(a[k])) && cl && bl && al) {
      const next = revertStrings(cl, bl, al);
      if (same(next, cl)) continue;
      // Списка не было (undefined / null) и он снова пуст — возвращаем как было
      v = !next.length && !Array.isArray(b[k]) ? b[k] : next;
    } else {
      // Поле с тех пор поменял кто-то другой — его правка важнее
      if (!same(c[k], a[k])) continue;
      v = b[k];
    }
    if (v === undefined) delete out[k];
    else out[k] = v;
    changed = true;
  }
  return changed ? (out as T) : cur;
}

/** Применить отмену к текущему списку. Ничего не поменялось — тот же список */
export function revertList<T extends Rec>(current: readonly T[], u: ListUndo<T>): T[] {
  if (isEmptyUndo(u)) return current as T[];
  const added = new Set(u.added);
  const changed = new Map(u.changed.map((c) => [c.before.id, c]));
  let touched = false;
  const out: T[] = [];
  for (const x of current) {
    if (added.has(x.id)) {
      touched = true;
      continue;
    }
    const c = changed.get(x.id);
    const next = c ? revertRecord(x, c.before, c.after) : x;
    if (next !== x) touched = true;
    out.push(next);
  }
  const have = new Set(out.map((x) => x.id));
  for (const { item, index } of u.removed) {
    if (have.has(item.id)) continue;
    out.splice(Math.min(index, out.length), 0, item);
    have.add(item.id);
    touched = true;
  }
  return touched ? out : (current as T[]);
}
