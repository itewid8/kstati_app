import type { DraftItem, ID, Task, WatchItem, Wish } from './types';

/** «Дюна », «дюна», «Дюна!» — одно и то же */
export const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'.,!?:;()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Ctx = { tasks: Task[]; watch: WatchItem[]; wishes: Wish[]; groupId: ID | null; meId: ID };

/**
 * Уже есть такая запись? Возвращает текст предупреждения или null.
 *   дела     — то же название на ту же дату (или обе без даты), ещё не выполнено;
 *   смотреть — то же название в группе (в том числе уже просмотренное);
 *   хочу     — то же название в моём списке, ещё не подарено.
 */
export function duplicateOf(item: DraftItem, ctx: Ctx): string | null {
  const t = normTitle(item.data.title);
  if (!t) return null;
  if (item.type === 'task') {
    const d = item.data.date ?? null;
    const hit = ctx.tasks.find(
      (x) => x.id !== item.id && x.groupId === ctx.groupId && !x.doneAt && normTitle(x.title) === t && (x.date ?? null) === d,
    );
    return hit ? `Уже есть в делах: «${hit.title}»` : null;
  }
  if (item.type === 'watch') {
    const hit = ctx.watch.find((x) => x.id !== item.id && x.groupId === ctx.groupId && normTitle(x.title) === t);
    if (!hit) return null;
    return hit.watchedAt ? `Уже посмотрели: «${hit.title}»` : `Уже есть в «Смотреть»: «${hit.title}»`;
  }
  const hit = ctx.wishes.find(
    (x) => x.id !== item.id && x.ownerId === ctx.meId && !x.receivedAt && normTitle(x.title) === t,
  );
  return hit ? `Уже есть в «Хочу»: «${hit.title}»` : null;
}

/** Дубликаты внутри самой карточки («добавь Дюну и Дюну») */
export function repeatsInside(items: DraftItem[]): Set<string> {
  const seen = new Map<string, string>();
  const out = new Set<string>();
  for (const it of items) {
    const k = `${it.type}|${normTitle(it.data.title)}|${it.type === 'task' ? (it.data.date ?? '') : ''}`;
    if (seen.has(k)) out.add(it.key);
    else seen.set(k, it.key);
  }
  return out;
}
