/**
 * Диктовка текста отзыва: первое нажатие — запись, второе — стоп и распознавание (POST /feedback/voice).
 * onText получает распознанный текст. Ушли с экрана посреди записи — микрофон останавливается.
 * У освобождённого рекордера свойства читать нельзя (из-за этого падало при уходе) — запись помечается своим флагом.
 */
import { AudioModule, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { RECORD_OPTIONS } from '@/components/VoiceRecorder';
import { transcribeFeedback } from '@/lib/api';
import type { DictateState } from '@/screens/account/FeedbackScreen';

export function useDictation(onText: (text: string) => void, onError: (problem: string | null) => void) {
  const rec = useAudioRecorder(RECORD_OPTIONS);
  const [state, setState] = useState<DictateState>('idle');
  const recording = useRef(false);
  const mounted = useRef(true);
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!recording.current) return;
      recording.current = false;
      try {
        rec.stop().catch(() => {});
      } catch {
        /* рекордер уже освобождён */
      }
    };
  }, [rec]);

  const toggle = useCallback(async () => {
    cb.current.onError(null);
    if (state === 'idle') {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return cb.current.onError('Нет доступа к микрофону — разрешите его в настройках телефона');
        Keyboard.dismiss();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await rec.prepareToRecordAsync();
        rec.record();
        recording.current = true;
        setState('recording');
      } catch {
        cb.current.onError('Микрофон не включился');
      }
      return;
    }
    if (state !== 'recording') return;
    setState('working');
    let uri: string | null = null;
    try {
      recording.current = false;
      await rec.stop();
      uri = rec.uri ?? null;
    } catch {
      uri = null;
    }
    if (!mounted.current) return;
    if (!uri) {
      setState('idle');
      return cb.current.onError('Запись не получилась');
    }
    const r = await transcribeFeedback(uri);
    if (!mounted.current) return;
    setState('idle');
    if ('problem' in r) return cb.current.onError(r.problem);
    if (!r.text) return cb.current.onError('Не расслышал — попробуйте ещё раз');
    cb.current.onText(r.text);
  }, [state, rec]);

  return { state, toggle };
}

/** Распознанное — в конец уже написанного */
export const appendText = (cur: string, add: string) => (cur.trim() ? `${cur.trimEnd()} ${add}` : add);
