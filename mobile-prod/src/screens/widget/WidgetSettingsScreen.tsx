/**
 * Настройки виджета (макет C-WidgetSettings). Сверху закреплены «Назад», заголовок, превью на обоях и вкладки
 * размеров 1×1 / 2×1 / 2×2 / 4×2 / 4×4 — превью видно, пока листаешь настройки. Ниже: КНОПКА REC (показывать, цвет),
 * ФОН (цвет, прозрачность полоской до 100%), ШАПКА (цвет, прозрачность), ЦВЕТА (названия, время), ГРУППЫ (Я и группы, несколько).
 * Превью — виджет в настоящих размерах, уменьшенный, чтобы целиком влезть в рамку (4×4 заметно выше 4×2). Снизу ОТМЕНА / СОХРАНИТЬ.
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { faceColors, headAlpha, WIDGET_OPACITY_MIN, type WidgetPrefs, type WidgetTone } from '@/lib/widgetData';
import { fonts, size as S, useTheme } from '@/ui';
import { Slider } from './components/Slider';
import { Wallpaper } from './Wallpaper';
import { FaceDays, FaceNext, FaceRec, FaceStack, type FaceDay, type FaceHeader, type FaceItem } from './WidgetFace';

export type WidgetSize = '1x1' | '2x1' | '2x2' | '4x2' | '4x4';
export const WIDGET_SIZES: readonly WidgetSize[] = ['1x1', '2x1', '2x2', '4x2', '4x4'];

export type WidgetGroupOption = { id: string; name: string };

export type WidgetPreviewData = { header: FaceHeader; days: readonly FaceDay[]; items: readonly FaceItem[]; dark: boolean };

export type WidgetSettingsScreenProps = {
  prefs: WidgetPrefs;
  size: WidgetSize;
  preview: WidgetPreviewData;
  groups: readonly WidgetGroupOption[];
  canSave: boolean;
  insets: { top: number; bottom: number };
  onChange?: (prefs: WidgetPrefs) => void;
  onChangeSize?: (size: WidgetSize) => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const TONES: ReadonlyArray<{ key: WidgetTone; label: string }> = [
  { key: 'auto', label: 'АВТО' },
  { key: 'light', label: 'СВЕТЛЫЙ' },
  { key: 'dark', label: 'ТЁМНЫЙ' },
];

/** Прозрачность в настройках: 0…100% (непрозрачность не ниже WIDGET_OPACITY_MIN) */
const MAX_TRANSPARENCY = 1 - WIDGET_OPACITY_MIN;
/** Рамка превью: высота и поля внутри; размеры виджетов на рабочем столе (как в C-WidgetHome / C-WidgetLarge) */
const STAGE = 260;
const STAGE_PAD = 14;
const REAL: Record<WidgetSize, readonly [number, number]> = { '1x1': [82, 82], '2x1': [174, 82], '2x2': [174, 182], '4x2': [358, 210], '4x4': [358, 374] };
const TOP = 60 + STAGE + 8 + 34 + 10;
const SAVE_BAR = 76;

export const WidgetSettingsScreen = memo(function WidgetSettingsScreen(props: WidgetSettingsScreenProps) {
  const { prefs, size, preview, groups, canSave, insets, onChange, onChangeSize, onCancel, onSave } = props;
  const { c } = useTheme();
  const set = (patch: Partial<WidgetPrefs>) => onChange?.({ ...prefs, ...patch });
  const toggleGroup = (id: string) =>
    set({ groups: prefs.groups.includes(id) ? prefs.groups.filter((g) => g !== id) : [...prefs.groups, id] });
  const transparency = Math.round((1 - prefs.opacity) * 100);
  const headTransparency = Math.round((1 - headAlpha(prefs)) * 100);
  // Место внутри рамки превью (без её линии)
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const onStage = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.form, { paddingTop: insets.top + TOP + 12, paddingBottom: insets.bottom + SAVE_BAR + 16 }]}
      >
        <Section title="КНОПКА REC">
          <View style={styles.toggleRow}>
            <Text style={[styles.label, { color: c.text }]}>Показывать</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.mic }}
              accessibilityLabel="Кнопка REC"
              onPress={() => set({ mic: !prefs.mic })}
              style={[styles.toggle, { borderColor: c.border, backgroundColor: c.bg }, !prefs.mic && styles.toggleOff]}
            >
              {prefs.mic ? <View style={[styles.toggleDot, { backgroundColor: c.red }]} /> : null}
              <View style={[styles.toggleKnob, { backgroundColor: prefs.mic ? c.text : c.muted }]} />
            </Pressable>
          </View>
          <Labeled label="Цвет">
            <Segments options={TONES} value={prefs.micTone} onChange={(micTone) => set({ micTone })} />
          </Labeled>
        </Section>
        <Section title="ФОН" count={`${transparency}%`}>
          <Labeled label="Цвет">
            <Segments options={TONES} value={prefs.bg} onChange={(bg) => set({ bg })} />
          </Labeled>
          <Labeled label="Прозрачность">
            <Slider
              value={(1 - prefs.opacity) / MAX_TRANSPARENCY}
              onChange={(t) => set({ opacity: Math.round((1 - t * MAX_TRANSPARENCY) * 100) / 100 })}
              accessibilityLabel="Прозрачность фона"
            />
          </Labeled>
        </Section>
        <Section title="ШАПКА" count={`${headTransparency}%`}>
          <Labeled label="Цвет">
            <Segments options={TONES} value={prefs.head} onChange={(head) => set({ head })} />
          </Labeled>
          <Labeled label="Прозрачность">
            <Slider
              value={1 - headAlpha(prefs)}
              onChange={(t) => set({ headOpacity: Math.round((1 - t) * 100) / 100 })}
              accessibilityLabel="Прозрачность шапки"
            />
          </Labeled>
        </Section>
        <Section title="ЦВЕТА">
          <Labeled label="Названия">
            <Segments options={TONES} value={prefs.text} onChange={(text) => set({ text })} />
          </Labeled>
          <Labeled label="Время">
            <Segments options={TONES} value={prefs.time} onChange={(time) => set({ time })} />
          </Labeled>
        </Section>
        {groups.length > 0 ? (
          <Section title="ГРУППЫ" count={prefs.groups.length === 0 ? 'ВСЕ' : `${prefs.groups.length} ИЗ ${groups.length}`}>
            {groups.map((g, i) => {
              const on = prefs.groups.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleGroup(g.id)}
                  style={[styles.groupRow, i > 0 && { height: 41, borderTopWidth: 1, borderTopColor: c.hair }]}
                >
                  <View style={[styles.check, { borderColor: c.border, backgroundColor: on ? c.text : c.bg }]}>
                    {on ? <Text style={[styles.checkMark, { color: c.bg }]}>✓</Text> : null}
                  </View>
                  <Text numberOfLines={1} style={[styles.label, styles.groupName, { color: c.text }]}>
                    {g.name}
                  </Text>
                </Pressable>
              );
            })}
          </Section>
        ) : null}
      </ScrollView>

      <View style={[styles.top, { height: insets.top + TOP + 1, backgroundColor: c.bg, borderBottomColor: c.border }]}>
        <View style={[styles.head, { top: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Назад"
            onPress={onCancel}
            style={[styles.back, { borderColor: c.border, backgroundColor: c.panel }]}
          >
            <Text style={[styles.backText, { color: c.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>Виджет</Text>
        </View>
        <View style={[styles.stage, { top: insets.top + 60, borderColor: c.border }]}>
          <Wallpaper dark={preview.dark} />
          <View style={StyleSheet.absoluteFill} onLayout={onStage} pointerEvents="none" />
          {stage ? <Preview size={size} prefs={prefs} data={preview} box={stage} /> : null}
        </View>
        <View style={[styles.sizes, { top: insets.top + 60 + STAGE + 8 }]}>
          <Segments
            height={34}
            options={WIDGET_SIZES.map((key) => ({ key, label: key.replace('x', '×') }))}
            value={size}
            onChange={onChangeSize}
          />
        </View>
      </View>

      <View style={[styles.saveBar, { height: insets.bottom + SAVE_BAR + 1, backgroundColor: c.bg, borderTopColor: c.hair }]}>
        <View style={[styles.saveRow, { bottom: insets.bottom + 16 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={[styles.saveBtn, { flexGrow: 1, flexBasis: 14, borderColor: c.border, backgroundColor: c.panel }]}
          >
            <Text style={[styles.saveText, { color: c.text }]}>ОТМЕНА</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={onSave}
            style={[styles.saveBtn, { flexGrow: 1, flexBasis: 14, borderColor: c.border, backgroundColor: c.text, opacity: canSave ? 1 : 0.4 }]}
          >
            <Text style={[styles.saveText, { color: c.bg }]}>СОХРАНИТЬ</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

/** Превью: виджет в настоящем размере по центру рамки, уменьшенный, если не влезает */
const Preview = memo(function Preview({ size, prefs, data, box }: { size: WidgetSize; prefs: WidgetPrefs; data: WidgetPreviewData; box: { w: number; h: number } }) {
  const fc = faceColors(prefs, data.dark ? 'dark' : 'light');
  const [w, h] = REAL[size];
  const scale = Math.min(1, (box.w - 2 * STAGE_PAD) / w, (box.h - 2 * STAGE_PAD) / h);
  const place = { position: 'absolute' as const, left: (box.w - w) / 2, top: (box.h - h) / 2, transform: [{ scale }] };
  switch (size) {
    case '1x1':
      return <FaceRec size={w} c={fc} style={place} />;
    case '2x1':
      return <FaceNext width={w} height={h} c={fc} item={data.items[0] ?? null} style={place} />;
    case '2x2':
      return <FaceStack width={w} height={h} c={fc} header={data.header} items={data.items} style={place} />;
    default:
      return <FaceDays width={w} height={h} c={fc} header={data.header} days={data.days} style={place} />;
  }
});

function Section({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.section, { borderColor: c.border, backgroundColor: c.panel }]}>
      <View style={[styles.sectionHead, { backgroundColor: c.text }]}>
        <Text style={[styles.sectionText, { color: c.bg }]}>{title}</Text>
        {count ? <Text style={[styles.sectionText, { color: c.bg }]}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.labeled, { borderTopColor: c.hair }]}>
      <View style={styles.labelCol}>
        <Text style={[styles.label, styles.labelText, { color: c.text }]}>
          {label}
        </Text>
      </View>
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

function Segments<K extends string>({
  options,
  value,
  onChange,
  height = 32,
}: {
  options: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange?: (key: K) => void;
  height?: number;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.segments}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={onChange ? () => onChange(o.key) : undefined}
            style={[
              styles.segment,
              { height, marginLeft: i ? -S.border : 0, flexBasis: i ? S.border : 0, borderColor: c.border, backgroundColor: on ? c.text : c.panel },
            ]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, { color: on ? c.bg : c.text, fontFamily: on ? fonts.mono600 : fonts.mono400 }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, borderBottomWidth: S.border },
  head: { position: 'absolute', left: 16, right: 16, height: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 40, height: 40, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.sans400, fontSize: 16 },
  title: { fontFamily: fonts.sans700, fontSize: 26, letterSpacing: -1.04 },
  stage: { position: 'absolute', left: 16, right: 16, height: STAGE, borderWidth: S.border, overflow: 'hidden' },
  sizes: { position: 'absolute', left: 16, right: 16 },
  form: { paddingHorizontal: 16, gap: 8 },
  section: { borderWidth: S.border },
  sectionHead: { height: 22, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  toggleRow: { height: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    width: 48,
    height: 26,
    borderWidth: S.border,
    paddingLeft: 6,
    paddingRight: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleOff: { justifyContent: 'flex-start', paddingLeft: 2 },
  toggleDot: { width: 7, height: 7, borderRadius: 4 },
  toggleKnob: { width: 18, height: 18 },
  labeled: { paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1 },
  label: { fontFamily: fonts.sans500, fontSize: 13 },
  // Подпись — колонка 100: «Прозрачность» помещается целиком
  labelCol: { width: 100, alignSelf: 'stretch', justifyContent: 'center', overflow: 'visible' },
  labelText: { width: 120 },
  segments: { flexDirection: 'row' },
  // Как grid с margin-left −1.5 в макете: первая ячейка — дорожка, остальные шире на 1.5
  segment: { flexGrow: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  segmentText: { fontSize: 8.5, letterSpacing: 0.51 },
  groupRow: { height: 40, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupName: { flex: 1 },
  check: { width: 18, height: 18, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, lineHeight: 14 },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1 },
  saveRow: { position: 'absolute', left: 16, right: 16, height: 44, flexDirection: 'row', gap: 8 },
  saveBtn: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1.05 },
});
