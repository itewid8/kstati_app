/**
 * «Поделиться → Кстати»: одна заметка (s.noteInbox) — шторка. Название (можно поправить), текст строками так, как
 * он станет заметкой (чек-лист — квадратиками), тема: четыре недавние, «ЕЩЁ…» и «+ НОВАЯ»; под темами — кому видно.
 * СОХРАНИТЬ — заметка в «Кстати» и «ВЕРНУТЬ» внизу. Несколько заметок — экран «Перенести заметки».
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { noteText } from '@/lib/noteImport';
import { parseNote } from '@/lib/note';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { Icon, fonts, size as S, useInputColors, useTheme } from '@/ui';
import { openMenu } from './ActionMenu';
import { Sheet } from './Sheet';

const close = () => useStore.getState().setNoteInbox(null);
const PREVIEW_LINES = 8;
const NONE = '';

/** Мои темы: последняя выбранная первой, дальше — где недавно были заметки */
export function useMyTopics() {
  const st = useStore(useShallow((s) => ({ topics: s.topics, ideas: s.ideas, meId: s.me?.id, last: s.noteTopicLast, groups: s.groups })));
  return useMemo(() => {
    const recent = new Map<ID, string>();
    for (const i of st.ideas) if (i.topicId && (recent.get(i.topicId) ?? '') < i.createdAt) recent.set(i.topicId, i.createdAt);
    const mine = st.topics
      .filter((t) => t.ownerId === st.meId && !t.archivedAt)
      .sort((a, b) => (a.id === st.last ? -1 : b.id === st.last ? 1 : (recent.get(b.id) ?? b.createdAt).localeCompare(recent.get(a.id) ?? a.createdAt)));
    const seenBy = (id: ID | null) => {
      const t = id ? st.topics.find((x) => x.id === id) : null;
      const names = (t?.groupIds ?? []).map((g) => st.groups.find((x) => x.id === g)?.name).filter(Boolean) as string[];
      return names.length ? names.join(', ').toUpperCase() : 'ТОЛЬКО МНЕ';
    };
    return { mine, last: st.last, seenBy };
  }, [st]);
}

export function NoteShareSheet() {
  const { c } = useTheme();
  const ic = useInputColors();
  const inbox = useStore((s) => s.noteInbox);
  const note = inbox && inbox.notes.length === 1 ? inbox.notes[0] : null;
  const { mine, last, seenBy } = useMyTopics();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState<string>(NONE);
  const [newName, setNewName] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setNewName(null);
    setTopic(last && mine.some((t) => t.id === last) ? last : NONE);
    // Только при новой заметке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);
  const lines = useMemo(() => (note ? parseNote(note.body).filter((b) => b.text.trim()) : []), [note]);
  if (!inbox || !note) return null;

  const shown = mine.slice(0, 4);
  const extra = mine.length > 4 && !shown.some((t) => t.id === topic) ? mine.find((t) => t.id === topic) : undefined;
  const chips = extra ? [...shown, extra] : shown;
  const save = () => {
    const name = newName?.trim();
    const target = name ? { title: name } : topic ? { id: topic } : null;
    useStore.getState().importNotes([{ text: noteText({ title, body: note.body }), topic: target }]);
    if (!name) useStore.setState({ noteTopicLast: topic || null });
    close();
  };
  const pickMore = () =>
    openMenu({
      title: 'Тема',
      actions: mine.map((t) => ({ label: t.title, onPress: () => (setNewName(null), setTopic(t.id)) })),
    });
  const chip = (key: string, label: string, on: boolean, onPress: () => void, dashed?: boolean) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { borderColor: c.border, backgroundColor: on ? c.text : dashed ? 'transparent' : c.panel }, dashed && styles.dashed]}
    >
      <Text numberOfLines={1} style={[on ? styles.chipOn : styles.chipText, { color: on ? c.bg : c.text }]}>
        {label}
      </Text>
    </Pressable>
  );
  const footer = (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" onPress={close} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Text style={[styles.buttonText, { color: c.text }]}>ОТМЕНА</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={save} style={[styles.button, styles.main, { borderColor: c.text, backgroundColor: c.text }]}>
        <Text style={[styles.buttonText, { color: c.bg }]}>СОХРАНИТЬ</Text>
      </Pressable>
    </View>
  );

  return (
    <Sheet visible onClose={close} footer={footer} inset>
      <View style={styles.gap4}>
        <Text style={[styles.cap, { color: c.muted }]}>{`НОВАЯ ЗАМЕТКА · ИЗ ${inbox.from ?? 'ДРУГОГО ПРИЛОЖЕНИЯ'}`}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Название"
          placeholderTextColor={c.muted}
          maxLength={200}
          selectionColor={ic.selectionColor}
          cursorColor={ic.cursorColor}
          underlineColorAndroid="transparent"
          style={[styles.title, { color: c.text, borderColor: c.border, backgroundColor: c.panel }]}
        />
      </View>

      {lines.length ? (
        <View style={[styles.box, styles.preview, { borderColor: c.border, backgroundColor: c.panel }]}>
          {lines.slice(0, PREVIEW_LINES).map((b, i) => (
            <View key={i} style={styles.line}>
              {b.kind === 'check' ? (
                <View style={[styles.square, { borderColor: c.text, backgroundColor: b.checked ? c.text : 'transparent' }]}>
                  {b.checked ? <Icon name="check" size={9} color={c.bg} /> : null}
                </View>
              ) : null}
              <Text numberOfLines={2} style={[b.kind === 'heading' ? styles.lineHead : styles.lineText, { color: c.text }, b.checked && styles.done]}>
                {b.text}
              </Text>
            </View>
          ))}
          {lines.length > PREVIEW_LINES ? (
            <Text style={[styles.cap, { color: c.muted }]}>{`+ ЕЩЁ ${lines.length - PREVIEW_LINES}`}</Text>
          ) : null}
        </View>
      ) : null}
      {inbox.skipped ? <Text style={[styles.cap, { color: c.muted }]}>{`КАРТИНКИ И ФАЙЛЫ НЕ ПЕРЕНОСЯТСЯ · ${inbox.skipped}`}</Text> : null}

      <View style={styles.gap6}>
        <Text style={[styles.cap, { color: c.muted }]}>ТЕМА</Text>
        <View style={styles.chips}>
          {chip(NONE, 'БЕЗ ТЕМЫ', !newName && topic === NONE, () => (setNewName(null), setTopic(NONE)))}
          {chips.map((t) => chip(t.id, t.title.toUpperCase(), !newName && topic === t.id, () => (setNewName(null), setTopic(t.id))))}
          {mine.length > 4 ? chip('more', 'ЕЩЁ…', false, pickMore) : null}
          {chip('new', '+ НОВАЯ', newName !== null, () => setNewName(newName === null ? '' : null), true)}
        </View>
        {newName !== null ? (
          <TextInput
            autoFocus
            value={newName}
            onChangeText={setNewName}
            placeholder="Название темы"
            placeholderTextColor={c.muted}
            maxLength={200}
            selectionColor={ic.selectionColor}
            cursorColor={ic.cursorColor}
            underlineColorAndroid="transparent"
            style={[styles.topicInput, { color: c.text, borderColor: c.border, backgroundColor: c.panel }]}
          />
        ) : null}
        <Text style={[styles.cap, { color: c.muted }]}>{`ВИДНО: ${newName !== null ? 'ТОЛЬКО МНЕ' : seenBy(topic || null)}`}</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  cap: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  title: { height: 44, borderWidth: S.border, paddingHorizontal: 10, fontFamily: fonts.sans700, fontSize: 18, letterSpacing: -0.5 },
  box: { borderWidth: S.border },
  preview: { paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  square: { width: 14, height: 14, marginTop: 3, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1, fontFamily: fonts.sans400, fontSize: 14, lineHeight: 20 },
  lineHead: { flex: 1, fontFamily: fonts.sans700, fontSize: 15, lineHeight: 20 },
  done: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, maxWidth: 200, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  dashed: { borderStyle: 'dashed' },
  chipText: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.6 },
  chipOn: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.6 },
  topicInput: { height: 40, borderWidth: S.border, paddingHorizontal: 10, fontFamily: fonts.sans500, fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  button: { flex: 1, height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1.6 },
  buttonText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
});
