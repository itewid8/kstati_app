/**
 * Виджет «Кстати» для Android (react-native-android-widget): ближайшие дела и микрофон.
 * Нажатие на микрофон — kstati://record: приложение открывается сразу в записи.
 * Нажатие на список — kstati://tasks.
 * Рисуется из JS: приложением при изменениях (update.android.tsx) и самим Android раз в 30 минут (widgetTaskHandler) —
 * тогда данные берутся из файла widget.json, который приложение пишет при каждом изменении дел.
 */
import React from 'react';
import { File, Paths } from 'expo-file-system';
import { FlexWidget, SvgWidget, TextWidget, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { visibleAt, whenLabel, WIDGET_DARK, WIDGET_LIGHT, type WidgetSnapshot } from './data';

export const ANDROID_WIDGET = 'Kstati';

const mic = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>`;

export function KstatiWidget({ snap, width, height, now }: { snap: WidgetSnapshot | null; width: number; height: number; now: number }) {
  const c = snap?.dark === false ? WIDGET_LIGHT : WIDGET_DARK;
  // Узкий виджет — только микрофон; по высоте — сколько дел помещается
  const micOnly = width < 150;
  const rows = visibleAt(snap?.items ?? [], now, height < 100 ? 2 : height < 150 ? 3 : 4);
  const micSize = Math.min(56, Math.max(44, height - 24));

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg as `#${string}`,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: micOnly ? 'center' : 'space-between',
      }}
    >
      {!micOnly && (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kstati://tasks' }}
          style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginRight: 10 }}
        >
          {rows.length === 0 ? (
            <TextWidget text="Дел нет" style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.muted as `#${string}` }} />
          ) : (
            rows.map((r, i) => (
              <FlexWidget
                key={`${r.date}-${r.time}-${i}`}
                style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}
              >
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text={r.title}
                    maxLines={1}
                    truncate="END"
                    style={{ fontSize: 14, fontFamily: 'Geist_400Regular', color: c.text as `#${string}` }}
                  />
                </FlexWidget>
                <TextWidget
                  text={whenLabel(r, now)}
                  maxLines={1}
                  style={{ marginLeft: 8, fontSize: 12, fontFamily: 'GeistMono_400Regular', color: c.muted as `#${string}` }}
                />
              </FlexWidget>
            ))
          )}
        </FlexWidget>
      )}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'kstati://record' }}
        style={{
          width: micSize,
          height: micSize,
          borderRadius: micSize / 2,
          backgroundColor: c.mic as `#${string}`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget svg={mic(c.onMic)} style={{ width: 26, height: 26 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Последний список дел, записанный приложением (widget.json) */
export function readSnapshot(): WidgetSnapshot | null {
  try {
    const f = new File(Paths.document, 'widget.json');
    return f.exists ? (JSON.parse(f.textSync()) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** Android просит нарисовать виджет: добавили на экран, изменили размер, прошло 30 минут */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED' || props.widgetAction === 'WIDGET_CLICK') return;
  const { width, height } = props.widgetInfo;
  props.renderWidget(<KstatiWidget snap={readSnapshot()} width={width} height={height} now={Date.now()} />);
}
