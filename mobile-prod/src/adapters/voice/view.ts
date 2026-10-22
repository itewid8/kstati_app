/**
 * Какие голосовые карточки (s.card) рисует VoiceHost, а какие — старый CardSheet (INTEGRATION.md 3.7).
 * VoiceHost: одна новая запись (C-Voice), одна правка (C-AskDelete / C-AskMove), ответ о планах (C-AskWeek/-Weekend),
 * ошибка. CardSheet: несколько записей или правок, правка карточки (editing), дубликат, ручное добавление.
 * Одна и та же функция в обоих местах — карточка не теряется и не рисуется дважды.
 */
import { duplicateOf } from '@/lib/dupes';
import type { PlansAnswer } from '@/lib/plans';
import type { ChangeDraft, DraftItem } from '@/lib/types';
import type { Clock, Snapshot } from '../snapshot';
import { deleteSheetProps, moveSheetProps } from './change';
import type { ProblemCard } from './problem';

/** Голосовые варианты Card из хранилища (структурно) */
export type VoiceCard =
  | { source: 'voice' | 'manual' | 'edit'; transcript?: string; items: DraftItem[]; editing: boolean }
  | { source: 'voice'; transcript: string; changes: ChangeDraft[] }
  | { source: 'voice'; transcript: string; plans: PlansAnswer }
  | ({ source: 'voice' } & ProblemCard);

export type VoiceView =
  | { kind: 'create'; item: DraftItem; transcript: string }
  | { kind: 'delete'; change: ChangeDraft; transcript: string }
  | { kind: 'move'; change: ChangeDraft; transcript: string }
  | { kind: 'agenda'; answer: PlansAnswer; transcript: string }
  | { kind: 'problem'; card: ProblemCard };

/** Что рисует VoiceHost; null — карточка не его (её рисует CardSheet) */
export function voiceView(card: VoiceCard | null, s: Snapshot, clock: Clock): VoiceView | null {
  if (!card || card.source !== 'voice') return null;
  if ('problem' in card) return { kind: 'problem', card };
  if ('plans' in card) return { kind: 'agenda', answer: card.plans, transcript: card.transcript };
  if ('changes' in card) {
    const [change, ...rest] = card.changes;
    if (!change || rest.length) return null;
    // Запись пропала или показать нечего (правка без изменений) — старое окно
    if (change.action === 'delete') return deleteSheetProps(change, s, clock) ? { kind: 'delete', change, transcript: card.transcript } : null;
    return moveSheetProps(change, s, clock) ? { kind: 'move', change, transcript: card.transcript } : null;
  }
  const [item, ...rest] = card.items;
  if (!item || rest.length || card.editing) return null;
  // Такая запись уже есть — старое окно с предупреждением и «Всё равно добавить»
  const dup = duplicateOf(item, { tasks: s.tasks, watch: s.watch, wishes: s.wishes, topics: s.topics, groupId: s.currentGroupId, meId: s.me.id });
  if (dup && !item.force) return null;
  return { kind: 'create', item, transcript: card.transcript ?? '' };
}
