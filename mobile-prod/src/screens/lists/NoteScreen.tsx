/**
 * Заметка внутри темы (C-Note): назад + подпись темы, «копировать», «⋯» (там и перенос в тему); название (бегущей строкой,
 * нажатие — правка), строки заметки по видам (components/NoteLines).
 * Своя — правится прямо в строках, ткнуть можно в любое место ниже текста; снизу (над клавиатурой) — панель
 * с ГОТОВО. Чужая — только читать. Презентационный экран: строки и курсор — пропсами, правки — колбэками.
 */
import { memo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NoteBlock } from '@/lib/note';
import type { NoteCaret, NoteTool } from '@/lib/noteEdit';
import { TopBar, size as S, space, type as T, useTheme, type TopBarAction } from '@/ui';
import { NOTE_TOOL, NoteLines, NoteTools, useKeyboardOverlap, type NoteHandlers } from './components/NoteLines';
import { TitleField } from './components/TitleField';

export type NoteScreenProps = NoteHandlers & {
  /** «ЗАМЕТКА · ПОЕЗДКИ» */
  caption: string;
  /** Название заметки (первая строка-заголовок); пустое — поле с подсказкой */
  title: string;
  onChangeTitle?: (title: string) => void;
  /** Новая заметка — курсор сразу в названии */
  focusTitle?: boolean;
  blocks: readonly NoteBlock[];
  /** Своя заметка: строки правятся, есть панель */
  editable: boolean;
  /** Строка с курсором — её вид подсвечен на панели */
  active: number | null;
  caret?: (NoteCaret & { nonce: number }) | null;
  insets?: { top: number; bottom: number };
  onBack?: () => void;
  onMore?: () => void;
  /** Скопировать текст заметки */
  onCopy?: () => void;
  onTool?: (tool: NoteTool) => void;
  onDone?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
/** Текст — под названием */
const TOP = 122;
/** Панель: кнопки 44, сверху и снизу по 16; над клавиатурой — 8 */
const BAR_PAD = 16;
const KB_GAP = 8;

export const NoteScreen = memo(function NoteScreen(props: NoteScreenProps) {
  const { caption, blocks, editable, active, caret, insets = NO_INSETS, onBack, onMore, onTool, onDone } = props;
  const { c } = useTheme();
  const root = useRef<View>(null);
  const overlap = useKeyboardOverlap(root);

  const actions: TopBarAction[] = [];
  if (props.onCopy) actions.push({ key: 'copy', icon: 'copy', accessibilityLabel: 'Скопировать', onPress: props.onCopy });
  if (onMore) actions.push({ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore });
  const barBottom = overlap > 0 ? overlap + KB_GAP : insets.bottom + BAR_PAD;
  const bottomSpace = editable ? barBottom + NOTE_TOOL + BAR_PAD : insets.bottom + BAR_PAD;

  return (
    <View ref={root} style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar lead={{ kind: 'back', label: caption, onBack }} actions={actions} style={[styles.side, { top: insets.top + S.topBarTop }]} />
      <View style={[styles.side, styles.title, { top: insets.top + S.titleTop }]}>
        <TitleField
          value={props.title}
          onChange={editable ? props.onChangeTitle : undefined}
          autoFocus={props.focusTitle}
          placeholder="Название"
          maxLength={80}
          textStyle={T.h1}
        />
      </View>
      <ScrollView
        style={[styles.scroll, { top: insets.top + TOP, bottom: bottomSpace, backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <NoteLines
          blocks={blocks}
          editable={editable}
          caret={caret}
          fill={{ minHeight: 120, grow: true }}
          onChangeText={props.onChangeText}
          onBackspace={props.onBackspace}
          onToggleCheck={props.onToggleCheck}
          onFocus={props.onFocus}
        />
      </ScrollView>
      {editable ? (
        <>
          <View style={[styles.bar, { height: barBottom + NOTE_TOOL + BAR_PAD + S.hairline, backgroundColor: c.bg, borderTopColor: c.hair }]} />
          <View style={[styles.side, { bottom: barBottom }]}>
            <NoteTools current={active !== null ? blocks[active] : undefined} onTool={onTool} onDone={onDone} />
          </View>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  side: { position: 'absolute', left: space.side, right: space.side },
  scroll: { position: 'absolute', left: 0, right: 0 },
  content: { paddingHorizontal: space.side, flexGrow: 1 },
  title: { height: S.titleHeight, justifyContent: 'flex-end' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
});
