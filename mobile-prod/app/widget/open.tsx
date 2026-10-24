import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { isPlan } from '@/adapters/common/tasks';
import { nav, param } from '@/containers/common/nav';
import { isSignedIn } from '@/containers/common/signedIn';
import { useStore } from '@/lib/store';

/**
 * Deep link kstatiapp://widget/open?id=…&occ=… — нажатие на дело в виджете.
 * Сначала вкладки (dismissTo: без второго (tabs) поверх открытого приложения), потом окно дела или сетка плана.
 */
export default function WidgetOpen() {
  const params = useLocalSearchParams<{ id?: string; occ?: string }>();
  useEffect(() => {
    const s = useStore.getState();
    if (!isSignedIn(s)) {
      router.replace('/login');
      return;
    }
    const id = param(params.id);
    const occ = param(params.occ);
    router.dismissTo('/tasks');
    const task = id ? s.tasks.find((t) => t.id === id) : undefined;
    if (!task) return;
    setTimeout(() => router.push(isPlan(task, s.tasks) ? nav.planGrid(task.id) : nav.taskEditor({ id: task.id, occ })), 50);
  }, [params.id, params.occ]);
  return null;
}
