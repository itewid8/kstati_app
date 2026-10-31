/**
 * Настройки приложения (C-Settings): тема, режим кнопки REC, язык распознавания, напоминания,
 * лимит голосовых команд на сегодня, состояние соединения, «О приложении».
 * Выбор не применяется сразу: снизу ОТМЕНА / СОХРАНИТЬ (СОХРАНИТЬ активна, когда что-то изменили).
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MicMode, ThemePref } from '@/lib/types';
import { SectionBox, fonts, pad2, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';
import { AccountRow } from './components/AccountRow';
import { OptionGrid, type Option } from './components/OptionGrid';
import { SaveBar } from './components/SaveBar';
import { Toggle } from './components/Toggle';
import { accountText, useAccountPalette } from './components/accountTheme';

export type RecognitionLang = 'ru' | 'en' | 'auto';

export type SettingsScreenProps = {
  theme: ThemePref;
  micMode: MicMode;
  language: RecognitionLang;
  remindersOn: boolean;
  /** Сводка правил для дел со временем: «ЗА 2 Ч · НАКАНУНЕ В 20:00» */
  timedReminders: string;
  /** Сводка для дел на весь день: «НАКАНУНЕ В 20:00» */
  allDayReminders: string;
  /** Голосовые запросы за сегодня и дневной лимит */
  voiceUsed: number;
  voiceLimit: number;
  /** Сервер отвечает */
  serverOnline: boolean;
  vpnOn: boolean;
  /** «1.0.3 (42)» */
  version: string;
  insets?: { top: number; bottom: number };
  /** Строки поддержки и политики; выключены, пока у приложения нет адресов */
  showAboutLinks?: boolean;
  /** Выбор отличается от сохранённого */
  canSave?: boolean;

  onBack?: () => void;
  onChangeTheme?: (theme: ThemePref) => void;
  onChangeMicMode?: (mode: MicMode) => void;
  onChangeLanguage?: (lang: RecognitionLang) => void;
  onToggleReminders?: (on: boolean) => void;
  onEditTimedReminders?: () => void;
  onEditAllDayReminders?: () => void;
  onContactSupport?: () => void;
  onOpenPrivacy?: () => void;
  /** Отзыв: ошибка или предложение */
  onOpenFeedback?: () => void;
  /** Кнопка-жучок поверх приложения (меняется сразу, без СОХРАНИТЬ) */
  bugButton?: boolean;
  onToggleBugButton?: (on: boolean) => void;
  /** Календари телефона: слой в календаре и перенос событий */
  onOpenPhoneCalendars?: () => void;
  /** Заметки из других приложений (файлы, несколько сразу) */
  onOpenNoteImport?: () => void;
  /** Настройки виджета на рабочем столе; нет — раздела нет (iOS без платного аккаунта) */
  onOpenWidget?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

const THEME_OPTIONS: Option<ThemePref>[] = [
  { key: 'system', label: 'СИСТЕМА' },
  { key: 'light', label: 'СВЕТЛАЯ' },
  { key: 'dark', label: 'ТЁМНАЯ' },
];

const MIC_OPTIONS: Option<MicMode>[] = [
  { key: 'tap', label: 'НАЖАТЬ' },
  { key: 'hold', label: 'УДЕРЖИВАТЬ' },
];

const LANG_OPTIONS: Option<RecognitionLang>[] = [
  { key: 'ru', label: 'РУССКИЙ' },
  { key: 'en', label: 'АНГЛИЙСКИЙ' },
  { key: 'auto', label: 'АВТО' },
];

/** Деления «ЛИМИТ ГОЛОСОВЫХ КОМАНД НА СЕГОДНЯ»: по одному на запрос из дневного лимита */
const VoiceMeter = memo(function VoiceMeter({ used, limit }: { used: number; limit: number }) {
  const { c } = useTheme();
  const pal = useAccountPalette();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: limit, now: used }}
      style={[styles.meter, { backgroundColor: c.panel }]}
    >
      {Array.from({ length: limit }, (_, i) => (
        <View key={i} style={[styles.meterCell, { backgroundColor: i < used ? c.text : pal.meterEmpty }]} />
      ))}
    </View>
  );
});

type StatusProps = { label: string; on: boolean; divider?: boolean };

/** Ячейка «СЕРВЕР» / «VPN ВЫКЛ»: зелёная точка — есть, пустое кольцо — нет */
const StatusCell = memo(function StatusCell({ label, on, divider }: StatusProps) {
  const { c } = useTheme();
  const pal = useAccountPalette();
  return (
    <View style={[styles.status, divider && { borderLeftWidth: S.hairline, borderLeftColor: c.hair }]}>
      <View
        style={[
          styles.statusDot,
          on ? { backgroundColor: pal.ok, boxShadow: `0 0 6px ${pal.ok}` } : { borderWidth: S.border, borderColor: c.muted },
        ]}
      />
      <Text numberOfLines={1} style={[styles.statusText, { color: on ? c.text : c.muted }]}>
        {label}
      </Text>
    </View>
  );
});

export const SettingsScreen = memo(function SettingsScreen(props: SettingsScreenProps) {
  const {
    theme,
    micMode,
    language,
    remindersOn,
    timedReminders,
    allDayReminders,
    voiceUsed,
    voiceLimit,
    serverOnline,
    vpnOn,
    version,
    insets = NO_INSETS,
    showAboutLinks = true,
    canSave = false,
    onBack,
    onChangeTheme,
    onChangeMicMode,
    onChangeLanguage,
    onToggleReminders,
    onEditTimedReminders,
    onEditAllDayReminders,
    onContactSupport,
    onOpenPrivacy,
    onOpenFeedback,
    onOpenWidget,
    onCancel,
    onSave,
  } = props;
  const { c } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader caption="НАСТРОЙКИ" title="Приложение" onBack={onBack} />

        <View style={styles.sections}>
          <SectionBox title="ТЕМА">
            <OptionGrid options={THEME_OPTIONS} value={theme} onChange={onChangeTheme} />
          </SectionBox>

          <SectionBox title="КНОПКА REC">
            <OptionGrid options={MIC_OPTIONS} value={micMode} onChange={onChangeMicMode} />
          </SectionBox>

          <SectionBox title="ЯЗЫК РАСПОЗНАВАНИЯ">
            <OptionGrid options={LANG_OPTIONS} value={language} onChange={onChangeLanguage} />
          </SectionBox>

          <SectionBox title="НАПОМИНАНИЯ">
            <View style={[styles.switchRow, { backgroundColor: c.panel }]}>
              <Text style={[accountText.rowLabel, { color: c.text }]}>Напоминать о делах</Text>
              <Toggle value={remindersOn} onChange={onToggleReminders} accessibilityLabel="Напоминать о делах" />
            </View>
            {remindersOn ? (
              <>
                <AccountRow label="Дела со временем" meta={timedReminders} onPress={onEditTimedReminders} />
                <AccountRow label="Дела на весь день" meta={allDayReminders} onPress={onEditAllDayReminders} />
              </>
            ) : null}
          </SectionBox>

          {props.onOpenPhoneCalendars ? (
            <SectionBox title="ПЕРЕНОС">
              <AccountRow label="Календари телефона" onPress={props.onOpenPhoneCalendars} />
              {props.onOpenNoteImport ? <AccountRow label="Заметки из других приложений" onPress={props.onOpenNoteImport} /> : null}
            </SectionBox>
          ) : null}

          {onOpenWidget ? (
            <SectionBox title="ВИДЖЕТ">
              <AccountRow label="Виджет на рабочем столе" onPress={onOpenWidget} />
            </SectionBox>
          ) : null}

          <SectionBox title="ЛИМИТ ГОЛОСОВЫХ КОМАНД НА СЕГОДНЯ" count={`${pad2(voiceUsed)} / ${pad2(voiceLimit)}`}>
            <VoiceMeter used={voiceUsed} limit={voiceLimit} />
          </SectionBox>

          <SectionBox title="СОЕДИНЕНИЕ">
            <View style={[styles.statusGrid, { backgroundColor: c.panel }]}>
              <StatusCell label="СЕРВЕР" on={serverOnline} />
              <StatusCell label={vpnOn ? 'VPN ВКЛ' : 'VPN ВЫКЛ'} on={vpnOn} divider />
            </View>
          </SectionBox>

          <SectionBox title="О ПРИЛОЖЕНИИ">
            <AccountRow label="Версия" value={version} smallValue chevron={false} />
            {onOpenFeedback ? <AccountRow label="Ошибка или предложение" onPress={onOpenFeedback} /> : null}
            {props.onToggleBugButton ? (
              <View style={[styles.switchRow, { backgroundColor: c.panel }]}>
                <Text style={[accountText.rowLabel, { color: c.text }]}>Кнопка отзыва</Text>
                <Toggle value={!!props.bugButton} onChange={props.onToggleBugButton} accessibilityLabel="Кнопка отзыва" />
              </View>
            ) : null}
            {showAboutLinks ? <AccountRow label="Написать в поддержку" onPress={onContactSupport} /> : null}
            {showAboutLinks ? <AccountRow label="Политика конфиденциальности" onPress={onOpenPrivacy} /> : null}
          </SectionBox>
        </View>
      </ScrollView>
      <SaveBar canSave={canSave} bottomInset={insets.bottom} onCancel={onCancel} onSave={onSave} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side, paddingBottom: 24 },
  sections: { marginTop: 12, gap: 8 },
  switchRow: {
    height: S.row,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meter: { padding: 8, flexDirection: 'row', gap: 2 },
  meterCell: { flex: 1, flexBasis: 0, height: 14 },
  statusGrid: { flexDirection: 'row' },
  /** Половина ширины, как колонка grid: у flex:1 рамка слева добавилась бы к базе и сдвинула ячейку */
  status: { width: '50%', height: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.57 },
});
