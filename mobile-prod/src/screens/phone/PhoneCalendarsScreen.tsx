/**
 * Календари телефона (из Настроек): показывать ли события телефона в календаре «Кстати», какие календари и куда
 * переносить их события; перенести списком; удалить все перенесённые. Нет доступа — «РАЗРЕШИТЬ».
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PhoneAccess } from '@/lib/phoneCalendarNative';
import { SectionBox, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from '../account/components/AccountHeader';
import { AccountRow } from '../account/components/AccountRow';
import { Toggle } from '../account/components/Toggle';
import { accountText } from '../account/components/accountTheme';
import { Tick, accessNotice } from './PhoneParts';

export type PhoneCalRow = { id: string; title: string; account: string; color: string; on: boolean; dest: string };

export type PhoneCalendarsScreenProps = {
  access: PhoneAccess | null;
  show: boolean;
  cals: readonly PhoneCalRow[];
  /** Сколько дел перенесено из телефона */
  imported: number;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onAsk?: () => void;
  onOpenSettings?: () => void;
  onToggleShow?: (on: boolean) => void;
  onToggleCal?: (id: string) => void;
  onPickDest?: (id: string) => void;
  onImport?: () => void;
  onDropAll?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
const noop = () => {};

export const PhoneCalendarsScreen = memo(function PhoneCalendarsScreen(props: PhoneCalendarsScreenProps) {
  const { access, show, cals, imported, insets = NO_INSETS } = props;
  const { c } = useTheme();
  const on = cals.filter((x) => x.on).length;
  const notice = accessNotice(access, props.onAsk ?? noop, props.onOpenSettings ?? noop);
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <AccountHeader caption="НАСТРОЙКИ" title="Календари телефона" onBack={props.onBack} />
        <View style={styles.sections}>
          {notice ?? (
            <>
              <SectionBox title="СЛОЙ">
                <View style={[styles.switchRow, { backgroundColor: c.panel }]}>
                  <Text style={[accountText.rowLabel, { color: c.text }]}>Показывать в календаре</Text>
                  <Toggle value={show} onChange={props.onToggleShow} accessibilityLabel="Показывать в календаре" />
                </View>
              </SectionBox>

              <SectionBox title="КАЛЕНДАРИ" count={`${on} ИЗ ${cals.length}`}>
                <View style={!show && styles.faded}>
                  {cals.map((cal, i) => (
                    <View key={cal.id} style={[styles.cal, { backgroundColor: c.panel }, i > 0 && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: cal.on }}
                        accessibilityLabel={cal.title}
                        onPress={props.onToggleCal ? () => props.onToggleCal!(cal.id) : undefined}
                        style={styles.calMain}
                      >
                        <View style={[styles.swatch, { backgroundColor: cal.color }]} />
                        <View style={styles.calText}>
                          <Text numberOfLines={1} style={[styles.calTitle, { color: c.text }]}>{cal.title}</Text>
                          <Text numberOfLines={1} style={[styles.calMeta, { color: c.muted }]}>{cal.account}</Text>
                        </View>
                        <Tick on={cal.on} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Куда переносить: ${cal.dest}`}
                        onPress={props.onPickDest ? () => props.onPickDest!(cal.id) : undefined}
                        style={[styles.dest, { borderColor: c.border }]}
                      >
                        <Text numberOfLines={1} style={[styles.destText, { color: c.text }]}>{cal.dest}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </SectionBox>

              {imported ? (
                <SectionBox title="ПЕРЕНЕСЕНО" count={String(imported)}>
                  <AccountRow label="Удалить все перенесённые" danger onPress={props.onDropAll} chevron={false} />
                </SectionBox>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      {notice ? null : (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16, borderTopColor: c.hair, backgroundColor: c.bg }]}>
          <Pressable accessibilityRole="button" onPress={props.onImport} style={[styles.button, { borderColor: c.text, backgroundColor: c.text }]}>
            <Text style={[styles.buttonText, { color: c.bg }]}>ПЕРЕНЕСТИ СПИСКОМ</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.side },
  sections: { marginTop: 12, gap: 8 },
  switchRow: { height: S.row, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faded: { opacity: 0.4 },
  cal: { minHeight: 52, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  calMain: { flex: 1, minHeight: 52, paddingLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 10, height: 10 },
  calText: { flex: 1, minWidth: 0, gap: 2 },
  calTitle: { fontFamily: fonts.sans500, fontSize: 14 },
  calMeta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.5 },
  dest: { height: 32, maxWidth: 120, paddingHorizontal: 8, borderWidth: S.border, justifyContent: 'center' },
  destText: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.6 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: space.side, borderTopWidth: S.hairline },
  button: { height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
