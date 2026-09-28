import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { X } from '@/components/icons';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { API_URL } from '@/lib/config';
import { duplicateOf, repeatsInside } from '@/lib/dupes';
import { plural, type PlansAnswer } from '@/lib/plans';
import { uid } from '@/lib/ids';
import { useStore, type Card } from '@/lib/store';
import { shortDate, taskWhen } from '@/lib/dates';
import { pastEnd, type ChangeDraft, type DraftItem, type ItemType, type Task } from '@/lib/types';
import { track } from '@/lib/analytics';
import { handleTranscript, startRecording, TAB_FOR } from '@/lib/voice';
import { font, ICON, size, space, useColors } from '@/theme';
import { ItemEditor, ItemPreview } from './editors';
import { Sheet } from './Sheet';
import { Button, Checkbox, Chip, Divider, T, selectionTint } from './ui';

/** Пустой черновик нужного типа — для «+» и для «Не понял → добавить как…» */
export function emptyDraft(type: ItemType, title = ''): DraftItem {
  if (type === 'task') return { key: uid(), type, data: { title, date: null, time: null } };
  if (type === 'wish') return { key: uid(), type, data: { title, note: '', link: '' } };
  return { key: uid(), type, data: { title, kind: null, genres: [], origin: null, year: null } };
}

/** Карточка подтверждения: голос, ручное добавление и правка */
export function CardSheet() {
  const card = useStore((s) => s.card);
  const setCard = useStore((s) => s.setCard);
  // Держим последнее содержимое, чтобы шторка не «пустела» во время закрытия
  const [shown, setShown] = useState<Card | null>(card);
  useEffect(() => {
    if (card) setShown(card);
  }, [card]);

  const close = () => setCard(null);

  return (
    <Sheet visible={!!card} onClose={close}>
      {shown &&
        ('problem' in shown ? (
          <Problem card={shown} />
        ) : 'changes' in shown ? (
          <Changes card={shown} />
        ) : 'plans' in shown ? (
          <Plans card={shown} />
        ) : (
          <Draft card={shown} />
        ))}
    </Sheet>
  );
}

function Draft({ card }: { card: Extract<Card, { items: DraftItem[] }> }) {
  const c = useColors();
  const setCard = useStore((s) => s.setCard);
  const saveItems = useStore((s) => s.saveItems);
  const tasks = useStore((s) => s.tasks);
  const watch = useStore((s) => s.watch);
  const wishes = useStore((s) => s.wishes);
  const groupId = useStore((s) => s.currentGroupId);
  const meId = useStore((s) => s.me?.id ?? '');
  const users = useStore((s) => s.users);
  const update = (items: DraftItem[]) => setCard({ ...card, items });

  /** Кто создал запись: для новой — вы, для существующей — автор и дата */
  const authorLine = (it: DraftItem) => {
    if (!it.id) return `Автор: ${users.find((u) => u.id === meId)?.name ?? 'вы'} (вы)`;
    const rec =
      it.type === 'task'
        ? (() => { const t = tasks.find((x) => x.id === it.id); return t && { by: t.createdBy, at: t.createdAt }; })()
        : it.type === 'watch'
          ? (() => { const w = watch.find((x) => x.id === it.id); return w && { by: w.addedBy, at: w.createdAt }; })()
          : (() => { const w = wishes.find((x) => x.id === it.id); return w && { by: w.ownerId, at: w.createdAt }; })();
    if (!rec) return null;
    const when = shortDate(rec.at.slice(0, 10));
    if (rec.by === meId) return `Добавили вы · ${when}`;
    const u = users.find((x) => x.id === rec.by);
    return `Добавил${pastEnd(u)} ${u?.name ?? 'участник'} · ${when}`;
  };

  // Проверка на дубликаты: такая запись уже есть или повторяется в этой же карточке
  const inside = repeatsInside(card.items);
  const dupOf = (it: DraftItem) =>
    duplicateOf(it, { tasks, watch, wishes, groupId, meId }) ?? (inside.has(it.key) ? 'Повторяется в этой карточке' : null);
  const blocked = (it: DraftItem) => !!dupOf(it) && !it.force;
  const toSave = card.items.filter((i) => !blocked(i));
  const canSave = toSave.length > 0 && toSave.every((i) => i.data.title.trim());

  const save = () => {
    saveItems(toSave.map((i) => ({ ...i, data: { ...i.data, title: i.data.title.trim() } }) as DraftItem));
    for (const i of toSave) track('save', { type: i.type, source: card.source });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCard(null);
    const first = toSave[0];
    if (first && card.source !== 'edit') router.navigate(TAB_FOR[first.type]);
  };

  return (
    <View>
      {card.source === 'voice' && <TranscriptLine transcript={card.transcript ?? ''} />}

      {card.items.map((item, idx) => {
        const dup = dupOf(item);
        const set = (patch: Partial<DraftItem>) => update(card.items.map((x) => (x.key === item.key ? ({ ...x, ...patch } as DraftItem) : x)));
        return (
          <View key={item.key}>
            {idx > 0 && <Divider inset={space.side} />}
            <View style={[styles.pad, styles.item]}>
              <View style={{ flex: 1, opacity: dup && !item.force ? 0.5 : 1 }}>
                {card.editing ? (
                  <ItemEditor item={item} onChange={(n) => update(card.items.map((x) => (x.key === n.key ? n : x)))} />
                ) : (
                  <ItemPreview item={item} />
                )}
                {authorLine(item) ? (
                  <T variant="label" muted style={{ marginTop: 8 }}>
                    {authorLine(item)}
                  </T>
                ) : null}
              </View>
              {card.items.length > 1 && (
                <Pressable hitSlop={10} onPress={() => update(card.items.filter((x) => x.key !== item.key))}>
                  <X size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />
                </Pressable>
              )}
            </View>
            {dup ? (
              <View style={[styles.pad, styles.dup]}>
                <T variant="caption" danger={!item.force} muted={!!item.force} style={{ flex: 1 }}>
                  {item.force ? 'Добавится ещё раз' : dup}
                </T>
                <Button
                  kind="text"
                  title={item.force ? 'Не добавлять' : 'Всё равно добавить'}
                  onPress={() => set({ force: !item.force })}
                  style={{ height: 32 }}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.pad, styles.actions]}>
        <Button kind="text" title="Отменить" onPress={() => setCard(null)} />
        <View style={{ flex: 1 }} />
        {!card.editing && <Button kind="text" title="Исправить" onPress={() => setCard({ ...card, editing: true })} />}
        <Button title={toSave.length === 0 ? 'Уже есть' : 'Сохранить'} onPress={save} disabled={!canSave} style={{ marginLeft: 16 }} />
      </View>
    </View>
  );
}

function Problem({ card }: { card: Extract<Card, { problem: string }> }) {
  const setCard = useStore((s) => s.setCard);

  const addAs = (type: ItemType) =>
    setCard({ source: 'manual', items: [emptyDraft(type, capitalize(card.transcript))], editing: true });

  let body: React.ReactNode;
  switch (card.problem) {
    case 'silence':
      body = (
        <>
          <T>Ничего не услышал</T>
          <Row>
            <Button kind="text" title="Закрыть" onPress={() => setCard(null)} />
            <Button title="Ещё раз" onPress={startRecording} />
          </Row>
        </>
      );
      break;
    case 'notUnderstood':
      body = (
        <>
          <T variant="caption" muted numberOfLines={2}>
            {card.transcript}
          </T>
          <T>Не понял. Добавить как…</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Дело" style={{ flex: 1 }} onPress={() => addAs('task')} />
            <Button title="Хотелку" style={{ flex: 1 }} onPress={() => addAs('wish')} />
            <Button title="Фильм" style={{ flex: 1 }} onPress={() => addAs('watch')} />
          </View>
        </>
      );
      break;
    case 'micDenied':
      body = (
        <>
          <T>Нужен доступ к микрофону</T>
          <Row>
            <Button kind="text" title="Закрыть" onPress={() => setCard(null)} />
            <Button title="Открыть настройки" onPress={() => Linking.openSettings().catch(() => {})} />
          </Row>
        </>
      );
      break;
    case 'info':
      body = (
        <>
          <T variant="caption" muted>
            {card.transcript}
          </T>
          <T>{card.query}</T>
          <Row>
            <Button title="Понятно" onPress={() => setCard(null)} />
          </Row>
        </>
      );
      break;
    case 'notFound':
      body = (
        <>
          <T variant="caption" muted>
            {card.transcript}
          </T>
          <T>Не нашёл «{card.query}» в списках</T>
          <Row>
            <Button title="Понятно" onPress={() => setCard(null)} />
          </Row>
        </>
      );
      break;
    case 'unknownPerson':
      body = (
        <>
          <T variant="caption" muted>
            {card.transcript}
          </T>
          <T>Не нашёл {card.person} в ваших группах</T>
          <Row>
            <Button title="Понятно" onPress={() => setCard(null)} />
          </Row>
        </>
      );
      break;
    case 'offline':
      body = (
        <>
          <T>Нет сети. Голосовой ввод недоступен</T>
          <T variant="caption" mono muted>
            {[API_URL, card.detail].filter(Boolean).join('\n')}
          </T>
          <Row>
            <Button kind="text" title="Закрыть" onPress={() => setCard(null)} />
            <Button title="Добавить вручную" onPress={() => setCard({ source: 'manual', items: [emptyDraft('task')], editing: true })} />
          </Row>
        </>
      );
      break;
    default:
      body = (
        <>
          <T>Не получилось. Попробуйте ещё раз</T>
          {card.detail ? (
            <T variant="caption" mono muted>
              {card.detail}
            </T>
          ) : null}
          <Row>
            <Button title="Ещё раз" onPress={startRecording} />
          </Row>
        </>
      );
  }
  return <View style={[styles.pad, { gap: 12, paddingVertical: 8 }]}>{body}</View>;
}

/** Распознанный текст: тап — правка, «Разобрать заново» — повторный разбор без записи */
function TranscriptLine({ transcript }: { transcript: string }) {
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(transcript);
  useEffect(() => {
    setText(transcript);
    setEditing(false);
  }, [transcript]);

  return (
    <>
      <View style={[styles.pad, { paddingBottom: 12 }]}>
        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              selectionColor={selectionTint(c.text)}
              selectionHandleColor={c.text}
              cursorColor={c.text}
              style={{ color: c.text, fontFamily: font.regular, fontSize: size.caption, padding: 0 }}
            />
            {text.trim() !== transcript.trim() && (
              <Button kind="text" title="Разобрать заново" style={{ alignSelf: 'flex-start', height: 32 }} onPress={() => handleTranscript(text.trim())} />
            )}
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <T variant="caption" muted numberOfLines={1}>
              {transcript}
            </T>
          </Pressable>
        )}
      </View>
      <Divider />
    </>
  );
}

/* ---------------- Изменения: перенести / переименовать / отметить / удалить ---------------- */

const MARK_LABEL: Record<ItemType, string> = {
  task: 'Отметить выполненным',
  watch: 'Отметить: посмотрели',
  wish: 'Отметить: подарили',
};

function actionLabel(ch: ChangeDraft): string {
  if (ch.action === 'mark') return MARK_LABEL[ch.type];
  if (ch.action === 'unmark') return 'Снять отметку';
  if (ch.action === 'delete') return 'Удалить';
  return ch.patch?.title !== undefined ? 'Переименовать' : 'Перенести';
}

type Found = { title: string; date: string | null; time: string | null } | null;

function useFind() {
  const tasks = useStore((s) => s.tasks);
  const wishes = useStore((s) => s.wishes);
  const watch = useStore((s) => s.watch);
  return (type: ItemType, id: string): Found => {
    if (type === 'task') {
      const t = tasks.find((x) => x.id === id);
      return t ? { title: t.title, date: t.date, time: t.time } : null;
    }
    const w = (type === 'wish' ? wishes : watch).find((x) => x.id === id);
    return w ? { title: w.title, date: null, time: null } : null;
  };
}

function Changes({ card }: { card: Extract<Card, { changes: ChangeDraft[] }> }) {
  const setCard = useStore((s) => s.setCard);
  const applyChanges = useStore((s) => s.applyChanges);
  const find = useFind();

  const set = (changes: ChangeDraft[]) => setCard({ ...card, changes });
  const onlyDeletes = card.changes.every((ch) => ch.action === 'delete');

  const apply = () => {
    applyChanges(card.changes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCard(null);
    const first = card.changes[0];
    if (first) router.navigate(TAB_FOR[first.type]);
  };

  return (
    <View>
      <TranscriptLine transcript={card.transcript} />
      {card.changes.map((ch, idx) => (
        <View key={ch.key}>
          {idx > 0 && <Divider inset={space.side} />}
          <ChangeView
            ch={ch}
            item={find(ch.type, ch.chosen)}
            find={find}
            onChoose={(id) => set(card.changes.map((x) => (x.key === ch.key ? { ...x, chosen: id } : x)))}
            onRemove={card.changes.length > 1 ? () => set(card.changes.filter((x) => x.key !== ch.key)) : undefined}
          />
        </View>
      ))}
      <View style={[styles.pad, styles.actions]}>
        <Button kind="text" title="Отменить" onPress={() => setCard(null)} />
        <View style={{ flex: 1 }} />
        <Button title={onlyDeletes ? 'Удалить' : 'Применить'} onPress={apply} disabled={card.changes.length === 0} />
      </View>
    </View>
  );
}

function ChangeView({
  ch,
  item,
  find,
  onChoose,
  onRemove,
}: {
  ch: ChangeDraft;
  item: Found;
  find: (type: ItemType, id: string) => Found;
  onChoose: (id: string) => void;
  onRemove?: () => void;
}) {
  const c = useColors();
  if (!item) return null;
  const p = ch.patch ?? {};
  const diffs: { label: string; from: string; to: string; mono?: boolean }[] = [];
  if (p.title !== undefined) diffs.push({ label: 'Название', from: item.title, to: p.title });
  if (p.date !== undefined || p.time !== undefined) {
    const nd = p.date !== undefined ? p.date : item.date;
    const nt = p.time !== undefined ? p.time : item.time;
    diffs.push({ label: 'Когда', from: taskWhen(item.date, item.time) || 'без даты', to: taskWhen(nd, nt) || 'без даты', mono: true });
  }

  return (
    <View style={[styles.pad, styles.item]}>
      <View style={{ flex: 1, gap: 6 }}>
        <T variant="label" muted={ch.action !== 'delete'} danger={ch.action === 'delete'}>
          {actionLabel(ch)}
        </T>
        <T weight="medium">{item.title}</T>
        {ch.type === 'task' && diffs.length === 0 && (item.date || item.time) ? (
          <T variant="caption" mono muted>
            {taskWhen(item.date, item.time)}
          </T>
        ) : null}

        {diffs.map((d) => (
          <View key={d.label} style={styles.diff}>
            <T variant="caption" muted mono={d.mono} style={{ textDecorationLine: 'line-through' }}>
              {d.from}
            </T>
            <T variant="caption" muted>
              →
            </T>
            <T variant="caption" mono={d.mono} weight="medium">
              {d.to}
            </T>
          </View>
        ))}

        {ch.candidates.length > 1 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <T variant="label" muted>
              Какое именно?
            </T>
            <View style={styles.wrap}>
              {ch.candidates.map((id) => {
                const f = find(ch.type, id);
                if (!f) return null;
                const when = f.date ? ` · ${taskWhen(f.date, null)}` : '';
                return <Chip key={id} label={f.title + when} selected={id === ch.chosen} onPress={() => onChoose(id)} />;
              })}
            </View>
          </View>
        )}
      </View>
      {onRemove && (
        <Pressable hitSlop={10} onPress={onRemove}>
          <X size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

/* ---------------- Ответ на вопрос о планах ---------------- */

function Plans({ card }: { card: Extract<Card, { plans: PlansAnswer }> }) {
  const c = useColors();
  const tasks = useStore((s) => s.tasks);
  const { setCard, toggleTask, selectGroup, setCalendarDate, setTasksView } = useStore.getState();
  const a = card.plans;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const sections = a.sections.map((sec) => ({ ...sec, tasks: sec.taskIds.map((id) => byId.get(id)).filter((t): t is Task => !!t) }));
  const open = sections.reduce((n, sec) => n + sec.tasks.filter((t) => !t.doneAt).length, 0);
  const multi = sections.length > 1;

  const openCalendar = () => {
    setCard(null);
    selectGroup(sections.find((x) => x.tasks.length)?.groupId ?? sections[0].groupId);
    setCalendarDate(a.from);
    setTasksView(a.singleDay || a.title.startsWith('Выходные') ? 'week' : 'month');
    router.navigate('/tasks');
  };

  const edit = (t: Task) =>
    setCard({
      source: 'edit',
      editing: true,
      items: [{ key: t.id, id: t.id, type: 'task', data: { title: t.title, date: t.date, time: t.time, note: t.note ?? '' } }],
    });

  return (
    <View>
      <TranscriptLine transcript={card.transcript} />
      <View style={[styles.pad, { paddingTop: 12, gap: 2 }]}>
        <T weight="semibold">{a.title}</T>
        <T variant="caption" muted>
          {a.groupNames.join(' · ')}
          {'  ·  '}
          {open ? `${open} ${plural(open, 'дело', 'дела', 'дел')}` : a.title.startsWith('«') ? 'ничего не нашёл' : 'планов нет'}
        </T>
      </View>

      {sections.map((sec) =>
        sec.tasks.length === 0 && multi ? null : (
          <View key={sec.groupId} style={{ paddingTop: 8 }}>
            {multi && (
              <T variant="label" muted style={[styles.pad, { paddingTop: 8, paddingBottom: 2 }]}>
                {sec.groupName}
              </T>
            )}
            {sec.tasks.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider inset={space.side + 36} />}
                <Pressable onPress={() => edit(t)} style={({ pressed }) => [styles.planRow, { backgroundColor: pressed ? c.background : 'transparent' }]}>
                  <Checkbox checked={!!t.doneAt} onPress={() => toggleTask(t.id)} />
                  <T numberOfLines={2} muted={!!t.doneAt} style={[{ flex: 1 }, t.doneAt ? { textDecorationLine: 'line-through' } : null]}>
                    {t.title}
                  </T>
                  <T variant="caption" mono muted>
                    {a.singleDay ? (t.time ?? 'весь день') : t.date ? taskWhen(t.date, t.time) : 'без даты'}
                  </T>
                </Pressable>
              </View>
            ))}
          </View>
        ),
      )}

      <View style={[styles.pad, styles.actions]}>
        <Button kind="text" title="Закрыть" onPress={() => setCard(null)} />
        <View style={{ flex: 1 }} />
        <Button kind="text" title="Открыть в календаре" onPress={openCalendar} />
      </View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>{children}</View>;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.side },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: space.side, paddingVertical: 6 },
  dup: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, paddingBottom: 8 },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
