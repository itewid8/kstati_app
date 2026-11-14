import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { practiceAttempt, practiceConsent, practiceMark, practiceNext, type PracticeProgress } from '@/lib/api';
import { abortDeviceSpeech, deviceSpeechAvailable, speechExtras, startDeviceSpeech, stopDeviceSpeech } from '@/lib/deviceSpeech';
import { useStore } from '@/lib/store';
import { PracticeScreen, type PracticeView } from '@/screens/account/PracticeScreen';
import { useInsets } from '../common';

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/app'));
const DEVICE = `${Platform.OS} ${String(Platform.Version)}${Constants.deviceName ? ` · ${Constants.deviceName}` : ''}`.slice(0, 200);
type CardView = Extract<PracticeView, { kind: 'card' }>;

/**
 * «Обучение»: карточки с сервера (GET /practice/next), диктовка распознаванием телефона с записью голоса,
 * сверка на сервере (POST /practice/attempt). Разбор идёт в учебном наборе записей — свои дела не меняются
 */
export function PracticeContainer() {
  const insets = useInsets();
  const [view, setView] = useState<PracticeView>({ kind: 'loading' });
  const [progress, setProgress] = useState<PracticeProgress | null>(null);
  const live = useRef(true);
  /** Диктовка заканчивается один раз: кнопкой «Стоп» или сама, когда замолчали */
  const finishing = useRef(false);
  const current = useRef<CardView | null>(null);
  current.current = view.kind === 'card' ? view : null;
  const patch = useCallback((p: Partial<CardView>) => setView((v) => (v.kind === 'card' ? { ...v, ...p } : v)), []);

  const load = useCallback(async () => {
    if (!deviceSpeechAvailable()) return setView({ kind: 'unavailable' });
    setView({ kind: 'loading' });
    const r = await practiceNext();
    if (!live.current) return;
    if ('problem' in r) return setView({ kind: 'problem', text: r.problem });
    setProgress(r.progress);
    if (!r.consent || !r.card) return setView({ kind: 'consent' });
    setView({ kind: 'card', card: r.card, phase: 'idle', live: '', verdict: null, said: false, bad: false, note: null });
  }, []);

  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      abortDeviceSpeech();
    };
  }, [load]);

  const onAgree = useCallback(async () => {
    setView({ kind: 'loading' });
    const problem = await practiceConsent();
    if (!live.current) return;
    if (problem) return setView({ kind: 'problem', text: problem });
    void load();
  }, [load]);

  const finish = useCallback(async () => {
    const v = current.current;
    if (!v || v.phase !== 'listening' || finishing.current) return;
    finishing.current = true;
    const out = await stopDeviceSpeech();
    const extras = speechExtras();
    finishing.current = false;
    if (!live.current) return;
    if ('error' in out) return patch({ phase: 'idle', live: '', note: out.error === 'denied' ? 'Нет доступа к микрофону' : out.error === 'network' ? 'Распознаванию нужна связь' : 'Распознавание не сработало' });
    if (!out.text) return patch({ phase: 'idle', live: '', note: 'Не расслышал' });
    patch({ phase: 'sending', live: out.text });
    const r = await practiceAttempt({ cardId: v.card.id, mode: v.card.mode, text: out.text, alts: extras.alts, audioUri: extras.audioUri, device: DEVICE });
    if (!live.current) return;
    if ('problem' in r) return patch({ phase: 'idle', note: r.problem });
    setProgress(r.progress);
    patch({ phase: 'done', verdict: r });
  }, [patch]);

  const onMic = useCallback(async () => {
    const v = current.current;
    if (!v) return;
    if (v.phase === 'listening') return void finish();
    if (v.phase !== 'idle') return;
    patch({ phase: 'listening', live: '', note: null });
    const lang = useStore.getState().voiceLang;
    const started = await startDeviceSpeech(lang, { text: (t) => live.current && patch({ live: t }), ended: () => void finish() }, { record: true, alternatives: 3 });
    if (!live.current) return;
    if (started !== 'ok') patch({ phase: 'idle', note: started === 'denied' ? 'Нет доступа к микрофону' : 'Микрофон не включился' });
  }, [finish, patch]);

  const onRepeat = useCallback(() => patch({ phase: 'idle', live: '', verdict: null, said: false, bad: false, note: null }), [patch]);

  // Отметки по желанию. «Сказал иначе» меняет сверку — вердикт приходит с сервера заново
  const toggle = useCallback(
    async (key: 'said' | 'bad') => {
      const v = current.current;
      if (!v?.verdict) return;
      patch({ [key]: !v[key] });
      const r = await practiceMark(v.verdict.id, key === 'said' ? { said: !v.said } : { card: !v.bad });
      if (!live.current) return;
      if (r) return patch({ verdict: { ...v.verdict, ...r } });
      patch({ [key]: v[key] });
      useStore.getState().notice('Отметка не отправилась');
    },
    [patch],
  );
  const onToggleSaid = useCallback(() => void toggle('said'), [toggle]);
  const onToggleBad = useCallback(() => void toggle('bad'), [toggle]);

  return <PracticeScreen view={view} progress={progress} insets={insets} onBack={back} onAgree={onAgree} onRetry={load} onMic={onMic} onNext={load} onRepeat={onRepeat} onToggleSaid={onToggleSaid} onToggleBad={onToggleBad} />;
}
