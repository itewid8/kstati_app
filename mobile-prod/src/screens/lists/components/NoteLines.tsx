/**
 * Строки заметки и панель — общие для заметки (C-Note) и темы (C-Topic: тема — тоже заметка).
 *  NoteLines — строки по видам (lib/note.ts); своя — правится прямо в строках, курсор ставится по caret.
 *    Ниже строк — пустое место (fill): нажатие туда ставит курсор в конец последней строки, — писать можно,
 *    куда ни ткни. На web (стенд сверки) строки — текстом: поле ввода там не растёт по строкам.
 *  NoteTools — панель: чек-лист, номера, список, заголовок, жирный — значок с подписью (вид строки с курсором залит) и ГОТОВО.
 *  useKeyboardOverlap — сколько снизу закрывает клавиатура.
 */
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { numberOf, type NoteBlock } from '@/lib/note';
import type { NoteCaret, NoteTool } from '@/lib/noteEdit';
import { Checkbox, Icon, fonts, size as S, type as T, useInputColors, useTheme, type IconName } from '@/ui';
import { keyboardOverlap } from '../../editors/components/revealMath';

const WEB = Platform.OS === 'web';
export const NOTE_TOOL = 48;

export type NoteHandlers = {
  onChangeText?: (index: number, text: string) => void;
  /** Backspace в начале строки (курсор на 0): склеить с предыдущей, пункт списка — в обычную строку */
  onBackspace?: (index: number) => void;
  onToggleCheck?: (index: number) => void;
  onFocus?: (index: number) => void;
};

/** Сколько снизу закрывает клавиатура (0 — её нет или окно уже сжато под неё) */
export function useKeyboardOverlap(root: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const top = e.endCoordinates.screenY;
      root.current?.measureInWindow((_x, y, _w, h) => setOverlap(keyboardOverlap(y + h, top)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [root]);
  return overlap;
}

type LineProps = {
  b: NoteBlock;
  index: number;
  number: number;
  editable: boolean;
  setRef: (index: number, input: TextInput | null) => void;
  /** Строка, где стоит курсор: место курсора (для Enter) */
  setCaretAt: (index: number, at: number) => void;
  /** Enter — разделить строку по курсору */
  onEnter: (index: number) => void;
} & NoteHandlers;

const Line = memo(function Line(props: LineProps) {
  const { b, index, number, editable, setRef, setCaretAt, onEnter, onChangeText, onBackspace, onToggleCheck, onFocus } = props;
  const { c } = useTheme();
  const ic = useInputColors();
  const input = useRef<TextInput | null>(null);
  // Где курсор: пока поле не сообщило — в конце текста (Backspace не склеивает строки по ошибке)
  const sel = useRef<{ start: number; end: number } | null>(null);
  const heading = b.kind === 'heading';
  const done = b.kind === 'check' && !!b.checked;
  const style = [heading ? styles.heading : b.bold ? styles.bold : styles.text, { color: done ? c.muted : c.text }, done && styles.done];
  // Enter не вставляет перевод строки (на iOS это давало двойной перенос и зависание): строка делится по курсору,
  // на клавиатуре — клавиша «Далее». Вставка нескольких строк по-прежнему разбирается в onChangeText
  const field =
    editable && !WEB ? (
      <TextInput
        ref={(r) => {
          input.current = r;
          setRef(index, r);
        }}
        value={b.text}
        multiline
        scrollEnabled={false}
        submitBehavior="submit"
        returnKeyType="next"
        onSubmitEditing={() => onEnter(index)}
        onChangeText={(t) => onChangeText?.(index, t)}
        onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
          sel.current = e.nativeEvent.selection;
          setCaretAt(index, e.nativeEvent.selection.end);
        }}
        onKeyPress={(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
          if (e.nativeEvent.key !== 'Backspace') return;
          const atStart = !b.text || (sel.current !== null && sel.current.start === 0 && sel.current.end === 0);
          if (atStart) onBackspace?.(index);
        }}
        onFocus={() => onFocus?.(index)}
        selectionColor={ic.selectionColor}
        cursorColor={ic.cursorColor}
        style={[style, styles.input, !heading && styles.flex]}
      />
    ) : (
      <Text style={[style, !heading && styles.flex]}>{b.text}</Text>
    );
  // Тап по строке мимо текста (отступы, место у значка) — курсор в конец строки
  const focusEnd = editable && !WEB ? () => input.current?.focus() : undefined;
  if (heading)
    return (
      <Pressable accessible={false} onPress={focusEnd} style={styles.line}>
        {field}
      </Pressable>
    );
  return (
    <Pressable accessible={false} onPress={focusEnd} style={[styles.line, styles.row]}>
      {b.kind === 'check' ? (
        <Checkbox
          checked={done}
          onPress={editable ? () => onToggleCheck?.(index) : undefined}
          accessibilityLabel={b.text || 'Пункт'}
          emptyFill="none"
          tapWidth={22}
          tapHeight={22}
        />
      ) : null}
      {b.kind === 'number' ? <Text style={[styles.number, { color: c.text }]}>{`${number}.`}</Text> : null}
      {b.kind === 'bullet' ? (
        <View style={styles.mark}>
          <View style={[styles.bullet, { backgroundColor: c.text }]} />
        </View>
      ) : null}
      {field}
    </Pressable>
  );
});

type LinesProps = NoteHandlers & {
  blocks: readonly NoteBlock[];
  editable: boolean;
  /** Поставить курсор (меняется nonce — ставим снова) */
  caret?: (NoteCaret & { nonce: number }) | null;
  /** Пустое место под строками: высота (минимум) и растягивается ли до низа */
  fill: { minHeight: number; grow?: boolean };
};

export const NoteLines = memo(function NoteLines(props: LinesProps) {
  const { blocks, editable, caret, fill } = props;
  const inputs = useRef<(TextInput | null)[]>([]);
  const setRef = useRef((index: number, input: TextInput | null) => {
    inputs.current[index] = input;
  }).current;
  // Где стоит курсор в каждой строке: Enter делит строку по нему
  const carets = useRef<number[]>([]);
  const setCaretAt = useRef((index: number, at: number) => {
    carets.current[index] = at;
  }).current;
  const latest = useRef(props);
  latest.current = props;
  const onEnter = useRef((index: number) => {
    const { blocks: bs, onChangeText } = latest.current;
    const text = bs[index]?.text ?? '';
    const at = Math.min(carets.current[index] ?? text.length, text.length);
    onChangeText?.(index, `${text.slice(0, at)}\n${text.slice(at)}`);
  }).current;

  const focusAt = (index: number, at: number | 'end') => {
    const input = inputs.current[index];
    if (!input) return;
    input.focus();
    const pos = at === 'end' ? (blocks[index]?.text.length ?? 0) : at;
    // setSelection есть у поля на iOS и Android, но не во всех типах React Native
    const select = (input as unknown as { setSelection?: (start: number, end: number) => void }).setSelection;
    requestAnimationFrame(() => select?.call(input, pos, pos));
  };

  // Курсор туда, куда сказали (новая строка после Enter, конец предыдущей после Backspace)
  useEffect(() => {
    if (caret) focusAt(caret.index, caret.at);
    // Курсор ставим только по новому nonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caret?.nonce]);

  return (
    <>
      {blocks.map((b, i) => (
        <Line
          key={b.key ?? i}
          b={b}
          index={i}
          number={b.kind === 'number' ? numberOf(blocks, i) : 0}
          editable={editable}
          setRef={setRef}
          setCaretAt={setCaretAt}
          onEnter={onEnter}
          onChangeText={props.onChangeText}
          onBackspace={props.onBackspace}
          onToggleCheck={props.onToggleCheck}
          onFocus={props.onFocus}
        />
      ))}
      <Pressable
        accessible={false}
        disabled={!editable}
        onPress={() => focusAt(blocks.length - 1, 'end')}
        style={[{ minHeight: fill.minHeight }, fill.grow && styles.grow]}
      />
    </>
  );
});

const TOOLS: ReadonlyArray<{ key: NoteTool; label: string; short: string; icon?: IconName; glyph?: string }> = [
  { key: 'check', label: 'Чек-лист', short: 'ЧЕК-ЛИСТ', icon: 'checklist' },
  { key: 'number', label: 'Нумерованный список', short: 'НОМЕРА', glyph: '1.' },
  { key: 'bullet', label: 'Список', short: 'СПИСОК', icon: 'bullets' },
  { key: 'heading', label: 'Заголовок', short: 'ЗАГОЛОВОК', glyph: 'H' },
  { key: 'bold', label: 'Жирный', short: 'ЖИРНЫЙ', glyph: 'B' },
];

/** Панель: вид строки с курсором — значок и подпись (выбранный залит), ГОТОВО */
export const NoteTools = memo(function NoteTools({ current, onTool, onDone }: { current?: NoteBlock; onTool?: (tool: NoteTool) => void; onDone?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.tools}>
      {TOOLS.map((t) => {
        const on = !!current && (t.key === 'bold' ? !!current.bold : current.kind === t.key);
        const ink = on ? c.bg : c.text;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on, disabled: !current }}
            onPress={current ? () => onTool?.(t.key) : undefined}
            style={[styles.tool, { borderColor: c.border, backgroundColor: on ? c.text : c.panel, opacity: current ? 1 : 0.5 }]}
          >
            <View style={styles.toolMark}>
              {t.icon ? <Icon name={t.icon} size={16} color={ink} /> : null}
              {t.glyph === '1.' ? <Text style={[styles.toolNum, { color: ink }]}>1.</Text> : null}
              {t.glyph === 'H' || t.glyph === 'B' ? <Text style={[t.glyph === 'H' ? styles.toolH : styles.toolB, { color: ink }]}>{t.glyph}</Text> : null}
            </View>
            <Text numberOfLines={1} style={[styles.toolLabel, { color: on ? c.bg : c.muted }]}>
              {t.short}
            </Text>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onDone} style={[styles.doneButton, { borderColor: c.border, backgroundColor: c.text }]}>
        <Text style={[T.action, { color: c.bg }]}>ГОТОВО</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1 },
  line: { paddingVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  heading: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 30, letterSpacing: -0.96 },
  text: { fontFamily: fonts.sans400, fontSize: 15, lineHeight: 22 },
  bold: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 22 },
  done: { textDecorationLine: 'line-through' },
  input: { padding: 0, margin: 0, includeFontPadding: false, textAlignVertical: 'top' },
  number: { width: 22, textAlign: 'right', fontFamily: fonts.mono600, fontSize: 13, lineHeight: 22 },
  mark: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  bullet: { width: 5, height: 5 },
  tools: { height: NOTE_TOOL, flexDirection: 'row', gap: 6 },
  tool: { flex: 1, height: NOTE_TOOL, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 1 },
  toolMark: { height: 18, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontFamily: fonts.mono600, fontSize: 6.5, letterSpacing: 0.2 },
  toolNum: { fontFamily: fonts.mono600, fontSize: 13, letterSpacing: -0.26 },
  toolH: { fontFamily: fonts.sans700, fontSize: 15, lineHeight: 18 },
  toolB: { fontFamily: fonts.sans700, fontSize: 15, lineHeight: 18 },
  doneButton: { flex: 1.3, height: NOTE_TOOL, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
