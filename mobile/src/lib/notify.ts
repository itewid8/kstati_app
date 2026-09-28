/**
 * Напоминания на самом телефоне — без сервера и push.
 * Из дел с датой и правил («за неделю», «накануне», «за 2 часа»…) считаем моменты напоминаний
 * и ставим их в системный планировщик. При любом изменении дел или настроек — пересчитываем всё заново.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fromISODate } from './dates';
import { useStore } from './store';
import type { ReminderRule, ReminderSettings, Task, TaskReminderOverride } from './types';

const CHANNEL = 'reminders';
/** Android держит ограниченное число запланированных уведомлений — ставим только ближайшие */
const MAX_SCHEDULED = 60;

const at = (date: string, hhmm: string) => {
  const d = fromISODate(date);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
const minusDays = (d: Date, n: number) => new Date(d.getTime() - n * 86400000);
const minusHours = (d: Date, n: number) => new Date(d.getTime() - n * 3600000);

const HOURS: Partial<Record<ReminderRule, number>> = { h1: 1, h2: 2, h3: 3, h6: 6 };

const hoursWord = (n: number) => (n === 1 ? 'час' : n < 5 ? 'часа' : 'часов');

export type Trigger = { taskId: string; date: Date; title: string; body: string };

/** Когда и что напомнить по одному делу */
export function triggersFor(task: Task, settings: ReminderSettings, override: TaskReminderOverride | undefined, groupName: string, now = new Date()): Trigger[] {
  if (!settings.enabled || !task.date || task.doneAt) return [];
  const rules = override ?? settings.rules;
  const event = task.time ? at(task.date, task.time) : at(task.date, '00:00');
  const when = task.time ? ` в ${task.time}` : '';
  const out: Trigger[] = [];
  const push = (date: Date, lead: string) => {
    if (date.getTime() <= now.getTime() + 30_000) return; // прошедшие не ставим
    out.push({ taskId: task.id, date, title: task.title, body: `${lead}${when} · ${groupName}` });
  };

  for (const r of rules) {
    if (r === 'week') push(minusDays(at(task.date, settings.dayTime), 7), 'Через неделю');
    else if (r === 'days3') push(minusDays(at(task.date, settings.dayTime), 3), 'Через 3 дня');
    else if (r === 'dayBefore') push(minusDays(at(task.date, settings.dayTime), 1), 'Завтра');
    else if (r === 'sameDay') {
      // Утром в день дела; если дело раньше этого времени — за час до него
      let d = at(task.date, settings.sameDayTime);
      if (task.time && d >= event) d = minusHours(event, 1);
      push(d, 'Сегодня');
    } else if (HOURS[r] && task.time) {
      const n = HOURS[r]!;
      push(minusHours(event, n), `Через ${n} ${hoursWord(n)}`);
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
