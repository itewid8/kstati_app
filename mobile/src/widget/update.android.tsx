import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ANDROID_WIDGET, KstatiWidget } from './android';
import type { WidgetSnapshot } from './data';

/** Перерисовать виджеты на рабочем столе (если они есть) */
export function pushWidget(snap: WidgetSnapshot) {
  requestWidgetUpdate({
    widgetName: ANDROID_WIDGET,
    renderWidget: (info) => <KstatiWidget snap={snap} width={info.width} height={info.height} now={Date.now()} />,
    widgetNotFound: () => {},
  }).catch(() => {});
}
