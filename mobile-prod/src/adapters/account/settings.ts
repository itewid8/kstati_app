/** C-Settings: настройки приложения — тема, кнопка REC, язык распознавания, напоминания, голос за сегодня, связь */
import { duration, parse, sortSpecs, specLabel } from '@/lib/remind';
import type { MicMode, ReminderSettings, ReminderSpec, ThemePref, VoiceLang } from '@/lib/types';
import type { RecognitionLang, SettingsScreenProps } from '@/screens/account/SettingsScreen';
import { upper } from '../common/ru';
import type { DataOf } from '../snapshot';

/** Дневной лимит голосовых команд, пока сервер не ответил (VOICE_DAILY_LIMIT на сервере) */
export const VOICE_LIMIT = 30;

export type SettingsInput = {
  theme: ThemePref;
  micMode: MicMode;
  voiceLang: VoiceLang;
  reminders: ReminderSettings;
  voiceQuota: { limit: number; used: number } | null;
  net: 'ok' | 'offline';
  vpnOn: boolean;
  /** «0.1.0 (1)» */
  version: string;
};

const LANG: Record<VoiceLang, RecognitionLang> = { 'ru-RU': 'ru', 'en-US': 'en', auto: 'auto' };
const VOICE_LANG: Record<RecognitionLang, VoiceLang> = { ru: 'ru-RU', en: 'en-US', auto: 'auto' };

/** Язык экрана → язык распознавания для POST /voice */
export const voiceLangOf = (lang: RecognitionLang): VoiceLang => VOICE_LANG[lang];

/** «ЗА 2 Ч», «НАКАНУНЕ В 20:00» */
function specShort(spec: ReminderSpec): string {
  const p = parse(spec);
  if (p?.kind === 'm') return p.min === 0 ? 'В МОМЕНТ НАЧАЛА' : `ЗА ${upper(duration(p.min))}`;
  return upper(specLabel(spec));
}

/** Сводка правил: ближайшее к началу — первым, «ЗА 2 Ч · НАКАНУНЕ В 20:00»; пусто — «НЕ НАПОМИНАТЬ» */
export function remindersSummary(specs: readonly ReminderSpec[]): string {
  if (!specs.length) return 'НЕ НАПОМИНАТЬ';
  return sortSpecs([...specs]).reverse().map(specShort).join(' · ');
}

export function settingsProps(i: SettingsInput): DataOf<SettingsScreenProps> {
  const limit = i.voiceQuota?.limit ?? VOICE_LIMIT;
  return {
    theme: i.theme,
    micMode: i.micMode,
    language: LANG[i.voiceLang],
    remindersOn: i.reminders.enabled,
    timedReminders: remindersSummary(i.reminders.timed),
    allDayReminders: remindersSummary(i.reminders.allDay),
    voiceUsed: Math.max(0, Math.min(limit, i.voiceQuota?.used ?? 0)),
    voiceLimit: limit,
    serverOnline: i.net === 'ok',
    vpnOn: i.vpnOn,
    version: i.version,
  };
}
