/** Браузер: виджета нет — файлы для него не пишем, настройки по умолчанию */
import { cleanPrefsFile, type WidgetFile, type WidgetPrefsFile } from '@/lib/widgetData';

export const writeWidgetFile = (_file: WidgetFile) => {};
export const readPrefsFile = (): WidgetPrefsFile => cleanPrefsFile(null);
export const writePrefsFile = (_file: WidgetPrefsFile) => {};
