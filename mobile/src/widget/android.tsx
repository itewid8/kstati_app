/**
 * Виджет «Кстати» для Android (react-native-android-widget): ближайшие дела и микрофон.
 * Нажатие на микрофон — kstati://record: приложение открывается сразу в записи.
 * Нажатие на список — kstati://tasks.
 * У каждого виджета свои настройки (микрофон, прозрачность, цвет текста) — экран WidgetConfig
 * открывается долгим нажатием на виджет → «Настроить». Хранятся в widget-prefs.json по id виджета.
 * Рисуется из JS: приложением при изменениях (update.android.tsx) и самим Android (widgetTaskHandler) —
 * тогда список дел берётся из widget.json, который приложение пишет при каждом изменении.
 */
import React from 'react';
import { File, Paths } from 'expo-file-system';
import { FlexWidget, SvgWidget, TextWidget, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { DEFAULT_WIDGET, type WidgetPrefs } from '@/lib/types';
import { visibleAt, whenLabel, widgetColors, type WidgetSnapshot } from './data';

export const ANDROID_WIDGET = 'Kstati';

const mic = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>`;

type Hex = `#${string}`;

/** Отступ карточки от краёв ячейки — как у системных виджетов (погода и др.), чтобы стоять ровно по сетке */
const INSET = 6;
const PAD = 14;
const GAP = 10;
const ROW_H = 22;

export function KstatiWidget({
  snap,
  prefs,
  width,
  height,
  now,
}: {
  snap: WidgetSnapshot | null;
  prefs: WidgetPrefs;
  width: number;
  height: number;
  now: number;
}) {
  const c = widgetColors(snap?.dark !== false, prefs);
  const W = Math.max(60, width - INSET * 2);
  const H = Math.max(40, height - INSET * 2);
  const micSize = H < 64 ? 34 : 40;
  // Раскладка по размеру: узкий — только микрофон; высокий — дела сверху во всю ширину, микрофон снизу;
  // низкий — дела слева, микрофон справа
  const micOnly = c.showMic && W < 100;
  const tall = H >= 120;
  const listWidth = tall || !c.showMic ? W - PAD * 2 : Math.max(40, W - PAD * 2 - micSize - GAP);
  const room = tall ? H - PAD * 2 - (c.showMic ? micSize + 8 : 0) : H - 12;
  const rows = visibleAt(snap?.items ?? [], now, Math.max(1, Math.min(8, Math.floor(room / ROW_H))));

  const list = (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kstati://tasks' }}
      style={{ width: listWidth, flexDirection: 'column', justifyContent: tall ? 'flex-start' : 'center', ...(tall ? {} : { height: 'match_parent' }) }}
    >
      {rows.length === 0 ? (
        <TextWidget text="Дел нет" style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.time as Hex }} />
      ) : (
        rows.map((r, i) => {
          const when = whenLabel(r, now);
          // Время слева, название сразу за ним — без пустоты посередине
          return (
            <FlexWidget key={`${r.id}-${i}`} style={{ width: listWidth, height: ROW_H, flexDirection: 'row', alignItems: 'center' }}>
              {when ? (
                <TextWidget text={when} maxLines={1} style={{ marginRight: 8, fontSize: 12, fontFamily: 'GeistMono_400Regular', color: c.time as Hex }} />
              ) : null}
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.text as Hex }} />
              </FlexWidget>
            </FlexWidget>
          );
        })
      )}
    </FlexWidget>
  );

  const micButton = (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kstati://record' }}
      style={{ width: micSize, height: micSize, borderRadius: micSize / 2, backgroundColor: c.mic as Hex, alignItems: 'center', justifyContent: 'center' }}
    >
      <SvgWidget svg={mic(c.onMic)} style={{ width: 18, height: 18 }} />
    </FlexWidget>
  );

  return (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding: INSET }}>
      <FlexWidget
        style={{
          width: W,
          height: H,
          backgroundColor: c.bg,
          borderRadius: 22,
          padding: tall ? PAD : 0,
          paddingHorizontal: PAD,
          flexDirection: tall ? 'column' : 'row',
          alignItems: tall ? 'flex-start' : 'center',
          justifyContent: micOnly ? 'center' : 'space-between',
        }}
      >
        {/* Без фрагментов: библиотека виджетов их не разворачивает */}
        {!micOnly && list}
        {!micOnly && tall && c.showMic ? (
          <FlexWidget style={{ width: W - PAD * 2, flexDirection: 'row', justifyContent: 'flex-end' }}>{micButton}</FlexWidget>
        ) : null}
        {micOnly || (!tall && c.showMic) ? micButton : null}
      </FlexWidget>
    </FlexWidget>
  );
}

const readJson = <T,>(name: string): T | null => {
  try {
    const f = new File(Paths.document, name);
    return f.exists ? (JSON.parse(f.textSync()) as T) : null;
  } catch {
    return null;
  }
};

/** Последний список дел, записанный приложением (widget.json) */
export const readSnapshot = () => readJson<WidgetSnapshot>('widget.json');

/** Настройки конкретного виджета (у каждого на рабочем столе свои) */
export const readPrefs = (widgetId: number): WidgetPrefs => ({ ...DEFAULT_WIDGET, ...readJson<Record<string, WidgetPrefs>>('widget-prefs.json')?.[widgetId] });

export function savePrefs(widgetId: number, p: WidgetPrefs) {
  const all = readJson<Record<string, WidgetPrefs>>('widget-prefs.json') ?? {};
  all[widgetId] = p;
  const f = new File(Paths.document, 'widget-prefs.json');
  if (!f.exists) f.create();
  f.write(JSON.stringify(all));
}

/** Android просит нарисовать виджет: добавили на экран, изменили размер, прошло 30 минут */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED' || props.widgetAction === 'WIDGET_CLICK') return;
  const { width, height, widgetId } = props.widgetInfo;
  // Плановое обновление (раз в 30 минут) — сначала забираем новое с сервера: дела могли добавить другие
  if (props.widgetAction === 'WIDGET_UPDATE') {
    try {
      const { refreshInBackground } = require('@/lib/background') as typeof import('@/lib/background');
      await refreshInBackground();
    } catch {
      /* нет связи — рисуем то, что есть */
    }
  }
  props.renderWidget(<KstatiWidget snap={readSnapshot()} prefs={readPrefs(widgetId)} width={width} height={height} now={Date.now()} />);
}
