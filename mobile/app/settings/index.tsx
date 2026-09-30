import { router } from 'expo-router';
import { ChevronRight } from '@/components/icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { Button, Chip, Divider, Field, ListRow, SectionLabel, T } from '@/components/ui';
import { useStore, type NickStatus } from '@/lib/store';
import type { Gender } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const GENDERS: { key: Gender | null; label: string }[] = [
  { key: 'm', label: 'Мужской' },
  { key: 'f', label: 'Женский' },
  { key: null, label: 'Не указывать' },
];
const GENDER_LABEL = (g?: Gender) => (g === 'm' ? 'мужской' : g === 'f' ? 'женский' : 'не указан');

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const { saveProfile, checkNick, logout, deleteAccount } = useStore.getState();

  // Профиль редактируется только после «Редактировать»; ник проверяется, только если его изменили
  const [editing, setEditing] = useState(false);
  const [name, setLocalName] = useState(me?.name ?? '');
  const [nick, setLocalNick] = useState(me?.nick ?? '');
  const [gender, setGender] = useState<Gender | null>(me?.gender ?? null);
  const [status, setStatus] = useState<NickStatus | 'checking' | 'empty'>('same');
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const nickChanged = nick.toLowerCase() !== (me?.nick ?? '').toLowerCase();

  useEffect(() => {
    if (!editing) return;
    if (!nickChanged) return setStatus('same');
    if (!nick) return setStatus('empty');
    const id = ++reqId.current;
    setStatus('checking');
    const t = setTimeout(async () => {
      const res = await checkNick(nick);
      if (id === reqId.current) setStatus(res);
    }, 400);
    return () => clearTimeout(t);
  }, [nick, nickChanged, editing, checkNick]);

  const startEdit = () => {
    setLocalName(me?.name ?? '');
    setLocalNick(me?.nick ?? '');
    setGender(me?.gender ?? null);
    setStatus('same');
    setError(null);
    setEditing(true);
  };

  const canSave = !!name.trim() && (status === 'same' || status === 'free' || status === 'empty');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const err = await saveProfile({ name, nick, gender });
    setSaving(false);
    if (err) return setError(err);
    setEditing(false);
  };

  const nickHint: { text: string; tone: 'muted' | 'danger' | 'ok' } | null =
    status === 'invalid'
      ? { text: 'От 3 до 20 символов: буквы, цифры, «_» и «.»', tone: 'danger' }
      : status === 'taken'
        ? { text: 'Этот никнейм занят', tone: 'danger' }
        : status === 'checking'
          ? { text: 'Проверяю…', tone: 'muted' }
          : status === 'free'
            ? { text: 'Свободен', tone: 'ok' }
            : null;

  const chevron = <ChevronRight size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Настройки" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionHead}>
          <T variant="caption" muted>
            Профиль
          </T>
          {!editing && <Button kind="text" title="Редактировать" onPress={startEdit} style={{ height: 32 }} />}
        </View>

        {!editing ? (
          <>
            <Divider />
            <ListRow label="Имя" value={me?.name} />
            <Divider inset={space.side} />
            <ListRow label="Никнейм" value={me?.nick ? `@${me.nick}` : 'не задан'} />
            <Divider inset={space.side} />
            <ListRow label="Пол" value={GENDER_LABEL(me?.gender)} />
            {me?.email ? (
              <>
                <Divider inset={space.side} />
                <ListRow label="Почта" value={me.email} />
              </>
            ) : null}
            {me?.vk ? (
              <>
                <Divider inset={space.side} />
                <ListRow label="VK ID" value="привязан" />
              </>
            ) : null}
            <Divider />
          </>
        ) : (
          <View style={{ paddingHorizontal: space.side, gap: 14 }}>
            <Field label="Имя" value={name} onChangeText={setLocalName} maxLength={40} returnKeyType="done" />
            <View style={{ gap: 6 }}>
              <T variant="label" muted>
                Никнейм
              </T>
              <View>
                <Field
                  value={nick}
                  onChangeText={(t) => setLocalNick(t.replace(/\s/g, '').replace(/^@/, ''))}
                  placeholder="например, sasha или саша_92"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  returnKeyType="done"
                  style={{ paddingLeft: 30 }}
                />
                <T muted style={{ position: 'absolute', left: 13, top: 12 }}>
                  @
                </T>
              </View>
              {nickHint ? (
                <T variant="caption" danger={nickHint.tone === 'danger'} muted={nickHint.tone === 'muted'} color={nickHint.tone === 'ok' ? c.success : undefined}>
                  {nickHint.text}
                </T>
              ) : null}
            </View>
            <View style={{ gap: 6 }}>
              <T variant="label" muted>
                Пол
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {GENDERS.map((g) => (
                  <Chip key={g.label} label={g.label} selected={gender === g.key} onPress={() => setGender(g.key)} />
                ))}
              </View>
            </View>
            {error ? (
              <T variant="caption" danger>
                {error}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              <Button kind="text" title="Отмена" onPress={() => setEditing(false)} />
              <Button title={saving ? '…' : 'Сохранить'} onPress={save} disabled={!canSave || saving} />
            </View>
          </View>
        )}

        <SectionLabel> </SectionLabel>
        <Divider />
        <ListRow label="Приложение" value="тема, микрофон, напоминания" onPress={() => router.push('/settings/app')} right={chevron} />
        <Divider />

        <SectionLabel> </SectionLabel>
        <Divider />
        <ListRow
          label="Выйти"
          onPress={() => {
            logout();
            router.replace('/login');
          }}
        />
        <Divider />
        <ListRow
          label="Удалить аккаунт"
          danger
          onPress={() =>
            Alert.alert('Удалить аккаунт?', 'Удалятся аккаунт, ваши хотелки и всё, что вы добавили в группы. Это нельзя отменить.', [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                  const err = await deleteAccount();
                  if (err) return Alert.alert('Не удалось удалить', err);
                  router.replace('/login');
                },
              },
            ])
          }
        />
        <Divider />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.side,
    paddingRight: space.side - 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
});
