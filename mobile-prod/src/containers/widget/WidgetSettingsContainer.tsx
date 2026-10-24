/**
 * Настройки виджета. Без widgetId — общие для всех виджетов (из настроек приложения): сохраняются в «default»,
 * свои настройки виджетов сбрасываются. С widgetId — окно «Настроить» одного виджета на Android.
 */
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  myGroups,
  prefsFor,
  todayOf,
  visibleAt,
  faceDays,
  faceWhen,
  type WidgetItem,
  widgetFile,
  widgetHeader,
  withSharedPrefs,
  withWidgetPrefs,
  type WidgetPrefs,
} from '@/lib/widgetData';
import { useTheme } from '@/ui';
import { WidgetSettingsScreen, type WidgetPreviewData, type WidgetSize } from '@/screens/widget/WidgetSettingsScreen';
import { finishWidgetConfig, reloadWidget, reloadWidgets } from '../../../modules/kstati-widget';
import { readPrefsFile, writePrefsFile } from '../../widget/files';
import { updateWidget } from '../../widget/sync';
import { useInsets } from '../common';

type Props = { widgetId?: number };

const samePrefs = (a: WidgetPrefs, b: WidgetPrefs) => JSON.stringify(a) === JSON.stringify(b);

export function WidgetSettingsContainer({ widgetId }: Props) {
  const insets = useInsets();
  const me = useStore((s) => s.me);
  const allGroups = useStore((s) => s.groups);
  const groups = useMemo(() => (me ? myGroups({ me, groups: allGroups }) : []), [me, allGroups]);
  const initial = useMemo(() => prefsFor(readPrefsFile(), widgetId ?? null), [widgetId]);
  const [prefs, setPrefs] = useState(initial);
  const { scheme } = useTheme();
  const users = useStore((s) => s.users);
  const tasks = useStore((s) => s.tasks);
  const theme = useStore((s) => s.theme);
  const file = useMemo(() => (me ? widgetFile({ me, users, groups: allGroups, tasks }, theme, new Date()) : null), [me, users, allGroups, tasks, theme]);
  const [size, setSize] = useState<WidgetSize>('4x2');
  const preview = useMemo((): WidgetPreviewData => {
    const now = Date.now();
    const today = todayOf(now);
    const items = file ? visibleAt(file.items, now, 6, prefs.groups) : [];
    const dark = scheme === 'dark';
    const strip = (x: WidgetItem) => x.c.map((pair) => (dark ? pair[1] : pair[0]));
    return {
      header: widgetHeader(file?.groups ?? [], prefs.groups, today),
      days: faceDays(items, today).map((d) => ({
        key: d.date,
        label: d.label,
        rows: d.items.map((x) => ({ key: `${x.id}@${x.occ ?? ''}`, title: x.title, time: x.time ?? '—', strip: strip(x), done: x.d === true })),
      })),
      items: items.slice(0, 5).map((x) => ({ key: `${x.id}@${x.occ ?? ''}`, title: x.title, when: faceWhen(x.date, x.time, today, true), strip: strip(x) })),
      dark,
    };
  }, [file, prefs.groups, scheme]);

  const close = useCallback(
    (saved: boolean) => {
      if (widgetId !== undefined) finishWidgetConfig(saved);
      else if (router.canGoBack()) router.back();
    },
    [widgetId],
  );

  const onSave = useCallback(() => {
    try {
      writePrefsFile(widgetId !== undefined ? withWidgetPrefs(readPrefsFile(), widgetId, prefs) : withSharedPrefs(prefs));
      updateWidget();
      if (widgetId !== undefined) reloadWidget(widgetId);
      else reloadWidgets();
    } catch (e) {
      console.warn('Настройки виджета не сохранены', e);
    }
    close(true);
  }, [prefs, widgetId, close]);

  return (
    <WidgetSettingsScreen
      prefs={prefs}
      preview={preview}
      size={size}
      onChangeSize={setSize}
      groups={groups}
      canSave={!samePrefs(prefs, initial)}
      insets={insets}
      onChange={setPrefs}
      onCancel={() => close(false)}
      onSave={onSave}
    />
  );
}
