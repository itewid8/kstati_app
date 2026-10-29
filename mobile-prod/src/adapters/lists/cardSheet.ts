/**
 * Окно записей (CardSheet): несколько записей или правок из голоса, ручное добавление и правка хотелки, «Смотреть»,
 * идеи, темы. Чистые подписи: карточка записи (ярлык типа, кто и когда добавил), темы для выбора, правки, дубликаты.
 * Подарок чужой хотелки здесь не показывается никогда (правятся только свои хотелки).
 */
import { duplicateOf, repeatsInside } from '@/lib/dupes';
import { pastEnd, type ChangeDraft, type DraftItem, type ID, type ItemType, type PersonColor } from '@/lib/types';
import type { MoveChange, MoveConflict } from '@/screens/voice/AskMoveSheet';
import type { VoiceTaskCard } from '@/screens/voice/types';
import type { Clock, Snapshot } from '../snapshot';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayMonthShort, whenLabel } from '../common/when';
import { deleteSheetProps, moveSheetProps } from '../voice/change';
import { clip } from '../voice/labels';

export const TYPE_TAG: Record<ItemType, string> = {
  task: 'ДЕЛО',
  wish: 'ХОЧУ',
  watch: 'СМОТРЕТЬ',
  idea: 'ЗАМЕТКА',
  topic: 'ТЕМА',
};

export type DraftHeadData = { tag: string; meta?: string; colors: PersonColor[] };

type CardSnapshot = Pick<Snapshot, 'me' | 'users' | 'tasks' | 'wishes' | 'watch' | 'ideas' | 'topics'>;

/** Кто и когда добавил существующую запись */
function origin(item: DraftItem, s: CardSnapshot): { by: ID; at: string } | null {
  if (!item.id) return null;
  const id = item.id;
  switch (item.type) {
    case 'task': {
      const t = s.tasks.find((x) => x.id === id);
      return t ? { by: t.createdBy, at: t.createdAt } : null;
    }
    case 'watch': {
      const w = s.watch.find((x) => x.id === id);
      return w ? { by: w.addedBy, at: w.createdAt } : null;
    }
    case 'wish': {
      const w = s.wishes.find((x) => x.id === id && x.ownerId === s.me.id);
      return w ? { by: w.ownerId, at: w.createdAt } : null;
    }
    case 'idea': {
      const x = s.ideas.find((i) => i.id === id);
      return x ? { by: x.ownerId, at: x.createdAt } : null;
    }
    case 'topic': {
      const t = s.topics.find((x) => x.id === id);
      return t ? { by: t.ownerId, at: t.createdAt } : null;
    }
  }
}

/**
 * Карточка записи в окне: ярлык типа, подпись и цвет автора.
 * Новая — имя автора (вы); существующая — «ДОБАВИЛИ ВЫ · 28 СЕН» / «ДОБАВИЛА КАРИНА · 28 СЕН»; идея — «ЗАПИСАНО 28 СЕН»; тема — без подписи
 */
export function draftHead(item: DraftItem, s: CardSnapshot, colors: ColorMap): DraftHeadData {
  const tag = TYPE_TAG[item.type];
  const rec = origin(item, s);
  const by = rec?.by ?? s.me.id;
  const out = { tag, colors: [colorOf(colors, by)] };
  if (item.type === 'topic') return out;
  if (!rec) return item.id ? out : { ...out, meta: upper(userOf(s, s.me.id)?.name ?? s.me.name) };
  const when = dayMonthShort(dateOfStamp(rec.at));
  if (item.type === 'idea') return { ...out, meta: `ЗАПИСАНО ${when}` };
  if (rec.by === s.me.id) return { ...out, meta: `ДОБАВИЛИ ВЫ · ${when}` };
  const u = userOf(s, rec.by);
  return { ...out, meta: upper(`Добавил${pastEnd(u)} ${u?.name ?? 'участник'} · ${when}`) };
}

/** Темы для выбора у идеи: только свои, по порядку хранилища */
export const ownTopics = (s: Pick<Snapshot, 'me' | 'topics'>): { id: ID; title: string }[] =>
  s.topics.filter((t) => t.ownerId === s.me.id).map((t) => ({ id: t.id, title: t.title }));

/** Повтор: такая запись уже есть (или повторяется в этом же ответе). null — не повтор */
export function duplicates(
  items: DraftItem[],
  s: Pick<Snapshot, 'me' | 'tasks' | 'watch' | 'wishes' | 'topics' | 'currentGroupId'>,
): Map<string, string> {
  const inside = repeatsInside(items);
  const out = new Map<string, string>();
  for (const it of items) {
    const dup =
      duplicateOf(it, { tasks: s.tasks, watch: s.watch, wishes: s.wishes, topics: s.topics, groupId: s.currentGroupId, meId: s.me.id }) ??
      (inside.has(it.key) ? 'Повторяется в этом ответе' : null);
    if (dup) out.set(it.key, dup);
  }
  return out;
}

/** Что сохранится: без неснятых повторов; кнопка доступна, если есть что сохранить и у всего есть название */
export function savable(items: DraftItem[], dups: ReadonlyMap<string, string>): { save: DraftItem[]; ok: boolean } {
  const save = items.filter((i) => !dups.has(i.key) || i.force);
  return { save, ok: save.length > 0 && save.every((i) => i.data.title.trim().length > 0) };
}

/* ---------- Правки ---------- */

export type ChangeView = {
  card: VoiceTaskCard;
  badge: string;
  struck: boolean;
  rows: MoveChange[];
  conflicts: MoveConflict[];
};

/** Правка записи: карточка, ярлык, «было → стало», пересечения. null — записи уже нет */
export function changeView(change: ChangeDraft, s: Snapshot, clock: Clock): ChangeView | null {
  if (change.action === 'delete') {
    const d = deleteSheetProps(change, s, clock);
    return d ? { card: d.task, badge: 'УДАЛИТЬ', struck: true, rows: [], conflicts: [] } : null;
  }
  const m = moveSheetProps(change, s, clock);
  return m ? { card: m.task, badge: m.badge, struck: false, rows: m.changes, conflicts: m.conflicts } : null;
}

/** Подходящие записи (больше одной): название и когда (у дела) */
export function candidateOptions(change: ChangeDraft, s: Snapshot): { key: ID; label: string; meta?: string; selected: boolean }[] {
  if (change.candidates.length < 2) return [];
  return change.candidates.flatMap((id) => {
    const selected = id === change.chosen;
    switch (change.type) {
      case 'task': {
        const t = s.tasks.find((x) => x.id === id);
        return t ? [{ key: id, label: t.title, meta: whenLabel(t.date, t.time), selected }] : [];
      }
      case 'idea': {
        const x = s.ideas.find((i) => i.id === id);
        return x ? [{ key: id, label: clip(x.text, 80), selected }] : [];
      }
      case 'topic': {
        const t = s.topics.find((x) => x.id === id);
        return t ? [{ key: id, label: t.title, selected }] : [];
      }
      case 'wish': {
        const w = s.wishes.find((x) => x.id === id);
        return w ? [{ key: id, label: w.title, selected }] : [];
      }
      case 'watch': {
        const w = s.watch.find((x) => x.id === id);
        return w ? [{ key: id, label: w.title, selected }] : [];
      }
    }
  });
}

/** Главная кнопка ответа из правок: только удаления — «УДАЛИТЬ» (красная рамка), иначе «ПРИМЕНИТЬ» */
export const changesConfirm = (changes: readonly ChangeDraft[]): { label: string; danger: boolean } =>
  changes.length > 0 && changes.every((c) => c.action === 'delete') ? { label: 'УДАЛИТЬ', danger: true } : { label: 'ПРИМЕНИТЬ', danger: false };
