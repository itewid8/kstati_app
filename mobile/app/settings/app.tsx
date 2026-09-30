import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { ChevronRight } from '@/components/icons';
import { Chip, Divider, ListRow, SectionLabel, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { MicMode, ThemePref } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'Как в системе' },
  { key: 'light', label: 'Светлая' },
  { key: 'dark', label: 'Тёмная' },
];

const MIC: { key: MicMode; label: string; hint: string }[] = [
  { key: 'tap', label: 'Нажать и отпустить', hint: 'Нажмите, чтобы начать запись, и ещё раз — чтобы закончить.' },
  { key: 'hold', label: 'Удерживать', hint: 'Запись идёт, пока палец на кнопке. Отпустите — и фраза уйдёт на разбор.' },
];

/** Настройки приложения: тема, кнопка микрофона, напоминания по умолчанию */
export default function AppSettings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const theme = useStore((s) => s.theme);
  const micMode = useStore((s) => s.micMode);
  const reminders = useStore((s) => s.reminders);
  const { setTheme, setMicMode } = useStore.getState();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Приложение" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <SectionLabel>Тема</SectionLabel>
        <View style={{ paddingHorizontal: space.side, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map((t) => (
            <Chip key={t.key} label={t.label} selected={theme === t.key} onPress={() => setTheme(t.key)} />
          ))}
        </View>

        <SectionLabel>Кнопка микрофона</SectionLabel>
        <View style={{ paddingHorizontal: space.side, gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MIC.map((m) => (
              <Chip key={m.key} label={m.label} selected={micMode === m.key} onPress={() => setMicMode(m.key)} />
            ))}
          </View>
          <T variant="caption" muted>
            {MIC.find((m) => m.key === micMode)?.hint}
          </T>
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
