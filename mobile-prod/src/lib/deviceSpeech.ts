/**
 * Распознавание речи самим телефоном (модуль expo-speech-recognition): бесплатно, на сервер уходит только текст.
 * Android — системная служба распознавания (Google, Samsung и др.), iPhone — встроенное распознавание Apple.
 * Нет службы (Huawei без сервисов Google, старая сборка) — available() = false, голос идёт через сервер (SpeechKit).
 * Модуль подключается необязательно: без него приложение работает как раньше.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type ResultEvent = { isFinal: boolean; results: { transcript: string }[] };
type ErrorEvent = { error: string; message: string };
type Sub = { remove(): void };
type Native = {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  getSpeechRecognitionServices(): string[];
  supportsOnDeviceRecognition(): boolean;
  addListener(name: 'result', fn: (e: ResultEvent) => void): Sub;
  addListener(name: 'error', fn: (e: ErrorEvent) => void): Sub;
  addListener(name: 'end' | 'start', fn: () => void): Sub;
  addListener(name: 'volumechange', fn: (e: { value: number }) => void): Sub;
};

const native = requireOptionalNativeModule<Native>('ExpoSpeechRecognition');

/** Служба отказала (язык не поддержан, служба запрещена): до перезапуска приложения голос — через сервер */
let broken = false;

/** Есть ли на телефоне бесплатное распознавание */
export function deviceSpeechAvailable(): boolean {
  if (!native || broken) return false;
  try {
    if (!native.isRecognitionAvailable()) return false;
    if (Platform.OS === 'android' && native.getSpeechRecognitionServices().length === 0) return false;
    return true;
  } catch {
    return false;
  }
}

/** Ошибки, после которых распознаванию телефона больше не доверяем */
const FATAL = new Set(['language-not-supported', 'service-not-allowed', 'client', 'audio-capture']);

export type SpeechOutcome = { text: string } | { error: 'network' | 'denied' | 'failed'; detail: string };

let committed = '';
let interim = '';
let failure: ErrorEvent | null = null;
let running = false;
let waiters: (() => void)[] = [];
let subs: Sub[] = [];
let hooks: { level?: (v: number) => void; ended?: () => void } = {};

function settle() {
  running = false;
  const w = waiters;
  waiters = [];
  w.forEach((f) => f());
}

function listen() {
  if (!native || subs.length) return;
  subs = [
    native.addListener('result', (e) => {
      const t = (e.results[0]?.transcript ?? '').trim();
      if (!e.isFinal) return void (interim = t);
      // iPhone присылает весь текст целиком, Android — по фразам
      committed = Platform.OS === 'ios' ? t : [committed, t].filter(Boolean).join(' ');
      interim = '';
    }),
    native.addListener('error', (e) => {
      failure = e;
      if (FATAL.has(e.error)) broken = true;
    }),
    native.addListener('volumechange', (e) => hooks.level?.(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
    native.addListener('end', () => {
      const wasRunning = running;
      settle();
      if (wasRunning) hooks.ended?.();
    }),
  ];
}

/**
 * Начать слушать. level — громкость 0…1 для волны; ended — служба закончила сама (замолчали), запись пора завершать
 */
export async function startDeviceSpeech(lang: string, on: { level?: (v: number) => void; ended?: () => void }): Promise<'ok' | 'denied' | 'error'> {
  if (!native) return 'error';
  try {
    const perm = await native.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    listen();
    hooks = on;
    committed = '';
    interim = '';
    failure = null;
    running = true;
    // «АВТО»: у служб телефона нет такого языка — без подсказки они слушают по-английски. Основной — русский;
    // Android 14+ сам переключится на английский, если услышит его. На iPhone и старом Android — русский
    const auto = lang === 'auto';
    native.start({
      lang: auto ? 'ru-RU' : lang,
      ...(auto &&
        Platform.OS === 'android' && {
          androidIntentOptions: {
            EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced',
            EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: ['ru-RU', 'en-US'],
            EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ['ru-RU', 'en-US'],
          },
        }),
      interimResults: true,
      continuous: false,
      addsPunctuation: false,
      maxAlternatives: 1,
      // На телефоне без сети, если модель языка скачана; иначе служба решает сама
      requiresOnDeviceRecognition: false,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    });
    return 'ok';
  } catch {
    running = false;
    return 'error';
  }
}

/** Закончить и дождаться текста (не дольше 4 с) */
export async function stopDeviceSpeech(): Promise<SpeechOutcome> {
  if (native && running) {
    const done = new Promise<void>((r) => waiters.push(r));
    try {
      native.stop();
    } catch {
      settle();
    }
    await Promise.race([done, new Promise((r) => setTimeout(r, 4000))]);
    if (running) {
      try {
        native.abort();
      } catch {}
      settle();
    }
  }
  hooks = {};
  const text = (committed || interim).trim();
  if (text) return { text };
  const f = failure;
  if (!f || f.error === 'no-speech' || f.error === 'speech-timeout' || f.error === 'nomatch' || f.error === 'aborted') return { text: '' };
  if (f.error === 'not-allowed') return { error: 'denied', detail: f.message };
  if (f.error === 'network') return { error: 'network', detail: f.message };
  return { error: 'failed', detail: `${f.error}: ${f.message}` };
}

/** Отменить без результата */
export function abortDeviceSpeech() {
  hooks = {};
  if (!native || !running) return;
  try {
    native.abort();
  } catch {}
  settle();
}
