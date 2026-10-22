import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { ReminderEditor } from '@/components/ReminderEditor';
import { Divider, ListRow, SectionLabel, T, Toggle } from '@/components/ui';
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
            <Toggle value={r.enabled} onValueChange={(enabled) => setReminders({ enabled })} />
          }
        />
        <Divider />

        <View style={{ opacity: disabled ? 0.4 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
          <SectionLabel>Дела со временем</SectionLabel>
          <View style={{ paddingHorizontal: space.side }}>
            <ReminderEditor value={r.timed} onChange={(timed) => setReminders({ timed })} timed />
          </View>

          <SectionLabel>Дела на весь день</SectionLabel>
          <View style={{ paddingHorizontal: space.side }}>
            <ReminderEditor value={r.allDay} onChange={(allDay) => setReminders({ allDay })} timed={false} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
