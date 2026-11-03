/**
 * Расходы на ИИ (из Настроек, прототип и отладка): сумма за период, команды, токены, цена команды,
 * столбики по дням (сегодня — красным), разбивка по источникам. Презентационный экран: данные — пропсами.
 */
import { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SpendView } from '@/adapters/account/spend';
import { SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';

export type SpendPeriod = { key: number; label: string; on: boolean };

export type SpendScreenProps = {
  periods: readonly SpendPeriod[];
  /** null — грузится; 'error' — нет связи */
  view: SpendView | null | 'error';
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onPeriod?: (days: number) => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
const BARS_H = 96;

export const SpendScreen = memo(function SpendScreen({ periods, view, insets = NO_INSETS, onBack, onPeriod }: SpendScreenProps) {
  const { c } = useTheme();
  const v = view && view !== 'error' ? view : null;
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <AccountHeader caption="НАСТРОЙКИ" title="Расходы на ИИ" onBack={onBack} />
      <View style={styles.body}>
        <View style={styles.chips}>
          {periods.map((p) => (
            <Pressable
              key={p.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: p.on }}
              onPress={onPeriod ? () => onPeriod(p.key) : undefined}
              style={[styles.chip, { borderColor: c.border, backgroundColor: p.on ? c.text : c.panel }]}
            >
              <Text style={[styles.chipText, { color: p.on ? c.bg : c.text }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {view === null ? <ActivityIndicator color={c.muted} style={styles.wait} /> : null}
        {view === 'error' ? (
          <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
            <Text style={[styles.title, { color: c.text }]}>Нет связи с сервером</Text>
          </View>
        ) : null}

        {v ? (
          <>
            <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
              <Text style={[styles.total, { color: c.text }]}>{v.total}</Text>
              <Text style={[styles.meta, { color: c.muted }]}>{v.todayLine.toUpperCase()}</Text>
              <View style={styles.totals}>
                {v.totals.map((t) => (
                  <View key={t.label} style={styles.cell}>
                    <Text style={[styles.cellValue, { color: c.text }]}>{t.value}</Text>
                    <Text style={[styles.meta, { color: c.muted }]}>{t.label.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>

            <SectionBox title="ПО ДНЯМ" count={v.barsMax}>
              <View style={[styles.chart, { backgroundColor: c.panel }]}>
                <View style={styles.bars} accessibilityLabel="Расход по дням">
                  {v.bars.map((b) => (
                    <View key={b.day} style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(b.kop ? 2 : 1, Math.round(b.share * BARS_H)), backgroundColor: b.today ? c.red : b.kop ? c.text : c.hair },
                        ]}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.axis}>
                  <Text style={[styles.meta, { color: c.muted }]}>{v.bars[0]?.label.toUpperCase()}</Text>
                  <Text style={[styles.meta, { color: c.muted }]}>{v.bars.at(-1)?.label.toUpperCase()}</Text>
                </View>
              </View>
            </SectionBox>

            <SectionBox title="ОТКУДА">
              {v.sources.map((s, i) => (
                <View key={s.key} style={[styles.row, { backgroundColor: c.panel }, i > 0 && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
                  <View style={styles.text}>
                    <Text style={[styles.title, { color: c.text }]}>{s.label}</Text>
                    <Text style={[styles.meta, { color: c.muted }]}>{s.meta.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.value, { color: c.text }]}>{s.value}</Text>
                </View>
              ))}
            </SectionBox>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  body: { marginTop: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.mono500, fontSize: 9.5, letterSpacing: 0.7 },
  wait: { marginTop: 24 },
  box: { borderWidth: S.border, padding: 12, gap: 6 },
  total: { fontFamily: fonts.sans600, fontSize: 34, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', marginTop: 8, gap: 8 },
  cell: { flex: 1, gap: 3 },
  cellValue: { fontFamily: fonts.sans500, fontSize: 17, fontVariant: ['tabular-nums'] },
  chart: { padding: 10, gap: 6 },
  bars: { height: BARS_H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: BARS_H, justifyContent: 'flex-end' },
  bar: { width: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { minHeight: 52, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fonts.sans500, fontSize: 14 },
  meta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.4 },
  value: { fontFamily: fonts.mono500, fontSize: 12, fontVariant: ['tabular-nums'] },
});
