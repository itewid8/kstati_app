/**
 * Календарь телефона через expo-calendar (только чтение). Модуль подключается через require: нет модуля в сборке
 * (старая сборка без expo-calendar) — available() false, а приложение работает как раньше.
 */
import { Linking, Platform } from 'react-native';
import { isBirthdayCalendar, isHolidayCalendar, type PhoneCal, type PhoneEvent, type PhoneRule } from './phoneCalendar';

type Perm = { status: 'granted' | 'denied' | 'undetermined'; canAskAgain: boolean };
type NativeCal = {
  id: string;
  title?: string;
  color?: string;
  ownerAccount?: string;
  source?: { name?: string; type?: string };
  isVisible?: boolean;
  allowedAvailabilities?: string[];
};
type NativeEvent = {
  id: string;
  calendarId: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
  allDay?: boolean;
  notes?: string | null;
  location?: string | null;
  recurrenceRule?: PhoneRule | null;
};
type ExpoCalendar = {
  EntityTypes: { EVENT: string };
  getCalendarPermissionsAsync: () => Promise<Perm>;
  requestCalendarPermissionsAsync: () => Promise<Perm>;
  getCalendarsAsync: (type?: string) => Promise<NativeCal[]>;
  getEventsAsync: (calendarIds: string[], start: Date, end: Date) => Promise<NativeEvent[]>;
};

let mod: ExpoCalendar | null | undefined;
function cal(): ExpoCalendar | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-calendar') as ExpoCalendar;
  } catch {
    mod = null;
  }
  return mod;
}

/** В сборке есть модуль календаря */
export const phoneCalendarAvailable = () => !!cal();

/** Доступ: есть, можно спросить, отказано насовсем (только через настройки телефона) */
export type PhoneAccess = 'granted' | 'ask' | 'blocked' | 'unavailable';

export async function phoneAccess(): Promise<PhoneAccess> {
  const m = cal();
  if (!m) return 'unavailable';
  try {
    const p = await m.getCalendarPermissionsAsync();
    return p.status === 'granted' ? 'granted' : p.canAskAgain ? 'ask' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

export async function requestPhoneAccess(): Promise<PhoneAccess> {
  const m = cal();
  if (!m) return 'unavailable';
  try {
    const p = await m.requestCalendarPermissionsAsync();
    return p.status === 'granted' ? 'granted' : p.canAskAgain ? 'ask' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

/** Настройки приложения в телефоне — вернуть отказанный доступ */
export const openPhoneSettings = () => void Linking.openSettings().catch(() => {});

const accountOf = (c: NativeCal): string => {
  const raw = `${c.source?.name ?? ''} ${c.ownerAccount ?? ''}`.toLowerCase();
  if (isBirthdayCalendar(c.title ?? '', c.id, c.ownerAccount)) return 'КОНТАКТЫ';
  if (raw.includes('gmail') || raw.includes('google')) return 'GOOGLE';
  if (raw.includes('yandex') || raw.includes('ya.ru')) return 'ЯНДЕКС';
  if (raw.includes('outlook') || raw.includes('hotmail') || raw.includes('exchange')) return 'MICROSOFT';
  if (raw.includes('icloud')) return 'ICLOUD';
  if (raw.includes('mail.ru') || raw.includes('inbox.ru') || raw.includes('bk.ru') || raw.includes('list.ru')) return 'MAIL.RU';
  return (c.source?.name ?? 'ТЕЛЕФОН').toUpperCase().slice(0, 24);
};

/** Календари телефона */
export async function phoneCalendars(): Promise<PhoneCal[]> {
  const m = cal();
  if (!m) return [];
  const list = await m.getCalendarsAsync(m.EntityTypes.EVENT);
  return list.map((c) => {
    const title = (c.title ?? '').trim() || 'Календарь';
    return {
      id: String(c.id),
      title,
      account: accountOf(c),
      color: typeof c.color === 'string' && /^#[0-9a-f]{6}/i.test(c.color) ? c.color.slice(0, 7) : '#8C8C86',
      birthdays: isBirthdayCalendar(title, c.id, c.ownerAccount),
      holidays: isHolidayCalendar(title, c.id),
    };
  });
}

const iso = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v).toISOString();

/** Разы событий календарей ids в [from, to) */
export async function phoneEvents(ids: readonly string[], from: Date, to: Date): Promise<PhoneEvent[]> {
  const m = cal();
  if (!m || !ids.length) return [];
  const list = await m.getEventsAsync([...ids], from, to);
  return list.map((e) => ({
    id: String(e.id),
    calendarId: String(e.calendarId),
    title: (e.title ?? '').trim(),
    start: iso(e.startDate),
    end: iso(e.endDate),
    allDay: !!e.allDay,
    ...(e.notes ? { notes: e.notes } : null),
    ...(e.location ? { location: e.location } : null),
    rule: e.recurrenceRule ?? null,
  }));
}

/** Открыть событие в календаре телефона */
export function openInPhoneCalendar(ev: Pick<PhoneEvent, 'id' | 'start'>) {
  const url =
    Platform.OS === 'android'
      ? `content://com.android.calendar/events/${encodeURIComponent(ev.id)}`
      : `calshow:${Math.round((new Date(ev.start).getTime() - Date.UTC(2001, 0, 1)) / 1000)}`;
  void Linking.openURL(url).catch(() => {});
}
