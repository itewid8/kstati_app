/** Данные макета C-Settings (design/mockups/C-Settings.dc.html). Обе темы — одно состояние */
import type { SettingsScreenProps } from '../../account/SettingsScreen';

export function settingsFixture(): SettingsScreenProps {
  return {
    theme: 'system',
    micMode: 'tap',
    language: 'ru',
    remindersOn: true,
    timedReminders: 'ЗА 2 Ч · НАКАНУНЕ В 20:00',
    allDayReminders: 'НАКАНУНЕ В 20:00',
    voiceUsed: 3,
    voiceLimit: 30,
    serverOnline: true,
    vpnOn: false,
    version: '1.0.3 (42)',
  };
}
