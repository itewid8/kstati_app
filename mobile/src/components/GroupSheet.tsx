import { router } from 'expo-router';
import { Check, ChevronRight } from '@/components/icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCurrentGroup, useStore } from '@/lib/store';
import { ICON, space, useColors } from '@/theme';
import { Sheet } from './Sheet';
import { Button, Chip, Divider, Field, ListRow, T } from './ui';
import { CATEGORIES, CATEGORY_LABEL, type GroupCategory } from '@/lib/types';

type Mode = 'list' | 'create' | 'join' | 'rename';

export function GroupSheet() {
  const visible = useStore((s) => s.groupSheet);
  const setGroupSheet = useStore((s) => s.setGroupSheet);
  return (
    <Sheet visible={visible} onClose={() => setGroupSheet(false)}>
      {visible && <GroupPanel onDone={() => setGroupSheet(false)} />}
    </Sheet>
  );
}

/** Используется и в шторке, и на экране первой группы */
export function GroupPanel({ onDone, initial = 'list' }: { onDone: () => void; initial?: Mode }) {
  const c = useColors();
  const groups = useStore((s) => s.groups);
  const users = useStore((s) => s.users);
  const current = useCurrentGroup();
  const { selectGroup, createGroup, joinGroup, renameGroup } = useStore.getState();
  const [mode, setMode] = useState<Mode>(initial);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<GroupCategory>('other');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setText(m === 'rename' ? (current?.name ?? '') : '');
    setError('');
  };

  if (mode !== 'list') {
    const cfg = {
      create: { title: 'Новая группа', ph: 'Название', btn: 'Создать' },
      join: { title: 'Вступить по коду', ph: 'Код из 6 символов', btn: 'Вступить' },
      rename: { title: 'Переименовать', ph: 'Название', btn: 'Сохранить' },
    }[mode];
    const submit = async () => {
      const v = text.trim();
      if (!v || busy) return;
      if (mode === 'create') createGroup(v, cat);
      if (mode === 'rename' && current) renameGroup(current.id, v);
      if (mode === 'join') {
        // Вступление проверяет сервер — нужен интернет
        setBusy(true);
        const err = await joinGroup(v);
        setBusy(false);
        if (err) return setError(err);
      }
      onDone();
    };
    return (
      <View style={[styles.pad, { gap: 16, paddingVertical: 8 }]}>
        <T weight="semibold">{cfg.title}</T>
        <Field
          placeholder={cfg.ph}
          value={text}
          onChangeText={(t) => {
            setText(mode === 'join' ? t.toUpperCase() : t);
            setError('');
          }}
          autoFocus
          autoCapitalize={mode === 'join' ? 'characters' : 'sentences'}
          maxLength={mode === 'join' ? 6 : 40}
          onSubmitEditing={submit}
          style={mode === 'join' ? { letterSpacing: 4 } : undefined}
        />
        {mode === 'create' && (
          <View style={{ gap: 8 }}>
            <T variant="label" muted>
              Кто в группе
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((k) => (
                <Chip key={k} label={CATEGORY_LABEL[k]} selected={cat === k} onPress={() => setCat(k)} />
              ))}
            </View>
          </View>
        )}
        {error ? (
          <T variant="caption" danger>
            {error}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
          <Button kind="text" title="Назад" onPress={() => (initial === 'list' ? go('list') : onDone())} />
          <Button title={cfg.btn} onPress={submit} disabled={!text.trim()} />
        </View>
      </View>
    );
  }

  return (
    <View>
      {groups.map((g) => {
        const active = g.id === current?.id;
        const members = g.memberIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean).join(', ');
        return (
          <Pressable
            key={g.id}
            onPress={() => {
              selectGroup(g.id);
              onDone();
            }}
            style={({ pressed }) => [styles.group, { backgroundColor: pressed ? c.background : 'transparent' }]}
          >
            <View style={{ flex: 1 }}>
              <T weight={active ? 'medium' : 'regular'}>{g.name}</T>
              <T variant="caption" muted numberOfLines={1}>
                {members}
              </T>
            </View>
            {active && <Check size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />}
          </Pressable>
        );
      })}
      {groups.length > 0 && <Divider />}
      {current && (
        <ListRow
          label="Настройки группы"
          value={current.name}
          onPress={() => {
            onDone();
            router.push('/group');
          }}
          right={<ChevronRight size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />}
        />
      )}
      <ListRow label="Создать группу" onPress={() => go('create')} />
      <ListRow label="Вступить по коду" onPress={() => go('join')} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.side },
  group: {
    minHeight: 56,
    paddingHorizontal: space.side,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
