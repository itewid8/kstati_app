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
  // Совсем узкий — только микрофон (если он включён); по высоте — сколько дел помещается
  const micOnly = c.showMic && width < 110;
  const rows = visibleAt(snap?.items ?? [], now, height < 70 ? (c.showMic ? 1 : 2) : height < 100 ? 2 : height < 150 ? 3 : 4);
  const micSize = height < 70 ? 36 : 40;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: micOnly ? 'center' : 'space-between',
      }}
    >
      {!micOnly && (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kstati://tasks' }}
          style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginRight: c.showMic ? 10 : 0 }}
        >
          {rows.length === 0 ? (
            <TextWidget text="Дел нет" style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.muted as Hex }} />
          ) : (
            rows.map((r, i) => {
              const when = whenLabel(r, now);
              // Время слева, название сразу за ним — без пустоты посередине
              return (
                <FlexWidget key={`${r.id}-${i}`} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
                  {when ? (
                    <TextWidget
                      text={when}
                      maxLines={1}
                      style={{ marginRight: 8, fontSize: 12, fontFamily: 'GeistMono_400Regular', color: c.muted as Hex }}
                    />
                  ) : null}
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.text as Hex }} />
                  </FlexWidget>
                </FlexWidget>
              );
            })
          )}
        </FlexWidget>
      )}
      {c.showMic && (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kstati://record' }}
          style={{ width: micSize, height: micSize, borderRadius: micSize / 2, backgroundColor: c.mic as Hex, alignItems: 'center', justifyContent: 'center' }}
        >
          <SvgWidget svg={mic(c.onMic)} style={{ width: 18, height: 18 }} />
        </FlexWidget>
      )}
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
