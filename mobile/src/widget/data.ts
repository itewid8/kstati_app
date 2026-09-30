/**
 * Данные для виджета на рабочем столе: ближайшие дела из всех групп (с повторами), только название и когда.
 * Приложение заранее считает список на два месяца вперёд; виджет сам отбрасывает то, что уже прошло.
 */
import { addDays, shortDate, toISODate } from '@/lib/dates';
import { expandTasks } from '@/lib/recur';
import { DEFAULT_WIDGET, type Task, type WidgetPrefs } from '@/lib/types';

export type WidgetItem = {
  /** id дела: у серии в виджете одна строка — ближайший раз */
  id: string;
  title: string;
  /** null — дело без даты (ими виджет добирает строки, если дел с датой мало) */
  date: string | null;
  time: string | null;
  /** Начало (мс): дело со временем — его время; на весь день — полночь следующего дня (весь день остаётся «ближайшим») */
  until: number;
};

/** Цвета виджета — те же, что в приложении (theme.ts), по выбранной теме */
export type WidgetColors = { bg: string; text: string; muted: string; mic: string; onMic: string; border: string };
export const WIDGET_DARK: WidgetColors = { bg: '#1E1E1E', text: '#E6E6E6', muted: '#8B8B8B', mic: '#E6E6E6', onMic: '#1E1E1E', border: '#333333' };
export const WIDGET_LIGHT: WidgetColors = { bg: '#FFFFFF', text: '#1A1A1A', muted: '#6B6B6B', mic: '#1A1A1A', onMic: '#FFFFFF', border: '#E5E5E5' };

export type WidgetSnapshot = { items: WidgetItem[]; dark: boolean; at: number };

/**
 * Итоговые цвета виджета. Каждый элемент — «как в теме», светлый или тёмный:
 *   фон (с непрозрачностью), названия, время, микрофон (значок на нём — цвета, контрастного микрофону).
 * «Как в теме»: фон — по теме телефона; текст и микрофон — контрастные к фону.
 */
export function widgetColors(dark: boolean, prefs: Partial<WidgetPrefs> | null | undefined) {
  const p = { ...DEFAULT_WIDGET, ...prefs };
  const pick = (tone: WidgetPrefs['bg'], auto: WidgetColors) => (tone === 'light' ? WIDGET_LIGHT : tone === 'dark' ? WIDGET_DARK : auto);
  const bgSet = pick(p.bg, dark ? WIDGET_DARK : WIDGET_LIGHT);
  // Светлый фон → тёмные буквы и наоборот; явный выбор — светлый текст = светлые буквы
  const ink = (tone: WidgetPrefs['text']) => (tone === 'light' ? WIDGET_DARK : tone === 'dark' ? WIDGET_LIGHT : bgSet);
  const hex = bgSet.bg.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = Math.round(Math.min(1, Math.max(0, p.opacity)) * 100) / 100;
  const micSet = ink(p.micTone);
  return {
    bg: `rgba(${r}, ${g}, ${b}, ${a})` as const,
    bgHex: bgSet.bg,
    alpha: a,
    text: ink(p.text).text,
    // Время «как в теме» — приглушённое; выбранное явно — в полную яркость (иначе не видно на обоях)
    time: p.time === 'auto' ? bgSet.muted : ink(p.time).text,
    muted: bgSet.muted,
    mic: micSet.mic,
    onMic: micSet.onMic,
    showMic: p.mic,
  };
}

const ms = (date: string, time: string | null) => {
  const [y, m, d] = date.split('-').map(Number);
  if (!time) return new Date(y, m - 1, d + 1).getTime();
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};

/**
 * Дела для виджета из всех моих групп: ближайшие с датой (с повторами, на 2 месяца вперёд).
 * Дела без даты не показываем — их бывает много, они забивают виджет. Выполненные и прошедшие — тоже.
 */
export function upcoming(tasks: Task[], groupIds: Set<string>, now = new Date()): WidgetItem[] {
  const from = toISODate(now);
  const to = toISODate(addDays(now, 60));
  const mine = tasks.filter((t) => groupIds.has(t.groupId));
  const dated = expandTasks(
    mine.filter((t) => t.date),
    from,
    to,
  )
    .filter((t) => !t.doneAt && t.date && t.date >= from && t.date <= to)
    .map((t) => ({ id: t.id, title: t.title, date: t.date!, time: t.time, until: ms(t.date!, t.time) }))
    .filter((x) => x.until > now.getTime())
    .sort((a, b) => a.until - b.until || a.title.localeCompare(b.title, 'ru'))
    .slice(0, 60);
  return dated;
}

/** Что показать в момент now: первые n ещё не прошедших, у серии — только ближайший раз */
export function visibleAt(items: WidgetItem[], now: number, n: number): WidgetItem[] {
  const seen = new Set<string>();
  const out: WidgetItem[] = [];
  for (const x of items) {
    if (x.until <= now || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/** «19:00» сегодня, «завтра 10:00», «сб 4 окт», «сегодня» — коротко, для строки виджета */
export function whenLabel(x: Pick<WidgetItem, 'date' | 'time'>, now: number): string {
  if (!x.date) return x.time ?? '';
  const today = toISODate(new Date(now));
  const tomorrow = toISODate(addDays(new Date(now), 1));
  const day = x.date === today ? '' : x.date === tomorrow ? 'завтра' : shortDate(x.date);
  if (x.time) return day ? `${day} ${x.time}` : x.time;
  return day || 'сегодня';
}
