/**
 * Напоминания на самом телефоне — без сервера и push.
 * Из дел с датой и правил («за неделю», «накануне», «за 2 часа»…) считаем моменты напоминаний
 * и ставим их в системный планировщик. При любом изменении дел или настроек — пересчитываем всё заново.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, shortDate, toISODate } from './dates';
import { occurrences } from './recur';
import { effectiveSpecs, eventStart, moment } from './remind';
import { useStore } from './store';
import type { ReminderSettings, Task, TaskReminderOverride } from './types';

const CHANNEL = 'reminders';
/** Android держит ограниченное число запланированных уведомлений — ставим только ближайшие */
const MAX_SCHEDULED = 60;
/** Повторы серий смотрим на 60 дней вперёд (плюс запас на «за месяц») */
const HORIZON_DAYS = 62;

export type Trigger = { taskId: string; date: Date; title: string; body: string };

/** Когда и что напомнить по одному делу (у серии — по каждому ближайшему повтору) */
export function triggersFor(task: Task, settings: ReminderSettings, mine: TaskReminderOverride | undefined, groupName: string, now = new Date()): Trigger[] {
  if (!settings.enabled || !task.date || task.doneAt) return [];
  const { specs } = effectiveSpecs(task, mine, settings);
  if (!specs.length) return [];
  const today = toISODate(now);
  // Для «за месяц» ищем повторы чуть дальше горизонта, но ставим только то, что сработает скоро
  const dates = task.repeat ? occurrences(task, today, toISODate(addDays(now, HORIZON_DAYS + 31)), 200).filter((d) => !task.doneDates?.includes(d)) : [task.date];
  const out: Trigger[] = [];
  for (const date of dates) {
    const start = eventStart(date, task.time);
    for (const spec of specs) {
      const m = moment(spec, date, task.time);
      if (!m) continue;
      if (m.getTime() <= now.getTime() + 30_000) continue; // прошедшие не ставим
      if (task.time && m.getTime() > start.getTime()) continue; // «в день события в 09:00» у дела в 08:00 — уже поздно
      // «Завтра в 19:00 · Мы с котиком», «сб 4 окт · Семья»
      const day = date === toISODate(m) ? 'Сегодня' : date === toISODate(addDays(m, 1)) ? 'Завтра' : shortDate(date);
      out.push({ taskId: task.id, date: m, title: task.title, body: [task.time ? `${day} в ${task.time}` : day, groupName].filter(Boolean).join(' · ') });
    }
  }
  return out;
}

let setupDone = false;
async function setup() {
  if (setupDone) return;
  setupDone = true;
  Notifications.setNotificationHandler({
    // Приложение открыто — всё равно показываем баннер
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Напоминания о делах',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#D13438',
    });
  }
}

/** Разрешение на уведомления: спрашиваем, только когда есть что напоминать */
async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

let running: Promise<void> | null = null;
let again = false;

/** Пересчитать и поставить все напоминания заново */
export async function syncReminders(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      await setup();
      const s = useStore.getState();
      const groupName = (id: string) => s.groups.find((g) => g.id === id)?.name ?? '';
      const all = s.me
        ? s.tasks.flatMap((t) => triggersFor(t, s.reminders, s.overrides[t.id], groupName(t.groupId)))
        : [];
      all.sort((a, b) => a.date.getTime() - b.date.getTime());
      const next = all.slice(0, MAX_SCHEDULED);

      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!next.length || !(await ensurePermission())) return;
      for (const t of next) {
        await Notifications.scheduleNotificationAsync({
          content: { title: t.title, body: t.body, data: { taskId: t.taskId } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.date, channelId: CHANNEL },
        });
      }
    } catch (e) {
      console.warn('Напоминания не поставлены', e);
    }
  })();
  await running;
  running = null;
  if (again) {
    again = false;
    await syncReminders();
  }
}

/** Следим за делами и настройками: изменились — через секунду пересчитываем */
export function watchReminders(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(syncReminders, 1000);
  };
  schedule();
  const unsub = useStore.subscribe((s, prev) => {
    if (s.tasks !== prev.tasks || s.reminders !== prev.reminders || s.overrides !== prev.overrides || s.me !== prev.me || s.groups !== prev.groups) schedule();
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}
