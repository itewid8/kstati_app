/**
 * Обновление в фоне, когда приложение закрыто: раз в 15–30 минут (на iPhone — когда разрешит система)
 * телефон забирает новое с сервера и переставляет напоминания — так приходят напоминания о делах,
 * которые добавили другие участники группы. (Виджета в «Кстати β» нет.)
 *
 * defineTask должен выполниться при загрузке кода — поэтому этот модуль подключается в index.ts.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncReminders } from './notify';
import { flushStorage } from './storage';
import { syncNow } from './sync';
import { updateWidget } from '../widget/sync';

export const BG_REFRESH = 'kstati-refresh';

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/** Забрать новое и переставить напоминания */
export async function refreshInBackground(): Promise<void> {
  try {
    await withTimeout(syncNow(), 20_000);
    await syncReminders(false);
    updateWidget();
  } finally {
    // Система может остановить приложение сразу после задачи: отложенная запись очереди и карантина не успела бы
    flushStorage();
  }
}

TaskManager.defineTask(BG_REFRESH, async () => {
  try {
    await refreshInBackground();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Включить фоновое обновление (один раз; повторный вызов ничего не делает) */
export async function registerBackgroundRefresh(): Promise<void> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BG_REFRESH)) return;
    await BackgroundTask.registerTaskAsync(BG_REFRESH, { minimumInterval: 15 });
  } catch (e) {
    console.warn('Фоновое обновление не включено', e);
  }
}
