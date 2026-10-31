import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { openMenu } from '@/components/ActionMenu';
import { shiftDay } from '@/adapters/calendar/events';
import { importItems, importSections } from '@/adapters/calendar/phoneImport';
import { phoneRoutes, usePhoneCalendars, usePhoneEvents } from '@/containers/calendar/usePhone';
import { toISODate } from '@/lib/dates';
import { calDest, calOn, eventDays, eventHash, toDraft, type PhoneEvent } from '@/lib/phoneCalendar';
import { openPhoneSettings, requestPhoneAccess } from '@/lib/phoneCalendarNative';
import { useStore } from '@/lib/store';
import { MONTHS_SHORT } from '@/screens/calendar/format';
import { PhoneImportScreen, type ImportPeriod, type ImportResult, type ImportSummary } from '@/screens/phone/PhoneImportScreen';
import { destsOf } from '@/screens/phone/phoneText';
import { useInsets } from '../common';

const DAYS: Record<ImportPeriod, number> = { week: 7, month: 30, quarter: 90, all: 730 };
/** «ВСЁ»: прошедшие — за год назад */
const PAST_DAYS = 365;
const EMPTY: Record<ImportPeriod, string> = { week: 'За неделю событий нет', month: 'За 30 дней событий нет', quarter: 'За 3 месяца событий нет', all: 'Событий нет' };
const back = () => (router.canGoBack() ? router.back() : router.replace(phoneRoutes.calendars()));
const BY_CAL = 'cal';

/** Перенести списком: период, фильтр календарей, выбор, куда; изменённые в телефоне — «ОБНОВИТЬ» */
export function PhoneImportContainer() {
  const insets = useInsets();
  const { access, cals, reload } = usePhoneCalendars();
  const st = useStore(useShallow((s) => ({ settings: s.phoneCal, groups: s.groups, tasks: s.tasks, meId: s.me?.id })));
  const [period, setPeriod] = useState<ImportPeriod>('month');
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dest, setDest] = useState(BY_CAL);
  const [past, setPast] = useState(false);
  const [result, setResult] = useState<(ImportResult & { ids: string[] }) | null>(null);
  const all = period === 'all';

  const today = toISODate(new Date());
  const to = shiftDay(today, DAYS[period] - 1);
  const from = all ? shiftDay(today, -PAST_DAYS) : today;
  const { events, loading } = usePhoneEvents(from, to, access === 'granted', true);
  const onCals = useMemo(() => cals.filter((c) => calOn(st.settings, c)), [cals, st.settings]);
  const calMap = useMemo(() => new Map(cals.map((c) => [c.id, c])), [cals]);
  const items = useMemo(
    () => importItems(events.filter((e) => !hidden.has(e.calendarId) && ((all && past) || notPast(e, today))), st.tasks, st.meId),
    [events, hidden, st.tasks, st.meId, today, all, past],
  );
  const sections = useMemo(() => importSections(items, selected, calMap), [items, selected, calMap]);
  const free = useMemo(() => items.filter((i) => i.state === 'new').map((i) => i.key), [items]);
  const chosen = free.filter((k) => selected.has(k));
  const dests = useMemo(() => [{ key: BY_CAL, label: 'ПО КАЛЕНДАРЯМ' }, ...destsOf(st.groups)], [st.groups]);
  const destLabel = dests.find((d) => d.key === dest)?.label ?? 'ПО КАЛЕНДАРЯМ';

  const toggle = useCallback((keys: readonly string[]) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const all = keys.every((k) => next.has(k));
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  }, []);
  const onToggleSection = useCallback(
    (key: string) => {
      const sec = sections.find((s) => s.key === key);
      if (sec) toggle(sec.rows.filter((r) => r.state === 'new').map((r) => r.key));
    },
    [sections, toggle],
  );
  const groupIds = useMemo(() => new Set(st.groups.map((g) => g.id)), [st.groups]);
  const destFor = (calId: string) => {
    if (dest !== BY_CAL && !all) return dest;
    const d = calDest(useStore.getState().phoneCal, calId);
    return d === 'me' || groupIds.has(d) ? d : 'me';
  };
  // «ВСЁ»: сводка по всем новым событиям включённых календарей
  const summary = useMemo<ImportSummary | undefined>(() => {
    if (!all) return undefined;
    const fresh = items.filter((i) => i.state === 'new');
    const pastCount = importItems(events.filter((e) => !hidden.has(e.calendarId) && !notPast(e, today)), st.tasks, st.meId).filter((i) => i.state === 'new').length;
    const byCal = new Map<string, number>();
    fresh.forEach((i) => byCal.set(i.ev.calendarId, (byCal.get(i.ev.calendarId) ?? 0) + 1));
    const split = new Map<string, number>();
    fresh.forEach((i) => {
      const d = destFor(i.ev.calendarId);
      const label = d === 'me' ? 'ТОЛЬКО МНЕ' : (st.groups.find((g) => g.id === d)?.name.toUpperCase() ?? 'ТОЛЬКО МНЕ');
      split.set(label, (split.get(label) ?? 0) + 1);
    });
    const end = new Date(`${to}T12:00:00`);
    return {
      counting: loading,
      until: `${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`,
      total: fresh.length,
      single: fresh.filter((i) => !i.series && !calMap.get(i.ev.calendarId)?.birthdays).length,
      series: fresh.filter((i) => i.series && !calMap.get(i.ev.calendarId)?.birthdays).length,
      birthdays: fresh.filter((i) => calMap.get(i.ev.calendarId)?.birthdays).length,
      already: items.length - fresh.length,
      past: { on: past, count: pastCount },
      cals: onCals.map((c) => ({
        id: c.id,
        title: c.title,
        meta: `${byCal.get(c.id) ?? 0} · ${c.account}`,
        color: c.color,
        on: !hidden.has(c.id),
        dest: dests.find((d) => d.key === destFor(c.id))?.label ?? 'ТОЛЬКО МНЕ',
      })),
      split: [...split.entries()].map(([k, n]) => `${k} · ${n}`),
    };
    // destFor читает настройки календарей — они в st.settings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, items, events, hidden, today, to, loading, past, onCals, calMap, dests, st.settings, st.groups, st.tasks, st.meId]);

  const onTransferAll = () => {
    const fresh = items.filter((i) => i.state === 'new');
    const list = fresh.map((i) => ({ draft: toDraft(i.ev, calMap.get(i.ev.calendarId)), ext: { cal: i.ev.calendarId, id: i.ev.id, h: eventHash(i.ev) }, dest: destFor(i.ev.calendarId) }));
    const ids = useStore.getState().importPhone(list);
    const rows = onCals
      .map((c) => ({ title: c.title, color: c.color, n: fresh.filter((i) => i.ev.calendarId === c.id).length }))
      .filter((r) => r.n);
    setResult({ total: ids.length, rows, ids });
  };

  const onTransfer = () => {
    if (all) return onTransferAll();
    const list = items
      .filter((i) => i.state === 'new' && selected.has(i.key))
      .map((i) => ({ draft: toDraft(i.ev, calMap.get(i.ev.calendarId)), ext: { cal: i.ev.calendarId, id: i.ev.id, h: eventHash(i.ev) }, dest: destFor(i.ev.calendarId) }));
    useStore.getState().importPhone(list);
    setSelected(new Set());
  };
  const onUpdate = (key: string) => {
    const it = items.find((i) => i.key === key);
    if (!it?.taskId) return;
    useStore.getState().refreshPhoneTask(it.taskId, toDraft(it.ev, calMap.get(it.ev.calendarId)), { cal: it.ev.calendarId, id: it.ev.id, h: eventHash(it.ev) });
  };
  const onAsk = async () => {
    await requestPhoneAccess();
    reload();
  };

  return (
    <PhoneImportScreen
      access={access}
      loading={loading}
      period={period}
      chips={onCals.map((c) => ({ id: c.id, label: c.title.toUpperCase(), on: !hidden.has(c.id) }))}
      sections={sections}
      destLabel={destLabel}
      selected={chosen.length}
      allChecked={!!free.length && chosen.length === free.length}
      emptyText={EMPTY[period]}
      noCalendars={access === 'granted' && !!cals.length && !onCals.length}
      summary={summary}
      result={result ?? undefined}
      onTogglePast={() => setPast((v) => !v)}
      onPickCalDest={(id) =>
        openMenu({
          title: `Куда переносить «${calMap.get(id)?.title ?? ''}»`,
          actions: destsOf(st.groups).map((d) => ({ label: d.label, onPress: () => useStore.getState().setPhoneCal(id, { dest: d.key }) })),
        })
      }
      onOneByOne={() => setPeriod('quarter')}
      onUndoResult={() => {
        if (result) useStore.getState().dropTasks(result.ids, 'Перенос отменён');
        setResult(null);
      }}
      onToCalendar={() => {
        setResult(null);
        useStore.getState().setTasksView('week');
        router.replace('/tasks');
      }}
      insets={insets}
      onBack={back}
      onAsk={() => void onAsk()}
      onOpenSettings={openPhoneSettings}
      onOpenCalendars={() => router.push(phoneRoutes.calendars())}
      onPeriod={setPeriod}
      onToggleChip={(id) =>
        setHidden((cur) => {
          const next = new Set(cur);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
      onToggleRow={(k) => toggle([k])}
      onToggleSection={onToggleSection}
      onToggleAll={() => setSelected(chosen.length === free.length ? new Set() : new Set(free))}
      onPickDest={() => openMenu({ title: 'Куда перенести', actions: dests.map((d) => ({ label: d.label, onPress: () => setDest(d.key) })) })}
      onUpdate={onUpdate}
      onTransfer={onTransfer}
    />
  );
}

/** Раз начинается сегодня или позже (вчерашние, задевающие сегодня ночью, не нужны) */
const notPast = (e: PhoneEvent, today: string) => eventDays(e).date >= today;
