/**
 * Голосовой ввод.
 *   С сервером (EXPO_PUBLIC_API_URL в .env): настоящая запись с микрофона → POST /voice (lang из настроек)
 *     → SpeechKit + YandexGPT → { transcript, result, left }.
 *   Без сервера: запись имитируется, вместо речи — фразы из ТЗ по кругу, разбор — mockParser.
 * Сам микрофон живёт в компоненте <VoiceRecorder/> (хуки expo-audio) и регистрируется здесь.
 * Окна результата рисует VoiceHost (одна запись, одна правка, ответ о планах, ошибка), остальное — CardSheet.
 */
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { QUOTA_DETAIL, quotaText } from '@/adapters/voice/problem';
import { nav } from '@/containers/common/nav';
import { toTab, toTopic } from '@/containers/common/go';
import { deleteRecording, fetchVoiceQuota, parseOnServer, uploadVoice, type VoiceProblem } from './api';
import { track } from './analytics';
import { API_URL } from './config';
import { toISODate } from './dates';
import { mockParse, SAMPLE_PHRASES, type ParseResult } from './mockParser';
import { answerPlans } from './plans';
import { groupmates, useStore, type VoiceQuota } from './store';
import type { ItemType } from './types';

/** Голосовая команда — не длиннее 10 секунд: короткие фразы дешевле и точнее разбираются */
export const MAX_MS = 10_000;
const MIN_MS = 700;
const FAKE_PROCESSING_MS = 800;

let startedAt = 0;
/** Длительность последней записи — для шапки окна результата */
let lastMs = 0;
let autoStop: ReturnType<typeof setTimeout> | null = null;
let phraseIdx = 0;
/**
 * Номер текущей команды: «Отмена» во время разбора увеличивает его, и опоздавший ответ сервера
 * (или заглушки) уже ничего не показывает
 */
let run = 0;
/**
 * Микрофон включается (recorder.start ещё не ответил): второе нажатие REC не начинает вторую запись,
 * а «Отмена» в это время увеличивает run — запись, включившись, сразу останавливается
 */
let starting = false;

/** Уровень звука 0…1 для волны в окне записи (отдельно от основного хранилища — меняется 10 раз в секунду) */
export const useVoiceLevel = create<{ level: number | null }>(() => ({ level: null }));

/**
 * armed — запрошена запись без нажатия (ссылка kstatiapp://record с виджета): окно ждёт «ЗАПИСАТЬ».
 * Сама ссылка микрофон не включает — иначе любой сайт или приложение могли бы начать запись (F14).
 * cancelling — запись отменили, микрофон ещё останавливается: окно «разбор» не показываем
 */
export const useVoiceUi = create<{ armed: boolean; cancelling: boolean }>(() => ({ armed: false, cancelling: false }));

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
/** Сколько длится запись сейчас (или длилась последняя), мс */
export const recordedMs = () => (useStore.getState().voice === 'recording' ? Date.now() - startedAt : lastMs);

/* ---------- Счётчик команд за день (GET /voice/quota, поле left ответа) ---------- */

/**
 * Счётчик с сервера (лимит не тратит). Нет связи или старый сервер — null, хранилище не меняется.
 * День счётчика (voiceQuotaDay) хранилище ставит само в setVoiceQuota — откуда бы счётчик ни пришёл (и с экрана настроек)
 */
export async function refreshVoiceQuota(): Promise<VoiceQuota | null> {
  if (!API_URL) return null;
  const q = await fetchVoiceQuota();
  if (q) useStore.getState().setVoiceQuota(q);
  return q;
}

/** После каждой команды: left из ответа; лимита ещё не знаем — спрашиваем сервер */
function noteLeft(left: number | undefined) {
  if (typeof left !== 'number') return;
  const s = useStore.getState();
  const q = s.voiceQuota;
  if (!q) {
    void refreshVoiceQuota();
    return;
  }
  s.setVoiceQuota({ limit: q.limit, used: Math.max(0, q.limit - left), left });
}

/** Лимит на сегодня точно исчерпан — запись не начинаем, сразу показываем причину */
function quotaSpent(): VoiceQuota | null {
  const { voiceQuota: q, voiceQuotaDay } = useStore.getState();
  return q && q.left <= 0 && voiceQuotaDay === toISODate(new Date()) ? q : null;
}

const showLimit = (transcript: string, q: VoiceQuota | null, fallback?: string) =>
  useStore.getState().setCard({ source: 'voice', transcript, problem: 'info', query: quotaText(q, fallback), detail: QUOTA_DETAIL });

/* ---------- Заглушка микрофона: волна без звука ---------- */

let fakeLevels: ReturnType<typeof setInterval> | null = null;
function stopFakeLevels() {
  if (fakeLevels) clearInterval(fakeLevels);
  fakeLevels = null;
}
function startFakeLevels() {
  stopFakeLevels();
  let t = 0;
  fakeLevels = setInterval(() => {
    t += 1;
    const v = 0.35 + 0.3 * Math.sin(t / 2.3) + 0.2 * Math.sin(t / 0.9);
    useVoiceLevel.setState({ level: Math.max(0.05, Math.min(1, v)) });
  }, 100);
}

/* ---------- Запись ---------- */

/** Начать запись по нажатию человека (REC, «ЕЩЁ РАЗ», «ЗАПИСАТЬ») */
export async function beginRecording() {
  const s = useStore.getState();
  useVoiceUi.setState({ armed: false });
  if (s.voice !== 'idle' || starting) return;
  s.setCard(null);
  const spent = quotaSpent();
  if (spent) return showLimit('', spent);
  const mic = useRealMic() ? recorder : null;
  if (mic) {
    const id = run;
    starting = true;
    let res: 'ok' | 'denied' | 'error';
    try {
      res = await mic.start();
    } catch {
      res = 'error';
    } finally {
      starting = false;
    }
    // Пока микрофон включался, запись отменили: выключаем и ничего не показываем
    if (id !== run) {
      if (res === 'ok') void mic.stop().then(deleteRecording, () => {});
      return;
    }
    if (res === 'denied') return s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
    if (res === 'error') return s.setCard({ source: 'voice', transcript: '', problem: 'server' });
  } else startFakeLevels();
  buzz();
  startedAt = Date.now();
  lastMs = 0;
  useVoiceLevel.setState({ level: null });
  s.setVoice('recording');
  autoStop = setTimeout(stopRecording, MAX_MS);
}

/** Запись по ссылке (виджет kstatiapp://record): только окно с кнопкой «ЗАПИСАТЬ», микрофон — после нажатия */
export function armRecording() {
  const s = useStore.getState();
  if (s.voice !== 'idle') return;
  s.setCard(null);
  useVoiceUi.setState({ armed: true });
}

export const disarmRecording = () => useVoiceUi.setState({ armed: false });

/**
 * Прежнее имя для app/record.tsx (ссылка kstatiapp://record): теперь только просит нажать «ЗАПИСАТЬ».
 * Нажатия в приложении вызывают beginRecording
 */
export const startRecording = armRecording;

/* ---------- Режим «удерживать»: запись, пока палец на кнопке ---------- */

let released = false;

export async function holdStart() {
  released = false;
  await beginRecording();
  // Отпустили раньше, чем микрофон успел включиться
  if (released) holdEnd();
}

export function holdEnd() {
  released = true;
  if (useStore.getState().voice !== 'recording') return;
  // Короткое касание — не запись: просто отменяем
  if (Date.now() - startedAt < MIN_MS) return void cancelRecording();
  void stopRecording();
}

/** Отменить запись: ничего не отправляем и не показываем (кнопка «ОТМЕНА» или затемнение) */
export async function cancelRecording() {
  if (starting) {
    // Микрофон ещё включается — beginRecording увидит новый run и сразу его выключит
    released = true;
    run++;
    return;
  }
  if (useStore.getState().voice !== 'recording') return;
  released = true;
  if (autoStop) clearTimeout(autoStop);
  autoStop = null;
  stopFakeLevels();
  run++;
  lastMs = 0;
  useVoiceUi.setState({ cancelling: true });
  useStore.getState().setVoice('processing');
  if (useRealMic() && recorder) deleteRecording(await recorder.stop().catch(() => null));
  useStore.getState().setVoice('idle');
  useVoiceUi.setState({ cancelling: false });
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** «Отмена» в окне голоса: идёт запись — отменить её, идёт разбор — не показывать ответ */
export function cancelVoice() {
  const v = useStore.getState().voice;
  if (v === 'recording' || starting) return void cancelRecording();
  if (v === 'processing') {
    run++;
    useStore.getState().setVoice('idle');
  }
}

export async function stopRecording() {
  const s = useStore.getState();
  if (s.voice !== 'recording') return;
  if (autoStop) clearTimeout(autoStop);
  autoStop = null;
  stopFakeLevels();
  buzz();
  const duration = Date.now() - startedAt;
  lastMs = duration;
  const id = ++run;
  s.setVoice('processing');

  if (useRealMic() && recorder) {
    let uri: string | null;
    try {
      uri = await recorder.stop();
    } catch (e) {
      // Микрофон не остановился как надо: окно «разбор» не должно висеть вечно
      if (id !== run) return;
      useStore.getState().setVoice('idle');
      useStore.getState().setCard({ source: 'voice', transcript: '', problem: 'server', detail: `микрофон: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    if (id !== run || !uri || duration < MIN_MS) {
      deleteRecording(uri);
      if (id !== run) return;
      return silence();
    }
    const res = await uploadVoice(uri);
    // Запись уже на сервере (или не дошла — повтор всё равно новой записью): файл больше не нужен
    deleteRecording(uri);
    if (id !== run) return;
    useStore.getState().setVoice('idle');
    if (!res.ok) return showFail('', res);
    noteLeft(res.left);
    if (!res.transcript) return silence();
    return applyResult(res.transcript, res.result);
  }

  // Заглушка
  setTimeout(() => {
    if (id !== run) return;
    if (duration < MIN_MS) return silence();
    void handleTranscript(SAMPLE_PHRASES[phraseIdx++ % SAMPLE_PHRASES.length] ?? '');
  }, API_URL ? 0 : FAKE_PROCESSING_MS);
}

/** Ошибка сервера или связи. Лимит на день — счётчиком «30 из 30», без технических деталей */
async function showFail(transcript: string, res: { problem: VoiceProblem; detail: string }) {
  if (res.problem === 'limit') {
    const id = run;
    const q = await refreshVoiceQuota();
    if (id !== run) return;
    return showLimit(transcript, q, res.detail);
  }
  useStore.getState().setCard({ source: 'voice', transcript, problem: res.problem, detail: res.detail });
}

function silence() {
  useStore.getState().setVoice('idle');
  useStore.getState().setCard({ source: 'voice', transcript: '', problem: 'silence' });
}

/** REC в режиме «нажать»: первое нажатие — запись, второе — готово */
export function toggleRecording() {
  const v = useStore.getState().voice;
  if (v === 'idle') void beginRecording();
  else if (v === 'recording') void stopRecording();
}

export const TAB_FOR: Record<ItemType, ReturnType<typeof nav.tab>> = {
  task: nav.tab('tasks'),
  wish: nav.tab('wishes'),
  watch: nav.tab('watch'),
  idea: nav.tab('ideas'),
  topic: nav.tab('ideas'),
};

/** Разбор текста: «Разобрать заново» и режим без микрофона */
export async function handleTranscript(transcript: string) {
  const s = useStore.getState();
  if (!s.me) return;
  const me = s.me;

  if (!API_URL) {
    const existing = {
      tasks: s.tasks.filter((t) => t.groupId === s.currentGroupId),
      watch: s.watch.filter((w) => w.groupId === s.currentGroupId),
      wishes: s.wishes.filter((w) => w.ownerId === me.id),
    };
    s.setVoice('idle');
    applyResult(transcript, mockParse(transcript, { me, people: groupmates(s), existing }));
    return;
  }

  const id = ++run;
  s.setVoice('processing');
  s.setCard(null);
  const res = await parseOnServer(transcript);
  if (id !== run) return;
  useStore.getState().setVoice('idle');
  if (!res.ok) return showFail(transcript, res);
  noteLeft(res.left);
  applyResult(transcript, res.result);
}

function applyResult(transcript: string, r: ParseResult) {
  const s = useStore.getState();
  const me = s.me;
  if (!me) return;
  track('voice', { result: r.type });
  switch (r.type) {
    case 'items':
      // Одну запись показывает VoiceHost (C-Voice), несколько — CardSheet списком
      s.setCard({ source: 'voice', transcript, items: r.items, editing: false });
      return;
    case 'queryWatch':
      s.setCard(null);
      s.setWatchFilters(r.filters);
      toTab('watch');
      return;
    case 'queryWish': {
      s.setCard(null);
      // Человек не из текущей группы — переключаемся на общую с ним группу
      const inCurrent = s.groups.find((g) => g.id === s.currentGroupId)?.memberIds.includes(r.personId);
      if (r.personId !== me.id && !inCurrent) {
        const common = s.groups.find((g) => g.memberIds.includes(r.personId));
        if (common) s.selectGroup(common.id);
      }
      s.setWishPerson(r.personId === me.id ? null : r.personId);
      toTab('wishes');
      return;
    }
    case 'changes':
      // Одну правку показывает VoiceHost (C-AskDelete / C-AskMove), несколько — CardSheet
      s.setCard({ source: 'voice', transcript, changes: r.changes });
      return;
    case 'notFound':
      s.setCard({ source: 'voice', transcript, problem: 'notFound', query: r.query });
      return;
    case 'queryPlans': {
      const a = answerPlans(r.plans, { me, users: s.users, groups: s.groups, tasks: s.tasks, currentGroupId: s.currentGroupId });
      if (a.ok) s.setCard({ source: 'voice', transcript, plans: a.answer });
      else s.setCard({ source: 'voice', transcript, problem: 'info', query: a.error });
      return;
    }
    case 'unknownPerson':
      s.setCard({ source: 'voice', transcript, problem: 'unknownPerson', person: r.name });
      return;
    case 'queryIdeas':
      s.setCard(null);
      (r.topicId ? toTopic(r.topicId) : toTab('ideas'));
      return;
    case 'unknown':
      s.setCard({ source: 'voice', transcript, problem: 'notUnderstood' });
  }
}
