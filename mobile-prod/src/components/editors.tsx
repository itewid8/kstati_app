import React from 'react';
import { StyleSheet, View } from 'react-native';
import { repeatLabel } from '@/lib/recur';
import { effectiveSpecs, specsSummary } from '@/lib/remind';
import { spanLabel } from '@/lib/span';
import { useStore } from '@/lib/store';
import {
  GENRE_LABEL,
  KIND_LABEL,
  ORIGIN_LABEL,
  type DraftItem,
  type Genre,
  type IdeaDraft,
  type Kind,
  type Origin,
  type TaskDraft,
  type WatchDraft,
  type WishDraft,
} from '@/lib/types';
import { TaskEditor } from './TaskEditor';
import { Chip, Field, T } from './ui';

/* ================= Просмотр (карточка до «Исправить») ================= */

export function ItemPreview({ item }: { item: DraftItem }) {
  if (item.type === 'task') {
    const d = item.data;
    return (
      <View style={{ gap: 2 }}>
        <T weight="medium">{d.title || 'Без названия'}</T>
        <T variant="caption" mono muted>
          {d.date || d.time ? spanLabel(d) : 'без даты'}
        </T>
        <TaskExtra draft={d} />
        {d.note ? (
          <T variant="caption" muted>
            {d.note}
          </T>
        ) : null}
        {d.repeat ? (
          <T variant="caption" muted>
            {repeatLabel(d.repeat, d.date)}
          </T>
        ) : null}
        {d.date ? <ReminderLine draft={d} /> : null}
      </View>
    );
  }
  if (item.type === 'wish') {
    const d = item.data;
    return (
      <View style={{ gap: 2 }}>
        <T weight="medium">{d.title}</T>
        {d.note ? (
          <T variant="caption" muted>
            {d.note}
          </T>
        ) : null}
        {d.link ? (
          <T variant="caption" mono muted numberOfLines={1}>
            {d.link}
          </T>
        ) : null}
      </View>
    );
  }
  if (item.type === 'idea') return <IdeaPreview value={item.data} />;
  if (item.type === 'topic')
    return (
      <View style={{ gap: 2 }}>
        <T variant="label" muted>
          Новая тема
        </T>
        <T weight="medium">{item.data.title}</T>
      </View>
    );
  const d = item.data;
  const meta = [d.kind ? KIND_LABEL[d.kind] : null, d.year].filter(Boolean).join(' · ');
  const sub = [...d.genres.map((g) => GENRE_LABEL[g]), d.origin ? ORIGIN_LABEL[d.origin] : null].filter(Boolean).join(', ');
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <T weight="medium" style={{ flex: 1 }}>
          {d.title}
        </T>
        {meta ? (
          <T variant="caption" mono muted>
            {meta}
          </T>
        ) : null}
      </View>
      {sub ? (
        <T variant="caption" muted>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

/** Кто занят и в каком плане — в карточке до «Исправить» */
function TaskExtra({ draft }: { draft: TaskDraft }) {
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.me?.id);
  const parent = useStore((s) => (draft.parentId ? s.tasks.find((t) => t.id === draft.parentId) : null));
  const who = (draft.people ?? []).map((id) => (id === meId ? 'я' : (users.find((u) => u.id === id)?.name ?? '—'))).join(', ');
  return (
    <>
      {who ? (
        <T variant="caption" muted>
          Кто: {who}
        </T>
      ) : null}
      {parent ? (
        <T variant="caption" muted>
          В плане «{parent.title}»
        </T>
      ) : null}
    </>
  );
}

/** «Напоминания: накануне в 20:00, за 1 ч до начала» — какие действуют для меня */
function ReminderLine({ draft }: { draft: TaskDraft }) {
  const settings = useStore((s) => s.reminders);
  const { specs } = effectiveSpecs({ time: draft.time, reminders: draft.shared ?? null }, draft.mine, settings);
  return (
    <T variant="caption" muted>
      Напоминания: {settings.enabled ? specsSummary(specs).toLowerCase() : 'выключены в настройках'}
    </T>
  );
}

/* ================= Редакторы ================= */

export function ItemEditor({ item, onChange }: { item: DraftItem; onChange: (i: DraftItem) => void }) {
  if (item.type === 'task') return <TaskItemEditor item={item} onChange={onChange} />;
  if (item.type === 'wish') return <WishEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'idea') return <IdeaEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'topic')
    return <Field placeholder="Название темы" value={item.data.title} onChangeText={(title) => onChange({ ...item, data: { title } })} autoFocus={!item.data.title} />;
  return <WatchEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
}

/** Дело: автор нужен, чтобы знать, кто занят, если «Кто» не выбран */
function TaskItemEditor({ item, onChange }: { item: Extract<DraftItem, { type: 'task' }>; onChange: (i: DraftItem) => void }) {
  const authorId = useStore((s) => (item.id ? s.tasks.find((t) => t.id === item.id)?.createdBy : undefined) ?? s.me?.id ?? '');
  return <TaskEditor value={item.data} onChange={(data) => onChange({ ...item, data })} selfId={item.id} authorId={authorId} />;
}

/** Куда ляжет идея: «Тема», «Новая тема: …» или «Без темы» */
function topicLine(d: IdeaDraft, title: (id: string) => string | undefined) {
  if (d.newTopic?.trim()) return `Новая тема: ${d.newTopic.trim()}`;
  return d.topicId ? (title(d.topicId) ?? 'Без темы') : 'Без темы';
}

function IdeaPreview({ value }: { value: IdeaDraft }) {
  const topics = useStore((s) => s.topics);
  return (
    <View style={{ gap: 4 }}>
      <T>{value.title}</T>
      <T variant="caption" muted>
        {topicLine(value, (id) => topics.find((t) => t.id === id)?.title)}
      </T>
    </View>
  );
}

/** Идея: текст и тема. Тему можно выбрать из своих или назвать новую */
function IdeaEditor({ value, onChange }: { value: IdeaDraft; onChange: (v: IdeaDraft) => void }) {
  const meId = useStore((s) => s.me?.id);
  const all = useStore((s) => s.topics);
  const topics = all.filter((t) => t.ownerId === meId);
  const set = (p: Partial<IdeaDraft>) => onChange({ ...value, ...p });
  const creating = value.newTopic !== null;
  return (
    <View style={{ gap: 14 }}>
      <Field
        placeholder="Идея"
        value={value.title}
        onChangeText={(title) => set({ title })}
        autoFocus={!value.title}
        multiline
        textAlignVertical="top"
        style={{ height: undefined, minHeight: 96, paddingTop: 12, paddingBottom: 12 }}
      />
      <Group label="Тема">
        <Chip label="Без темы" selected={!creating && !value.topicId} onPress={() => set({ topicId: null, newTopic: null })} />
        {topics.map((t) => (
          <Chip key={t.id} label={t.title} selected={!creating && value.topicId === t.id} onPress={() => set({ topicId: t.id, newTopic: null })} />
        ))}
        <Chip label="Новая" selected={creating} onPress={() => set({ topicId: null, newTopic: creating ? null : '' })} />
      </Group>
      {creating && <Field placeholder="Название темы" value={value.newTopic ?? ''} onChangeText={(newTopic) => set({ newTopic })} autoFocus={!value.newTopic} />}
    </View>
  );
}

function WishEditor({ value, onChange }: { value: WishDraft; onChange: (v: WishDraft) => void }) {
  const set = (p: Partial<WishDraft>) => onChange({ ...value, ...p });
  return (
    <View style={{ gap: 12 }}>
      <Field placeholder="Название" value={value.title} onChangeText={(title) => set({ title })} autoFocus={!value.title} />
      <Field placeholder="Заметка" value={value.note} onChangeText={(note) => set({ note })} />
      <Field
        placeholder="Ссылка"
        value={value.link}
        onChangeText={(link) => set({ link })}
        autoCapitalize="none"
        keyboardType="url"
        autoCorrect={false}
      />
    </View>
  );
}

function WatchEditor({ value, onChange }: { value: WatchDraft; onChange: (v: WatchDraft) => void }) {
  const set = (p: Partial<WatchDraft>) => onChange({ ...value, ...p });
  const toggleGenre = (g: Genre) => {
    const on = value.genres.includes(g);
    if (on) set({ genres: value.genres.filter((x) => x !== g) });
    else if (value.genres.length < 3) set({ genres: [...value.genres, g] });
  };
  return (
    <View style={{ gap: 14 }}>
      <Field placeholder="Название" value={value.title} onChangeText={(title) => set({ title })} autoFocus={!value.title} />
      <Group label="Тип">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <Chip key={k} label={KIND_LABEL[k]} selected={value.kind === k} onPress={() => set({ kind: value.kind === k ? null : k })} />
        ))}
      </Group>
      <Group label="Жанры, до трёх">
        {(Object.keys(GENRE_LABEL) as Genre[]).map((g) => (
          <Chip key={g} label={GENRE_LABEL[g]} selected={value.genres.includes(g)} onPress={() => toggleGenre(g)} />
        ))}
      </Group>
      <Group label="Страна">
        {(Object.keys(ORIGIN_LABEL) as Origin[]).map((o) => (
          <Chip
            key={o}
            label={ORIGIN_LABEL[o]}
            selected={value.origin === o}
            onPress={() => set({ origin: value.origin === o ? null : o })}
          />
        ))}
      </Group>
      <Field
        label="Год"
        placeholder="—"
        keyboardType="number-pad"
        maxLength={4}
        value={value.year ? String(value.year) : ''}
        onChangeText={(t) => set({ year: t ? Number(t.replace(/\D/g, '')) || null : null })}
        style={{ width: 120 }}
      />
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="label" muted>
        {label}
      </T>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
