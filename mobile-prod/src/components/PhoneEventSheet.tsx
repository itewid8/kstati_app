/**
 * Шторка события календаря телефона (s.phoneSheet): откуда, когда, повтор, описание; куда перенести
 * (по умолчанию — как настроено у календаря, иначе «Только мне»); «ПЕРЕНЕСТИ · <куда>» — дело в «Кстати» и «ВЕРНУТЬ» внизу.
 * Ещё: открыть событие в календаре телефона, скрыть весь календарь из слоя.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { calDest, eventHash, toDraft } from '@/lib/phoneCalendar';
import { openInPhoneCalendar } from '@/lib/phoneCalendarNative';
import { useStore } from '@/lib/store';
import { OptionGrid } from '@/screens/account/components/OptionGrid';
import { destsOf, repeatLabel, whenText } from '@/screens/phone/phoneText';
import { Icon, fonts, size as S, useTheme } from '@/ui';
import { Sheet } from './Sheet';

const close = () => useStore.getState().setPhoneSheet(null);

export function PhoneEventSheet() {
  const { c } = useTheme();
  const st = useStore(useShallow((s) => ({ sheet: s.phoneSheet, groups: s.groups, settings: s.phoneCal })));
  const sheet = st.sheet;
  const dests = useMemo(() => destsOf(st.groups), [st.groups]);
  const [dest, setDest] = useState('me');
  useEffect(() => {
    if (!sheet) return;
    const d = calDest(useStore.getState().phoneCal, sheet.cal.id);
    setDest(dests.some((x) => x.key === d) ? d : 'me');
  }, [sheet, dests]);
  if (!sheet) return null;
  const { ev, cal } = sheet;
  const destLabel = dests.find((d) => d.key === dest)?.label ?? 'ТОЛЬКО МНЕ';
  const note = [ev.notes?.trim(), ev.location?.trim()].filter(Boolean).join('\n');

  const transfer = () => {
    useStore.getState().importPhone([{ draft: toDraft(ev, cal), ext: { cal: cal.id, id: ev.id, h: eventHash(ev) }, dest }]);
    close();
  };
  const hideCal = () => {
    useStore.getState().setPhoneCal(cal.id, { on: false });
    close();
  };

  const footer = (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" onPress={close} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Text style={[styles.buttonText, { color: c.text }]}>ЗАКРЫТЬ</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={transfer} style={[styles.button, styles.main, { borderColor: c.text, backgroundColor: c.text }]}>
        <Text numberOfLines={1} style={[styles.buttonText, { color: c.bg }]}>{`ПЕРЕНЕСТИ · ${destLabel}`}</Text>
      </Pressable>
    </View>
  );

  return (
    <Sheet visible onClose={close} footer={footer} inset>
      <View style={styles.head}>
        <View style={styles.capRow}>
          <Icon name="phone" size={10} color={c.muted} />
          <Text numberOfLines={1} style={[styles.cap, { color: c.muted }]}>{`ИЗ ТЕЛЕФОНА · ${cal.account} · ${cal.title.toUpperCase()}`}</Text>
        </View>
        <Text style={[styles.title, { color: c.text }]}>{ev.title || 'Без названия'}</Text>
      </View>

      <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Row label="КОГДА" value={whenText(ev)} />
        <Row label="ПОВТОР" value={repeatLabel(ev)} line />
        {note ? <Row label="ОПИСАНИЕ" value={note} line text /> : null}
      </View>

      <View style={styles.dest}>
        <Text style={[styles.cap, { color: c.muted }]}>КУДА</Text>
        <View style={[styles.box, { borderColor: c.border }]}>
          <OptionGrid options={dests} value={dest} onChange={setDest} />
        </View>
      </View>

      <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Pressable accessibilityRole="button" onPress={() => openInPhoneCalendar(ev)} style={styles.link}>
          <Text style={[styles.linkText, { color: c.text }]}>Открыть в календаре телефона</Text>
          <Icon name="chevronRight" size={12} color={c.muted} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={hideCal} style={[styles.link, { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
          <Text numberOfLines={1} style={[styles.linkText, { color: c.text }]}>{`Скрыть календарь «${cal.title}»`}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function Row({ label, value, line, text }: { label: string; value: string; line?: boolean; text?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, line && { borderTopWidth: S.hairline, borderTopColor: c.hair }]}>
      <Text style={[styles.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[text ? styles.rowText : styles.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cap: { flexShrink: 1, fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  title: { fontFamily: fonts.sans700, fontSize: 26, lineHeight: 30, letterSpacing: -1 },
  box: { borderWidth: S.border },
  row: { minHeight: 40, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  rowLabel: { width: 84, paddingLeft: 10, fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.4 },
  rowValue: { flex: 1, paddingRight: 10, fontFamily: fonts.mono500, fontSize: 11 },
  rowText: { flex: 1, paddingRight: 10, fontFamily: fonts.sans400, fontSize: 13, lineHeight: 17 },
  dest: { gap: 6 },
  link: { height: S.row, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkText: { flexShrink: 1, fontFamily: fonts.sans500, fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  main: { flex: 1.6 },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
