/**
 * Настройки виджета на Android — открываются самим виджетом (долгое нажатие → «Настроить»).
 * У каждого виджета на рабочем столе свои: микрофон, прозрачность фона, цвет текста.
 * Экран отдельный от приложения (своё окно), поэтому без шрифтов и навигации приложения — простые элементы.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import type { WidgetPrefs } from '@/lib/types';
import { KstatiWidget, readPrefs, readSnapshot, savePrefs } from './android';

const OPACITY = [
  { label: '0%', value: 1 },
  { label: '25%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.25 },
  { label: '100%', value: 0 },
];
const TEXT: { key: WidgetPrefs['text']; label: string }[] = [
  { key: 'auto', label: 'Как в теме' },
  { key: 'light', label: 'Светлый' },
  { key: 'dark', label: 'Тёмный' },
];

export function WidgetConfig({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const dark = useColorScheme() !== 'light';
  const c = dark
    ? { bg: '#1E1E1E', text: '#E6E6E6', muted: '#8B8B8B', border: '#333333', primary: '#E6E6E6', onPrimary: '#1E1E1E' }
    : { bg: '#FFFFFF', text: '#1A1A1A', muted: '#6B6B6B', border: '#E5E5E5', primary: '#1A1A1A', onPrimary: '#FFFFFF' };
  const [p, setP] = useState<WidgetPrefs>(() => readPrefs(widgetInfo.widgetId));

  // Каждое изменение сразу видно на самом виджете
  const apply = (next: WidgetPrefs) => {
    setP(next);
    renderWidget(<KstatiWidget snap={readSnapshot()} prefs={next} width={widgetInfo.width} height={widgetInfo.height} now={Date.now()} />);
  };
  const done = () => {
    savePrefs(widgetInfo.widgetId, p);
    setResult('ok');
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : 'transparent' }]}>
      <Text style={{ fontSize: 13, color: on ? c.onPrimary : c.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>Виджет «Кстати»</Text>

      <View style={[styles.row, { borderColor: c.border }]}>
        <Text style={{ fontSize: 16, color: c.text }}>Микрофон</Text>
        <Switch
          value={p.mic}
          onValueChange={(mic) => apply({ ...p, mic })}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor={p.mic ? c.onPrimary : c.muted}
        />
      </View>

      <Text style={[styles.label, { color: c.muted }]}>Прозрачность фона</Text>
      <View style={styles.wrap}>{OPACITY.map((o) => chip(o.label, Math.abs(p.opacity - o.value) < 0.01, () => apply({ ...p, opacity: o.value })))}</View>

      <Text style={[styles.label, { color: c.muted }]}>Цвет текста</Text>
      <View style={styles.wrap}>{TEXT.map((t) => chip(t.label, p.text === t.key, () => apply({ ...p, text: t.key })))}</View>

      <View style={{ flex: 1 }} />
      <View style={styles.actions}>
        <Pressable onPress={() => setResult('cancel')} style={styles.textBtn}>
          <Text style={{ fontSize: 16, color: c.muted }}>Отмена</Text>
        </Pressable>
        <Pressable onPress={done} style={[styles.btn, { backgroundColor: c.primary }]}>
          <Text style={{ fontSize: 16, color: c.onPrimary }}>Готово</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderTopWidth: 1, borderBottomWidth: 1 },
  label: { fontSize: 13, marginTop: 20, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingBottom: 24 },
  textBtn: { height: 48, justifyContent: 'center', paddingHorizontal: 4 },
  btn: { height: 48, borderRadius: 10, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
});
