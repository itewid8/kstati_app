/**
 * Настройки виджета на Android — открываются самим виджетом (долгое нажатие → «Настроить»).
 * Окно — KstatiWidgetConfigActivity из modules/kstati-widget, экран регистрируется в index.ts.
 * У каждого виджета на рабочем столе свои: микрофон, прозрачность фона, цвета.
 * Окно прозрачное: виджет на рабочем столе меняется сразу. Панель настроек можно перетащить
 * вверх или вниз экрана, чтобы она не закрывала виджет; место запоминается.
 * Экран отдельный от приложения (своё окно), поэтому без шрифтов и навигации приложения — простые элементы.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toggle } from '@/components/ui';
import type { WidgetPrefs, WidgetTone } from '@/lib/types';
import { finishWidgetConfig, reloadWidget } from '../../modules/kstati-widget';
import { readPrefs, readSheetTop, savePrefs, saveSheetTop } from './android';

const TONES: { key: WidgetTone; label: string }[] = [
  { key: 'auto', label: 'Как в теме' },
  { key: 'light', label: 'Светлый' },
  { key: 'dark', label: 'Тёмный' },
];
/** Насколько потянуть панель, чтобы она перескочила на другой край экрана */
const MOVE_DY = 60;

type Palette = { bg: string; text: string; muted: string; border: string; primary: string; onPrimary: string };
/** Нативное окно передаёт id виджета */
type Props = { widgetId: number };

export function WidgetConfig(props: Props) {
  return (
    <SafeAreaProvider>
      <Sheet {...props} />
    </SafeAreaProvider>
  );
}

function Sheet({ widgetId }: Props) {
  const dark = useColorScheme() !== 'light';
  const c: Palette = dark
    ? { bg: '#1E1E1E', text: '#E6E6E6', muted: '#8B8B8B', border: '#333333', primary: '#E6E6E6', onPrimary: '#1E1E1E' }
    : { bg: '#FFFFFF', text: '#1A1A1A', muted: '#6B6B6B', border: '#E5E5E5', primary: '#1A1A1A', onPrimary: '#FFFFFF' };
  const insets = useSafeAreaInsets();
  const [initial] = useState<WidgetPrefs>(() => readPrefs(widgetId));
  const [p, setP] = useState<WidgetPrefs>(initial);
  const [top, setTop] = useState(readSheetTop);

  // Каждое изменение сразу видно на самом виджете: пишем настройки и просим виджет перерисоваться.
  // Ползунок шлёт много значений подряд — не чаще раза в 80 мс и обязательно последним значением.
  // «Отмена» возвращает прежние настройки.
  const pending = useRef<WidgetPrefs | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draw = (next: WidgetPrefs) => {
    savePrefs(widgetId, next);
    reloadWidget(widgetId);
  };
  const apply = (next: WidgetPrefs) => {
    setP(next);
    pending.current = next;
    if (timer.current) return;
    draw(next);
    pending.current = null;
    timer.current = setTimeout(function flush() {
      timer.current = null;
      if (pending.current) {
        const last = pending.current;
        pending.current = null;
        draw(last);
        timer.current = setTimeout(flush, 80);
      }
    }, 80);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  };
  const done = () => {
    stop();
    draw(p);
    finishWidgetConfig(true);
  };
  const cancel = () => {
    stop();
    draw(initial);
    finishWidgetConfig(false);
  };
  // «Назад» на телефоне — как «Отмена»
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Перетаскивание панели за полосу и заголовок: снизу — вверх, сверху — вниз
  const ty = useRef(new Animated.Value(0)).current;
  const topRef = useRef(top);
  topRef.current = top;
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => ty.setValue(topRef.current ? Math.max(0, g.dy) : Math.min(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          const isTop = topRef.current;
          const move = isTop ? g.dy > MOVE_DY || g.vy > 0.8 : g.dy < -MOVE_DY || g.vy < -0.8;
          if (move) {
            ty.setValue(0);
            setTop(!isTop);
            saveSheetTop(!isTop);
          } else {
            Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
      }),
    [ty],
  );

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : 'transparent' }]}>
      <Text style={{ fontSize: 13, color: on ? c.onPrimary : c.text }}>{label}</Text>
    </Pressable>
  );

  /** Ряд «как в теме / светлый / тёмный» для одного элемента виджета */
  const tones = (label: string, key: 'bg' | 'text' | 'time' | 'micTone') => (
    <>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={styles.wrap}>{TONES.map((t) => chip(t.label, p[key] === t.key, () => apply({ ...p, [key]: t.key })))}</View>
    </>
  );

  const transparency = Math.round((1 - p.opacity) * 100);
  const handle = (
    <View {...drag.panHandlers} style={styles.handleArea}>
      <View style={[styles.handle, { backgroundColor: c.border }]} />
    </View>
  );

  const sheet = (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: c.bg, borderColor: c.border, transform: [{ translateY: ty }] },
        top
          ? { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderTopWidth: 0, paddingTop: insets.top + 12 }
          : { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomWidth: 0, paddingBottom: insets.bottom + 8 },
      ]}
    >
      {top ? null : handle}
      <View {...drag.panHandlers}>
        <Text style={[styles.title, { color: c.text }]}>Виджет «Кстати»</Text>
      </View>

      <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={[styles.row, { borderColor: c.border }]}>
          <Text style={{ fontSize: 16, color: c.text }}>Микрофон</Text>
          <Toggle value={p.mic} onValueChange={(mic) => apply({ ...p, mic })} />
        </View>
        {p.mic ? tones('Цвет микрофона', 'micTone') : null}
        {tones('Фон', 'bg')}
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: c.muted }]}>Прозрачность фона</Text>
          <Text style={[styles.label, styles.value, { color: c.text }]}>{transparency}%</Text>
        </View>
        <Slider value={1 - p.opacity} onChange={(v) => apply({ ...p, opacity: Math.round((1 - v) * 100) / 100 })} c={c} />
        {tones('Цвет названий', 'text')}
        {tones('Цвет времени', 'time')}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable onPress={cancel} style={styles.textBtn}>
          <Text style={{ fontSize: 16, color: c.muted }}>Отмена</Text>
        </Pressable>
        <Pressable onPress={done} style={[styles.btn, { backgroundColor: c.primary }]}>
          <Text style={{ fontSize: 16, color: c.onPrimary }}>Готово</Text>
        </Pressable>
      </View>
      {top ? handle : null}
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {top ? sheet : null}
      <Pressable style={{ flex: 1 }} onPress={done} />
      {top ? null : sheet}
    </View>
  );
}

const THUMB = 24;

/** Ползунок 0…1 с шагом 5 %: тянуть за ручку или нажать в нужное место полосы */
function Slider({ value, onChange, c }: { value: number; onChange: (v: number) => void; c: Palette }) {
  const [w, setW] = useState(0);
  const width = useRef(0);
  const start = useRef(0);
  const last = useRef(value);
  const cb = useRef(onChange);
  cb.current = onChange;

  const pan = useMemo(() => {
    const emit = (x: number) => {
      const usable = Math.max(1, width.current - THUMB);
      const v = Math.round(Math.min(1, Math.max(0, (x - THUMB / 2) / usable)) * 20) / 20;
      if (v !== last.current) {
        last.current = v;
        cb.current(v);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Пока тянем ползунок, прокрутка панели его не перехватывает
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        start.current = e.nativeEvent.locationX;
        emit(start.current);
      },
      onPanResponderMove: (_, g) => emit(start.current + g.dx),
    });
  }, []);
  last.current = value;

  const x = Math.max(0, w - THUMB) * value;
  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
        setW(width.current);
      }}
      style={styles.slider}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: c.border }]} />
      <View pointerEvents="none" style={[styles.fill, { width: x + THUMB / 2, backgroundColor: c.primary }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: x, backgroundColor: c.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  sheet: { borderWidth: 1, paddingHorizontal: 16 },
  handleArea: { height: 24, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderTopWidth: 1, borderBottomWidth: 1 },
  label: { fontSize: 13, marginTop: 20, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontVariant: ['tabular-nums'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  slider: { height: 36, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  thumb: { position: 'absolute', top: (36 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingBottom: 8 },
  textBtn: { height: 48, justifyContent: 'center', paddingHorizontal: 4 },
  btn: { height: 48, borderRadius: 10, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
});
