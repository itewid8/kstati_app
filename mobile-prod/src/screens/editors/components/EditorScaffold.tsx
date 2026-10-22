/**
 * Каркас окна редактирования дела/плана (C-Edit*):
 *  - сверху «‹  ДЕЛО · МЫ С КАРИНОЙ  ⋯» (top 20);
 *  - заголовок 24/28 с полосой цветов участников слева и линией снизу (top 70);
 *  - поля с top 120, прокручиваются (ScrollView из gesture-handler — колесо времени забирает вертикаль у прокрутки);
 *  - снизу плашка 76px над линией и кнопки «УДАЛИТЬ» / «СОХРАНИТЬ» (44px, bottom 16).
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Marquee, TopBar, size as S, space, type as T, useTheme, type TopBarAction } from '@/ui';
import { ET } from './text';

/** Верх полей под заголовком */
const CONTENT_TOP = 120;
/** Нижняя плашка с кнопками (без линии) */
const BAR = 76;
const BUTTON = 44;
const BUTTON_BOTTOM = 16;
/**
 * Только для react-native-web: transform: [] снимает translateZ(0) у ScrollView, из-за которого Chromium рисует
 * часть текста без субпиксельного сглаживания (стенд сверки видит это как +1.7%). На телефоне стиль не нужен
 */
const WEB_SCROLL = Platform.OS === 'web' ? { transform: [] } : {};

export type EditorInsets = { top: number; bottom: number };
const NO_INSETS: EditorInsets = { top: 0, bottom: 0 };

type Props = {
  /** «ДЕЛО · МЫ С КАРИНОЙ» */
  caption: string;
  title: string;
  /** Цвета участников под тему — полоса у заголовка делится поровну сверху вниз */
  colors: readonly string[];
  insets?: EditorInsets;
  onBack?: () => void;
  onMore?: () => void;
  /** Тап по заголовку — переименовать; без колбэка заголовок не нажимается */
  onEditTitle?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  children: ReactNode;
};

export const EditorScaffold = memo(function EditorScaffold(props: Props) {
  const { caption, title, colors, insets = NO_INSETS, onBack, onMore, onEditTitle, onDelete, onSave, children } = props;
  const { c } = useTheme();
  const actions = useMemo<TopBarAction[]>(() => [{ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore }], [onMore]);
  const barHeight = insets.bottom + BAR + S.hairline;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar
        lead={{ kind: 'back', label: caption, onBack }}
        actions={actions}
        iconSize={S.iconSmall}
        style={[styles.side, { top: insets.top + S.topBarTop }]}
      />
      <View style={[styles.side, styles.titleBox, { top: insets.top + S.titleTop, borderBottomColor: c.border }]}>
        <View style={styles.strip}>
          {colors.map((color, i) => (
            <View key={i} style={[styles.stripPart, { backgroundColor: color }]} />
          ))}
        </View>
        {onEditTitle ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Название: ${title}`} onPress={onEditTitle}>
            <Text style={[ET.editorTitle, { color: c.text }]}>{title}</Text>
          </Pressable>
        ) : (
          <Text accessibilityRole="header" style={[ET.editorTitle, { color: c.text }]}>
            {title}
          </Text>
        )}
      </View>

      <ScrollView
        style={[styles.scroll, { top: insets.top + CONTENT_TOP, bottom: barHeight }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={[styles.bar, { height: barHeight, backgroundColor: c.bg, borderTopColor: c.hair }]} />
      <View style={[styles.side, styles.actions, { bottom: insets.bottom + BUTTON_BOTTOM }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={[styles.button, styles.delete, { borderColor: c.red }]}
        >
          <Text style={[T.action, { color: c.red }]}>УДАЛИТЬ</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={[styles.button, styles.save, { borderColor: c.border, backgroundColor: c.text }]}
        >
          <Text style={[T.action, { color: c.bg }]}>СОХРАНИТЬ</Text>
        </Pressable>
      </View>
    </View>
  );
});

export type NoticeTone = 'red' | 'warn';

export type EditorNotice = {
  /** «КАРИНА ЗАНЯТА», «ВНЕ ПЕРИОДА» */
  label: string;
  /** «Йога · 19:00–20:00» */
  text: string;
  tone: NoticeTone;
};

/** Плашка-предупреждение под полями: рамка и полоса цветом тона */
export const Notice = memo(function Notice({ label, text, tone }: EditorNotice) {
  const { c } = useTheme();
  const color = tone === 'red' ? c.red : c.warn;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: color, backgroundColor: c.panel }]}>
      <View style={[styles.noticeStrip, { backgroundColor: color }]} />
      <Text style={[ET.warnLabel, { color }]}>{label}</Text>
      <Marquee style={[ET.warnText, styles.shrink, { color: c.text }]}>
        {text}
      </Marquee>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  side: { position: 'absolute', left: space.side, right: space.side },
  titleBox: { paddingLeft: 12, paddingBottom: 8, borderBottomWidth: S.border },
  strip: { position: 'absolute', left: 0, top: 2, bottom: 10, width: S.strip },
  stripPart: { flex: 1 },
  scroll: { position: 'absolute', left: 0, right: 0, ...WEB_SCROLL },
  content: { paddingHorizontal: space.side, paddingBottom: 16, gap: 8 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
  actions: { height: BUTTON, flexDirection: 'row', gap: 8 },
  button: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  /**
   * flex 1 : 1.6 от основы 15px: в макете это <button> с UA-полями 6+6 и рамкой 3 — свободное место
   * делится уже после них (138 / 212 при ширине 358).
   */
  delete: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
  save: { flexGrow: 1.6, flexShrink: 1, flexBasis: 15 },
  /** min-height 34 + рамки (content-box в макете; Chromium рисует рамку 1.5 как 1px — эталон 36) */
  notice: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 11,
    paddingRight: 8,
    borderWidth: S.border,
  },
  noticeStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  shrink: { flexShrink: 1 },
});
