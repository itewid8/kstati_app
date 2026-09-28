/**
 * Голосовой ввод.
 *   С сервером (EXPO_PUBLIC_API_URL в mobile/.env): настоящая запись с микрофона → POST /voice
 *     → SpeechKit + YandexGPT → { transcript, result }.
 *   Без сервера: запись имитируется, вместо речи — фразы из ТЗ по кругу, разбор — mockParser.
 * Сам микрофон живёт в компоненте <VoiceRecorder/> (хуки expo-audio) и регистрируется здесь.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { create } from 'zustand';
import { parseOnServer, uploadVoice } from './api';
import { track } from './analytics';
import { API_URL } from './config';
import { mockParse, SAMPLE_PHRASES, type ParseResult } from './mockParser';
import { answerPlans } from './plans';
import { groupmates, useStore } from './store';
import type { ItemType } from './types';

/** Голосовая команда — не длиннее 7 секунд: короткие фразы дешевле и точнее разбираются */
export const MAX_MS = 7_000;
const MIN_MS = 700;
const FAKE_PROCESSING_MS = 800;

let startedAt = 0;
let autoStop: ReturnType<typeof setTimeout> | null = null;
let phraseIdx = 0;

/** Уровень звука 0…1 для полоски рядом с кнопкой (отдельно от основного хранилища — меняется 10 раз в секунду) */
export const useVoiceLevel = create<{ level: number | null }>(() => ({ level: null }));

/** Настоящий микрофон, если подключён <VoiceRecorder/> */
export type RecorderImpl = {
  start: () => Promise<'ok' | 'denied' | 'error'>;
  stop: () => Promise<string | null>; // uri файла
};
let recorder: RecorderImpl | null = null;
export const registerRecorder = (r: RecorderImpl | null) => {
  recorder = r;
};
const useRealMic = () => !!API_URL && !!recorder;

const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

export const recordingStartedAt = () => startedAt;

export async function startRecording() {
  const s = useStore.getState();
  if (s.voice !== 'idle') return;
  s.setCard(null);
  if (useRealMic()) {
    const res = await recorder!.start();
    if (res === 'denied') return s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
    if (res === 'error') return s.setCard({ source: 'voice', transcript: '', problem: 'server' });
  }
  buzz();
  startedAt = Date.now();
  useVoiceLevel.setState({ level: null });
  s.setVoice('recording');
  autoStop = setTimeout(stopRecording, MAX_MS);
}

export async function stopRecording() {
  const s = useStore.getState();
  if (s.voice !== 'recording') return;
  if (autoStop) clearTimeout(autoStop);
  autoStop = null;
  buzz();
  const duration = Date.now() - startedAt;
  s.setVoice('processing');

  if (useRealMic()) {
    const uri = await recorder!.stop();
    if (!uri || duration < MIN_MS) return silence();
    const res = await uploadVoice(uri);
    useStore.getState().setVoice('idle');
    if (!res.ok) return showFail('', res);
    if (!res.transcript) return silence();
    return applyResult(res.transcript, res.result);
  }

  // Заглушка
  setTimeout(() => {
    if (duration < MIN_MS) return silence();
    handleTranscript(SAMPLE_PHRASES[phraseIdx++ % SAMPLE_PHRASES.length]);
  }, API_URL ? 0 : FAKE_PROCESSING_MS);
}

/** Ошибка сервера или связи. Лимит на день — понятным текстом, без технических деталей */
function showFail(transcript: string, res: { problem: 'offline' | 'server' | 'limit'; detail: string }) {
  const set = useStore.getState().setCard;
  if (res.problem === 'limit') return set({ source: 'voice', transcript, problem: 'info', query: res.detail });
  set({ source: 'voice', transcript, problem: res.problem, detail: res.detail });
}

function silence() {
  useStore.getState().setVoice('idle');
  useStore.getState().setCard({ source: 'voice', transcript: '', problem: 'silence' });
}

export function toggleRecording() {
  const v = useStore.getState().voice;
  if (v === 'idle') startRecording();
  else if (v === 'recording') stopRecording();
}

export const TAB_FOR: Record<ItemType, '/tasks' | '/wishes' | '/watch'> = {
  task: '/tasks',
  wish: '/wishes',
  watch: '/watch',
};

/** Разбор текста: «Разобрать заново» и режим без микрофона */
export async function handleTranscript(transcript: string) {
  const s = useStore.getState();
  if (!s.me) return;

  if (!API_URL) {
    const existing = {
      tasks: s.tasks.filter((t) => t.groupId === s.currentGroupId),
      watch: s.watch.filter((w) => w.groupId === s.currentGroupId),
      wishes: s.wishes.filter((w) => w.ownerId === s.me!.id),
    };
    s.setVoice('idle');
    applyResult(transcript, mockParse(transcript, { me: s.me, people: groupmates(s), existing }));
    return;
  }

  s.setVoice('processing');
  s.setCard(null);
  const res = await parseOnServer(transcript);
  useStore.getState().setVoice('idle');
  if (res.ok) applyResult(transcript, res.result);
  else showFail(transcript, res);
}

function applyResult(transcript: string, r: ParseResult) {
  const s = useStore.getState();
  track('voice', { result: r.type });
  switch (r.type) {
    case 'items':
      s.setCard({ source: 'voice', transcript, items: r.items, editing: false });
      return;
    case 'queryWatch':
      s.setCard(null);
      s.setWatchFilters(r.filters);
      router.navigate('/watch');
      return;
    case 'queryWish':
      s.setCard(null);
      // Человек не из текущей группы — переключаемся на общую с ним группу
      if (r.personId !== s.me?.id && !s.groups.find((g) => g.id === s.currentGroupId)?.memberIds.includes(r.personId)) {
        const common = s.groups.find((g) => g.memberIds.includes(r.personId));
        if (common) s.selectGroup(common.id);
      }
      s.setWishPerson(r.personId === s.me?.id ? null : r.personId);
      router.navigate('/wishes');
      return;
    case 'changes':
      s.setCard({ source: 'voice', transcript, changes: r.changes });
      return;
    case 'notFound':
      s.setCard({ source: 'voice', transcript, problem: 'notFound', query: r.query });
      return;
    case 'queryPlans': {
      const a = answerPlans(r.plans, { me: s.me!, users: s.users, groups: s.groups, tasks: s.tasks, currentGroupId: s.currentGroupId });
      if (a.ok) s.setCard({ source: 'voice', transcript, plans: a.answer });
      else s.setCard({ source: 'voice', transcript, problem: 'info', query: a.error });
      return;
    }
    case 'unknownPerson':
      s.setCard({ source: 'voice', transcript, problem: 'unknownPerson', person: r.name });
      return;
    case 'unknown':
      s.setCard({ source: 'voice', transcript, problem: 'notUnderstood' });
  }
}
