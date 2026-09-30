import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ANDROID_WIDGET, KstatiWidget, readPrefs } from './android';
import type { WidgetSnapshot } from './data';

/** Перерисовать все виджеты «Кстати» на рабочем столе (у каждого — свои настройки) */
export function pushWidget(snap: WidgetSnapshot) {
  requestWidgetUpdate({
    widgetName: ANDROID_WIDGET,
    renderWidget: (info) => <KstatiWidget snap={snap} prefs={readPrefs(info.widgetId)} width={info.width} height={info.height} now={Date.now()} />,
    widgetNotFound: () => {},
  }).catch((e) => console.warn('Виджет не обновлён', e));
}
