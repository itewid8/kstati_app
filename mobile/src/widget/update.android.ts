import { reloadWidgets } from '../../modules/kstati-widget';
import type { WidgetSnapshot } from './data';

/** Перерисовать все виджеты «Кстати» на рабочем столе: widget.json уже записан, виджет прочитает его сам */
export function pushWidget(_snap: WidgetSnapshot) {
  try {
    reloadWidgets();
  } catch (e) {
    console.warn('Виджет не обновлён', e);
  }
}
