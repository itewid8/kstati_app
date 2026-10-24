/**
 * Нативный виджет «Кстати» на Android (модуль modules/kstati-widget).
 * Виджет сам читает widget.json и widget-prefs.json из папки приложения (src/widget/files.ts); отсюда только просим
 * перерисовать и закрываем окно настроек. На iOS и в вебе модуля нет — вызовы ничего не делают.
 */
import { requireOptionalNativeModule } from 'expo';

type Native = {
  reload(): void;
  reloadWidget(widgetId: number): void;
  finishConfig(ok: boolean): void;
};

const native = requireOptionalNativeModule<Native>('KstatiWidget');

/** Перерисовать все виджеты на рабочем столе */
export const reloadWidgets = () => {
  native?.reload();
};

/** Перерисовать один виджет (живое превью из окна его настроек) */
export const reloadWidget = (widgetId: number) => {
  native?.reloadWidget(widgetId);
};

/** Закрыть окно настроек виджета: ok — сохранили, иначе отмена */
export const finishWidgetConfig = (ok: boolean) => {
  native?.finishConfig(ok);
};
