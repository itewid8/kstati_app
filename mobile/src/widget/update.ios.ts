import { addDays, startOfDay } from '@/lib/dates';
import { visibleAt, whenLabel, WIDGET_DARK, WIDGET_LIGHT, type WidgetSnapshot } from './data';
import KstatiWidget, { type IosWidgetProps } from './ios';

/**
 * iPhone сам не пересчитывает виджет, поэтому отдаём «расписание»: какие дела показывать
 * с какого момента — сейчас, после начала каждого ближайшего дела и в полночь (меняется «завтра» → «сегодня»).
 */
export function pushWidget(snap: WidgetSnapshot) {
  const pal = (c: typeof WIDGET_DARK) => [c.bg, c.text, c.muted, c.mic, c.onMic];
  const now = Date.now();
  const midnights = [1, 2, 3].map((n) => addDays(startOfDay(new Date(now)), n).getTime());
  const moments = [...new Set([now, ...snap.items.filter((x) => x.date).slice(0, 10).map((x) => x.until), ...midnights])]
    .filter((t) => t >= now)
    .sort((a, b) => a - b)
    .slice(0, 16);
  const entries = moments.map((t) => ({
    date: new Date(t),
    props: {
      rows: visibleAt(snap.items, t, 8).map((x) => ({ title: x.title, when: whenLabel(x, t) })),
      // Тему телефона виджет знает сам — отдаём обе палитры
      light: pal(WIDGET_LIGHT),
      dark: pal(WIDGET_DARK),
    } satisfies IosWidgetProps,
  }));
  try {
    KstatiWidget.updateTimeline(entries);
  } catch {
    /* виджет ещё не добавлен или сборка без виджета */
  }
}
