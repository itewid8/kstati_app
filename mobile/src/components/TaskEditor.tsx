/**
 * Карточка дела: название и строка чипов — дата, время, конец, повтор, кто, напоминания, описание.
 * Пустой чип — бледный «+ …», заполненный показывает значение. Нажатие раскрывает панель только этого чипа,
 * остальное свёрнуто. Надиктованное голосом сразу стоит в чипах.
 * Под чипами — пересечения с делами тех же людей и выход подзадачи за даты плана.
 */
import { X } from '@/components/icons';
import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { shortDate, toISODate } from '@/lib/dates';
import { expandTasks, repeatLabel, shiftRepeat } from '@/lib/recur';
import { effectiveSpecs, specsSummary } from '@/lib/remind';
import { lastDay, overlaps, peopleOf, spanLabel, timeOn } from '@/lib/span';
import { useStore } from '@/lib/store';
import type { ID, TaskDraft } from '@/lib/types';
import { ICON, useColors } from '@/theme';
import { DatePanel, TimePanel } from './pickers';
import { ReminderEditor } from './ReminderEditor';
import { RepeatPanel } from './RepeatPanel';
import { Chip, Field, T } from './ui';

type Open = 'date' | 'time' | 'end' | 'repeat' | 'who' | 'remind' | 'note' | null;

const plusHour = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function TaskEditor({
  value,
  onChange,
  selfId,
  authorId,
}: {
  value: TaskDraft;
  onChange: (v: TaskDraft) => void;
  /** id правимого дела (свои пересечения не показываем) */
  selfId?: ID;
  /** Автор: он занят, если «Кто» не выбран */
  authorId: ID;
}) {
  const c = useColors();
  const [open, setOpen] = useState<Open>(null);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.me?.id);
  const groups = useStore((s) => s.groups);
  const currentGroupId = useStore((s) => s.currentGroupId);
  const settings = useStore((s) => s.reminders);

  const set = (p: Partial<TaskDraft>) => onChange({ ...value, ...p });
  const toggle = (k: Open) => {
    Keyboard.dismiss();
    setOpen(open === k ? null : k);
  };

  const parent = value.parentId ? tasks.find((t) => t.id === value.parentId) : null;
  const self = selfId ? tasks.find((t) => t.id === selfId) : null;
  const groupId = parent?.groupId ?? self?.groupId ?? currentGroupId;
  const group = groups.find((g) => g.id === groupId);
  const members = group?.memberIds ?? [];
  const who = value.people?.length ? value.people : [authorId];
  const name = (id: ID) => (id === meId ? 'Я' : (users.find((u) => u.id === id)?.name ?? '—'));
  const multi = !!value.endDate && !!value.date && value.endDate > value.date;

  // Пересечения: дела тех же людей в этой группе, которые идут в то же время
  const conflicts = useMemo(() => {
    if (!value.date || (!value.time && !multi)) return [];
    const from = value.date;
    const to = lastDay(value)!;
    const near = expandTasks(
      // Сам план и его подзадачи — не пересечения
      tasks.filter((t) => t.groupId === groupId && t.id !== selfId && t.id !== value.parentId && (!selfId || t.parentId !== selfId) && !t.doneAt),
      from,
      to,
    );
    return near.filter((t) => overlaps(value, t) && peopleOf(t).some((p) => who.includes(p))).slice(0, 3);
  }, [tasks, value, groupId, selfId, who.join(',')]);

  // Подзадача за пределами дат плана
  const outside = !!parent?.date && !!value.date && (value.date < parent.date || value.date > (lastDay(parent) ?? parent.date));

  const reminderSpecs = effectiveSpecs({ time: value.time, reminders: value.shared ?? null }, value.mine, settings).specs;

  const chips: { key: Exclude<Open, null>; label: string; filled: boolean; mono?: boolean; clear?: () => void; hidden?: boolean }[] = [
    { key: 'date', label: value.date ? shortDate(value.date) : 'Дата', filled: !!value.date, mono: true, clear: () => set({ date: null, repeat: null, endDate: null }) },
    { key: 'time', label: value.time ?? 'Время', filled: !!value.time, mono: true, clear: () => set({ time: null, endTime: multi ? value.endTime : null }) },
    {
      key: 'end',
      label: multi ? `до ${shortDate(value.endDate!)}${value.endTime ? ` ${value.endTime}` : ''}` : value.endTime ? `до ${value.endTime}` : 'Конец',
      filled: multi || !!value.endTime,
      mono: true,
      clear: () => set({ endDate: null, endTime: null }),
      hidden: !value.date && !value.time,
    },
    { key: 'repeat', label: value.repeat ? repeatLabel(value.repeat, value.date) : 'Повтор', filled: !!value.repeat, clear: () => set({ repeat: null }), hidden: !!parent },
    {
      key: 'who',
      label: value.people?.length ? who.map(name).join(', ') : 'Кто',
      filled: !!value.people?.length,
      clear: () => set({ people: undefined }),
      hidden: members.length < 2,
    },
    {
      key: 'remind',
      label: value.mine || value.shared ? specsSummary(reminderSpecs) : 'Напоминание',
      filled: !!(value.mine || value.shared),
      clear: () => set({ mine: undefined, shared: null }),
      hidden: !value.date,
    },
    { key: 'note', label: value.note?.trim() ? 'Описание' : 'Описание', filled: !!value.note?.trim(), clear: () => set({ note: '' }) },
  ];

  return (
    <View style={{ gap: 12 }}>
      <Field placeholder="Название" value={value.title} onChangeText={(title) => set({ title })} autoFocus={!value.title} />

      {parent ? (
        <T variant="caption" muted numberOfLines={1}>
          В плане «{parent.title}» · {spanLabel(parent)}
        </T>
      ) : null}

      <View style={styles.chips}>
        {chips
          .filter((x) => !x.hidden)
          .map((x) => (
            <AttrChip key={x.key} label={x.label} filled={x.filled} mono={x.mono} active={open === x.key} onPress={() => toggle(x.key)} onClear={x.clear} />
          ))}
      </View>

      {open === 'date' && (
        <DatePanel
          value={value.date}
          onPick={(date) => {
            // Многодневное дело переезжает целиком; правило повтора — вместе с датой
            const len = multi ? dayDiff(value.date!, value.endDate!) : 0;
            set({ date, repeat: shiftRepeat(value.repeat, value.date, date), endDate: len ? addIso(date, len) : value.endDate && value.endDate > date ? value.endDate : null });
          }}
          onDone={() => setOpen(null)}
          onClear={() => {
            set({ date: null, repeat: null, endDate: null });
            setOpen(null);
          }}
        />
      )}
      {open === 'time' && (
        <TimePanel
          value={value.time}
          onPick={(time, done) => {
            // Конец не может оказаться раньше начала: длительность сохраняется
            const end = !multi && value.endTime && value.time ? shiftEnd(value.time, value.endTime, time) : value.endTime;
            set({ time, date: value.date ?? (parent?.date ?? null), endTime: end ?? null });
            if (done) setOpen(null);
          }}
        />
      )}
      {open === 'end' && <EndPanel value={value} set={set} />}
      {open === 'repeat' && (
        <RepeatPanel
          value={value.repeat ?? null}
          start={value.date ?? toISODate(new Date())}
          onChange={(repeat) => set({ repeat, ...(repeat && !value.date && { date: toISODate(new Date()) }) })}
        />
      )}
      {open === 'who' && (
        <View style={styles.chips}>
          {members.map((id) => {
            const on = who.includes(id);
            return (
              <Chip
                key={id}
                label={name(id)}
                selected={on}
                onPress={() => {
                  const next = on ? who.filter((x) => x !== id) : [...who, id];
                  // Хотя бы один человек занят всегда
                  if (next.length) set({ people: next });
                }}
              />
            );
          })}
        </View>
      )}
      {open === 'remind' && <RemindersBlock value={value} set={set} />}
      {(open === 'note' || !!value.note?.trim()) && (
        <Field
          placeholder="Описание"
          value={value.note ?? ''}
          onChangeText={(note) => set({ note })}
          autoFocus={open === 'note' && !value.note}
          multiline
          textAlignVertical="top"
          style={{ height: undefined, minHeight: 72, paddingTop: 12, paddingBottom: 12 }}
        />
      )}

      {conflicts.length || outside ? (
        <View style={{ gap: 2 }}>
          {conflicts.map((t) => {
            const busy = peopleOf(t).filter((p) => who.includes(p));
            const u = users.find((x) => x.id === busy[0]);
            const verb = busy.length > 1 ? 'заняты' : u?.gender === 'f' ? 'занята' : u?.gender === 'm' ? 'занят' : 'занят(а)';
            return (
              <T key={`${t.id}@${t.occ ?? ''}`} variant="caption" danger numberOfLines={1}>
                {busy.map(name).join(', ')} {verb}: {t.title} {timeOn(t, value.date!) || spanLabel(t)}
              </T>
            );
          })}
          {outside ? (
            <T variant="caption" danger>
              Вне дат плана ({spanLabel(parent!)})
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const addIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Начало сдвинули — конец едет на столько же, чтобы длительность не менялась */
function shiftEnd(oldStart: string, oldEnd: string, newStart: string): string | null {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const e = m(oldEnd) - m(oldStart) + m(newStart);
  if (e >= 24 * 60) return null;
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
}

/**
 * Конец дела: время окончания (колесо) и, если надо, другой день — тогда дело многодневное.
 * Без времени начала конец — только дата (поездка на несколько дней).
 */
function EndPanel({ value, set }: { value: TaskDraft; set: (p: Partial<TaskDraft>) => void }) {
  const multi = !!value.endDate && !!value.date && value.endDate > value.date;
  const [pickDay, setPickDay] = useState(!value.time);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.chips}>
        {value.time ? <Chip label="В тот же день" selected={!multi && !pickDay} onPress={() => { set({ endDate: null }); setPickDay(false); }} /> : null}
        <Chip label={multi ? shortDate(value.endDate!) : 'Другой день'} selected={multi || pickDay} onPress={() => setPickDay(true)} />
      </View>
      {pickDay && value.date ? (
        <DatePanel
          value={value.endDate ?? null}
          onPick={(endDate) => {
            if (endDate > value.date!) set({ endDate });
            else set({ endDate: null });
            if (value.time) setPickDay(false);
          }}
        />
      ) : null}
      {value.time && !pickDay ? (
        <TimePanel
          value={value.endTime ?? plusHour(value.time)}
          // Конец раньше начала в тот же день — это ночь следующего дня
          onPick={(endTime) => set({ endTime, endDate: !multi && value.date && endTime < value.time! ? addIso(value.date, 1) : multi ? value.endDate : null })}
        />
      ) : null}
    </View>
  );
}

/** Чип свойства дела: пустой — «+ Повтор», заполненный — значение и крестик */
function AttrChip({
  label,
  filled,
  mono,
  active,
  onPress,
  onClear,
}: {
  label: string;
  filled: boolean;
  mono?: boolean;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.attr,
        { borderColor: active ? c.text : c.border, borderStyle: filled ? 'solid' : 'dashed', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <T variant="caption" mono={filled && mono} muted={!filled} numberOfLines={1} style={{ flexShrink: 1 }}>
        {filled ? label : `+ ${label}`}
      </T>
      {filled && onClear ? (
        <Pressable onPress={onClear} hitSlop={10}>
          <X size={14} strokeWidth={ICON.stroke} color={c.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/**
 * Напоминания дела. «Мне» — личные (видны и срабатывают только у меня),
 * «Всем» — общие для группы (у каждого, кто не настроил свои).
 */
function RemindersBlock({ value, set }: { value: TaskDraft; set: (p: Partial<TaskDraft>) => void }) {
  const settings = useStore((s) => s.reminders);
  const [scope, setScope] = useState<'me' | 'all'>(value.mine ? 'me' : value.shared ? 'all' : 'me');
  if (!value.date) return null;
  const task = { time: value.time, reminders: value.shared ?? null };
  const specs =
    scope === 'me' ? effectiveSpecs(task, value.mine, settings).specs : (value.shared ?? (value.time ? settings.timed : settings.allDay));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }} />
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attr: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
});
