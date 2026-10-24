/**
 * Файлы виджета в папке документов приложения. Android-виджет (modules/kstati-widget) читает их сам:
 *   widget.json        — ближайшие дела, группы, тема (WidgetFile, src/lib/widgetData.ts)
 *   widget-prefs.json  — настройки: общие («default») и по id виджета
 */
import { File, Paths } from 'expo-file-system';
import { cleanPrefsFile, type WidgetFile, type WidgetPrefsFile } from '@/lib/widgetData';

const DATA = 'widget.json';
const PREFS = 'widget-prefs.json';

const write = (name: string, data: unknown) => {
  const f = new File(Paths.document, name);
  if (!f.exists) f.create();
  f.write(JSON.stringify(data));
};

const read = (name: string): unknown => {
  try {
    const f = new File(Paths.document, name);
    return f.exists ? JSON.parse(f.textSync()) : null;
  } catch {
    return null;
  }
};

export const writeWidgetFile = (file: WidgetFile) => write(DATA, file);
export const readPrefsFile = (): WidgetPrefsFile => cleanPrefsFile(read(PREFS));
export const writePrefsFile = (file: WidgetPrefsFile) => write(PREFS, file);
