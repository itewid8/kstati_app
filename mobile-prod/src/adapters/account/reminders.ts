/** Напоминания по умолчанию (страница «Напоминания»): правила, готовые варианты, есть ли что сохранить */
import { specLabel } from '@/lib/remind';
import type { ReminderSettings, ReminderSpec } from '@/lib/types';
import type { ReminderBlock, ReminderKind, RemindersScreenProps } from '@/screens/account/RemindersScreen';
import { orderSpecs, remindLabel } from '../editors/labels';
import { MAX_REMINDERS, REMIND_PRESETS } from '../editors/panels';
import type { DataOf } from '../snapshot';

export type RemindersDraft = Pick<ReminderSettings, 'timed' | 'allDay'>;

/**
 * Готовые варианты: у дел со временем — как в окне дела (C-EditRemind); у дел на весь день «за N минут» нет,
 * вместо них — дни до события
 */
export const DEFAULT_PRESETS: Record<ReminderKind, readonly ReminderSpec[]> = {
  timed: REMIND_PRESETS,
  allDay: ['d0@09:00', 'd1@20:00', 'd2@18:00', 'd3@20:00', 'd7@20:00', 'M1@20:00'],
};

/** Правило добавлено: ближе к началу — выше, без повторов, не больше MAX_REMINDERS */
export const withRule = (list: readonly ReminderSpec[], spec: ReminderSpec): ReminderSpec[] =>
  orderSpecs([...list, spec]).slice(0, MAX_REMINDERS);

export const withoutRule = (list: readonly ReminderSpec[], spec: ReminderSpec): ReminderSpec[] => list.filter((s) => s !== spec);

/** Одинаковые наборы правил (порядок не важен) */
export function sameRules(a: readonly ReminderSpec[], b: readonly ReminderSpec[]): boolean {
  const x = orderSpecs(a);
  const y = orderSpecs(b);
  return x.length === y.length && x.every((s, i) => s === y[i]);
}

export function reminderBlock(kind: ReminderKind, specs: readonly ReminderSpec[]): ReminderBlock {
  const rules = orderSpecs(specs);
  const full = rules.length >= MAX_REMINDERS;
  return {
    rules: rules.map((spec) => ({ spec, label: specLabel(spec) })),
    presets: DEFAULT_PRESETS[kind].map((key) =>
      full || rules.includes(key) ? { key, label: remindLabel(key), used: true } : { key, label: remindLabel(key) },
    ),
    full,
  };
}

export function remindersProps(draft: RemindersDraft, saved: RemindersDraft): DataOf<RemindersScreenProps> {
  return {
    timed: reminderBlock('timed', draft.timed),
    allDay: reminderBlock('allDay', draft.allDay),
    canSave: !sameRules(draft.timed, saved.timed) || !sameRules(draft.allDay, saved.allDay),
  };
}
