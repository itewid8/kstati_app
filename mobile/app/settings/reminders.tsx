import { Check } from '@/components/icons';
import React, { useState } from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import { TimePanel } from '@/components/pickers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { Divider, ListRow, SectionLabel, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { ALL_RULES, RULE_LABEL, type ReminderRule } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

export default function Reminders() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const r = useStore((s) => s.reminders);
  const setReminders = useStore((s) => s.setReminders);
  // Какое время сейчас выбирается — панель раскрывается под строкой
  const [picking, setPicking] = useState<'dayTime' | 'sameDayTime' | null>(null);

  const toggle = (rule: ReminderRule) =>
    setReminders({ rules: r.rules.includes(rule) ? r.rules.filter((x) => x !== rule) : ALL_RULES.filter((x) => x === rule || r.rules.includes(x)) });

  const pickTime = (key: 'dayTime' | 'sameDayTime') => setPicking(picking === key ? null : key);

  const disabled = !r.enabled;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Напоминания" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
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
          <SectionLabel>Когда напоминать</SectionLabel>
          <Divider />
          {ALL_RULES.map((rule, i) => (
            <View key={rule}>
              {i > 0 && <Divider inset={space.side} />}
              <ListRow
                label={RULE_LABEL[rule]}
                onPress={() => toggle(rule)}
                right={r.rules.includes(rule) ? <Check size={ICON.size} strokeWidth={ICON.stroke} color={c.text} /> : <View style={{ width: ICON.size }} />}
              />
            </View>
          ))}
          <Divider />

          <SectionLabel>Время</SectionLabel>
          <Divider />
          <ListRow label="За неделю, за 3 дня, накануне" value={r.dayTime} mono onPress={() => pickTime('dayTime')} />
          {picking === 'dayTime' && <TimeBox value={r.dayTime} onPick={(v, done) => { setReminders({ dayTime: v }); if (done) setPicking(null); }} />}
          <Divider inset={space.side} />
          <ListRow label="В день события" value={r.sameDayTime} mono onPress={() => pickTime('sameDayTime')} />
          {picking === 'sameDayTime' && (
            <TimeBox value={r.sameDayTime} onPick={(v, done) => { setReminders({ sameDayTime: v }); if (done) setPicking(null); }} />
          )}
          <Divider />

          <T variant="caption" muted style={{ paddingHorizontal: space.side, paddingTop: 12 }}>
            Для дел без времени «за N часов» не применяется. Для отдельного дела правило меняется в его карточке.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

function TimeBox({ value, onPick }: { value: string; onPick: (v: string, done: boolean) => void }) {
  return (
    <View style={{ paddingHorizontal: space.side, paddingBottom: 12 }}>
      <TimePanel value={value} onPick={onPick} />
    </View>
  );
}
