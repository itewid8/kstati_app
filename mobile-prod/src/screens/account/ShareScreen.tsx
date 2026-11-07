/**
 * Мои дела в группе (C-ShareMine) и тот же выбор сразу после вступления (C-ShareJoin):
 * режим «Все, кроме скрытых / Только выбранные», в шапке списка — сколько моих дел видно группе,
 * список моих дел с отметкой «видно группе» (у «Только я» — замок, менять в самом деле).
 * Переход на «Все» — подтверждение снизу (C-ShareAsk): сколько станет видно.
 * Презентационный экран: данные — пропсами, действия — колбэками.
 */
import { memo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { BottomSheet, Icon, Marquee, ScreenTitle, SectionBox, TopBar, fonts, pad2, size as S, space, type as T, useTheme } from '@/ui';
import { Segmented, type SegmentItem } from '../editors/components/Segmented';
import { ET } from '../editors/components/text';
import { AccountHeader } from './components/AccountHeader';

export type ShareTask = {
  /** id дела */
  key: string;
  title: string;
  /** «СР 28 ОКТ · 18:00» */
  meta: string;
  /** Цвета людей дела — полоса слева */
  colors: readonly PersonColor[];
  /** Видно группе */
  visible: boolean;
  /** «Только я» — замок вместо отметки */
  onlyMe: boolean;
};

export type ShareAsk = {
  group: string;
  /** Сейчас видно / станет видно / всего моих дел */
  now: number;
  next: number;
  total: number;
};

export type ShareScreenProps = {
  /** group — из настроек группы (назад, ⋯, заголовок с полосой); join — сразу после вступления (ГОТОВО внизу) */
  variant: 'group' | 'join';
  /** «ГРУППА · МЫ С КАРИНОЙ», «ВЫ В ГРУППЕ · ДРУЗЬЯ» */
  caption: string;
  title: string;
  selectOnly: boolean;
  visible: number;
  total: number;
  tasks: readonly ShareTask[];
  /** «ВСЕ ДЕЛА»: отмечены все, ни одного или часть (чёрточка) — без дел «Только я» */
  all: 'all' | 'none' | 'some';
  ask?: ShareAsk | null;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onMore?: () => void;
  onMode?: (selectOnly: boolean) => void;
  onToggle?: (key: string) => void;
  /** «ВСЕ ДЕЛА»: все отмечены — снять все, иначе отметить все */
  onToggleAll?: () => void;
  onDone?: () => void;
  onAskCancel?: () => void;
  onAskConfirm?: () => void;
};

type Mode = 'all' | 'selected';
const MODES: ReadonlyArray<SegmentItem<Mode>> = [
  { key: 'all', label: 'ВСЕ, КРОМЕ СКРЫТЫХ' },
  { key: 'selected', label: 'ТОЛЬКО ВЫБРАННЫЕ' },
];

const NO_INSETS = { top: 0, bottom: 0 };
/** Только для web (стенд сверки): без translateZ(0) у ScrollView Chromium сглаживает текст субпиксельно, как в макете */
const WEB_SCROLL = Platform.OS === 'web' ? { transform: [] } : {};
/** Нижняя плашка (C-ShareJoin): 76 над линией, кнопка 44 в 16 от низа */
const BAR = 76;

const Row = memo(function Row({ t, first, onToggle }: { t: ShareTask; first: boolean; onToggle?: (key: string) => void }) {
  const { c, person } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: t.visible, disabled: t.onlyMe }}
      accessibilityLabel={t.onlyMe ? `${t.title}, только я` : t.title}
      disabled={t.onlyMe || !onToggle}
      onPress={onToggle ? () => onToggle(t.key) : undefined}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }, first && styles.firstRow]}
    >
      <View style={styles.strip}>
        {t.colors.map((col, i) => (
          <View key={i} style={[styles.stripPart, { backgroundColor: person(col) }]} />
        ))}
      </View>
      <View style={styles.text}>
        <Marquee style={[ET.subtaskTitle, { color: t.onlyMe ? c.muted : c.text }]}>{t.title}</Marquee>
        <Text numberOfLines={1} style={[ET.subtaskMeta, { color: c.muted }]}>
          {t.meta}
        </Text>
      </View>
      {t.onlyMe ? (
        <Icon name="lock" size={11} color={c.muted} />
      ) : (
        <View style={[styles.check, { borderColor: t.visible ? c.text : c.border, backgroundColor: t.visible ? c.text : c.bg }]}>
          {t.visible ? <Icon name="check" size={11} color={c.bg} /> : null}
        </View>
      )}
    </Pressable>
  );
});

/** «ВСЕ ДЕЛА»: отметить или снять все дела разом */
const AllRow = memo(function AllRow({ all, onPress }: { all: ShareScreenProps['all']; onPress?: () => void }) {
  const { c } = useTheme();
  const on = all === 'all';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: all === 'some' ? 'mixed' : on }}
      accessibilityLabel="Все дела"
      onPress={onPress}
      style={[styles.allRow, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <Text style={[styles.allText, { color: c.text }]}>ВСЕ ДЕЛА</Text>
      <View style={[styles.check, { borderColor: on ? c.text : c.border, backgroundColor: on ? c.text : c.bg }]}>
        {on ? <Icon name="check" size={11} color={c.bg} /> : null}
        {all === 'some' ? <View style={[styles.dash, { backgroundColor: c.text }]} /> : null}
      </View>
    </Pressable>
  );
});

const AskSheet = memo(function AskSheet({ ask, bottom, onCancel, onConfirm }: { ask: ShareAsk; bottom: number; onCancel?: () => void; onConfirm?: () => void }) {
  const { c } = useTheme();
  return (
    <BottomSheet visible onClose={onCancel} bottomInset={bottom} style={styles.askSheet}>
      <Text style={[styles.askTitle, { color: c.text }]}>Показать группе «{ask.group}» все мои дела?</Text>
      <View style={[styles.askBox, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Text style={[styles.askLabel, { color: c.muted }]}>ГРУППЕ ВИДНО</Text>
        <Text style={[styles.askNum, { color: c.muted }]}>{pad2(ask.now)}</Text>
        <Icon name="arrow" size={14} color={c.text} />
        <Text style={[styles.askNum, { color: c.text }]}>{`${pad2(ask.next)} / ${pad2(ask.total)}`}</Text>
      </View>
      <View style={styles.askButtons}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.button, styles.cancel, { borderColor: c.border, backgroundColor: c.panel }]}>
          <Text style={[T.action, { color: c.text }]}>ОТМЕНА</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirm} style={[styles.button, styles.confirm, { borderColor: c.border, backgroundColor: c.text }]}>
          <Text style={[T.action, { color: c.bg }]}>ПОКАЗАТЬ ВСЕ</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
});

export const ShareScreen = memo(function ShareScreen(props: ShareScreenProps) {
  const { variant, caption, title, selectOnly, visible, total, tasks, ask, insets = NO_INSETS } = props;
  const { c } = useTheme();
  const join = variant === 'join';
  const top = insets.top + (join ? 116 : 60);
  const barHeight = join ? insets.bottom + BAR + S.hairline : 0;
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {join ? (
        <>
          <TopBar lead={{ kind: 'caption', text: caption }} style={[styles.side, { top: insets.top + S.topBarTop }]} />
          <ScreenTitle title={title} style={[styles.side, { top: insets.top + 62 }]} />
        </>
      ) : (
        <AccountHeader caption={caption} title={title} onBack={props.onBack} style={[styles.side, { top: insets.top + S.topBarTop }]} />
      )}
      <ScrollView
        style={[styles.scroll, { top, bottom: barHeight }]}
        contentContainerStyle={[styles.content, { paddingBottom: join ? 16 : insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Segmented items={MODES} value={selectOnly ? 'selected' : 'all'} onChange={props.onMode ? (k) => props.onMode?.(k === 'selected') : undefined} />
        <SectionBox title="ГРУППЕ ВИДНО" count={`${pad2(visible)} / ${pad2(total)}`}>
          <AllRow all={props.all} onPress={props.onToggleAll} />
          {tasks.map((t, i) => (
            <Row key={t.key} t={t} first={i === 0} onToggle={props.onToggle} />
          ))}
        </SectionBox>
      </ScrollView>
      {join ? (
        <>
          <View style={[styles.bar, { height: barHeight, backgroundColor: c.bg, borderTopColor: c.hair }]} />
          <Pressable
            accessibilityRole="button"
            onPress={props.onDone}
            style={[styles.side, styles.button, styles.done, { bottom: insets.bottom + 16, borderColor: c.border, backgroundColor: c.text }]}
          >
            <Text style={[T.action, { color: c.bg }]}>ГОТОВО</Text>
          </Pressable>
        </>
      ) : null}
      {ask ? <AskSheet ask={ask} bottom={insets.bottom} onCancel={props.onAskCancel} onConfirm={props.onAskConfirm} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  side: { position: 'absolute', left: space.side, right: space.side },
  scroll: { position: 'absolute', left: 0, right: 0, ...WEB_SCROLL },
  content: { paddingHorizontal: space.side, gap: 8 },
  /** Кнопка 44 вместе с разделителем (border-box) */
  row: { height: S.row, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 10, borderTopWidth: S.hairline },
  firstRow: {},
  /** «ВСЕ ДЕЛА» — 36 вместе с разделителем */
  allRow: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 10, borderTopWidth: S.hairline },
  allText: { flex: 1, fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  dash: { width: 8, height: S.border },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  stripPart: { flex: 1 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
  button: { height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  done: {},
  askSheet: { gap: 12 },
  askTitle: { fontFamily: fonts.sans600, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  /** В макете 40 — высота содержимого (content-box); рамку 1.5 Chromium рисует в 1px — эталон 42 */
  askBox: { height: 42, borderWidth: S.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  askLabel: { flex: 1, fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
  askNum: { fontFamily: fonts.mono600, fontSize: 13 },
  askButtons: { flexDirection: 'row', gap: 8 },
  cancel: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
  confirm: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
});
