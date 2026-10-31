/**
 * Календарь телефона для экранов: доступ, календари, разы событий за видимый период (обновляются, когда приложение
 * снова на экране и когда меняют настройки календарей). Последние загруженные события запоминаются по ключу —
 * по нажатию на событие шторка берёт его отсюда.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { notImported, phoneKey } from '@/adapters/calendar/phone';
import type { IsoDate } from '@/lib/calendarLayout';
import { calOn, type PhoneCal, type PhoneEvent } from '@/lib/phoneCalendar';
import {
  phoneAccess,
  phoneCalendarAvailable,
  phoneCalendars,
  phoneEvents,
  requestPhoneAccess,
  type PhoneAccess,
} from '@/lib/phoneCalendarNative';
import { useStore } from '@/lib/store';
import { logError } from '@/lib/diag';

export const phoneRoutes = {
  calendars: () => '/settings/phone' as const,
  import: () => '/settings/phone-import' as const,
};

/** Последние загруженные разы и календари — для шторки */
const seen = new Map<string, PhoneEvent>();
const calsById = new Map<string, PhoneCal>();

/** Нажали событие телефона: шторка с переносом */
export function openPhoneKey(key: string) {
  const ev = seen.get(key);
  if (!ev) return;
  const cal = calsById.get(ev.calendarId) ?? { id: ev.calendarId, title: 'Календарь', account: 'ТЕЛЕФОН', color: '#8C8C86', birthdays: false, holidays: false };
  useStore.getState().setPhoneSheet({ ev, cal });
}

/** Ячейка «ТЕЛ»: выключить; включить — спросить доступ, отказано насовсем — на экран календарей (там «РАЗРЕШИТЬ») */
export async function togglePhoneLayer() {
  const s = useStore.getState();
  if (s.phoneCal.show) return s.setPhoneShow(false);
  if (!phoneCalendarAvailable()) return s.notice('Календарь телефона — в новой сборке приложения');
  let access = await phoneAccess();
  if (access === 'ask') access = await requestPhoneAccess();
  if (access === 'granted') s.setPhoneShow(true);
  else router.push(phoneRoutes.calendars());
}

/** Счётчик «приложение снова на экране» */
function useForeground(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);
  return tick;
}

/** Доступ и календари телефона; reload — перечитать (после «РАЗРЕШИТЬ») */
export function usePhoneCalendars(): { access: PhoneAccess | null; cals: PhoneCal[]; reload: () => void } {
  const [access, setAccess] = useState<PhoneAccess | null>(null);
  const [cals, setCals] = useState<PhoneCal[]>([]);
  const [n, setN] = useState(0);
  const fg = useForeground();
  // Экран снова показан (вернулись из настроек телефона, закрыли системное окно) — проверить доступ заново
  useFocusEffect(useCallback(() => setN((x) => x + 1), []));
  useEffect(() => {
    let alive = true;
    void (async () => {
      const a = await phoneAccess();
      if (!alive) return;
      setAccess(a);
      if (a !== 'granted') return setCals([]);
      try {
        const list = await phoneCalendars();
        if (!alive) return;
        list.forEach((c) => calsById.set(c.id, c));
        setCals(list);
      } catch (e) {
        logError(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [n, fg]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { access, cals, reload };
}

const startOf = (iso: IsoDate) => new Date(`${iso}T00:00:00`);
const dayAfter = (iso: IsoDate) => {
  const d = startOf(iso);
  d.setDate(d.getDate() + 1);
  return d;
};

/**
 * Разы событий включённых календарей в [from, to] (с запасом сутки — события через полночь).
 * active false — ничего не читаем. imported — показывать и уже перенесённые (экран переноса).
 */
export function usePhoneEvents(from: IsoDate, to: IsoDate, active: boolean, imported = false): { events: PhoneEvent[]; loading: boolean; cals: PhoneCal[] } {
  const settings = useStore((s) => s.phoneCal);
  const tasks = useStore((s) => s.tasks);
  const meId = useStore((s) => s.me?.id);
  const [raw, setRaw] = useState<{ events: PhoneEvent[]; cals: PhoneCal[] }>({ events: [], cals: [] });
  const [loading, setLoading] = useState(false);
  const fg = useForeground();
  const calsKey = JSON.stringify(settings.cals);
  useEffect(() => {
    if (!active) return setRaw({ events: [], cals: [] });
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        if ((await phoneAccess()) !== 'granted') return alive && setRaw({ events: [], cals: [] });
        const cals = await phoneCalendars();
        cals.forEach((c) => calsById.set(c.id, c));
        const on = cals.filter((c) => calOn(useStore.getState().phoneCal, c)).map((c) => c.id);
        const from0 = startOf(from);
        from0.setDate(from0.getDate() - 1);
        const list = await phoneEvents(on, from0, dayAfter(to));
        list.forEach((e) => seen.set(phoneKey(e), e));
        if (alive) setRaw({ events: list, cals });
      } catch (e) {
        logError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to, active, calsKey, fg]);
  const events = useMemo(() => (imported ? raw.events : notImported(raw.events, tasks, meId)), [raw.events, tasks, meId, imported]);
  return { events, loading, cals: raw.cals };
}
