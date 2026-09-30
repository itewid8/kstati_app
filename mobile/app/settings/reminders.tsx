import React from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { ReminderEditor } from '@/components/ReminderEditor';
import { Divider, ListRow, SectionLabel, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { space, useColors } from '@/theme';

/**
 * Напоминания по умолчанию — отдельно для дел со временем и для дел на весь день (как в Google Календаре).
 * Они действуют для новых и старых дел, пока в карточке дела не выбрано своё.
 */
export default function Reminders() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const r = useStore((s) => s.reminders);
  const setReminders = useStore((s) => s.setReminders);
  const disabled = !r.enabled;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Напоминания" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Divider />
        <ListRow
          label="Напоминания включены"
          right={
            <Switch
              value={r.enabled}
              onValueChange={(enabled) => setReminders({ enabled })}
              trackColor={{ true: c.primary, false: c.border }}
              thumbColor={Platform.OS === 'android' ? (r.enabled ? c.onPrimary : c.textMuted) : undefined}
              ios_backgroundColor={c.border}
            />
          }
        />
        <Divider />

        <View style={{ opacity: disabled ? 0.4 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
          <SectionLabel>Дела со временем</SectionLabel>
          <View style={{ paddingHorizontal: space.side }}>
            <T variant="label" muted>
              Например, «Ужин у родителей» в сб 19:00
            </T>
            <ReminderEditor value={r.timed} onChange={(timed) => setReminders({ timed })} timed />
          </View>

          <SectionLabel>Дела на весь день</SectionLabel>
          <View style={{ paddingHorizontal: space.side }}>
            <T variant="label" muted>
              Дела без времени, например «День рождения Лены». У них нет часа начала, поэтому напоминание всегда с точным временем: «в день события в 09:00», «накануне в 20:00».
            </T>
            <ReminderEditor value={r.allDay} onChange={(allDay) => setReminders({ allDay })} timed={false} />
          </View>

          <T variant="caption" muted style={{ paddingHorizontal: space.side, paddingTop: 16 }}>
            Это настройки по умолчанию. Для отдельного дела напоминания меняются в его карточке — только для себя или для всех участников группы.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}
