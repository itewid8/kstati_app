/**
 * Заметка (C-Note) — как «Заметки» на iPhone: назад + подпись темы, «скопировать», «⋯» (там и перенос в тему);
 * ниже — одно поле на весь текст (components/NoteEditor): первая строка — название (стиль «Название»),
 * дальше текст, чек-листы, списки. Курсор, выделение и лупа — системные.
 * Своя — правится сразу; пока пишут, над клавиатурой — панель (Aa, чек-лист, списки, ГОТОВО).
 * Чужая — только читать. Презентационный экран: текст — пропсами, правки — колбэками.
 */
import { memo, useCallback, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { TopBar, size as S, space, useTheme, type TopBarAction } from '@/ui';
import { NO_FORMAT, NOTE_PANEL, NOTE_TOOL, NoteEditor, NoteToolbar, type NoteEditorHandle, type NoteFormat, type NoteTool } from './components/NoteEditor';
import { useKeyboardOverlap } from './components/NoteLines';

export type NoteScreenProps = {
  /** «ЗАМЕТКА · ПОЕЗДКИ» */
  caption: string;
  /** Текст заметки при открытии: первая строка «# …» — название */
  initial: string;
  /** Своя заметка: правится, есть панель */
  editable: boolean;
  /** Новая заметка — курсор сразу в названии */
  autoFocus?: boolean;
  editor?: Ref<NoteEditorHandle>;
  insets?: { top: number; bottom: number };
  onChange?: (text: string) => void;
  onBack?: () => void;
  onMore?: () => void;
  /** Скопировать текст заметки */
  onCopy?: () => void;
  onDone?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
/** Текст — под верхней панелью */
const TOP = S.topBarTop + S.topBarHeight + 8;
/** Панель: отступы сверху и снизу 12, над клавиатурой — 8 */
const BAR_PAD = 12;
const KB_GAP = 8;

export const NoteScreen = memo(function NoteScreen(props: NoteScreenProps) {
  const { caption, initial, editable, autoFocus, editor, insets = NO_INSETS, onChange, onBack, onMore, onCopy, onDone } = props;
  const { c } = useTheme();
  const root = useRef<View>(null);
  const overlap = useKeyboardOverlap(root);
  const local = useRef<NoteEditorHandle>(null);
  const [focused, setFocused] = useState(!!autoFocus);
  const [format, setFormat] = useState<NoteFormat>(NO_FORMAT);
  const [stylesOpen, setStylesOpen] = useState(false);

  // Ссылка на поле нужна и экрану (панель), и контейнеру (вернуть сохранённое)
  const setEditor = useCallback(
    (h: NoteEditorHandle | null) => {
      local.current = h;
      if (typeof editor === 'function') editor(h);
      else if (editor) (editor as { current: NoteEditorHandle | null }).current = h;
    },
    [editor],
  );
  // Нажатие на панель в браузере уводит фокус из поля: панель прячется не сразу, курсор возвращается в поле
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFocus = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    setFocused(true);
  }, []);
  const onBlur = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => {
      setFocused(false);
      setStylesOpen(false);
    }, 250);
  }, []);
  const onTool = useCallback((tool: NoteTool) => {
    local.current?.apply(tool);
    local.current?.focus();
  }, []);
  const toggleStyles = useCallback(() => {
    setStylesOpen((v) => !v);
    local.current?.focus();
  }, []);
  const done = useCallback(() => {
    setStylesOpen(false);
    local.current?.blur();
    onDone?.();
  }, [onDone]);

  const actions: TopBarAction[] = [];
  if (onCopy) actions.push({ key: 'copy', icon: 'copy', accessibilityLabel: 'Скопировать в буфер обмена', onPress: onCopy });
  if (onMore) actions.push({ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore });

  // Панель — только пока пишут (как на iPhone): над клавиатурой или над нижним краем
  const tools = editable && focused;
  const barBottom = overlap > 0 ? overlap + KB_GAP : insets.bottom + BAR_PAD;
  const barHeight = NOTE_TOOL + (stylesOpen ? NOTE_PANEL : 0);
  const bottom = tools ? barBottom + barHeight + BAR_PAD : overlap > 0 ? overlap : 0;

  return (
    <View ref={root} style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar lead={{ kind: 'back', label: caption, onBack }} actions={actions} style={[styles.side, { top: insets.top + S.topBarTop }]} />
      <View style={[styles.body, { top: insets.top + TOP, bottom }]}>
        <NoteEditor
          ref={setEditor}
          initial={initial}
          editable={editable}
          autoFocus={autoFocus}
          placeholder="Название"
          onChange={onChange}
          onFormat={setFormat}
          onFocus={onFocus}
          onBlur={onBlur}
          bottomInset={tools ? 8 : insets.bottom + 24}
        />
      </View>
      {tools ? (
        <>
          <View style={[styles.bar, { height: barBottom + barHeight + BAR_PAD + S.hairline, backgroundColor: c.bg, borderTopColor: c.hair }]} />
          <View style={[styles.side, { bottom: barBottom }]}>
            <NoteToolbar format={format} stylesOpen={stylesOpen} onToggleStyles={toggleStyles} onTool={onTool} onDone={done} />
          </View>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  side: { position: 'absolute', left: space.side, right: space.side },
  body: { position: 'absolute', left: space.side, right: space.side },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
});
