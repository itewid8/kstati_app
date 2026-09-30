/**
 * Обновление в фоне, когда приложение закрыто: раз в 15–30 минут (на iPhone — когда разрешит система)
 * телефон забирает новое с сервера, перерисовывает виджет и переставляет напоминания.
 * Так на виджете появляются дела, которые добавили другие участники группы.
 *
 * defineTask должен выполниться при загрузке кода — поэтому этот модуль подключается в index.ts.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncReminders } from './notify';
import { syncNow } from './sync';

export const BG_REFRESH = 'kstati-refresh';

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/** Забрать новое и обновить всё, что видно без приложения: виджет и напоминания */
export async function refreshInBackground(): Promise<void> {
  await withTimeout(syncNow(), 20_000);
  // Позднее подключение: виджет тянет за собой свои модули, а они нужны только здесь
  const { updateWidget } = require('@/widget/sync') as typeof import('@/widget/sync');
  updateWidget();
  await syncReminders(false);
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
