/**
 * Каркас окна редактирования дела/плана (C-Edit*):
 *  - сверху «‹  ДЕЛО · МЫ С КАРИНОЙ  ⋯» (top 8);
 *  - заголовок 24/28 с полосой цветов участников слева и линией снизу (top 58). С onChangeTitle это поле ввода того же
 *    вида: тап ставит курсор, пустое — «—» бледным; длинное название в несколько строк сдвигает поля вниз;
 *  - поля с top 108, прокручиваются (ScrollView из gesture-handler — колесо времени забирает вертикаль у прокрутки);
 *    поле в фокусе не прячется под клавиатурой (useEditorKeyboard);
 *  - снизу плашка 76px над линией и кнопки «УДАЛИТЬ» / «СОХРАНИТЬ» (44px, bottom 16); saveDisabled — «СОХРАНИТЬ» бледная.
 * Тап мимо полей, по строке или кнопке закрывает клавиатуру.
 */
import { memo, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ScrollView as RNScrollView,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Marquee, TopBar, size as S, space, type as T, useInputColors, useTheme, type TopBarAction } from '@/ui';
import { KeyboardTargetContext, useEditorKeyboard } from './keyboard';
import { TITLE_MAX } from './limits';
import { titleShift } from './revealMath';
import { ET } from './text';
import { useWebAutoHeight } from './webAutoHeight';

/** Верх полей под заголовком */
const CONTENT_TOP = 108;
/** Заголовок в одну строку: 28 + отступ 8 + линия */
const TITLE_ONE_LINE = 28 + 8 + S.border;
/** Длинное название — до трёх строк, дальше прокрутка внутри поля */
const TITLE_MAX_HEIGHT = 28 * 3;
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
  /** «СОХРАНИТЬ» недоступна (нет названия) */
  saveDisabled?: boolean;
  /** Поле названия — фокус снаружи (окно просит назвать дело перед «Сделать планом») */
  titleRef?: RefObject<TextInput | null>;
  onBack?: () => void;
  onMore?: () => void;
  /** Название правится прямо в заголовке; без колбэка заголовок только текст */
  onChangeTitle?: (title: string) => void;
  onDelete?: () => void;
  onSave?: () => void;
  children: ReactNode;
};

/** Сначала закрыть клавиатуру, потом действие */
const dismissThen = (fn: (() => void) | undefined) =>
  fn &&
  (() => {
    Keyboard.dismiss();
    fn();
  });

const yes = () => true;

export const EditorScaffold = memo(function EditorScaffold(props: Props) {
  const { caption, title, colors, insets = NO_INSETS, saveDisabled = false, titleRef, onChangeTitle, children } = props;
  const { c } = useTheme();
  const ic = useInputColors();
  const onBack = useMemo(() => dismissThen(props.onBack), [props.onBack]);
  const onMore = useMemo(() => dismissThen(props.onMore), [props.onMore]);
  const onDelete = useMemo(() => dismissThen(props.onDelete), [props.onDelete]);
  const onSave = useMemo(() => dismissThen(props.onSave), [props.onSave]);
  const actions = useMemo<TopBarAction[]>(() => [{ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore }], [onMore]);
  const barHeight = insets.bottom + BAR + S.hairline;

  const [titleHeight, setTitleHeight] = useState(TITLE_ONE_LINE);
  const onTitleLayout = useCallback((e: LayoutChangeEvent) => setTitleHeight(e.nativeEvent.layout.height), []);
  const contentTop = insets.top + CONTENT_TOP + titleShift(titleHeight, TITLE_ONE_LINE);

  const titleAuto = useWebAutoHeight(ET.editorTitle.lineHeight);
  const root = useRef<View>(null);
  const scroll = useRef<RNScrollView>(null);
  const refs = useMemo(() => ({ root, scroll }), []);
  const keyboard = useEditorKeyboard(refs, { top: contentTop, bottom: barHeight });

  return (
    <View
      ref={root}
      style={[styles.screen, { backgroundColor: c.bg }]}
      onStartShouldSetResponder={yes}
      onResponderRelease={Keyboard.dismiss}
    >
      <TopBar
        lead={{ kind: 'back', label: caption, onBack }}
        actions={actions}
        iconSize={S.iconSmall}
        style={[styles.side, { top: insets.top + S.topBarTop }]}
      />
      <View
        onLayout={onTitleLayout}
        style={[styles.side, styles.titleBox, { top: insets.top + S.titleTop, borderBottomColor: c.border }]}
      >
        <View style={styles.strip}>
          {colors.map((color, i) => (
            <View key={i} style={[styles.stripPart, { backgroundColor: color }]} />
          ))}
        </View>
        {onChangeTitle ? (
          <TextInput
            ref={titleRef}
            value={title}
            onChangeText={onChangeTitle}
            multiline
            {...titleAuto.webProps}
            onContentSizeChange={titleAuto.onContentSizeChange}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            maxLength={TITLE_MAX}
            placeholder="—"
            placeholderTextColor={c.muted}
            textAlignVertical="top"
            underlineColorAndroid="transparent"
            selectionColor={ic.selectionColor}
            cursorColor={ic.cursorColor}
            accessibilityLabel="Название"
            style={[ET.editorTitle, styles.titleInput, titleAuto.style, { color: c.text }]}
          />
        ) : (
          <Text accessibilityRole="header" style={[ET.editorTitle, { color: c.text }]}>
            {title}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scroll}
        style={[styles.scroll, { top: contentTop, bottom: barHeight }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={keyboard.onScroll}
        onContentSizeChange={keyboard.onContentSizeChange}
      >
        <KeyboardTargetContext.Provider value={keyboard.setTarget}>{children}</KeyboardTargetContext.Provider>
        {keyboard.space > 0 ? <View style={{ height: keyboard.space }} /> : null}
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
          accessibilityState={{ disabled: saveDisabled }}
          disabled={saveDisabled}
          onPress={onSave}
          style={[styles.button, styles.save, { borderColor: c.border, backgroundColor: c.text, opacity: saveDisabled ? 0.4 : 1 }]}
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
  /** Поле названия без своих отступов — текст там же, где у заголовка-текста */
  titleInput: { padding: 0, margin: 0, maxHeight: TITLE_MAX_HEIGHT },
  scroll: { position: 'absolute', left: 0, right: 0, ...WEB_SCROLL },
  content: { paddingHorizontal: space.side, paddingBottom: 16, gap: 8 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
  actions: { height: BUTTON, flexDirection: 'row', gap: 8 },
  button: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  /**
   * flex 1 : 1 от основы 15px: в макете это <button> с UA-полями 6+6 и рамкой 3 — свободное место
   * делится уже после них (138 / 212 при ширине 358).
   */
  delete: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
  save: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
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
