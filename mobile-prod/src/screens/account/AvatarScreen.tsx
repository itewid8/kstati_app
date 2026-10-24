/**
 * Цвет и символ: квадрат-превью, цвет («АВТО», семь цветов палитры, свой — полосой спектра), символ на квадрате.
 * Ничего не сохраняется, пока не нажата СОХРАНИТЬ. Презентационный экран: черновик — пропсами.
 */
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { hexHue, hueHex } from '@/lib/personColors';
import { PERSON_COLORS, type PaletteKey, type PersonColor } from '@/lib/types';
import { Icon, SectionBox, fonts, size as S, useTheme } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { accountText, gridColumn } from './components/accountTheme';
import { ErrorLine } from './components/ErrorLine';
import { Field } from './components/Field';

export type AvatarScreenProps = {
  name: string;
  /** Цвет черновика; null — «АВТО» (подбирается по группам) */
  color: PersonColor | null;
  /** Каким будет «АВТО» */
  autoColor: PersonColor;
  /** Символ черновика; пусто — первая буква имени */
  symbol: string;
  canSave: boolean;
  busy?: boolean;
  error?: string | null;
  insets?: PageInsets;

  onBack?: () => void;
  onPickColor?: (color: PersonColor | null) => void;
  onChangeSymbol?: (symbol: string) => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

const COLOR_NAME: Record<PaletteKey, string> = {
  blue: 'Синий',
  pink: 'Розовый',
  green: 'Зелёный',
  yellow: 'Жёлтый',
  orange: 'Оранжевый',
  violet: 'Фиолетовый',
  teal: 'Бирюзовый',
};

const STRIP = 32;
const HUES = [0, 60, 120, 180, 240, 300, 360];
const CELL = gridColumn(PERSON_COLORS.length + 1);

const upper = (s: string) => s.toLocaleUpperCase('ru-RU');
const firstLetter = (name: string) => upper(Array.from(name.trim())[0] ?? '?');

/* ---------- Полоса спектра: провести пальцем — свой цвет ---------- */

type SpectrumProps = {
  /** Оттенок своего цвета (бегунок); null — свой цвет не выбран */
  hue: number | null;
  /** Пока палец на полосе — оттенок под ним */
  onDrag: (hue: number | null) => void;
  onPick?: (color: PersonColor) => void;
};

const Spectrum = memo(function Spectrum({ hue, onDrag, onPick }: SpectrumProps) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const gesture = useMemo(() => {
    const hueAt = (x: number) => Math.max(0, Math.min(359, (x / Math.max(1, width)) * 360));
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => onDrag(hueAt(e.x)))
      .onUpdate((e) => onDrag(hueAt(e.x)))
      .onEnd((e) => {
        onDrag(null);
        onPick?.(hueHex(hueAt(e.x)));
      })
      .onFinalize(() => onDrag(null));
  }, [width, onDrag, onPick]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Свой цвет"
        onLayout={onLayout}
        style={[styles.strip, { borderColor: c.border }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="kstatiSpectrum" x1="0" y1="0" x2="1" y2="0">
              {HUES.map((h) => (
                <Stop key={h} offset={h / 360} stopColor={hueHex(h % 360)} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#kstatiSpectrum)" />
        </Svg>
        {hue !== null && width > 0 ? (
          <View pointerEvents="none" style={[styles.thumb, { left: (hue / 360) * width - 3, backgroundColor: c.text, borderColor: c.bg }]} />
        ) : null}
      </View>
    </GestureDetector>
  );
});

/* ---------- Экран ---------- */

export const AvatarScreen = memo(function AvatarScreen(props: AvatarScreenProps) {
  const {
    name,
    color,
    autoColor,
    symbol,
    canSave,
    busy = false,
    error,
    insets = NO_INSETS,
    onBack,
    onPickColor,
    onChangeSymbol,
    onCancel,
    onSave,
  } = props;
  const { c, person, personInk } = useTheme();
  const [dragHue, setDragHue] = useState<number | null>(null);
  const custom = color?.startsWith('#') ? color : null;
  const shown: PersonColor = dragHue !== null ? hueHex(dragHue) : (color ?? autoColor);
  const letter = symbol.trim() ? upper(symbol.trim()) : firstLetter(name);
  const pick = busy ? undefined : onPickColor;

  return (
    <AccountPage caption="ПРОФИЛЬ" title="Иконка" insets={insets} onBack={onBack} save={{ canSave, busy, onCancel, onSave }}>
      <View style={styles.identity}>
        <View
          accessible
          accessibilityLabel={`Иконка: ${letter}`}
          style={[styles.preview, { borderColor: c.border, backgroundColor: person(shown) }]}
        >
          <Text numberOfLines={1} style={[styles.letter, { color: personInk(shown) }]}>
            {letter}
          </Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{name}</Text>
      </View>

      <SectionBox title="ЦВЕТ">
        <View style={[styles.panel, { backgroundColor: c.panel }]}>
          <View accessibilityRole="radiogroup" style={styles.cells}>
            <View style={styles.cell}>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Авто"
                accessibilityState={{ selected: color === null }}
                onPress={pick ? () => pick(null) : undefined}
                style={[styles.swatch, { borderColor: c.border, backgroundColor: color === null ? c.text : c.panel }]}
              >
                <Text style={[color === null ? accountText.optionActive : accountText.option, { color: color === null ? c.bg : c.text }]}>
                  АВТО
                </Text>
              </Pressable>
            </View>
            {PERSON_COLORS.map((key) => {
              const on = color === key;
              return (
                <View key={key} style={styles.cell}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={COLOR_NAME[key]}
                    accessibilityState={{ selected: on }}
                    onPress={pick ? () => pick(key) : undefined}
                    style={[styles.swatch, { borderColor: c.border, backgroundColor: person(key) }]}
                  >
                    {on ? <Icon name="check" size={14} color={personInk(key)} strokeWidth={3} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Spectrum hue={dragHue ?? (custom ? hexHue(custom) : null)} onDrag={setDragHue} onPick={pick} />
        </View>
      </SectionBox>

      <SectionBox title="СИМВОЛ">
        <Field
          framed={false}
          value={symbol}
          onChangeText={onChangeSymbol}
          placeholder={firstLetter(name)}
          accessibilityLabel="Символ"
          maxLength={16}
          autoCorrect={false}
          editable={!busy}
          returnKeyType="done"
        />
      </SectionBox>

      <ErrorLine text={error} />
    </AccountPage>
  );
});

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  preview: { width: 64, height: 64, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { fontFamily: fonts.sans700, fontSize: 30, letterSpacing: -1.2 },
  name: { flex: 1, fontFamily: fonts.sans700, fontSize: 32, lineHeight: 34, letterSpacing: -1.6 },
  panel: { padding: 6, gap: 6 },
  /** Восемь равных колонок с зазором 6: у ячейки поле справа, у ряда — компенсация */
  cells: { flexDirection: 'row', marginRight: -6 },
  cell: { width: CELL, paddingRight: 6 },
  swatch: { height: 32, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  strip: { height: STRIP, borderWidth: S.border, overflow: 'hidden' },
  thumb: { position: 'absolute', top: 0, bottom: 0, width: 6, borderLeftWidth: S.border, borderRightWidth: S.border },
});
