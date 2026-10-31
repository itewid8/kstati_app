/**
 * Перенести списком: события телефона за неделю / 30 дней / 3 месяца. Сверху — фишки календарей (нажатие скрывает),
 * затем повторяющиеся серии отдельным блоком (одной строкой с правилом), дальше — по дням. Нажатие на шапку дня
 * выбирает весь день. Уже перенесённые — бледные «ПЕРЕНЕСЕНО»; изменённые в телефоне — «ОБНОВИТЬ».
 * Снизу: куда (по календарям / только мне / группа), «ВЫБРАТЬ ВСЕ», «ПЕРЕНЕСТИ N».
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PhoneAccess } from '@/lib/phoneCalendarNative';
import { Icon, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from '../account/components/AccountHeader';
import { OptionGrid, type Option } from '../account/components/OptionGrid';
import { Loading, PhoneNotice, Tick, accessNotice } from './PhoneParts';

export type ImportPeriod = 'week' | 'month' | 'quarter';
export type ImportRow = {
  key: string;
  time: string;
  title: string;
  cal: string;
  repeat?: boolean;
  birthday?: boolean;
  /** new — можно выбрать; done — уже перенесено; changed — перенесено, но в телефоне изменили */
  state: 'new' | 'done' | 'changed';
  checked: boolean;
};
export type ImportSection = { key: string; title: string; rows: readonly ImportRow[] };
export type ImportChip = { id: string; label: string; on: boolean };

export type PhoneImportScreenProps = {
  access: PhoneAccess | null;
  loading: boolean;
  period: ImportPeriod;
  chips: readonly ImportChip[];
  sections: readonly ImportSection[];
  /** «ПО КАЛЕНДАРЯМ», «ТОЛЬКО МНЕ», «МЫ С КАРИНОЙ» — нажатие открывает выбор */
  destLabel: string;
  selected: number;
  /** Есть что выбрать и всё уже выбрано */
  allChecked: boolean;
  /** Пусто: «За 30 дней событий нет» */
  emptyText: string;
  /** Включённых календарей нет */
  noCalendars?: boolean;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onAsk?: () => void;
  onOpenSettings?: () => void;
  onOpenCalendars?: () => void;
  onPeriod?: (p: ImportPeriod) => void;
  onToggleChip?: (id: string) => void;
  onToggleRow?: (key: string) => void;
  onToggleSection?: (key: string) => void;
  onToggleAll?: () => void;
  onPickDest?: () => void;
  onUpdate?: (key: string) => void;
  onTransfer?: () => void;
};

const PERIODS: Option<ImportPeriod>[] = [
  { key: 'week', label: 'НЕДЕЛЯ' },
  { key: 'month', label: '30 ДНЕЙ' },
  { key: 'quarter', label: '3 МЕСЯЦА' },
];
const NO_INSETS = { top: 0, bottom: 0 };
const noop = () => {};

const Row = memo(function Row({ row, onToggle, onUpdate }: { row: ImportRow; onToggle?: (k: string) => void; onUpdate?: (k: string) => void }) {
  const { c } = useTheme();
  const free = row.state === 'new';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.checked, disabled: !free }}
      accessibilityLabel={`${row.time} ${row.title}`}
      disabled={!free}
      onPress={onToggle ? () => onToggle(row.key) : undefined}
      style={[styles.row, { borderTopColor: c.hair }, row.state === 'done' && styles.faded]}
    >
      {free ? <Tick on={row.checked} /> : <Icon name="check" size={14} color={c.muted} />}
      <Text style={[styles.time, { color: c.text }]}>{row.time}</Text>
      <View style={styles.titleWrap}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{row.title}</Text>
        {row.repeat ? <Icon name="repeat" size={11} color={c.muted} /> : null}
        {row.birthday ? <Icon name="kindBirthday" size={11} color={c.muted} /> : null}
      </View>
      {row.state === 'changed' ? (
        <Pressable accessibilityRole="button" onPress={onUpdate ? () => onUpdate(row.key) : undefined} style={[styles.update, { borderColor: c.text }]}>
          <Text style={[styles.updateText, { color: c.text }]}>ОБНОВИТЬ</Text>
        </Pressable>
      ) : (
        <Text numberOfLines={1} style={[styles.cal, { color: c.muted }]}>{row.state === 'done' ? 'ПЕРЕНЕСЕНО' : row.cal}</Text>
      )}
    </Pressable>
  );
});

export const PhoneImportScreen = memo(function PhoneImportScreen(props: PhoneImportScreenProps) {
  const { access, loading, period, chips, sections, destLabel, selected, allChecked, insets = NO_INSETS } = props;
  const { c } = useTheme();
  const notice = accessNotice(access, props.onAsk ?? noop, props.onOpenSettings ?? noop);
  const ready = !notice;
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + (ready ? 170 : 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader caption="КАЛЕНДАРИ ТЕЛЕФОНА" title="Перенести" onBack={props.onBack} />
        <View style={styles.body}>
          {notice ?? (
            <>
              <View style={[styles.box, { borderColor: c.border }]}>
                <OptionGrid options={PERIODS} value={period} onChange={props.onPeriod} />
              </View>
              {chips.length > 1 ? (
                <View style={styles.chips}>
                  {chips.map((ch) => (
                    <Pressable
                      key={ch.id}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: ch.on }}
                      accessibilityLabel={ch.label}
                      onPress={props.onToggleChip ? () => props.onToggleChip!(ch.id) : undefined}
                      style={[styles.chip, { borderColor: c.border, backgroundColor: ch.on ? c.text : c.panel }]}
                    >
                      <Text numberOfLines={1} style={[styles.chipText, { color: ch.on ? c.bg : c.text }]}>{ch.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {props.noCalendars ? (
                <PhoneNotice text="Календари не выбраны" action="КАЛЕНДАРИ" onAction={props.onOpenCalendars} />
              ) : loading && !sections.length ? (
                <Loading />
              ) : !sections.length ? (
                <PhoneNotice text={props.emptyText} />
              ) : (
                sections.map((sec) => (
                  <View key={sec.key} style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${sec.title}: выбрать все`}
                      onPress={props.onToggleSection ? () => props.onToggleSection!(sec.key) : undefined}
                      style={[styles.head, { backgroundColor: c.text }]}
                    >
                      <Text style={[styles.headText, { color: c.bg }]}>{sec.title}</Text>
                      <Text style={[styles.headText, { color: c.bg }]}>{String(sec.rows.length).padStart(2, '0')}</Text>
                    </Pressable>
                    {sec.rows.map((r) => (
                      <Row key={r.key} row={r} onToggle={props.onToggleRow} onUpdate={props.onUpdate} />
                    ))}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
      {ready ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16, borderTopColor: c.hair, backgroundColor: c.bg }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Куда: ${destLabel}`}
            onPress={props.onPickDest}
            style={[styles.destRow, { borderColor: c.border, backgroundColor: c.panel }]}
          >
            <Text style={[styles.destLabel, { color: c.muted }]}>КУДА</Text>
            <Text numberOfLines={1} style={[styles.destValue, { color: c.text }]}>{destLabel}</Text>
            <Icon name="chevronDown" size={10} color={c.text} />
          </Pressable>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" onPress={props.onToggleAll} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
              <Text style={[styles.buttonText, { color: c.text }]}>{allChecked ? 'СНЯТЬ ВСЕ' : 'ВЫБРАТЬ ВСЕ'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected }}
              disabled={!selected}
              onPress={props.onTransfer}
              style={[styles.button, styles.main, { borderColor: c.text, backgroundColor: c.text }, !selected && styles.faded]}
            >
              <Text style={[styles.buttonText, { color: c.bg }]}>{selected ? `ПЕРЕНЕСТИ ${selected}` : 'ПЕРЕНЕСТИ'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  body: { marginTop: 12, gap: 8 },
  box: { borderWidth: S.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.mono500, fontSize: 9.5, letterSpacing: 0.7 },
  head: { height: S.sectionHeader, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  row: { minHeight: S.row, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: S.hairline },
  faded: { opacity: 0.4 },
  time: { width: 38, fontFamily: fonts.mono600, fontSize: 11 },
  titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { flexShrink: 1, fontFamily: fonts.sans500, fontSize: 14 },
  cal: { maxWidth: 96, fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.4 },
  update: { height: 28, paddingHorizontal: 8, borderWidth: S.border, justifyContent: 'center' },
  updateText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.7 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: space.side, gap: 10, borderTopWidth: S.hairline },
  destRow: { height: 40, paddingHorizontal: 10, borderWidth: S.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  destLabel: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  destValue: { flex: 1, fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 2 },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
