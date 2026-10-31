import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { openConfirm, openMenu } from '@/components/ActionMenu';
import { phoneRoutes, usePhoneCalendars } from '@/containers/calendar/usePhone';
import { calDest, calOn } from '@/lib/phoneCalendar';
import { openPhoneSettings, requestPhoneAccess } from '@/lib/phoneCalendarNative';
import { useStore } from '@/lib/store';
import { PhoneCalendarsScreen, type PhoneCalRow } from '@/screens/phone/PhoneCalendarsScreen';
import { destsOf } from '@/screens/phone/phoneText';
import { useInsets } from '../common';

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/app'));

/** Календари телефона: слой, какие календари и куда переносить, перенос списком, удалить перенесённое */
export function PhoneCalendarsContainer() {
  const insets = useInsets();
  const { access, cals, reload } = usePhoneCalendars();
  const st = useStore(useShallow((s) => ({ settings: s.phoneCal, groups: s.groups, tasks: s.tasks, meId: s.me?.id })));
  const dests = useMemo(() => destsOf(st.groups), [st.groups]);
  const rows = useMemo<PhoneCalRow[]>(
    () =>
      cals.map((c) => ({
        id: c.id,
        title: c.title,
        account: c.account,
        color: c.color,
        on: calOn(st.settings, c),
        dest: dests.find((d) => d.key === calDest(st.settings, c.id))?.label ?? 'ТОЛЬКО МНЕ',
      })),
    [cals, st.settings, dests],
  );
  const imported = useMemo(() => st.tasks.filter((t) => t.ext && t.createdBy === st.meId).length, [st.tasks, st.meId]);

  const onAsk = useCallback(async () => {
    const a = await requestPhoneAccess();
    if (a === 'granted') useStore.getState().setPhoneShow(true);
    reload();
  }, [reload]);
  const onToggleCal = useCallback(
    (id: string) => {
      const c = cals.find((x) => x.id === id);
      if (c) useStore.getState().setPhoneCal(id, { on: !calOn(useStore.getState().phoneCal, c) });
    },
    [cals],
  );
  const onPickDest = useCallback(
    (id: string) => {
      const c = cals.find((x) => x.id === id);
      openMenu({
        title: `Куда переносить «${c?.title ?? ''}»`,
        actions: dests.map((d) => ({ label: d.label, onPress: () => useStore.getState().setPhoneCal(id, { dest: d.key }) })),
      });
    },
    [cals, dests],
  );
  const onDropAll = useCallback(
    () =>
      openConfirm({
        title: `Удалить ${imported} перенесённых из телефона дел? В календаре телефона ничего не изменится`,
        action: 'УДАЛИТЬ',
        onConfirm: () => useStore.getState().dropImported(),
      }),
    [imported],
  );

  return (
    <PhoneCalendarsScreen
      access={access}
      show={st.settings.show}
      cals={rows}
      imported={imported}
      insets={insets}
      onBack={back}
      onAsk={() => void onAsk()}
      onOpenSettings={openPhoneSettings}
      onToggleShow={(on) => useStore.getState().setPhoneShow(on)}
      onToggleCal={onToggleCal}
      onPickDest={onPickDest}
      onImport={() => router.push(phoneRoutes.import())}
      onDropAll={onDropAll}
    />
  );
}
