/**
 * Записи из быстрых действий: текст дела для буфера, дело из хотелки, «Смотреть» и идеи, правка-перенос дела.
 * Чистые функции: id и время приходят снаружи.
 */
import { notePlain, plainLine } from '@/lib/note';
import type { IsoDate } from '@/lib/calendarLayout';
import type { ChangeDraft, ChangePatch, Task, TaskDraft } from '@/lib/types';

/** Текст дела для буфера обмена: название, подзадачи плана строками «— …», описание */
export const taskClipText = (t: Pick<Task, 'title' | 'note'>, kids: readonly Pick<Task, 'title'>[] = []): string =>
  [t.title, ...kids.map((k) => `— ${k.title}`), notePlain(t.note ?? '').trim()].filter(Boolean).join('\n');

/** Правка-перенос: у серии с occ — только этот раз (store.applyChanges), иначе всё дело */
export const moveChange = (t: Pick<Task, 'id' | 'repeat' | 'date'>, occ: IsoDate | null, patch: ChangePatch): ChangeDraft => {
  return {
    key: `quick:${t.id}`,
    action: 'update',
    type: 'task',
    candidates: [t.id],
    chosen: t.id,
    patch,
    ...(occ && t.repeat && t.date ? { occ } : null),
  };
};

/** Новое дело без даты */
export const undatedTask = (title: string, note = ''): TaskDraft => ({ title, date: null, time: null, note });

/** «Купить подарок: Наушники» — дело из чужой хотелки */
export const giftTaskTitle = (title: string) => `Купить подарок: ${title.trim()}`;

const TITLE_MAX = 120;

/**
 * Идея → дело: первая фраза — в название (до 120 знаков), весь текст — в описание, если он длиннее
 * (как «Сделать делом» в старом меню идеи)
 */
export const splitIdea = (text: string): { title: string; note: string } => {
  // Разметка заметки (заголовок, пункты) в дело не переносится — только слова
  const t = text.split('\n').map(plainLine).filter(Boolean).join('\n');
  const m = t.match(/[.!?…](\s|$)|\n/);
  let first = m && m.index !== undefined ? t.slice(0, m.index + (m[0].startsWith('\n') ? 0 : 1)) : t;
  first = first.replace(/[.]$/, '').trim();
  if (first.length > TITLE_MAX) first = `${first.slice(0, TITLE_MAX - 3).trimEnd()}…`;
  const rest = t.replace(/[.]$/, '').trim();
  return { title: first, note: rest !== first ? t : '' };
};
