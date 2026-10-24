/**
 * iPhone сам не пересчитывает виджет: отдаём «расписание» — что показывать сейчас, после начала каждого ближайшего
 * дела и в каждую из трёх ближайших полуночей. Вызывать из src/widget/sync.ts после записи widget.json (на iOS).
 */
import { visibleAt, whenParts, widgetHeader, todayOf, type WidgetFile } from '@/lib/widgetData';
import { palettes } from '@/ui/tokens';
import KstatiWidget, { type IosWidgetProps } from './ios';

const pal = (p: typeof palettes.light) => [p.bg, p.panel, p.text, p.muted, p.red];

export function pushIosWidget(file: WidgetFile) {
  const now = Date.now();
  const day = 86_400_000;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const moments = [...new Set([now, ...file.items.slice(0, 10).map((x) => x.until), ...[1, 2, 3].map((n) => midnight.getTime() + n * day)])]
    .filter((t) => t >= now)
    .sort((a, b) => a - b)
    .slice(0, 16);
  const entries = moments.map((t) => {
    const today = todayOf(t);
    const head = widgetHeader(file.groups, [], today);
    const props: IosWidgetProps = {
      label: head.label,
      today: `${head.weekday} ${head.day}`,
      rows: visibleAt(file.items, t, 8, []).map((x) => ({ title: x.title, ...whenParts(x.date, x.time, today) })),
      light: pal(palettes.light),
      dark: pal(palettes.dark),
    };
    return { date: new Date(t), props };
  });
  try {
    KstatiWidget.updateTimeline(entries);
  } catch {
    /* виджет не добавлен или сборка без виджета */
  }
}
