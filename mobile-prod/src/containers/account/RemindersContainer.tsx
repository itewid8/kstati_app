import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { remindersProps, withRule, withoutRule, type RemindersDraft } from '@/adapters/account/reminders';
import { useStore } from '@/lib/store';
import type { ReminderSpec } from '@/lib/types';
import { CustomRemindSheet } from '@/containers/editors/EditorSheets';
import { RemindersScreen, type CustomRule, type ReminderKind } from '@/screens/account/RemindersScreen';
import { useInsets } from '../common';
import { backToProfile } from './back';

type Custom = { kind: ReminderKind; rule: CustomRule };

/**
 * Напоминания по умолчанию для дел со временем и на весь день — черновик до СОХРАНИТЬ.
 * Свои правила — в окнах окна дела (CustomRemindSheet). Вкл/выкл напоминаний — в настройках приложения
 */
export function RemindersContainer() {
  const saved = useStore(useShallow((s): RemindersDraft => ({ timed: s.reminders.timed, allDay: s.reminders.allDay })));
  const insets = useInsets();
  const [draft, setDraft] = useState<RemindersDraft>(saved);
  const [custom, setCustom] = useState<Custom | null>(null);
  const data = useMemo(() => remindersProps(draft, saved), [draft, saved]);

  const onAdd = useCallback((kind: ReminderKind, spec: ReminderSpec) => setDraft((d) => ({ ...d, [kind]: withRule(d[kind], spec) })), []);
  const onRemove = useCallback((kind: ReminderKind, spec: ReminderSpec) => setDraft((d) => ({ ...d, [kind]: withoutRule(d[kind], spec) })), []);
  const onCustom = useCallback((kind: ReminderKind, rule: CustomRule) => setCustom({ kind, rule }), []);
  const onCloseCustom = useCallback(() => setCustom(null), []);
  const onAddCustom = useCallback(
    (spec: ReminderSpec) => {
      if (custom) onAdd(custom.kind, spec);
    },
    [custom, onAdd],
  );
  const onSave = useCallback(() => {
    useStore.getState().setReminders({ timed: draft.timed, allDay: draft.allDay });
    backToProfile();
  }, [draft]);

  return (
    <View style={styles.screen}>
      <RemindersScreen
        {...data}
        insets={insets}
        onBack={backToProfile}
        onAdd={onAdd}
        onRemove={onRemove}
        onCustom={onCustom}
        onCancel={backToProfile}
        onSave={onSave}
      />
      <CustomRemindSheet kind={custom?.rule ?? null} bottomInset={insets.bottom} onAdd={onAddCustom} onClose={onCloseCustom} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
