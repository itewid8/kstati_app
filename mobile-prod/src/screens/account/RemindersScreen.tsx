/**
 * Напоминания по умолчанию — для дел со временем и для дел на весь день: список правил («×» — убрать),
 * готовые варианты (добавленные — бледные) и свои правила. Снизу ОТМЕНА / СОХРАНИТЬ.
 * Презентационный экран: черновик — пропсами, окна своих правил — у вызывающего.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReminderSpec } from '@/lib/types';
import { Marquee, SectionBox, fonts, pad2, size as S, useTheme } from '@/ui';
import { ChipGrid, type ChipItem } from '../editors/components/ChipGrid';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { AccountRow } from './components/AccountRow';
import { accountText } from './components/accountTheme';

export type ReminderKind = 'timed' | 'allDay';
/** Свои правила: за N минут/часов до начала (только у дел со временем) или за N дней в заданное время */
export type CustomRule = 'before' | 'days';

export type ReminderRuleItem = {
  spec: ReminderSpec;
  /** «За 2 ч до начала», «Накануне в 20:00» */
  label: string;
};

export type ReminderPresetItem = {
  key: ReminderSpec;
  /** «ЗА 15 МИН» */
  label: string;
  /** Уже в списке или список полон — бледный, не нажимается */
  used?: boolean;
};

export type ReminderBlock = {
  rules: ReminderRuleItem[];
  presets: ReminderPresetItem[];
  /** Больше правил не добавить */
  full: boolean;
};

export type RemindersScreenProps = {
  timed: ReminderBlock;
  allDay: ReminderBlock;
  canSave: boolean;
  insets?: PageInsets;

  onBack?: () => void;
  onRemove?: (kind: ReminderKind, spec: ReminderSpec) => void;
  onAdd?: (kind: ReminderKind, spec: ReminderSpec) => void;
  onCustom?: (kind: ReminderKind, rule: CustomRule) => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

const TITLE: Record<ReminderKind, string> = { timed: 'ДЕЛА СО ВРЕМЕНЕМ', allDay: 'ДЕЛА НА ВЕСЬ ДЕНЬ' };

type BlockProps = {
  kind: ReminderKind;
  block: ReminderBlock;
  onRemove?: RemindersScreenProps['onRemove'];
  onAdd?: RemindersScreenProps['onAdd'];
  onCustom?: RemindersScreenProps['onCustom'];
};

const Block = memo(function Block({ kind, block, onRemove, onAdd, onCustom }: BlockProps) {
  const { c } = useTheme();
  const chips: ChipItem<ReminderSpec>[] = block.presets.map((p) => ({ key: p.key, label: p.label, state: p.used ? 'used' : 'normal' }));
  const custom = (rule: CustomRule) => (onCustom && !block.full ? () => onCustom(kind, rule) : undefined);
  return (
    <SectionBox title={TITLE[kind]} count={pad2(block.rules.length)}>
      {block.rules.length ? (
        block.rules.map((r) => (
          <View key={r.spec} style={[styles.rule, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
            <Marquee style={[accountText.rowLabel, styles.flex, { color: c.text }]}>{r.label}</Marquee>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Убрать: ${r.label}`}
              onPress={onRemove ? () => onRemove(kind, r.spec) : undefined}
              style={styles.remove}
            >
              <Text style={[styles.removeSign, { color: c.muted }]}>×</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <View style={[styles.rule, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
          <Text style={[accountText.rowLabel, { color: c.muted }]}>Не напоминать</Text>
        </View>
      )}
      <View style={[styles.presets, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
        <ChipGrid items={chips} columns={3} weight="medium" onPress={onAdd ? (spec) => onAdd(kind, spec) : undefined} />
      </View>
      {kind === 'timed' ? <AccountRow label="Своё: за … до начала" onPress={custom('before')} /> : null}
      <AccountRow label="Своё: за … дней в …" onPress={custom('days')} />
    </SectionBox>
  );
});

export const RemindersScreen = memo(function RemindersScreen(props: RemindersScreenProps) {
  const { timed, allDay, canSave, insets = NO_INSETS, onBack, onRemove, onAdd, onCustom, onCancel, onSave } = props;
  return (
    <AccountPage caption="НАСТРОЙКИ" title="Напоминания" insets={insets} onBack={onBack} save={{ canSave, onCancel, onSave }}>
      <Block kind="timed" block={timed} onRemove={onRemove} onAdd={onAdd} onCustom={onCustom} />
      <Block kind="allDay" block={allDay} onRemove={onRemove} onAdd={onAdd} onCustom={onCustom} />
    </AccountPage>
  );
});

const styles = StyleSheet.create({
  rule: { height: S.row, paddingLeft: 8, borderTopWidth: S.hairline, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  remove: { width: 40, height: S.row - S.hairline, alignItems: 'center', justifyContent: 'center' },
  removeSign: { fontFamily: fonts.sans400, fontSize: 16 },
  presets: { padding: 6, borderTopWidth: S.hairline },
});
