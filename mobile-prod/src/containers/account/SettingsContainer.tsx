import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { settingsProps, voiceLangOf } from '@/adapters/account/settings';
import { fetchVoiceQuota } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { MicMode, ThemePref } from '@/lib/types';
import { SettingsScreen, type RecognitionLang } from '@/screens/account/SettingsScreen';
import { useVpnActive } from '../../../modules/kstati-net';
import { nav, useInsets } from '../common';
import { backToProfile } from './back';
import { accountRoutes } from './routes';
import { phoneRoutes } from '../calendar/usePhone';
import { noteImportRoute } from '@/components/ShareHost';

/** «0.1.0 (1)»: версия и номер сборки из app.json */
const VERSION = (() => {
  const cfg = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${cfg?.version ?? '0'} (${build ?? '0'})`;
})();

const editReminders = () => router.push(nav.reminders());
const openFeedback = () => router.push(accountRoutes.feedback());
const openPhoneCalendars = () => router.push(phoneRoutes.calendars());
const openNoteImport = () => router.push(noteImportRoute);
const openTrash = () => router.push('/settings/trash');
const toggleBug = (on: boolean) => useStore.getState().setBugButton(on);

/** Выбор на экране, ещё не сохранённый: только то, что меняли */
type Draft = { theme?: ThemePref; micMode?: MicMode; language?: RecognitionLang; remindersOn?: boolean };

/**
 * C-Settings. Тема, кнопка REC, язык и «Напоминать о делах» — черновик до СОХРАНИТЬ, ОТМЕНА — назад без изменений.
 * Счётчик голоса — с сервера при каждом показе экрана. Адресов поддержки и политики пока нет — их строки скрыты
 */
export function SettingsContainer() {
  const insets = useInsets();
  const vpnOn = useVpnActive();
  const st = useStore(
    useShallow((s) => ({
      theme: s.theme,
      micMode: s.micMode,
      voiceLang: s.voiceLang,
      reminders: s.reminders,
      voiceQuota: s.voiceQuota,
      net: s.net,
    })),
  );
  const [draft, setDraft] = useState<Draft>({});
  const bugButton = useStore((s) => s.bugButton);
  const trashCount = useStore((s) => s.trash.length);
  const saved = useMemo(() => settingsProps({ ...st, vpnOn, version: VERSION }), [st, vpnOn]);
  const data = useMemo(() => ({ ...saved, ...draft }), [saved, draft]);
  const canSave =
    data.theme !== saved.theme || data.micMode !== saved.micMode || data.language !== saved.language || data.remindersOn !== saved.remindersOn;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchVoiceQuota().then((q) => {
        if (alive && q) useStore.getState().setVoiceQuota(q);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const onChangeTheme = useCallback((theme: ThemePref) => setDraft((d) => ({ ...d, theme })), []);
  const onChangeMicMode = useCallback((micMode: MicMode) => setDraft((d) => ({ ...d, micMode })), []);
  const onChangeLanguage = useCallback((language: RecognitionLang) => setDraft((d) => ({ ...d, language })), []);
  const onToggleReminders = useCallback((remindersOn: boolean) => setDraft((d) => ({ ...d, remindersOn })), []);
  const onSave = useCallback(() => {
    const store = useStore.getState();
    if (data.theme !== saved.theme) store.setTheme(data.theme);
    if (data.micMode !== saved.micMode) store.setMicMode(data.micMode);
    if (data.language !== saved.language) store.setVoiceLang(voiceLangOf(data.language));
    if (data.remindersOn !== saved.remindersOn) store.setReminders({ enabled: data.remindersOn });
    setDraft({});
    backToProfile();
  }, [data, saved]);

  return (
    <SettingsScreen
      {...data}
      insets={insets}
      showAboutLinks={false}
      canSave={canSave}
      onBack={backToProfile}
      onChangeTheme={onChangeTheme}
      onChangeMicMode={onChangeMicMode}
      onChangeLanguage={onChangeLanguage}
      onToggleReminders={onToggleReminders}
      onEditTimedReminders={editReminders}
      onEditAllDayReminders={editReminders}
      onOpenWidget={OPEN_WIDGET}
      onOpenPhoneCalendars={openPhoneCalendars}
      onOpenNoteImport={openNoteImport}
      trashCount={trashCount}
      onOpenTrash={openTrash}
      onOpenFeedback={openFeedback}
      bugButton={bugButton}
      onToggleBugButton={toggleBug}
      onCancel={backToProfile}
      onSave={onSave}
    />
  );
}

/** Виджет на рабочем столе есть только на Android (на iOS — со сборкой под платный аккаунт) */
const OPEN_WIDGET = Platform.OS === 'android' ? () => router.push(nav.widgetSettings()) : undefined;
