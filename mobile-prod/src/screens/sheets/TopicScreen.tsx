/**
 * Тема заметок (C-Topic). Тема — сама заметка: назад + подпись, кнопки «открыть группам» / «+» (заметка внутри) / «⋯»,
 * название (своё правится прямо в заголовке), текст темы строками заметки (components/NoteLines — писать можно сразу,
 * ткнув в любое место), ниже — «ЗАМЕТКИ» внутри темы (новые сверху): первая строка, вторая, дата и счёт чек-листа.
 * Пока открыта клавиатура, вместо нижней навигации — панель заметки с ГОТОВО.
 * Нажатие на заметку — открыть (чужую — только читать), смахнуть влево — удалить свою.
 * Удержание — быстрые действия над поднятой строкой. Прокрутка подменяется (PullScrollView — обновление потягиванием).
 */
import { memo, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import type { NoteBlock } from '@/lib/note';
import type { NoteCaret, NoteTool } from '@/lib/noteEdit';
import type { ID, PersonColor } from '@/lib/types';
import {
  BottomNav,
  Checkbox,
  Icon,
  LONG_PRESS_MS,
  ListMotion,
  RowMotion,
  fonts,
  TopBar,
  pad2,
  size as S,
  space,
  type as T,
  useLift,
  useTheme,
  type LiftHandler,
  type LiftTarget,
  type NavTab,
  type TopBarAction,
} from '@/ui';
import { NOTE_TOOL, NoteLines, NoteTools, useKeyboardOverlap, type NoteHandlers } from '../lists/components/NoteLines';
import { TitleField } from '../lists/components/TitleField';
import { SwipeDelete } from './components/SwipeDelete';

export type TopicIdea = {
  id: ID;
  /** Первая строка заметки */
  title: string;
  /** Вторая строка; пусто — строки нет */
  line: string;
  /** Чек-лист: «2/4»; null — его нет */
  checks: string | null;
  /** «28 СЕН» */
  date: string;
};

export type TopicScreenProps = {
  /** «ТЕМА · КАРИНА», «БЕЗ ТЕМЫ», «ТЕМЫ НЕТ» */
  caption: string;
  title: string;
  /** Своя тема: название правится в заголовке */
  onChangeTitle?: (title: string) => void;
  /** Новая тема — курсор сразу в названии */
  focusTitle?: boolean;
  /** Текст самой темы; нет — «Без темы» (только заметки) */
  body?: NoteHandlers & {
    blocks: readonly NoteBlock[];
    editable: boolean;
    active: number | null;
    caret?: (NoteCaret & { nonce: number }) | null;
    onTool?: (tool: NoteTool) => void;
    /** Перейти к тексту (клавиша «Далее» в названии) */
    onStart?: () => void;
  };
  /** Цвет владельца — полоса строк; null — нейтральная */
  color: PersonColor | null;
  ideas: readonly TopicIdea[];
  /** Тема открыта группам; null — кнопки нет (чужая тема или «Без темы») */
  shared: boolean | null;
  insets?: { top: number; bottom: number };
  /** Прокрутка списка (по умолчанию ScrollView) */
  Scroll?: ComponentType<ScrollViewProps>;

  onBack?: () => void;
  onShare?: () => void;
  onAdd?: () => void;
  onMore?: () => void;
  /** ГОТОВО на панели над клавиатурой — сохранить (правки темы сохраняются только так); нет — просто убрать клавиатуру */
  onDone?: () => void;
  /** Скопировать тему целиком: название, текст и заметки внутри */
  onCopy?: () => void;
  /** Выбор заметок (удалить несколько): выбранные id; null — выбора нет */
  selected?: readonly ID[] | null;
  onToggleSelect?: (id: ID) => void;
  onCancelSelect?: () => void;
  onDeleteSelected?: () => void;
  onOpenIdea?: (id: ID) => void;
  onHoldIdea?: (id: ID, lift: LiftTarget) => void;
  onDeleteIdea?: (id: ID) => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

type RowProps = {
  idea: TopicIdea;
  strip: string;
  /** Режим выбора: отмечена ли строка; undefined — выбора нет */
  selected?: boolean;
  onOpen?: (id: ID) => void;
  onHold?: (id: ID, lift: LiftTarget) => void;
};

const IdeaRow = memo(function IdeaRow(props: RowProps) {
  const { idea, strip, selected, onOpen, onHold } = props;
  const { c } = useTheme();
  const hold = useCallback<LiftHandler>((lift) => onHold?.(idea.id, lift), [onHold, idea.id]);
  const lift = useLift(onHold ? hold : undefined, 'row', () => <IdeaRow idea={idea} strip={strip} />);
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={idea.title}
      onPress={onOpen ? () => onOpen(idea.id) : undefined}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      disabled={!onOpen && !lift.onLongPress}
      style={[styles.row, selected !== undefined && styles.selRow, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <View style={[styles.strip, { backgroundColor: strip }]} />
      {selected !== undefined ? (
        <Checkbox checked={selected} onPress={onOpen ? () => onOpen(idea.id) : undefined} accessibilityLabel="Выбрать" emptyFill="none" style={styles.selCheck} />
      ) : null}
      <View style={styles.rowText}>
      <Text numberOfLines={1} style={[styles.noteTitle, { color: c.text }]}>
        {idea.title}
      </Text>
      {idea.line ? (
        <Text numberOfLines={1} style={[styles.noteLine, { color: c.muted }]}>
          {idea.line}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={[T.rowMeta, { color: c.muted }]}>{idea.date}</Text>
        {idea.checks ? (
          <View style={styles.checks}>
            <View style={[styles.checkBox, { borderColor: c.text }]}>
              <Icon name="check" size={7} color={c.text} />
            </View>
            <Text style={[styles.checksText, { color: c.text }]}>{idea.checks}</Text>
          </View>
        ) : null}
      </View>
      </View>
    </Pressable>
  );
});

export const TopicScreen = memo(function TopicScreen(props: TopicScreenProps) {
  const {
    caption,
    title,
    color,
    ideas,
    shared,
    body,
    insets = NO_INSETS,
    Scroll = ScrollView,
    onBack,
    onShare,
    onAdd,
    onMore,
    onOpenIdea,
    onHoldIdea,
    onDeleteIdea,
    onNavigate,
    onRec,
  } = props;
  const { c, person } = useTheme();
  const strip = color ? person(color) : c.hairStrong;
  const root = useRef<View>(null);
  const overlap = useKeyboardOverlap(root);
  // Клавиатура открыта (правят текст или название) — снизу панель заметки вместо навигации
  const typing = overlap > 0 && !!body?.editable;

  const selecting = !!props.selected;
  const picked = useMemo(() => new Set(props.selected ?? []), [props.selected]);
  const actions = useMemo<TopBarAction[]>(() => {
    const out: TopBarAction[] = [];
    if (selecting) {
      if (picked.size && props.onDeleteSelected) out.push({ key: 'delete', icon: 'trash', accessibilityLabel: 'Удалить выбранные', onPress: props.onDeleteSelected });
      return out;
    }
    if (shared !== null && onShare) {
      out.push({
        key: 'share',
        icon: 'people',
        accessibilityLabel: 'Открыть группам',
        onPress: onShare,
        ...(shared ? { fill: c.text, ink: c.bg } : null),
      });
    }
    if (props.onCopy) out.push({ key: 'copy', icon: 'copy', accessibilityLabel: 'Скопировать', onPress: props.onCopy });
    if (onAdd) out.push({ key: 'add', icon: 'plus', accessibilityLabel: 'Новая заметка', onPress: onAdd });
    if (onMore) out.push({ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore });
    return out;
  }, [shared, onShare, onAdd, onMore, props.onCopy, c.text, c.bg, selecting, picked, props.onDeleteSelected]);

  // Пустой текст темы при заметках внутри не занимает места: писать — «Далее» в названии
  const hideBody = !!body && ideas.length > 0 && body.active === null && body.blocks.every((b) => !b.text.trim());

  const bottom = typing ? overlap + KB_GAP + NOTE_TOOL + BAR_PAD : insets.bottom + S.contentBottom;

  return (
    <View ref={root} style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar
        lead={selecting ? { kind: 'back', label: `ВЫБРАНО ${pad2(picked.size)}`, onBack: props.onCancelSelect } : { kind: 'back', label: caption, onBack }}
        actions={actions} style={[styles.abs, { top: insets.top + S.topBarTop }]} />
      <View style={[styles.abs, styles.title, { top: insets.top + S.titleTop }]}>
        <TitleField
          value={title}
          onChange={props.onChangeTitle}
          autoFocus={props.focusTitle}
          onNext={body?.editable ? body.onStart : undefined}
          placeholder="Новая тема"
          maxLength={80}
          textStyle={T.h1}
        />
      </View>

      <Scroll
        style={[styles.scroll, { top: insets.top + BODY_TOP, bottom, backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {body && !hideBody ? (
          <NoteLines
            blocks={body.blocks}
            editable={body.editable}
            caret={body.caret}
            fill={{ minHeight: ideas.length ? 8 : 160, grow: !ideas.length }}
            onChangeText={body.onChangeText}
            onBackspace={body.onBackspace}
            onToggleCheck={body.onToggleCheck}
            onFocus={body.onFocus}
          />
        ) : null}
        {ideas.length ? (
          <View style={[styles.box, { borderColor: c.border }]}>
            <View style={[styles.header, { backgroundColor: c.text }]}>
              <Text style={[T.section, { color: c.bg }]}>ЗАМЕТКИ</Text>
              <Text style={[T.section, { color: c.bg }]}>{pad2(ideas.length)}</Text>
            </View>
            <ListMotion>
              {ideas.map((idea) => (
                <RowMotion key={idea.id}>
                  {selecting ? (
                    <IdeaRow idea={idea} strip={strip} selected={picked.has(idea.id)} onOpen={props.onToggleSelect} />
                  ) : (
                    <SwipeDelete onDelete={onDeleteIdea ? () => onDeleteIdea(idea.id) : undefined}>
                      <IdeaRow idea={idea} strip={strip} onOpen={onOpenIdea} onHold={onHoldIdea} />
                    </SwipeDelete>
                  )}
                </RowMotion>
              ))}
            </ListMotion>
          </View>
        ) : null}
      </Scroll>

      {typing && body ? (
        <>
          <View style={[styles.bar, { height: overlap + KB_GAP + NOTE_TOOL + BAR_PAD + S.hairline, backgroundColor: c.bg, borderTopColor: c.hair }]} />
          <View style={[styles.abs, { bottom: overlap + KB_GAP }]}>
            <NoteTools current={body.active !== null ? body.blocks[body.active] : undefined} onTool={body.onTool} onDone={props.onDone ?? Keyboard.dismiss} />
          </View>
        </>
      ) : (
        <BottomNav active="ideas" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
      )}
    </View>
  );
});

/** Текст темы — сразу под названием; панель над клавиатурой: отступы 16 и 8 */
const BODY_TOP = 108;
const BAR_PAD = 16;
const KB_GAP = 8;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  title: { height: S.titleHeight, justifyContent: 'flex-end' },
  box: { borderWidth: S.border },
  scroll: { position: 'absolute', left: 0, right: 0 },
  content: { paddingHorizontal: space.side, paddingBottom: 16, flexGrow: 1 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: S.hairline },
  header: {
    height: S.sectionHeader,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { borderTopWidth: S.hairline, paddingVertical: 9, paddingLeft: 12, paddingRight: 10 },
  selRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  selCheck: { marginRight: 4 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  noteTitle: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 16 },
  noteLine: { fontFamily: fonts.sans400, fontSize: 12.5, lineHeight: 16 },
  meta: { height: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkBox: { width: 10, height: 10, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  checksText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.18, lineHeight: 11 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
});
