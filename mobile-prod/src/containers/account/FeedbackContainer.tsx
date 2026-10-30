import { AudioModule, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { RECORD_OPTIONS } from '@/components/VoiceRecorder';
import { sendFeedback, transcribeFeedback, type FeedbackKind } from '@/lib/api';
import { useStore } from '@/lib/store';
import { FeedbackScreen, type DictateState } from '@/screens/account/FeedbackScreen';
import { useInsets } from '../common';

/** К отзыву прикладывается устройство и версия: «android 34 · 0.1.0 (12)» */
const DEVICE = (() => {
  const cfg = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${Platform.OS} ${String(Platform.Version)} · ${cfg?.version ?? '0'} (${build ?? '0'})${Constants.deviceName ? ` · ${Constants.deviceName}` : ''}`.slice(0, 200);
})();

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

/** Отзыв из настроек: ошибка или предложение, текстом или голосом — уходит на сервер (и письмом разработчикам) */
export function FeedbackContainer() {
  const insets = useInsets();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useAudioRecorder(RECORD_OPTIONS);
  const [dictate, setDictate] = useState<DictateState>('idle');

  // Ушли с экрана посреди записи — остановить микрофон
  useEffect(
    () => () => {
      if (rec.isRecording) rec.stop().catch(() => {});
    },
    [rec],
  );

  /** Первое нажатие — запись, второе — стоп и распознавание; текст дописывается в поле */
  const onDictate = useCallback(async () => {
    setError(null);
    if (dictate === 'idle') {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return setError('Нет доступа к микрофону — разрешите его в настройках телефона');
        Keyboard.dismiss();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await rec.prepareToRecordAsync();
        rec.record();
        setDictate('recording');
      } catch {
        setError('Микрофон не включился');
      }
      return;
    }
    if (dictate !== 'recording') return;
    setDictate('working');
    let uri: string | null = null;
    try {
      await rec.stop();
      uri = rec.uri ?? null;
    } catch {
      uri = null;
    }
    if (!uri) {
      setDictate('idle');
      return setError('Запись не получилась');
    }
    const r = await transcribeFeedback(uri);
    setDictate('idle');
    if ('problem' in r) return setError(r.problem);
    if (!r.text) return setError('Не расслышал — попробуйте ещё раз');
    setText((cur) => (cur.trim() ? `${cur.trimEnd()} ${r.text}` : r.text));
  }, [dictate, rec]);

  const onSend = useCallback(async () => {
    if (!text.trim() || busy || dictate !== 'idle') return;
    setBusy(true);
    setError(null);
    const problem = await sendFeedback(kind, text.trim(), DEVICE);
    setBusy(false);
    if (problem) return setError(problem);
    useStore.getState().notice('Спасибо, отправлено');
    back();
  }, [kind, text, busy, dictate]);

  return (
    <FeedbackScreen
      kind={kind}
      text={text}
      error={error}
      busy={busy}
      dictate={dictate}
      insets={insets}
      onBack={back}
      onChangeKind={setKind}
      onChangeText={setText}
      onDictate={onDictate}
      onCancel={back}
      onSend={onSend}
    />
  );
}
