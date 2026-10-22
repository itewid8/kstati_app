/**
 * Иконка: цвет и символ. Цвет — «Авто», один из семи стикеров или свой с полосы спектра;
 * он же цвет твоих дел в календаре. Символ — буква или эмодзи; пусто — первая буква имени.
 * Всё сохраняется сразу.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Avatar, avatarText } from '@/components/Avatar';
import { BackHeader } from '@/components/Header';
import { Chip, Field, SectionLabel } from '@/components/ui';
import { colorHex, hexHue, hueHex, usePalette } from '@/lib/colors';
import { useStore } from '@/lib/store';
import { PERSON_COLORS, type PersonColor } from '@/lib/types';
import { space, useColors } from '@/theme';

const SWATCH = 28;
const STRIP_H = 28;
const THUMB = 26;
const HUES = [0, 60, 120, 180, 240, 300, 360];

export default function AvatarSettings() {
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const me = useStore((s) => s.me);
  const setLook = useStore((s) => s.setLook);
  const color = me?.color;
  const custom = color?.startsWith('#') ? color : null;

  // Пока тянут по спектру — показываем цвет сразу, сохраняем, когда отпустили
  const [dragHue, setDragHue] = useState<number | null>(null);
  const [stripW, setStripW] = useState(0);
  const [symbol, setSymbol] = useState(me?.avatar ?? '');
  useEffect(() => setSymbol(me?.avatar ?? ''), [me?.avatar]);

  const save = async (patch: { color?: PersonColor | null; avatar?: string | null }) => {
    const err = await setLook(patch);
    if (err) Alert.alert('Не удалось сохранить', err);
  };
  const pick = (next: PersonColor | null) => {
    if (next === (color ?? null)) return;
    save({ color: next });
  };

  const hueAt = (x: number) => Math.max(0, Math.min(359, (x / Math.max(1, stripW)) * 360));
  const spectrum = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => setDragHue(hueAt(e.x)))
    .onUpdate((e) => setDragHue(hueAt(e.x)))
    .onEnd((e) => {
      const hex = hueHex(hueAt(e.x));
      setDragHue(null);
      save({ color: hex });
    })
    .onFinalize(() => setDragHue(null));

  if (!me) return null;
  const previewColor = dragHue !== null ? hueHex(dragHue) : pal.of(me.id);
  const thumbHue = dragHue ?? (custom ? hexHue(custom) : null);
  const commitSymbol = () => {
    const v = symbol.trim();
    if (v === (me.avatar ?? '')) return;
    save({ avatar: v || null });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Иконка" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          <Avatar id={me.id} size={96} color={previewColor} text={avatarText(me.name, symbol)} />
        </View>

        <SectionLabel>Цвет</SectionLabel>
        {/* Одна линия: «Авто» и семь стикеров */}
        <View style={styles.row}>
          <Chip label="Авто" selected={!color} onPress={() => pick(null)} />
          {PERSON_COLORS.map((k) => (
            <Pressable
              key={k}
              onPress={() => pick(k)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected: color === k }}
              style={[styles.ring, { borderColor: color === k ? c.text : 'transparent' }]}
            >
              <View style={[styles.swatch, { backgroundColor: colorHex(k, dark) }]} />
            </Pressable>
          ))}
        </View>
        {/* Свой цвет: провести пальцем по спектру */}
        <GestureDetector gesture={spectrum}>
          <View style={styles.strip} onLayout={(e) => setStripW(e.nativeEvent.layout.width)}>
            <Svg width="100%" height={STRIP_H}>
              <Defs>
                <LinearGradient id="kstatiHue" x1="0" y1="0" x2="1" y2="0">
                  {HUES.map((h) => (
                    <Stop key={h} offset={h / 360} stopColor={hueHex(h % 360)} />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height={STRIP_H} rx={STRIP_H / 2} fill="url(#kstatiHue)" />
            </Svg>
            {thumbHue !== null && stripW > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  { left: (thumbHue / 360) * stripW - THUMB / 2, backgroundColor: hueHex(thumbHue), borderColor: c.background },
                ]}
              />
            ) : null}
          </View>
        </GestureDetector>

        <SectionLabel>Символ</SectionLabel>
        <View style={{ paddingHorizontal: space.side }}>
          <Field
            value={symbol}
            onChangeText={setSymbol}
            onBlur={commitSymbol}
            onSubmitEditing={commitSymbol}
            placeholder={avatarText(me.name)}
            maxLength={16}
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.side, paddingVertical: 6 },
  ring: { width: SWATCH + 8, height: SWATCH + 8, borderRadius: (SWATCH + 8) / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2 },
  strip: { marginHorizontal: space.side, marginTop: 14, height: STRIP_H, justifyContent: 'center' },
  thumb: { position: 'absolute', top: (STRIP_H - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
});
