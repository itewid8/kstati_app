import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { settingsProps, voiceLangOf } from '@/adapters/account/settings';
import { fetchVoiceQuota } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { MicMode, ThemePref } from '@/lib/types';
import { SettingsScreen, type RecognitionLang } from '@/screens/account/SettingsScreen';
import { useVpnActive } from '../../../modules/kstati-net';
import { nav, useInsets } from '../common';

/** «0.1.0 (1)»: версия и номер сборки из app.json */
const VERSION = (() => {
  const cfg = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${cfg?.version ?? '0'} (${build ?? '0'})`;
})();

const back = () => (router.canGoBack() ? router.back() : router.navigate(nav.profile()));
const changeTheme = (t: ThemePref) => useStore.getState().setTheme(t);
const changeMicMode = (m: MicMode) => useStore.getState().setMicMode(m);
const changeLanguage = (lang: RecognitionLang) => useStore.getState().setVoiceLang(voiceLangOf(lang));
const toggleReminders = (enabled: boolean) => useStore.getState().setReminders({ enabled });
const editReminders = () => router.push(nav.reminders());

/**
 * C-Settings. Счётчик голоса — с сервера при каждом показе экрана. Адресов поддержки и политики пока нет —
 * их строки без действия
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
  const data = useMemo(() => settingsProps({ ...st, vpnOn, version: VERSION }), [st, vpnOn]);

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

  return (
    <SettingsScreen
      {...data}
      insets={insets}
      showAboutLinks={false}
      onBack={back}
      onChangeTheme={changeTheme}
      onChangeMicMode={changeMicMode}
      onChangeLanguage={changeLanguage}
      onToggleReminders={toggleReminders}
      onEditTimedReminders={editReminders}
      onEditAllDayReminders={editReminders}
    />
  );
}
