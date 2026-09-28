import { X } from '@/components/icons';
import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { taskWhen } from '@/lib/dates';
import {
  ALL_RULES,
  GENRE_LABEL,
  KIND_LABEL,
  ORIGIN_LABEL,
  RULE_LABEL,
  type DraftItem,
  type Genre,
  type Kind,
  type Origin,
  type TaskDraft,
  type TaskReminderOverride,
  type WatchDraft,
  type WishDraft,
} from '@/lib/types';
import { ICON, useColors } from '@/theme';
import { DatePanel, TimePanel } from './pickers';
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
        {d.date ? (
          <T variant="caption" muted>
            Напоминания: {reminderSummary(d.reminder)}
          </T>
        ) : null}
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

export function reminderSummary(r: TaskReminderOverride | undefined): string {
  if (!r) return 'как обычно';
  if (r.length === 0) return 'не напоминать';
  return r.map((x) => RULE_LABEL[x].toLowerCase()).join(', ');
}

/* ================= Редакторы ================= */

export function ItemEditor({ item, onChange }: { item: DraftItem; onChange: (i: DraftItem) => void }) {
  if (item.type === 'task') return <TaskEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  if (item.type === 'wish') return <WishEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
  return <WatchEditor value={item.data} onChange={(data) => onChange({ ...item, data })} />;
}

function TaskEditor({ value, onChange }: { value: TaskDraft; onChange: (v: TaskDraft) => void }) {
  const [remOpen, setRemOpen] = useState(false);
  // Открыт свой выбор даты или времени (раскрывается под полями)
  const [open, setOpen] = useState<'date' | 'time' | null>(null);
  const set = (p: Partial<TaskDraft>) => onChange({ ...value, ...p });
  const toggle = (k: 'date' | 'time') => {
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
            // Сбрасываем только дату, время остаётся
            set({ date: null });
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
          onPick={(date) => set({ date })}
          onDone={() => setOpen(null)}
          onClear={() => {
            set({ date: null });
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
      <Field
        placeholder="Описание"
        value={value.note ?? ''}
        onChangeText={(note) => set({ note })}
        multiline
        textAlignVertical="top"
        style={{ height: undefined, minHeight: 72, paddingTop: 12, paddingBottom: 12 }}
      />
      <Pressable onPress={() => setRemOpen((v) => !v)} hitSlop={6}>
        <T variant="caption" muted>
          Напоминания: <T variant="caption">{reminderSummary(value.reminder)}</T>
        </T>
      </Pressable>
      {remOpen && (
        <View style={styles.wrap}>
          <Chip label="Как обычно" selected={!value.reminder} onPress={() => set({ reminder: undefined })} />
          <Chip label="Не напоминать" selected={value.reminder?.length === 0} onPress={() => set({ reminder: [] })} />
          {ALL_RULES.filter((r) => value.time || !r.startsWith('h')).map((r) => {
            const on = !!value.reminder?.includes(r);
            return (
              <Chip
                key={r}
                label={RULE_LABEL[r]}
                selected={on}
                onPress={() => {
                  const cur = value.reminder ?? [];
                  set({ reminder: on ? cur.filter((x) => x !== r) : [...cur, r] });
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Поле даты или времени: нажатие раскрывает свой выбор под полями */
function PickerField({
  placeholder,
  display,
  active,
  onPress,
  onClear,
}: {
  placeholder: string;
  display: string | null;
  active: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onPress} style={[styles.picker, { backgroundColor: c.background, borderColor: active ? c.text : c.border }]}>
        <T mono={!!display} muted={!display} variant={display ? 'caption' : 'body'} style={{ flex: 1 }}>
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
