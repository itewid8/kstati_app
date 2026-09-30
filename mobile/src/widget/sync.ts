/**
 * Виджет следит за делами: изменились дела, группы или тема — через 1,5 с пересчитываем ближайшие дела,
 * пишем их в widget.json (его читает Android, когда перерисовывает виджет сам) и обновляем виджет.
 * При уходе приложения в фон — обновляем сразу, чтобы на рабочем столе было свежее.
 */
import { File, Paths } from 'expo-file-system';
import { Appearance, AppState } from 'react-native';
import { useStore } from '@/lib/store';
import { upcoming, type WidgetSnapshot } from './data';
import { pushWidget } from './update';

function snapshot(): WidgetSnapshot {
  const s = useStore.getState();
  const mine = new Set(s.me ? s.groups.filter((g) => g.memberIds.includes(s.me!.id)).map((g) => g.id) : []);
  const dark = s.theme === 'system' ? Appearance.getColorScheme() !== 'light' : s.theme === 'dark';
  return { items: s.me ? upcoming(s.tasks, mine) : [], dark, at: Date.now() };
}

export function updateWidget() {
  try {
    const snap = snapshot();
    const f = new File(Paths.document, 'widget.json');
    if (!f.exists) f.create();
    f.write(JSON.stringify(snap));
    pushWidget(snap);
  } catch (e) {
    console.warn('Виджет не обновлён', e);
  }
}

export function watchWidget(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(updateWidget, 1500);
  };
  schedule();
  const unsub = useStore.subscribe((s, p) => {
    if (s.tasks !== p.tasks || s.groups !== p.groups || s.theme !== p.theme || s.me !== p.me) schedule();
  });
  const app = AppState.addEventListener('change', (st) => st === 'background' && updateWidget());
  const scheme = Appearance.addChangeListener(schedule);
  return () => {
    unsub();
    app.remove();
    scheme.remove();
    if (timer) clearTimeout(timer);
  };
}
