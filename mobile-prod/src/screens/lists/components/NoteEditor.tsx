/**
 * Редактор заметки — как «Заметки» на iPhone: одно нативное поле (react-native-enriched-html) на весь текст,
 * поэтому курсор, лупа, выделение через строки, перетаскивание курсора по пробелу и вставка — системные.
 *  NoteEditor  — поле: стили текста по стандартным размерам iOS (название 28, заголовок 22, подзаголовок 17 полужирный,
 *                текст 17 с интервалом 22, моноширинный 15), чек-лист, списки, цитата, ссылки; в HTML ⇄ текст заметки (lib/noteHtml).
 *  NoteToolbar — панель над клавиатурой: Aa (стили), чек-лист, список, нумерованный список, ГОТОВО;
 *                по Aa над ней — стили абзаца и начертания (Ж, К, Ч, З), цитата.
 * Шрифт — системный (SF на iPhone), как в «Заметках».
 */
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type HtmlStyle,
  type OnChangeStateEvent,
  type TextShortcut,
} from 'react-native-enriched-html';
import { htmlToNote, listExit, noteToHtml } from '@/lib/noteHtml';
import { Icon, fonts, size as S, type as T, useInputColors, useTheme } from '@/ui';

const WEB = Platform.OS === 'web';
/** Системный шрифт: на iPhone — SF, как в «Заметках» */
const SYSTEM_FONT = WEB ? 'system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif' : undefined;

/** Размеры стандартных стилей iOS (крупность по умолчанию): Title1, Title2, Headline, Body */
export const NOTE_TYPE = { title: 28, heading: 22, subheading: 17, body: 17, line: 22, mono: 15 } as const;

/** Как в «Заметках»: «- » и «* » — список, «1. » — нумерованный, «[] » — чек-лист, «> » — цитата */
const SHORTCUTS: TextShortcut[] = [
  { trigger: '- ', style: 'unordered_list' },
  { trigger: '* ', style: 'unordered_list' },
  { trigger: '1. ', style: 'ordered_list' },
  { trigger: '[] ', style: 'checkbox_list' },
  { trigger: '> ', style: 'blockquote' },
];

/** Что включено там, где курсор: стиль абзаца и начертания */
export type NoteFormat = {
  block: 'title' | 'heading' | 'subheading' | 'body' | 'mono';
  check: boolean;
  bullet: boolean;
  number: boolean;
  quote: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
};

export const NO_FORMAT: NoteFormat = {
  block: 'body',
  check: false,
  bullet: false,
  number: false,
  quote: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
};

export type NoteTool = 'title' | 'heading' | 'subheading' | 'body' | 'mono' | 'check' | 'bullet' | 'number' | 'quote' | 'bold' | 'italic' | 'underline' | 'strike';

export type NoteEditorHandle = {
  focus: () => void;
  blur: () => void;
  /** Заменить текст (вернуть сохранённое) */
  setText: (text: string) => void;
  apply: (tool: NoteTool) => void;
};

type Props = {
  /** Текст заметки при открытии (дальше поле само хранит текст) */
  initial: string;
  editable: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Новый текст заметки — после каждой правки */
  onChange?: (text: string) => void;
  onFormat?: (format: NoteFormat) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Снизу внутри поля: под панелью и клавиатурой текст не прячется */
  bottomInset?: number;
};

const formatOf = (s: OnChangeStateEvent): NoteFormat => ({
  block: s.h1.isActive ? 'title' : s.h2.isActive ? 'heading' : s.h3.isActive ? 'subheading' : s.codeBlock.isActive ? 'mono' : 'body',
  check: s.checkboxList.isActive,
  bullet: s.unorderedList.isActive,
  number: s.orderedList.isActive,
  quote: s.blockQuote.isActive,
  bold: s.bold.isActive,
  italic: s.italic.isActive,
  underline: s.underline.isActive,
  strike: s.strikeThrough.isActive,
});

export const NoteEditor = memo(
  forwardRef<NoteEditorHandle, Props>(function NoteEditor(props, ref) {
    const { initial, editable, autoFocus, placeholder, onChange, onFormat, onFocus, onBlur, bottomInset = 0 } = props;
    const { c, person } = useTheme();
    const ic = useInputColors();
    const input = useRef<EnrichedTextInputInstance>(null);
    const format = useRef<NoteFormat>(NO_FORMAT);
    const [defaultValue] = useMemoOnce(() => noteToHtml(initial));

    useImperativeHandle(
      ref,
      () => ({
        focus: () => input.current?.focus(),
        blur: () => input.current?.blur(),
        setText: (text) => input.current?.setValue(noteToHtml(text)),
        apply: (tool) => {
          const el = input.current;
          if (!el) return;
          const f = format.current;
          switch (tool) {
            case 'title':
              return el.toggleH1();
            case 'heading':
              return el.toggleH2();
            case 'subheading':
              return el.toggleH3();
            case 'mono':
              return el.toggleCodeBlock();
            case 'body':
              // «Текст» — снять стиль абзаца, который сейчас включён
              if (f.block === 'title') el.toggleH1();
              else if (f.block === 'heading') el.toggleH2();
              else if (f.block === 'subheading') el.toggleH3();
              else if (f.block === 'mono') el.toggleCodeBlock();
              return;
            case 'check':
              return el.toggleCheckboxList(false);
            case 'bullet':
              return el.toggleUnorderedList();
            case 'number':
              return el.toggleOrderedList();
            case 'quote':
              return el.toggleBlockQuote();
            case 'bold':
              return el.toggleBold();
            case 'italic':
              return el.toggleItalic();
            case 'underline':
              return el.toggleUnderline();
            case 'strike':
              return el.toggleStrikeThrough();
          }
        },
      }),
      [],
    );

    const htmlStyle = useMemo<HtmlStyle>(
      () => ({
        h1: { fontSize: NOTE_TYPE.title, bold: true },
        h2: { fontSize: NOTE_TYPE.heading, bold: true },
        h3: { fontSize: NOTE_TYPE.subheading, bold: true },
        blockquote: { borderColor: c.hairStrong, borderWidth: 3, gapWidth: 12, color: c.text },
        codeblock: { color: c.text, borderRadius: 0, backgroundColor: c.panel },
        code: { color: c.text, backgroundColor: c.panel },
        a: { color: person('blue'), textDecorationLine: 'underline' },
        ol: { gapWidth: 10, marginLeft: 6, markerColor: c.text },
        ul: { bulletColor: c.text, bulletSize: 6, marginLeft: 8, gapWidth: 12 },
        ulCheckbox: { boxSize: 22, gapWidth: 10, marginLeft: 0, boxColor: c.text },
      }),
      [c, person],
    );

    // Текст до последней правки: по нему видно Enter в пустом пункте списка
    const last = useRef(initial);
    const onChangeHtml = useCallback(
      (e: { nativeEvent: { value: string } }) => {
        const next = htmlToNote(e.nativeEvent.value);
        const exit = listExit(last.current, next);
        if (exit && input.current) {
          // Enter в пустом пункте — выход из списка (как на iPhone): пункт становится обычной строкой
          last.current = exit.text;
          onChange?.(exit.text);
          input.current.setValue(noteToHtml(exit.text));
          input.current.setSelection(exit.at, exit.at);
          return;
        }
        last.current = next;
        onChange?.(next);
      },
      [onChange],
    );
    const onChangeState = useCallback(
      (e: { nativeEvent: OnChangeStateEvent }) => {
        format.current = formatOf(e.nativeEvent);
        onFormat?.(format.current);
      },
      [onFormat],
    );

    return (
      <EnrichedTextInput
        ref={input}
        defaultValue={defaultValue}
        editable={editable}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        cursorColor={ic.cursorColor}
        selectionColor={ic.selectionColor}
        autoCapitalize="sentences"
        htmlStyle={htmlStyle}
        textShortcuts={SHORTCUTS}
        mentionIndicators={[]}
        scrollEnabled
        onChangeHtml={onChangeHtml}
        onChangeState={onChangeState}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ ...INPUT, color: c.text, paddingBottom: bottomInset, ...(SYSTEM_FONT ? { fontFamily: SYSTEM_FONT } : null) }}
      />
    );
  }),
);

/** Значение, посчитанное один раз при первом рисовании */
function useMemoOnce<V>(make: () => V): [V] {
  const box = useRef<{ v: V } | null>(null);
  if (!box.current) box.current = { v: make() };
  return [box.current.v];
}

/* ---------- Панель над клавиатурой ---------- */

export const NOTE_TOOL = 44;
/** Панель стилей: две строки по 40 и промежутки по 6 */
export const NOTE_PANEL = 40 + 6 + 40 + 6;

type ToolbarProps = {
  format: NoteFormat;
  /** Открыта панель стилей (Aa) */
  stylesOpen: boolean;
  onToggleStyles: () => void;
  onTool: (tool: NoteTool) => void;
  onDone: () => void;
};

const BLOCKS: ReadonlyArray<{ key: NoteFormat['block']; label: string }> = [
  { key: 'title', label: 'Название' },
  { key: 'heading', label: 'Заголовок' },
  { key: 'subheading', label: 'Подзаголовок' },
  { key: 'body', label: 'Текст' },
  { key: 'mono', label: 'Моно' },
];

const MARKS: ReadonlyArray<{ key: 'bold' | 'italic' | 'underline' | 'strike' | 'quote'; label: string; glyph: string }> = [
  { key: 'bold', label: 'Жирный', glyph: 'Ж' },
  { key: 'italic', label: 'Курсив', glyph: 'К' },
  { key: 'underline', label: 'Подчёркнутый', glyph: 'Ч' },
  { key: 'strike', label: 'Зачёркнутый', glyph: 'З' },
  { key: 'quote', label: 'Цитата', glyph: '❝' },
];

/** Панель: Aa, чек-лист, список, номера и ГОТОВО; по Aa сверху — стили абзаца и начертания */
export const NoteToolbar = memo(function NoteToolbar({ format, stylesOpen: open, onToggleStyles, onTool, onDone }: ToolbarProps) {
  const { c } = useTheme();
  const cell = (on: boolean) => [s.tool, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }];
  const ink = (on: boolean) => (on ? c.bg : c.text);
  return (
    <View style={s.wrap}>
      {open ? (
        <View style={s.panel}>
          <View style={s.row}>
            {BLOCKS.map((b) => {
              const on = format.block === b.key;
              return (
                <Pressable
                  key={b.key}
                  accessibilityRole="button"
                  accessibilityLabel={b.label}
                  accessibilityState={{ selected: on }}
                  onPress={() => onTool(b.key)}
                  style={[cell(on), s.styleCell]}
                >
                  <Text numberOfLines={1} style={[blockText[b.key], { color: ink(on) }]}>
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.row}>
            {MARKS.map((m) => {
              const on = format[m.key];
              return (
                <Pressable
                  key={m.key}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: on }}
                  onPress={() => onTool(m.key)}
                  style={[cell(on), s.styleCell]}
                >
                  <Text style={[markText[m.key], { color: ink(on) }]}>{m.glyph}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Стили текста"
          accessibilityState={{ expanded: open }}
          onPress={onToggleStyles}
          style={[cell(open), s.main]}
        >
          <Text style={[s.aa, { color: ink(open) }]}>Aa</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Чек-лист" accessibilityState={{ selected: format.check }} onPress={() => onTool('check')} style={[cell(format.check), s.main]}>
          <Icon name="checklist" size={18} color={ink(format.check)} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Список" accessibilityState={{ selected: format.bullet }} onPress={() => onTool('bullet')} style={[cell(format.bullet), s.main]}>
          <Icon name="bullets" size={18} color={ink(format.bullet)} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Нумерованный список"
          accessibilityState={{ selected: format.number }}
          onPress={() => onTool('number')}
          style={[cell(format.number), s.main]}
        >
          <Text style={[s.num, { color: ink(format.number) }]}>1.</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDone} style={[s.tool, s.done, { borderColor: c.border, backgroundColor: c.text }]}>
          <Text style={[T.action, { color: c.bg }]}>ГОТОВО</Text>
        </Pressable>
      </View>
    </View>
  );
});

const blockText = StyleSheet.create({
  title: { fontFamily: fonts.sans700, fontSize: 15 },
  heading: { fontFamily: fonts.sans700, fontSize: 13 },
  subheading: { fontFamily: fonts.sans600, fontSize: 12 },
  body: { fontFamily: fonts.sans400, fontSize: 12 },
  mono: { fontFamily: fonts.mono500, fontSize: 11 },
});

const markText = StyleSheet.create({
  bold: { fontFamily: fonts.sans700, fontSize: 16 },
  italic: { fontFamily: fonts.sans400, fontSize: 16, fontStyle: 'italic' },
  underline: { fontFamily: fonts.sans400, fontSize: 16, textDecorationLine: 'underline' },
  strike: { fontFamily: fonts.sans400, fontSize: 16, textDecorationLine: 'line-through' },
  quote: { fontFamily: fonts.sans700, fontSize: 16 },
});

const s = StyleSheet.create({
  wrap: { gap: 6 },
  panel: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  tool: { height: NOTE_TOOL, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  styleCell: { flex: 1, height: 40, paddingHorizontal: 2 },
  main: { flex: 1 },
  done: { flex: 1.6 },
  aa: { fontFamily: fonts.sans600, fontSize: 17, letterSpacing: -0.3 },
  num: { fontFamily: fonts.mono600, fontSize: 15 },
});

/** Поле: стиль — простым объектом (у EnrichedTextInput свой тип стиля, без массивов) */
const INPUT = { flex: 1, fontSize: NOTE_TYPE.body, lineHeight: NOTE_TYPE.line, paddingTop: 4 } as const;
