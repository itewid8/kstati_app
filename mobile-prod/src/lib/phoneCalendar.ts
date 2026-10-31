/**
 * Календарь телефона → дела «Кстати»: чистый перевод без нативного модуля (его обёртка — lib/phoneCalendarNative.ts).
 *
 * Событие телефона приходит разом повтора (instance): начало и конец этого раза, правило серии.
 * Перевод: название, дата и время (весь день — без времени), конец (многодневное — дата конца), описание (+ место),
 * повтор — если правило ложится на наш Repeat; «второй вторник месяца» и подобное — только этот раз.
 * Календарь дней рождения (контакты) — тип «день рождения», каждый год, именинник из названия.
 * Отпечаток h — по содержимому: изменили событие в телефоне — у перенесённого дела отпечаток разойдётся («изменено»).
 */
import type { Repeat, TaskKind } from './types';

/** Календарь телефона */
export type PhoneCal = {
  id: string;
  title: string;
  /** Аккаунт: «GOOGLE», «ЯНДЕКС», «КОНТАКТЫ» */
  account: string;
  /** Свой цвет календаря (#rrggbb) */
  color: string;
  /** Календарь дней рождения из контактов */
  birthdays: boolean;
  /** Праздники — по умолчанию выключены */
  holidays: boolean;
};

/** Правило повтора как его отдаёт календарь (expo-calendar RecurrenceRule) */
export type PhoneRule = {
  frequency: string;
  interval?: number | null;
  endDate?: string | null;
  occurrence?: number | null;
  /** dayOfTheWeek: 1 — воскресенье … 7 — суббота; weekNumber ≠ 0 — «второй вторник» */
  daysOfTheWeek?: { dayOfTheWeek: number; weekNumber?: number | null }[] | null;
  daysOfTheMonth?: number[] | null;
  monthsOfTheYear?: number[] | null;
};

/** Раз события телефона */
export type PhoneEvent = {
  /** id события (серии) — по нему узнаём перенесённое */
  id: string;
  calendarId: string;
  title: string;
  /** Начало и конец этого раза, ISO */
  start: string;
  end: string;
  allDay: boolean;
  notes?: string;
  location?: string;
  rule?: PhoneRule | null;
};

/** Черновик дела из события */
export type PhoneDraft = {
  title: string;
  date: string;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  note: string;
  repeat: Repeat | null;
  kind?: Exclude<TaskKind, 'task'>;
  celebrant?: { name: string } | null;
};

/** Откуда перенесено (поле ext у дела) */
export type PhoneExt = { cal: string; id: string; h: string };

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const utcDayOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const shiftDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDayOf(d);
};

/**
 * Дни события: весь день — по UTC (календари хранят его полночью UTC), конец не входит;
 * со временем — по часам телефона.
 */
export function eventDays(ev: Pick<PhoneEvent, 'start' | 'end' | 'allDay'>): { date: string; endDate: string } {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  if (ev.allDay) {
    const date = utcDayOf(s);
    const last = shiftDay(utcDayOf(e), -1);
    return { date, endDate: last > date ? last : date };
  }
  const date = dayOf(s);
  // Конец ровно в полночь — последний день предыдущий
  const endDay = e.getHours() === 0 && e.getMinutes() === 0 && e > s ? dayOf(new Date(e.getTime() - 60000)) : dayOf(e);
  return { date, endDate: endDay > date ? endDay : date };
}

const FREQ: Record<string, Repeat['freq']> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

/** Правило ложится на наш повтор */
export function ruleSupported(rule: PhoneRule | null | undefined): boolean {
  if (!rule) return false;
  if (!FREQ[rule.frequency]) return false;
  return !(rule.daysOfTheWeek ?? []).some((d) => !!d.weekNumber);
}

/** Повтор из правила телефона; null — не повторяется или правило не ложится на наш повтор */
export function repeatOf(rule: PhoneRule | null | undefined): Repeat | null {
  if (!rule || !ruleSupported(rule)) return null;
  const freq = FREQ[rule.frequency]!;
  const r: Repeat = { freq, every: Math.max(1, Math.round(rule.interval ?? 1)) };
  const wd = (rule.daysOfTheWeek ?? []).map((d) => (d.dayOfTheWeek === 1 ? 7 : d.dayOfTheWeek - 1)).filter((d) => d >= 1 && d <= 7);
  if (freq === 'week' && wd.length) r.weekdays = [...new Set(wd)].sort((a, b) => a - b);
  const md = (rule.daysOfTheMonth ?? []).filter((d) => d === -1 || (d >= 1 && d <= 31));
  if ((freq === 'month' || freq === 'year') && md.length) r.monthDays = [...new Set(md)];
  const months = (rule.monthsOfTheYear ?? []).filter((m) => m >= 1 && m <= 12);
  if (freq === 'year' && months.length) r.months = [...new Set(months)].sort((a, b) => a - b);
  if (rule.endDate) r.until = dayOf(new Date(rule.endDate));
  else if (rule.occurrence && rule.occurrence > 0) r.count = Math.round(rule.occurrence);
  return r;
}

const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

/** «КАЖДЫЙ ПН», «КАЖДЫЕ 2 НЕДЕЛИ · ПН, СР», «КАЖДЫЙ ГОД» — подпись серии в списке переноса */
export function ruleText(r: Repeat, date: string): string {
  const every = r.every > 1;
  switch (r.freq) {
    case 'day':
      return every ? `КАЖДЫЕ ${r.every} ДН.` : 'КАЖДЫЙ ДЕНЬ';
    case 'week': {
      const days = (r.weekdays?.length ? r.weekdays : [((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1]).map((d) => WD[d - 1]).join(', ');
      return every ? `КАЖДЫЕ ${r.every} НЕД. · ${days}` : `КАЖДЫЙ ${days}`;
    }
    case 'month':
      return every ? `КАЖДЫЕ ${r.every} МЕС.` : `КАЖДЫЙ МЕСЯЦ · ${r.monthDays?.length ? r.monthDays.map((d) => (d === -1 ? 'ПОСЛ.' : d)).join(', ') : Number(date.slice(8))}-ГО`;
    default:
      return every ? `КАЖДЫЕ ${r.every} Г.` : 'КАЖДЫЙ ГОД';
  }
}

const BIRTHDAY_CAL = /birthday|contacts@group\.v\.calendar|день рожд|дни рожд/i;
const HOLIDAY_CAL = /holiday|праздник/i;
export const isBirthdayCalendar = (title: string, id = '', owner = '') => BIRTHDAY_CAL.test(`${title} ${id} ${owner}`);
export const isHolidayCalendar = (title: string, id = '') => HOLIDAY_CAL.test(`${title} ${id}`);

/** Имя именинника из названия: «День рождения Пети», «Петя's birthday», «ДР Пети» → как есть без приставки */
export function celebrantName(title: string): string {
  const t = title
    .replace(/^(день рождения|др)\s*[:—-]?\s*/i, '')
    .replace(/[’']s birthday$/i, '')
    .replace(/\s*[—-]?\s*(день рождения|birthday)$/i, '')
    .trim();
  return t || title.trim();
}

/** Событие → черновик дела */
export function toDraft(ev: PhoneEvent, cal?: Pick<PhoneCal, 'birthdays'>): PhoneDraft {
  const { date, endDate } = eventDays(ev);
  const title = ev.title.trim() || 'Без названия';
  const note = [ev.notes?.trim(), ev.location?.trim()].filter(Boolean).join('\n').slice(0, 2000);
  if (cal?.birthdays) {
    const name = celebrantName(title);
    return {
      title,
      date,
      time: null,
      endDate: null,
      endTime: null,
      note,
      repeat: repeatOf(ev.rule) ?? { freq: 'year', every: 1 },
      kind: 'birthday',
      celebrant: { name },
    };
  }
  if (ev.allDay) {
    return { title, date, time: null, endDate: endDate > date ? endDate : null, endTime: null, note, repeat: repeatOf(ev.rule) };
  }
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const time = timeOf(s);
  const endTime = e > s ? timeOf(e) : null;
  return {
    title,
    date,
    time,
    endDate: endDate > date ? endDate : null,
    endTime: endDate > date ? endTime : endTime && endTime > time ? endTime : null,
    note,
    repeat: repeatOf(ev.rule),
  };
}

/** Отпечаток содержимого события (base36): изменили в телефоне — отпечаток другой */
export function eventHash(ev: PhoneEvent): string {
  const r = ev.rule;
  const key = [
    ev.title.trim(),
    ev.allDay ? 'a' : '',
    ev.allDay ? eventDays(ev).date : ev.start,
    ev.allDay ? eventDays(ev).endDate : ev.end,
    ev.notes?.trim() ?? '',
    ev.location?.trim() ?? '',
    r ? JSON.stringify([r.frequency, r.interval ?? 1, r.endDate ?? '', r.occurrence ?? 0, r.daysOfTheWeek ?? [], r.daysOfTheMonth ?? [], r.monthsOfTheYear ?? []]) : '',
  ].join('\u0001');
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Повторяющееся событие: серию в списке показываем один раз */
export const isSeries = (ev: PhoneEvent) => !!repeatOf(ev.rule);

/** Настройки календарей телефона: слой в календаре; у календаря — показывать и куда переносить ('me' или id группы) */
export type PhoneCalSettings = { show: boolean; cals: Record<string, { on?: boolean; dest?: string }> };
export const NO_PHONE_SETTINGS: PhoneCalSettings = { show: false, cals: {} };

/** Календарь включён: по умолчанию все, кроме праздников */
export const calOn = (s: PhoneCalSettings, c: Pick<PhoneCal, 'id' | 'holidays'>) => s.cals[c.id]?.on ?? !c.holidays;
/** Куда переносить события календаря: по умолчанию — только мне */
export const calDest = (s: PhoneCalSettings, id: string) => s.cals[id]?.dest ?? 'me';
