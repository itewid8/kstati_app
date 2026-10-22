/**
 * Раскрытая строка «НАПОМНИТЬ» (C-EditRemind): для меня / для всех, список добавленных напоминаний
 * («За 2 ч до начала» + когда сработает, «×» — убрать), пресеты (уже добавленный — бледный) и свои правила.
 * Ключи пресетов — ReminderSpec из lib/remind (m15, d1@20:00 …), подписи готовит вызывающий.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID, ReminderSpec } from '@/lib/types';
import { Icon, Marquee, size as S, useTheme } from '@/ui';
import { ChipGrid, type ChipItem } from '../components/ChipGrid';
import { PanelLabel } from '../components/FieldTable';
import { Segmented, type SegmentItem } from '../components/Segmented';
import { ET } from '../components/text';

export type RemindScope = 'me' | 'all';

const SCOPES: ReadonlyArray<SegmentItem<RemindScope>> = [
  { key: 'me', label: 'ДЛЯ МЕНЯ' },
  { key: 'all', label: 'ДЛЯ ВСЕХ' },
];

export type ReminderItem = {
  id: ID;
  /** «За 2 ч до начала» */
  rule: string;
  /** «СБ 10 ОКТ, 17:00» */
  when: string;
};

export type ReminderPreset = {
  key: ReminderSpec;
  /** «ЗА 15 МИН» */
  label: string;
  /** Уже в списке — бледный, не нажимается */
  used?: boolean;
};

/** Свои правила: за N минут/часов до начала или за N дней в заданное время */
export type CustomReminder = 'before' | 'days';

const CUSTOM: ReadonlyArray<{ key: CustomReminder; label: string }> = [
  { key: 'before', label: 'СВОЁ: ЗА … ДО НАЧАЛА' },
  { key: 'days', label: 'СВОЁ: ЗА … ДНЕЙ В …' },
];

export type RemindPanelProps = {
  scope: RemindScope;
  reminders: readonly ReminderItem[];
  presets: readonly ReminderPreset[];
  onScope?: (scope: RemindScope) => void;
  onRemove?: (id: ID) => void;
  onAdd?: (spec: ReminderSpec) => void;
  onCustom?: (kind: CustomReminder) => void;
};

export const RemindPanel = memo(function RemindPanel({ scope, reminders, presets, onScope, onRemove, onAdd, onCustom }: RemindPanelProps) {
  const { c } = useTheme();
  const chips: ChipItem<ReminderSpec>[] = presets.map((p) => ({ key: p.key, label: p.label, state: p.used ? 'used' : 'normal' }));
  return (
    <>
      <Segmented items={SCOPES} value={scope} onChange={onScope} />
      {reminders.length ? (
        <View style={[styles.box, { borderColor: c.border }]}>
          {reminders.map((r, i) => (
            <View
              key={r.id}
              style={[styles.reminder, { backgroundColor: c.panel }, i > 0 && [styles.divided, { borderTopColor: c.hair }]]}
            >
              <View style={styles.reminderText}>
                <Marquee style={[ET.reminderRule, { color: c.text }]}>
                  {r.rule}
                </Marquee>
                <Marquee style={[ET.reminderWhen, { color: c.muted }]}>
                  {r.when}
                </Marquee>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Убрать: ${r.rule}`}
                onPress={onRemove ? () => onRemove(r.id) : undefined}
                style={styles.remove}
              >
                <Text style={[ET.removeSign, { color: c.muted }]}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <PanelLabel text="ДОБАВИТЬ" />
      <ChipGrid items={chips} columns={3} weight="medium" onPress={onAdd} />
      <View style={[styles.box, { borderColor: c.border }]}>
        {CUSTOM.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={onCustom ? () => onCustom(item.key) : undefined}
            style={[styles.menuItem, { backgroundColor: c.panel }, i > 0 && [styles.menuDivided, { borderTopColor: c.hair }]]}
          >
            <Marquee style={[ET.menuItem, { color: c.text }]}>
              {item.label}
            </Marquee>
            <Icon name="chevronRight" size={12} color={c.muted} />
          </Pressable>
        ))}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border },
  /** Строка 40 + разделитель 1px сверху (content-box в макете) */
  reminder: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 },
  divided: { height: 40 + S.hairline, borderTopWidth: S.hairline },
  reminderText: { flex: 1, minWidth: 0, gap: 1 },
  remove: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  /** Кнопка 36 вместе с разделителем (border-box) */
  menuItem: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: 8,
  },
  menuDivided: { borderTopWidth: S.hairline },
});
