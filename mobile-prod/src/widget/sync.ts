/**
 * Виджет следит за делами: изменились дела, люди, группы или тема — через 1,5 с пересчитываем ближайшие дела,
 * пишем widget.json и просим Android перерисовать виджеты. При уходе в фон и возвращении — сразу.
 * На iOS виджет включается только со сборкой под платный аккаунт (app.config.js, KSTATI_IOS_WIDGET=1).
 */
import { AppState, Platform } from 'react-native';
import { useStore } from '@/lib/store';
import { widgetFile } from '@/lib/widgetData';
import { reloadWidgets } from '../../modules/kstati-widget';
import { writeWidgetFile } from './files';

export function updateWidget() {
  if (Platform.OS !== 'android') return;
  try {
    const s = useStore.getState();
    if (!s.me) return;
    writeWidgetFile(widgetFile({ me: s.me, users: s.users, groups: s.groups, tasks: s.tasks }, s.theme, new Date()));
    reloadWidgets();
  } catch (e) {
    console.warn('Виджет не обновлён', e);
  }
}

export function watchWidget(): () => void {
  if (Platform.OS !== 'android') return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(updateWidget, 1500);
  };
  schedule();
  const unsub = useStore.subscribe((s, p) => {
    if (s.tasks !== p.tasks || s.groups !== p.groups || s.users !== p.users || s.theme !== p.theme || s.me !== p.me) schedule();
  });
  const app = AppState.addEventListener('change', (st) => {
    if (st === 'background' || st === 'active') updateWidget();
  });
  return () => {
    unsub();
    app.remove();
    if (timer) clearTimeout(timer);
  };
}
