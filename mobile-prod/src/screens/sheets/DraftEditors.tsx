/**
 * Правка записи в окне (хотелка, «Смотреть», идея, тема — без макета, из src/ui и блоков C-Voice / C-Quick*):
 * карточка с полем названия вверху, ниже — таблица полей и плитки выбора. Дело правится в полном окне дела.
 */
import { memo, useCallback, useMemo } from 'react';
import { GENRE_LABEL, KIND_LABEL, ORIGIN_LABEL, type Genre, type IdeaDraft, type Kind, type Origin, type PersonColor, type TopicDraft, type WatchDraft, type WishDraft } from '@/lib/types';
import type { ChipItem } from '../editors/components/ChipGrid';
import { ChoiceSection } from './components/ChoiceSection';
import { FieldBox, FieldInput, FieldLine } from './components/FieldRows';
import { SheetCard } from './components/SheetCard';

/** Карточка записи: ярлык типа, подпись (кто и когда добавил), цвет автора, «×» — убрать из ответа */
export type DraftHead = {
  tag: string;
  meta?: string;
  colors: readonly PersonColor[];
  onRemove?: () => void;
  /** Фокус в название при открытии (новая запись без названия) */
  autoFocus?: boolean;
};

const TITLE_MAX = 200;
const NOTE_MAX = 2000;
/** Жанров не больше трёх */
export const GENRES_MAX = 3;

const upper = (s: string) => s.toLocaleUpperCase('ru-RU');
const keysOf = <K extends string>(labels: Record<K, string>): K[] => Object.keys(labels).filter((k): k is K => k in labels);

type EditorProps<D> = { head: DraftHead; value: D; onChange: (value: D) => void };

export const WishDraftEditor = memo(function WishDraftEditor({ head, value, onChange }: EditorProps<WishDraft>) {
  const set = useCallback((p: Partial<WishDraft>) => onChange({ ...value, ...p }), [value, onChange]);
  return (
    <>
      <SheetCard
        title={value.title}
        tag={head.tag}
        meta={head.meta}
        colors={head.colors}
        onRemove={head.onRemove}
        input={{ value: value.title, onChangeText: (title) => set({ title }), accessibilityLabel: 'Название', autoFocus: head.autoFocus, maxLength: TITLE_MAX }}
      />
      <FieldBox>
        <FieldLine label="ЗАМЕТКА" first>
          <FieldInput value={value.note} onChangeText={(note) => set({ note })} accessibilityLabel="Заметка" maxLength={NOTE_MAX} />
        </FieldLine>
        <FieldLine label="ССЫЛКА">
          <FieldInput value={value.link} onChangeText={(link) => set({ link })} accessibilityLabel="Ссылка" keyboardType="url" mono />
        </FieldLine>
      </FieldBox>
    </>
  );
});

const KINDS = keysOf<Kind>(KIND_LABEL);
const GENRES = keysOf<Genre>(GENRE_LABEL);
const ORIGINS = keysOf<Origin>(ORIGIN_LABEL);

export const WatchDraftEditor = memo(function WatchDraftEditor({ head, value, onChange }: EditorProps<WatchDraft>) {
  const set = useCallback((p: Partial<WatchDraft>) => onChange({ ...value, ...p }), [value, onChange]);
  const kinds = useMemo<ChipItem<Kind>[]>(
    () => KINDS.map((k) => ({ key: k, label: upper(KIND_LABEL[k]), state: value.kind === k ? 'selected' : 'normal' })),
    [value.kind],
  );
  const full = value.genres.length >= GENRES_MAX;
  const genres = useMemo<ChipItem<Genre>[]>(
    () =>
      GENRES.map((g) => {
        const on = value.genres.includes(g);
        return { key: g, label: upper(GENRE_LABEL[g]), state: on ? 'selected' : full ? 'used' : 'normal' };
      }),
    [value.genres, full],
  );
  const origins = useMemo<ChipItem<Origin>[]>(
    () => ORIGINS.map((o) => ({ key: o, label: upper(ORIGIN_LABEL[o]), state: value.origin === o ? 'selected' : 'normal' })),
    [value.origin],
  );
  const toggleGenre = useCallback(
    (g: Genre) => {
      if (value.genres.includes(g)) set({ genres: value.genres.filter((x) => x !== g) });
      else if (value.genres.length < GENRES_MAX) set({ genres: [...value.genres, g] });
    },
    [value.genres, set],
  );
  return (
    <>
      <SheetCard
        title={value.title}
        tag={head.tag}
        meta={head.meta}
        colors={head.colors}
        onRemove={head.onRemove}
        input={{ value: value.title, onChangeText: (title) => set({ title }), accessibilityLabel: 'Название', autoFocus: head.autoFocus, maxLength: TITLE_MAX }}
      />
      <ChoiceSection label="ВИД" items={kinds} onPress={(k) => set({ kind: value.kind === k ? null : k })} />
      <ChoiceSection label="ЖАНРЫ" items={genres} onPress={toggleGenre} />
      <ChoiceSection label="СТРАНА" items={origins} columns={2} onPress={(o) => set({ origin: value.origin === o ? null : o })} />
      <FieldBox>
        <FieldLine label="ГОД" first>
          <FieldInput
            value={value.year ? String(value.year) : ''}
            onChangeText={(t) => set({ year: t ? Number(t.replace(/\D/g, '')) || null : null })}
            accessibilityLabel="Год"
            keyboardType="number-pad"
            maxLength={4}
            mono
          />
        </FieldLine>
      </FieldBox>
    </>
  );
});

/** Тема для выбора: своя тема */
export type TopicChoice = { id: string; title: string };

/** Ключи плиток темы, кроме id тем */
const NO_TOPIC = '__none';
const NEW_TOPIC = '__new';

type IdeaProps = EditorProps<IdeaDraft> & { topics: readonly TopicChoice[] };

export const IdeaDraftEditor = memo(function IdeaDraftEditor({ head, value, topics, onChange }: IdeaProps) {
  const set = useCallback((p: Partial<IdeaDraft>) => onChange({ ...value, ...p }), [value, onChange]);
  const creating = value.newTopic !== null;
  const items = useMemo<ChipItem<string>[]>(
    () => [
      { key: NO_TOPIC, label: 'БЕЗ ТЕМЫ', state: !creating && !value.topicId ? 'selected' : 'normal' },
      ...topics.map((t): ChipItem<string> => ({ key: t.id, label: upper(t.title), state: !creating && value.topicId === t.id ? 'selected' : 'normal' })),
      { key: NEW_TOPIC, label: '+ НОВАЯ', state: creating ? 'selected' : 'normal' },
    ],
    [topics, creating, value.topicId],
  );
  const pick = useCallback(
    (key: string) => {
      if (key === NO_TOPIC) set({ topicId: null, newTopic: null });
      else if (key === NEW_TOPIC) set({ topicId: null, newTopic: creating ? null : '' });
      else set({ topicId: key, newTopic: null });
    },
    [creating, set],
  );
  return (
    <>
      <SheetCard
        title={value.title}
        tag={head.tag}
        meta={head.meta}
        colors={head.colors}
        onRemove={head.onRemove}
        input={{
          value: value.title,
          onChangeText: (title) => set({ title }),
          accessibilityLabel: 'Идея',
          multiline: true,
          autoFocus: head.autoFocus,
          maxLength: NOTE_MAX,
        }}
      />
      <ChoiceSection label="ТЕМА" items={items} columns={2} onPress={pick} />
      {creating ? (
        <FieldBox>
          <FieldLine label="НОВАЯ ТЕМА" first>
            <FieldInput
              value={value.newTopic ?? ''}
              onChangeText={(newTopic) => set({ newTopic })}
              accessibilityLabel="Новая тема"
              autoFocus={!value.newTopic}
              maxLength={TITLE_MAX}
            />
          </FieldLine>
        </FieldBox>
      ) : null}
    </>
  );
});

export const TopicDraftEditor = memo(function TopicDraftEditor({ head, value, onChange }: EditorProps<TopicDraft>) {
  return (
    <SheetCard
      title={value.title}
      tag={head.tag}
      meta={head.meta}
      colors={head.colors}
      onRemove={head.onRemove}
      input={{ value: value.title, onChangeText: (title) => onChange({ title }), accessibilityLabel: 'Название темы', autoFocus: head.autoFocus, maxLength: TITLE_MAX }}
    />
  );
});
