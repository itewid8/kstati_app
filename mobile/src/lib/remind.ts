/**
 * Напоминания: разбор строк вида «m90», «d1@20:00», «M1@20:00», подписи и точный момент срабатывания.
 * Главное правило интерфейса: человек всегда видит, КОГДА именно придёт напоминание — день и время.
 */
import { fromISODate, shortDate } from './dates';
import type { ReminderRule, ReminderSettings, ReminderSpec, Task, TaskReminderOverride } from './types';

export type Parsed = { kind: 'm'; min: number } | { kind: 'd'; days: number; at: string } | { kind: 'M'; months: number; at: string };

export const SPEC_RE = /^(m\d{1,4}|[dM]\d{1,3}@\d{2}:\d{2})$/;

export function parse(spec: ReminderSpec): Parsed | null {
  if (!SPEC_RE.test(spec)) return null;
  if (spec[0] === 'm') return { kind: 'm', min: Number(spec.slice(1)) };
  const [n, at] = spec.slice(1).split('@');
  return spec[0] === 'd' ? { kind: 'd', days: Number(n), at } : { kind: 'M', months: Number(n), at };
}

export const specM = (min: number): ReminderSpec => `m${min}`;
export const specD = (days: number, at: string): ReminderSpec => `d${days}@${at}`;
export const specMonth = (months: number, at: string): ReminderSpec => `M${months}@${at}`;

/** Поменять время у «d…@…» и «M…@…» */
export function withTime(spec: ReminderSpec, at: string): ReminderSpec {
  const p = parse(spec);
  if (!p || p.kind === 'm') return spec;
  return p.kind === 'd' ? specD(p.days, at) : specMonth(p.months, at);
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

/** «1 ч 30 мин», «15 мин», «2 ч» */
export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Подпись: «За 1 ч 30 мин», «Накануне в 20:00», «В день события в 09:00», «За неделю в 20:00» */
export function specLabel(spec: ReminderSpec): string {
  const p = parse(spec);
  if (!p) return spec;
  if (p.kind === 'm') return p.min === 0 ? 'В момент начала' : `За ${duration(p.min)} до начала`;
  if (p.kind === 'M') return `${p.months === 1 ? 'За месяц' : `За ${p.months} ${plural(p.months, 'месяц', 'месяца', 'месяцев')}`} в ${p.at}`;
  if (p.days === 0) return `В день события в ${p.at}`;
  if (p.days === 1) return `Накануне в ${p.at}`;
  if (p.days === 7) return `За неделю в ${p.at}`;
  if (p.days === 14) return `За 2 недели в ${p.at}`;
  return `За ${p.days} ${plural(p.days, 'день', 'дня', 'дней')} в ${p.at}`;
}

const at = (date: string, hhmm: string) => {
  const d = fromISODate(date);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Точный момент напоминания для дела на date (time — если есть).
 * null — напоминание неприменимо: «за N минут» у дела без времени.
 */
export function moment(spec: ReminderSpec, date: string, time: string | null): Date | null {
  const p = parse(spec);
  if (!p) return null;
  if (p.kind === 'm') {
    if (!time) return null;
    return new Date(at(date, time).getTime() - p.min * 60000);
  }
  const d = at(date, p.at);
  if (p.kind === 'd') {
    d.setDate(d.getDate() - p.days);
    return d;
  }
  // «За месяц» до 31 марта — 28 (29) февраля, а не 3 марта
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - p.months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

/** Начало дела: время или начало дня */
export const eventStart = (date: string, time: string | null) => at(date, time ?? '00:00');

/** «пт 3 окт, 20:00» — когда именно придёт */
export function momentText(d: Date): string {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${shortDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Порядок в списке: раньше срабатывает — выше */
export function sortSpecs(specs: ReminderSpec[]): ReminderSpec[] {
  const ref = '2030-06-15';
  const key = (s: ReminderSpec) => moment(s, ref, '12:00')?.getTime() ?? 0;
  return [...new Set(specs)].sort((a, b) => key(a) - key(b));
}

/** Какие напоминания действуют для меня: мои личные → общие группы → мои по умолчанию */
export function effectiveSpecs(
  task: Pick<Task, 'time' | 'reminders'>,
  mine: TaskReminderOverride | undefined,
  settings: ReminderSettings,
): { specs: ReminderSpec[]; source: 'mine' | 'shared' | 'default' } {
  if (mine) return { specs: mine, source: 'mine' };
  if (task.reminders) return { specs: task.reminders, source: 'shared' };
  return { specs: task.time ? settings.timed : settings.allDay, source: 'default' };
}

/* ---------- готовые варианты для выбора ---------- */

export const PRESETS_TIMED: ReminderSpec[] = ['m0', 'm15', 'm30', 'm60', 'm90', 'm120', 'm180', 'd0@09:00', 'd1@20:00', 'd7@20:00', 'M1@20:00'];
export const PRESETS_ALLDAY: ReminderSpec[] = ['d0@09:00', 'd1@20:00', 'd2@20:00', 'd3@20:00', 'd7@20:00', 'M1@20:00'];

/** Короткая подпись для чипа: «15 мин», «1 ч 30 мин», «Накануне», «За неделю» */
export function presetChip(spec: ReminderSpec): string {
  const p = parse(spec);
  if (!p) return spec;
  if (p.kind === 'm') return p.min === 0 ? 'В момент начала' : duration(p.min);
  if (p.kind === 'M') return p.months === 1 ? 'За месяц' : `За ${p.months} мес`;
  if (p.days === 0) return 'В день события';
  if (p.days === 1) return 'Накануне';
  if (p.days === 7) return 'За неделю';
  return `За ${p.days} ${plural(p.days, 'день', 'дня', 'дней')}`;
}

/** Одна строка для превью: «накануне в 20:00, за 1 ч до начала» */
export function specsSummary(specs: ReminderSpec[] | undefined | null): string {
  if (!specs) return 'по умолчанию';
  if (!specs.length) return 'не напоминать';
  return sortSpecs(specs)
    .map((s) => specLabel(s))
    .map((s, i) => (i ? s[0].toLowerCase() + s.slice(1) : s))
    .join(', ');
}

/* ---------- перенос старых настроек (хранилище версии 1) ---------- */

export function migrateRules(rules: ReminderRule[], dayTime: string, sameDayTime: string): ReminderSpec[] {
  const map: Record<ReminderRule, ReminderSpec> = {
    week: specD(7, dayTime),
    days3: specD(3, dayTime),
    dayBefore: specD(1, dayTime),
    sameDay: specD(0, sameDayTime),
    h1: specM(60),
    h2: specM(120),
    h3: specM(180),
    h6: specM(360),
  };
  return rules.map((r) => map[r]).filter(Boolean);
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, timed: ['d1@20:00', 'm60'], allDay: ['d1@20:00', 'd0@09:00'] };
