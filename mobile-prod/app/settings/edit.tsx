import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { PasswordMeter } from '@/components/PasswordMeter';
import { Button, Chip, Field, T } from '@/components/ui';
import { param, type ProfileField } from '@/containers/common/nav';
import { errorText, request } from '@/lib/net';
import { passwordStrength } from '@/lib/password';
import { DEMO, useStore, type NickStatus } from '@/lib/store';
import type { Gender } from '@/lib/types';
import { space, useColors } from '@/theme';

const GENDERS: { key: Gender | null; label: string }[] = [
  { key: 'm', label: 'Мужской' },
  { key: 'f', label: 'Женский' },
  { key: null, label: 'Не указывать' },
];

const FIELDS: readonly ProfileField[] = ['name', 'nick', 'gender', 'password'];
const fieldOf = (v: string | undefined): ProfileField => FIELDS.find((f) => f === v) ?? 'name';

const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings'));

/**
 * Старая форма профиля (макета нет): имя, ник, пол — одна форма, ?field= — какое поле в фокусе;
 * ?field=password — смена пароля (или первый пароль после входа через VK)
 */
export default function ProfileEdit() {
  const field = fieldOf(param(useLocalSearchParams().field));
  return field === 'password' ? <PasswordForm /> : <ProfileForm field={field} />;
}

function ProfileForm({ field }: { field: Exclude<ProfileField, 'password'> }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const { saveProfile, checkNick } = useStore.getState();

  const [name, setName] = useState(me?.name ?? '');
  const [nick, setNick] = useState(me?.nick ?? '');
  const [gender, setGender] = useState<Gender | null>(me?.gender ?? null);
  const [status, setStatus] = useState<NickStatus | 'checking' | 'empty'>('same');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reqId = useRef(0);

  // Ник проверяется на сервере, только если его изменили
  const nickChanged = nick.toLowerCase() !== (me?.nick ?? '').toLowerCase();
  useEffect(() => {
    if (!nickChanged) return setStatus('same');
    if (!nick) return setStatus('empty');
    const id = ++reqId.current;
    setStatus('checking');
    const t = setTimeout(async () => {
      const res = await checkNick(nick);
      if (id === reqId.current) setStatus(res);
    }, 400);
    return () => clearTimeout(t);
  }, [nick, nickChanged, checkNick]);

  const canSave = !!name.trim() && (status === 'same' || status === 'free' || status === 'empty');
  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const err = await saveProfile({ name, nick, gender });
    setSaving(false);
    if (err) return setError(err);
    back();
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

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Профиль" />
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Field label="Имя" value={name} onChangeText={setName} maxLength={40} returnKeyType="done" autoFocus={field === 'name'} />
        <View style={styles.group}>
          <T variant="label" muted>
            Никнейм
          </T>
          <View>
            <Field
              value={nick}
              onChangeText={(t: string) => setNick(t.replace(/\s/g, '').replace(/^@/, ''))}
              placeholder="например, sasha или саша_92"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              autoFocus={field === 'nick'}
              style={{ paddingLeft: 30 }}
            />
            <T muted style={styles.at}>
              @
            </T>
          </View>
          {nickHint ? (
            <T
              variant="caption"
              danger={nickHint.tone === 'danger'}
              muted={nickHint.tone === 'muted'}
              color={nickHint.tone === 'ok' ? c.success : undefined}
            >
              {nickHint.text}
            </T>
          ) : null}
        </View>
        <View style={styles.group}>
          <T variant="label" muted>
            Пол
          </T>
          <View style={styles.chips}>
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
        <View style={styles.actions}>
          <Button kind="text" title="Отмена" onPress={back} />
          <Button title={saving ? '…' : 'Сохранить'} onPress={save} disabled={!canSave || saving} />
        </View>
      </ScrollView>
    </View>
  );
}

/** Смена пароля: текущий (если он есть), новый от «среднего» по шкале и повтор */
function PasswordForm() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const token = useStore((s) => s.session?.token);
  const hasOld = me?.hasPassword !== false;
  const [old, setOld] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const repeatRef = useRef<TextInput>(null);

  const strength = useMemo(() => passwordStrength(password, [me?.name ?? '', me?.email?.split('@')[0] ?? '']), [password, me?.name, me?.email]);
  const matches = repeat.length > 0 && repeat === password;
  const mismatch = repeat.length > 0 && !password.startsWith(repeat);
  const ready = strength >= 1 && matches && (!hasOld || old.length > 0);

  const save = async () => {
    if (!ready || saving) return;
    if (DEMO) return back();
    setSaving(true);
    setError(null);
    try {
      await request('/me/password', { token, body: { ...(hasOld && { old }), password } });
      setSaving(false);
      useStore.getState().notice('Пароль изменён');
      back();
    } catch (e) {
      setSaving(false);
      setError(errorText(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Пароль" />
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {hasOld ? (
          <Field placeholder="Текущий пароль" value={old} onChangeText={setOld} secureTextEntry autoComplete="current-password" autoFocus />
        ) : null}
        <Field
          placeholder="Новый пароль"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus={!hasOld}
          returnKeyType="next"
          onSubmitEditing={() => repeatRef.current?.focus()}
        />
        {password.length > 0 && <PasswordMeter strength={strength} />}
        <Field
          ref={repeatRef}
          placeholder="Повторите пароль"
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          style={mismatch ? { borderColor: c.danger } : matches ? { borderColor: c.success } : null}
          onSubmitEditing={save}
        />
        {mismatch ? (
          <T variant="label" color={c.danger}>
            Пароли не совпадают
          </T>
        ) : null}
        {error ? (
          <T variant="caption" danger>
            {error}
          </T>
        ) : null}
        <View style={styles.actions}>
          <Button kind="text" title="Отмена" onPress={back} />
          <Button title={saving ? '…' : 'Сохранить'} onPress={save} disabled={!ready || saving} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: space.side, paddingTop: 12, gap: 14 },
  group: { gap: 6 },
  at: { position: 'absolute', left: 13, top: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
});
