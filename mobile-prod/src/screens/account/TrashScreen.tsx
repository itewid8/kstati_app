/**
 * Недавно удалённые (из Настроек): все удалённые записи любого типа за 30 дней, по дням удаления.
 * Фишки типов сверху; «ВЫБРАТЬ ВСЕ / СНЯТЬ ВСЕ» в шапке списка; нажатие на строку — выбрать.
 * Снизу: ничего не выбрано — ВЕРНУТЬ ВСЁ / ОЧИСТИТЬ ВСЁ, выбрано — ВЕРНУТЬ N / УДАЛИТЬ N (навсегда — с вопросом).
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { Tick } from '../phone/PhoneParts';
import { AccountHeader } from './components/AccountHeader';

export type TrashRow = { key: string; type: string; title: string; meta: string; checked: boolean };
export type TrashDay = { key: string; title: string; rows: readonly TrashRow[] };
export type TrashFilter = { key: string; label: string; on: boolean };

export type TrashScreenProps = {
  filters: readonly TrashFilter[];
  days: readonly TrashDay[];
  total: number;
  selected: number;
  allSelected: boolean;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onFilter?: (key: string) => void;
  onToggleRow?: (key: string) => void;
  onToggleDay?: (key: string) => void;
  onSelectAll?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

const Row = memo(function Row({ row, onToggle, first }: { row: TrashRow; onToggle?: (k: string) => void; first: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.checked }}
      accessibilityLabel={`${row.type}: ${row.title}`}
      onPress={onToggle ? () => onToggle(row.key) : undefined}
      style={[styles.row, { backgroundColor: c.panel }, !first && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}
    >
      <Tick on={row.checked} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{row.title}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{`${row.type} · ${row.meta}`}</Text>
      </View>
    </Pressable>
  );
});

export const TrashScreen = memo(function TrashScreen(props: TrashScreenProps) {
  const { filters, days, total, selected, allSelected, insets = NO_INSETS } = props;
  const { c } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader caption="НАСТРОЙКИ" title="Недавно удалённые" onBack={props.onBack} />
        <View style={styles.body}>
          {filters.length > 2 ? (
            <View style={styles.chips}>
              {filters.map((f) => (
                <Pressable
                  key={f.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: f.on }}
                  onPress={props.onFilter ? () => props.onFilter!(f.key) : undefined}
                  style={[styles.chip, { borderColor: c.border, backgroundColor: f.on ? c.text : c.panel }]}
                >
                  <Text style={[styles.chipText, { color: f.on ? c.bg : c.text }]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {!total ? (
            <View style={[styles.empty, { borderColor: c.border, backgroundColor: c.panel }]}>
              <Text style={[styles.title, { color: c.text }]}>Здесь пусто</Text>
              <Text style={[styles.meta, { color: c.muted }]}>УДАЛЁННОЕ ХРАНИТСЯ 30 ДНЕЙ</Text>
            </View>
          ) : (
            <SectionBox title="УДАЛЕНО" count={String(total)} action={props.onSelectAll && { label: allSelected ? 'СНЯТЬ ВСЕ' : 'ВЫБРАТЬ ВСЕ', onPress: props.onSelectAll }}>
              {days.map((d) => (
                <View key={d.key}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${d.title}: выбрать все`}
                    onPress={props.onToggleDay ? () => props.onToggleDay!(d.key) : undefined}
                    style={[styles.day, { backgroundColor: c.bg, borderTopColor: c.hair }]}
                  >
                    <Text style={[styles.dayText, { color: c.muted }]}>{d.title}</Text>
                    <Text style={[styles.dayText, { color: c.muted }]}>{String(d.rows.length).padStart(2, '0')}</Text>
                  </Pressable>
                  {d.rows.map((r, i) => (
                    <Row key={r.key} row={r} first={i === 0} onToggle={props.onToggleRow} />
                  ))}
                </View>
              ))}
            </SectionBox>
          )}
        </View>
      </ScrollView>
      {total ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16, borderTopColor: c.hair, backgroundColor: c.bg }]}>
          <Pressable accessibilityRole="button" onPress={props.onRestore} style={[styles.button, { borderColor: c.text, backgroundColor: c.text }]}>
            <Text style={[styles.buttonText, { color: c.bg }]}>{selected ? `ВЕРНУТЬ ${selected}` : 'ВЕРНУТЬ ВСЁ'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={props.onPurge} style={[styles.button, { borderColor: c.red, backgroundColor: c.panel }]}>
            <Text style={[styles.buttonText, { color: c.red }]}>{selected ? `УДАЛИТЬ ${selected}` : 'ОЧИСТИТЬ ВСЁ'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  body: { marginTop: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.mono500, fontSize: 9.5, letterSpacing: 0.7 },
  empty: { borderWidth: S.border, padding: 12, gap: 4 },
  day: { height: 26, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: S.hairline },
  dayText: { fontFamily: fonts.mono500, fontSize: 9, letterSpacing: 0.72 },
  row: { minHeight: 52, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fonts.sans500, fontSize: 14 },
  meta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: space.side, flexDirection: 'row', gap: 8, borderTopWidth: S.hairline },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
