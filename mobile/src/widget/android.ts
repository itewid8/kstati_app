/**
 * Файлы виджета «Кстати» на Android. Сам виджет — нативный (modules/kstati-widget): рисуется разметкой Android
 * и читает эти файлы из папки приложения сам.
 *   widget.json        — ближайшие дела и тема (пишет src/widget/sync.ts)
 *   widget-prefs.json  — настройки каждого виджета по его id (экран WidgetConfig)
 *   widget-ui.json     — где открывать панель настроек: снизу или сверху
 */
import { File, Paths } from 'expo-file-system';
import { DEFAULT_WIDGET, type WidgetPrefs } from '@/lib/types';

const readJson = <T,>(name: string): T | null => {
  try {
    const f = new File(Paths.document, name);
    return f.exists ? (JSON.parse(f.textSync()) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (name: string, data: unknown) => {
  const f = new File(Paths.document, name);
  if (!f.exists) f.create();
  f.write(JSON.stringify(data));
};

/** Настройки конкретного виджета (у каждого на рабочем столе свои) */
export const readPrefs = (widgetId: number): WidgetPrefs => ({ ...DEFAULT_WIDGET, ...readJson<Record<string, WidgetPrefs>>('widget-prefs.json')?.[widgetId] });

export function savePrefs(widgetId: number, p: WidgetPrefs) {
  const all = readJson<Record<string, WidgetPrefs>>('widget-prefs.json') ?? {};
  all[widgetId] = p;
  writeJson('widget-prefs.json', all);
}

/** Где открывать панель настроек виджета — снизу или сверху экрана (её переносят перетаскиванием) */
export const readSheetTop = () => readJson<{ sheetTop?: boolean }>('widget-ui.json')?.sheetTop === true;
export const saveSheetTop = (top: boolean) => {
  try {
    writeJson('widget-ui.json', { sheetTop: top });
  } catch {
    /* не запомнили — в следующий раз откроется снизу */
  }
};
