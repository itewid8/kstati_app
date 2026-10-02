import { X } from '@/components/icons';
import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { taskWhen } from '@/lib/dates';
import { toISODate } from '@/lib/dates';
import { repeatLabel, shiftRepeat } from '@/lib/recur';
import { effectiveSpecs, specsSummary } from '@/lib/remind';
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
import { ICON, useColors } from '@/theme';
import { DatePanel, TimePanel } from './pickers';
import { ReminderEditor } from './ReminderEditor';
import { RepeatPanel } from './RepeatPanel';
import { Chip, Field, T } from './ui';

/* ================= Просмотр (карточка до «Исправить») ================= */

export function ItemPreview({ item }: { item: DraftItem }) {
  if (item.type === 'task') {
    const d = item.data;
    return (
      <View style={{ gap: 2 }}>
        <T weight="medium">{d.title || 'Без названия'}</T>
        <T variant="caption" mono muted>
          {d.date || d.time ? taskWhen(d.date, d.time) : 'без даты'}
        </T>
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
  if (item.type === 'task') return <TaskEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'wish') return <WishEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'idea') return <IdeaEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'topic')
    return <Field placeholder="Название темы" value={item.data.title} onChangeText={(title) => onChange({ ...item, data: { title } })} autoFocus={!item.data.title} />;
  return <WatchEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
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

function TaskEditor({ value, onChange }: { value: TaskDraft; onChange: (v: TaskDraft) => void }) {
  // Открыт свой выбор даты, времени или повтора (раскрывается под полями)
  const [open, setOpen] = useState<'date' | 'time' | 'repeat' | null>(null);
  const set = (p: Partial<TaskDraft>) => onChange({ ...value, ...p });
  const toggle = (k: 'date' | 'time' | 'repeat') => {
    Keyboard.dismiss();
    setOpen(open === k ? null : k);
  };
  return (
    <View style={{ gap: 12 }}>
      <Field placeholder="Название" value={value.title} onChangeText={(title) => set({ title })} autoFocus={!value.title} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PickerField
          placeholder="Дата"
          display={value.date ? taskWhen(value.date, null) : null}
          active={open === 'date'}
          onPress={() => toggle('date')}
          onClear={() => {
            // Сбрасываем только дату, время остаётся; без даты нет и повтора
            set({ date: null, repeat: null });
            setOpen(null);
          }}
        />
        <PickerField
          placeholder="Время"
          display={value.time}
          active={open === 'time'}
          onPress={() => toggle('time')}
          onClear={() => {
            set({ time: null });
            setOpen(null);
          }}
        />
      </View>
      {open === 'date' && (
        <DatePanel
          value={value.date}
          // Правило повтора, привязанное к дате («каждую среду»), переезжает вместе с ней
          onPick={(date) => set({ date, repeat: shiftRepeat(value.repeat, value.date, date) })}
          onDone={() => setOpen(null)}
          onClear={() => {
            set({ date: null, repeat: null });
            setOpen(null);
          }}
        />
      )}
      {open === 'time' && (
        <TimePanel
          value={value.time}
          onPick={(time, done) => {
            // Дата и время независимы: время можно задать и без даты
            set({ time });
            if (done) setOpen(null);
          }}
        />
      )}
      <PickerField
        placeholder="Не повторяется"
        display={value.repeat ? repeatLabel(value.repeat, value.date) : null}
        plain
        active={open === 'repeat'}
        onPress={() => toggle('repeat')}
        onClear={() => {
          set({ repeat: null });
          setOpen(null);
        }}
      />
      {open === 'repeat' && (
        <RepeatPanel
          value={value.repeat ?? null}
          start={value.date ?? toISODate(new Date())}
          // Повтор без даты не бывает: первая дата — сегодня
          onChange={(repeat) => set({ repeat, ...(repeat && !value.date && { date: toISODate(new Date()) }) })}
        />
      )}
      <Field
        placeholder="Описание"
        value={value.note ?? ''}
        onChangeText={(note) => set({ note })}
        multiline
        textAlignVertical="top"
        style={{ height: undefined, minHeight: 72, paddingTop: 12, paddingBottom: 12 }}
      />
      <RemindersBlock value={value} set={set} />
    </View>
  );
}

/**
 * Напоминания дела. «Мне» — личные (видны и срабатывают только у меня),
 * «Всем» — общие для группы (у каждого, кто не настроил свои). Показываем, откуда взялись текущие.
 */
function RemindersBlock({ value, set }: { value: TaskDraft; set: (p: Partial<TaskDraft>) => void }) {
  const c = useColors();
  const settings = useStore((s) => s.reminders);
  const [scope, setScope] = useState<'me' | 'all'>(value.mine ? 'me' : value.shared ? 'all' : 'me');
  // Без даты напоминать не о чем — блок не показываем
  if (!value.date) return null;
  const task = { time: value.time, reminders: value.shared ?? null };
  const specs =
    scope === 'me' ? effectiveSpecs(task, value.mine, settings).specs : (value.shared ?? (value.time ? settings.timed : settings.allDay));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="label" muted style={{ flex: 1 }}>
          Напоминания
        </T>
        <Chip label="Для меня" selected={scope === 'me'} onPress={() => setScope('me')} />
        <Chip label="Для всех" selected={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      {!settings.enabled && (
        <T variant="caption" danger>
          Напоминания выключены в настройках приложения
        </T>
      )}
      <ReminderEditor
        value={specs}
        timed={!!value.time}
        date={value.repeat ? null : value.date}
        time={value.time}
        onChange={(v) => (scope === 'me' ? set({ mine: v }) : set({ shared: v, mine: undefined }))}
      />
    </View>
  );
}

/** Поле даты или времени: нажатие раскрывает свой выбор под полями */
function PickerField({
  placeholder,
  display,
  plain,
  active,
  onPress,
  onClear,
}: {
  placeholder: string;
  display: string | null;
  /** Значение обычным шрифтом, не моноширинным (повтор: «Каждую неделю: сб») */
  plain?: boolean;
  active: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onPress} style={[styles.picker, { backgroundColor: c.background, borderColor: active ? c.text : c.border }]}>
        <T mono={!!display && !plain} muted={!display} variant={display ? 'caption' : 'body'} numberOfLines={1} style={{ flex: 1 }}>
          {display ?? placeholder}
        </T>
        {display ? (
          <Pressable onPress={onClear} hitSlop={10}>
            <X size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
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
  picker: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
