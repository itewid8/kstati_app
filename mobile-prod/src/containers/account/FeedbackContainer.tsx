import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { sendFeedback, type FeedbackKind } from '@/lib/api';
import { useStore } from '@/lib/store';
import { FeedbackScreen } from '@/screens/account/FeedbackScreen';
import { useInsets } from '../common';

/** К отзыву прикладывается устройство и версия: «android 34 · 0.1.0 (12)» */
const DEVICE = (() => {
  const cfg = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${Platform.OS} ${String(Platform.Version)} · ${cfg?.version ?? '0'} (${build ?? '0'})${Constants.deviceName ? ` · ${Constants.deviceName}` : ''}`.slice(0, 200);
})();

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

/** Отзыв из настроек: ошибка или предложение уходит на сервер (и письмом разработчикам) */
export function FeedbackContainer() {
  const insets = useInsets();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSend = useCallback(async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const problem = await sendFeedback(kind, text.trim(), DEVICE);
    setBusy(false);
    if (problem) return setError(problem);
    useStore.getState().notice('Спасибо, отправлено');
    back();
  }, [kind, text, busy]);

  return (
    <FeedbackScreen
      kind={kind}
      text={text}
      error={error}
      busy={busy}
      insets={insets}
      onBack={back}
      onChangeKind={setKind}
      onChangeText={setText}
      onCancel={back}
      onSend={onSend}
    />
  );
}
