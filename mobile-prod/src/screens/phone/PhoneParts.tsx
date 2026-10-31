/** Общие куски экранов календаря телефона: нет доступа / пусто, кнопка снизу */
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhoneAccess } from '@/lib/phoneCalendarNative';
import { fonts, size as S, useTheme } from '@/ui';

/** Нет доступа, нет модуля в сборке или пусто — строка и (если есть) одна кнопка */
export const PhoneNotice = memo(function PhoneNotice({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.panel }]}>
      <Text style={[styles.text, { color: c.text }]}>{text}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={[styles.button, { borderColor: c.text, backgroundColor: c.text }]}>
          <Text style={[styles.buttonText, { color: c.bg }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

/** Состояние доступа → строка и кнопка; granted — null */
export function accessNotice(access: PhoneAccess | null, onAsk: () => void, onSettings: () => void) {
  switch (access) {
    case null:
      return <Loading />;
    case 'ask':
      return <PhoneNotice text="Нет доступа к календарю телефона" action="РАЗРЕШИТЬ" onAction={onAsk} />;
    case 'blocked':
      return <PhoneNotice text="Доступ к календарю запрещён в настройках телефона" action="ОТКРЫТЬ НАСТРОЙКИ" onAction={onSettings} />;
    case 'unavailable':
      return <PhoneNotice text="Календарь телефона появится в новой сборке приложения" />;
    default:
      return null;
  }
}

export const Loading = memo(function Loading() {
  const { c } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color={c.muted} />
    </View>
  );
});

/** Квадрат-галочка 20px */
export const Tick = memo(function Tick({ on }: { on: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.tick, { borderColor: c.border, backgroundColor: on ? c.text : c.bg }]}>
      {on ? <View style={[styles.tickMark, { borderColor: c.bg }]} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border, padding: 12, gap: 12 },
  text: { fontFamily: fonts.sans500, fontSize: 14, lineHeight: 19 },
  button: { height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
  loading: { height: 80, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 20, height: 20, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  tickMark: { width: 10, height: 6, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginTop: -2 },
});
