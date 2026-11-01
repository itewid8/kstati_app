/**
 * Голосовой ввод.
 *   С сервером (EXPO_PUBLIC_API_URL в .env): настоящая запись с микрофона → POST /voice (lang из настроек)
 *     → SpeechKit + YandexGPT → { transcript, result, left }.
 *   Без сервера: запись имитируется, вместо речи — фразы из ТЗ по кругу, разбор — mockParser.
 * Сам микрофон живёт в компоненте <VoiceRecorder/> (хуки expo-audio) и регистрируется здесь.
 * Окна результата рисует VoiceHost (одна запись, одна правка, ответ о планах, ошибка), остальное — CardSheet.
 */
import { scopeFilter } from '@/lib/visibility';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { QUOTA_DETAIL, quotaText } from '@/adapters/voice/problem';
import { MIN_HOLD_MS, recStep, type RecEvent, type RecMode, type RecState } from '@/adapters/voice/recording';
import { nav } from '@/containers/common/nav';
import { toTab, toTopic } from '@/containers/common/go';
import { deleteRecording, fetchVoiceQuota, parseOnServer, uploadVoice, type VoiceProblem } from './api';
import { abortDeviceSpeech, deviceSpeechAvailable, startDeviceSpeech, stopDeviceSpeech } from './deviceSpeech';
import { track } from './analytics';
import { API_URL } from './config';
import { toISODate } from './dates';
import { mockParse, SAMPLE_PHRASES, type ParseResult } from './mockParser';
import { answerPlans } from './plans';
import { groupmates, useStore, type VoiceQuota } from './store';
import type { ItemType } from './types';

/** Голосовая команда — не длиннее 10 секунд: короткие фразы дешевле и точнее разбираются */
export const MAX_MS = 10_000;
/** Короче — не команда (случайное касание): разбор не запускаем */
const MIN_MS = MIN_HOLD_MS;
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
 * cancelling — запись отменили, микрофон ещё останавливается: окно «разбор» не показываем.
 * held — текущая запись идёт, пока палец на REC (режим «удерживать»): окно без кнопок, отмена — жестом
 */
export const useVoiceUi = create<{ armed: boolean; cancelling: boolean; held: boolean }>(() => ({
  armed: false,
  cancelling: false,
  held: false,
}));

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

/**
 * Чем записываем текущую команду: speech — распознаёт сам телефон (бесплатно, на сервер уходит текст),
 * mic — запись звука, распознаёт сервер (SpeechKit), fake — заглушка без сервера
 */
let engine: 'speech' | 'mic' | 'fake' = 'fake';

/** Громкость от распознавания телефона: волна и автостоп после 2 с тишины (как у записи звука) */
let spoke = false;
let lastLoud = 0;
function speechLevel(v: number) {
  if (useStore.getState().voice !== 'recording') return;
  useVoiceLevel.setState({ level: v });
  const now = Date.now();
  if (v > 0.3) {
    spoke = true;
    lastLoud = now;
  } else if (spoke && now - lastLoud > 2000) stopRecording();
}

/** Распознавания на телефоне нет: один раз говорим, что голос пойдёт через сервер */
function speechNoticeDue(): boolean {
  const s = useStore.getState();
  if (!API_URL || s.speechNotice || deviceSpeechAvailable()) return false;
  s.setSpeechNotice(true);
  s.setCard({ source: 'voice', transcript: '', problem: 'info', query: 'На этом телефоне нет встроенного распознавания речи'});
  return true;
}

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

/* ---------- Автомат записи (adapters/voice/recording) ---------- */

/** Состояние автомата из хранилища и переменных модуля */
function recState(): RecState {
  const { voice, card } = useStore.getState();
  const { armed, held } = useVoiceUi.getState();
  const mode: RecMode = held ? 'hold' : 'tap';
  if (starting) return { phase: 'arming', mode };
  if (voice === 'recording') return { phase: 'recording', mode };
  if (voice === 'processing') return { phase: 'processing', mode };
  if (armed) return { phase: 'prompt', mode };
  return { phase: card ? 'result' : 'idle', mode };
}

/** Событие от человека → команда автомата → действие */
function dispatch(e: RecEvent) {
  const { state, command } = recStep(recState(), e);
  switch (command) {
    case 'start':
      return void begin(state.mode);
    case 'stop':
      return void finish();
    case 'cancel':
      return void cancelRecording();
    case 'drop':
      // Разбор уже идёт: новый номер команды — опоздавший ответ ничего не покажет
      run++;
      return useStore.getState().setVoice('idle');
    case 'close':
      disarmRecording();
      return useStore.getState().setCard(null);
  }
}

/* ---------- Запись ---------- */

/** Начать запись по нажатию человека (REC в режиме «нажать», «ЕЩЁ РАЗ», «ЗАПИСАТЬ») */
export function beginRecording() {
  return begin('tap');
}

async function begin(mode: RecMode) {
  const s = useStore.getState();
  useVoiceUi.setState({ armed: false });
  if (s.voice !== 'idle' || starting) return;
  s.setCard(null);
  const spent = quotaSpent();
  if (spent) return showLimit('', spent);
  if (speechNoticeDue()) return;
  useVoiceUi.setState({ held: mode === 'hold' });
  if (API_URL && deviceSpeechAvailable()) {
    const id = run;
    starting = true;
    spoke = false;
    lastLoud = Date.now();
    const res = await startDeviceSpeech(s.voiceLang, { level: speechLevel, ended: stopRecording });
    starting = false;
    if (id !== run) {
      abortDeviceSpeech();
      if (res === 'denied') s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
      return;
    }
    if (res === 'denied') return s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
    if (res === 'error') return s.setCard({ source: 'voice', transcript: '', problem: 'server', detail: 'распознавание телефона не запустилось' });
    engine = 'speech';
  } else if (useRealMic() && recorder) {
    const mic = recorder;
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
    // Пока микрофон включался, запись отменили (или отпустили REC — системный запрос доступа снимает палец):
    // выключаем и ничего не показываем. Запрета на микрофон это не касается — без доступа запись не начнётся никогда
    if (id !== run) {
      if (res === 'ok') void mic.stop().then(deleteRecording, () => {});
      if (res === 'denied') s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
      return;
    }
    if (res === 'denied') return s.setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
    if (res === 'error') return s.setCard({ source: 'voice', transcript: '', problem: 'server' });
    engine = 'mic';
  } else {
    engine = 'fake';
    startFakeLevels();
  }
  buzz();
  startedAt = Date.now();
  lastMs = 0;
  useVoiceLevel.setState({ level: null });
  s.setVoice('recording');
  autoStop = setTimeout(finish, MAX_MS);
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

/* ---------- Режим «удерживать»: запись, пока палец на кнопке (BottomNav, жест REC) ---------- */

/** Палец лёг на REC. Идёт запись, начатая нажатием «ЗАПИСАТЬ», — это ГОТОВО */
export function holdStart() {
  dispatch({ type: 'press', mode: 'hold' });
}

/**
 * Палец отпущен (cancelled — увёл его жестом отмены). Отпустили, пока микрофон включался, или раньше MIN_MS — отмена:
 * случайное касание не запись. Вызов без аргумента — обычное отпускание
 */
export function holdEnd(cancelled?: unknown) {
  dispatch({ type: 'release', heldMs: Date.now() - startedAt, cancelled: cancelled === true });
}

/** Отменить запись: ничего не отправляем и не показываем (ОТМЕНА, затемнение, жест отмены) */
export async function cancelRecording() {
  if (starting) {
    // Микрофон ещё включается — begin увидит новый run и сразу его выключит
    run++;
    return;
  }
  if (useStore.getState().voice !== 'recording') return;
  if (autoStop) clearTimeout(autoStop);
  autoStop = null;
  stopFakeLevels();
  run++;
  lastMs = 0;
  useVoiceUi.setState({ cancelling: true });
  useStore.getState().setVoice('processing');
  if (engine === 'speech') abortDeviceSpeech();
  else if (engine === 'mic' && recorder) deleteRecording(await recorder.stop().catch(() => null));
  useStore.getState().setVoice('idle');
  useVoiceUi.setState({ cancelling: false });
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * ОТМЕНА в окне голоса, затемнение, Android «назад»: запись — стереть, разбор — не показывать ответ,
 * окно ссылки или ответа — закрыть
 */
export const cancelVoice = () => dispatch({ type: 'cancel' });

/** ГОТОВО в окне записи: закончить и разобрать */
export const finishRecording = () => dispatch({ type: 'done' });

/**
 * Автостоп по тишине (VoiceRecorder). Запись пальцем им не заканчивается: пока палец на REC, конец — отпустить
 * (окно не должно уходить в разбор из-под пальца); предел MAX_MS действует всегда
 */
export function stopRecording() {
  if (useVoiceUi.getState().held) return;
  void finish();
}

/** Закончить запись и отправить на разбор */
async function finish() {
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

  if (engine === 'speech') {
    const out = await stopDeviceSpeech();
    if (id !== run) return;
    if ('error' in out) {
      useStore.getState().setVoice('idle');
      if (out.error === 'denied') return useStore.getState().setCard({ source: 'voice', transcript: '', problem: 'micDenied' });
      return useStore.getState().setCard({ source: 'voice', transcript: '', problem: out.error === 'network' ? 'offline' : 'server', detail: `распознавание телефона: ${out.detail}` });
    }
    if (duration < MIN_MS || !out.text) return silence();
    const res = await parseOnServer(out.text, 'device');
    if (id !== run) return;
    useStore.getState().setVoice('idle');
    if (!res.ok) return showFail(out.text, res);
    noteLeft(res.left);
    return applyResult(out.text, res.result);
  }

  if (engine === 'mic' && recorder) {
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

/** REC в режиме «нажать»: первое нажатие — запись, второе — ГОТОВО; пока микрофон включается или идёт разбор — ничего */
export const toggleRecording = () => dispatch({ type: 'press', mode: 'tap' });

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
      tasks: s.tasks.filter(scopeFilter({ viewId: s.currentGroupId, groups: s.groups, meId: me.id })),
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
