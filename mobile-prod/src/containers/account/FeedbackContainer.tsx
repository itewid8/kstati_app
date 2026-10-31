import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { sendFeedback, type FeedbackKind } from '@/lib/api';
import { useStore } from '@/lib/store';
import { FeedbackScreen } from '@/screens/account/FeedbackScreen';
import { useInsets } from '../common';
import { appendText, useDictation } from './useDictation';

/** К отзыву прикладывается устройство и версия: «android 34 · 0.1.0 (12)» */
export const DEVICE = (() => {
  const cfg = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${Platform.OS} ${String(Platform.Version)} · ${cfg?.version ?? '0'} (${build ?? '0'})${Constants.deviceName ? ` · ${Constants.deviceName}` : ''}`.slice(0, 200);
})();

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

/** Отзыв из настроек: ошибка или предложение, текстом или голосом — уходит на сервер (задачей в GitHub и письмом) */
export function FeedbackContainer() {
  const insets = useInsets();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const dictation = useDictation((t) => setText((cur) => appendText(cur, t)), setError);

  const onSend = useCallback(async () => {
    if (!text.trim() || busy || dictation.state !== 'idle') return;
    setBusy(true);
    setError(null);
    const problem = await sendFeedback(kind, text.trim(), DEVICE);
    if (!mounted.current) return;
    setBusy(false);
    if (problem) return setError(problem);
    Keyboard.dismiss();
    useStore.getState().notice('Спасибо, отправлено');
    back();
  }, [kind, text, busy, dictation.state]);

  return (
    <FeedbackScreen
      kind={kind}
      text={text}
      error={error}
      busy={busy}
      dictate={dictation.state}
      insets={insets}
      onBack={back}
      onChangeKind={setKind}
      onChangeText={setText}
      onDictate={dictation.toggle}
      onCancel={back}
      onSend={onSend}
    />
  );
}
