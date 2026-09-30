import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { ChevronRight } from '@/components/icons';
import { Chip, Divider, ListRow, SectionLabel, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { MicMode, ThemePref, WidgetPrefs } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'Как в системе' },
  { key: 'light', label: 'Светлая' },
  { key: 'dark', label: 'Тёмная' },
];

const MIC: { key: MicMode; label: string }[] = [
  { key: 'tap', label: 'Нажать и отпустить' },
  { key: 'hold', label: 'Удерживать' },
];

/** Прозрачность фона виджета: подпись — прозрачность, значение — непрозрачность */
const OPACITY = [
  { label: '0%', value: 1 },
  { label: '25%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.25 },
  { label: '100%', value: 0 },
];
const TEXT: { key: WidgetPrefs['text']; label: string }[] = [
  { key: 'auto', label: 'Как в теме' },
  { key: 'light', label: 'Светлый' },
  { key: 'dark', label: 'Тёмный' },
];

/** Настройки приложения: тема, кнопка микрофона, напоминания по умолчанию */
export default function AppSettings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const theme = useStore((s) => s.theme);
  const micMode = useStore((s) => s.micMode);
  const reminders = useStore((s) => s.reminders);
  const widget = useStore((s) => s.widget);
  const { setTheme, setMicMode, setWidget } = useStore.getState();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Настройки приложения" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <SectionLabel>Тема</SectionLabel>
        <View style={{ paddingHorizontal: space.side, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map((t) => (
            <Chip key={t.key} label={t.label} selected={theme === t.key} onPress={() => setTheme(t.key)} />
          ))}
        </View>

        <SectionLabel>Кнопка микрофона</SectionLabel>
        <View style={{ paddingHorizontal: space.side, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MIC.map((m) => (
            <Chip key={m.key} label={m.label} selected={micMode === m.key} onPress={() => setMicMode(m.key)} />
          ))}
        </View>

        <SectionLabel>Виджет</SectionLabel>
        <Divider />
        <ListRow
          label="Микрофон"
          right={
            <Switch
              value={widget.mic}
              onValueChange={(mic) => setWidget({ mic })}
              trackColor={{ true: c.primary, false: c.border }}
              thumbColor={Platform.OS === 'android' ? (widget.mic ? c.onPrimary : c.textMuted) : undefined}
              ios_backgroundColor={c.border}
            />
          }
        />
        <Divider />
        {Platform.OS === 'android' && (
          <>
            <SectionLabel>Прозрачность фона</SectionLabel>
            <View style={{ paddingHorizontal: space.side, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OPACITY.map((o) => (
                <Chip key={o.label} label={o.label} selected={Math.abs(widget.opacity - o.value) < 0.01} onPress={() => setWidget({ opacity: o.value })} />
              ))}
            </View>
          </>
        )}
        <SectionLabel>Цвет текста</SectionLabel>
        <View style={{ paddingHorizontal: space.side, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TEXT.map((t) => (
            <Chip key={t.key} label={t.label} selected={widget.text === t.key} onPress={() => setWidget({ text: t.key })} />
          ))}
        </View>

        <SectionLabel>Напоминания</SectionLabel>
        <Divider />
        <ListRow
          label="По умолчанию"
          value={reminders.enabled ? `${reminders.timed.length + reminders.allDay.length ? 'Включены' : 'Нет'}` : 'Выключены'}
          onPress={() => router.push('/settings/reminders')}
          right={<ChevronRight size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />}
        />
        <Divider />
      </ScrollView>
    </View>
  );
}
