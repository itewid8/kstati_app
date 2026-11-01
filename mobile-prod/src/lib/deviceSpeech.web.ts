/**
 * Браузер: распознавание речи самим браузером (Web Speech API — Chrome, Edge, Яндекс Браузер, Safari).
 * Тот же интерфейс, что у deviceSpeech.ts. Нет API (Firefox) — available() = false, голос пишется и идёт на сервер.
 * Громкость для волны и автостопа — с микрофона через AudioContext (само распознавание её не даёт).
 */
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SRCtor = new () => SR;

const Ctor: SRCtor | null =
  typeof window === 'undefined' ? null : ((window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition ?? null);

let broken = false;
const FATAL = new Set(['language-not-supported', 'service-not-allowed', 'bad-grammar']);

export function deviceSpeechAvailable(): boolean {
  return !!Ctor && !broken;
}

export type SpeechOutcome = { text: string } | { error: 'network' | 'denied' | 'failed'; detail: string };

let rec: SR | null = null;
let finals: string[] = [];
let interim = '';
let failure: { error: string; message?: string } | null = null;
let running = false;
let waiters: (() => void)[] = [];
let hooks: { level?: (v: number) => void; ended?: () => void } = {};

/* ---------- громкость с микрофона ---------- */
let media: MediaStream | null = null;
let audio: AudioContext | null = null;
let raf = 0;
async function startMeter() {
  try {
    media = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = new AC();
    const an = audio.createAnalyser();
    an.fftSize = 512;
    audio.createMediaStreamSource(media).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 100) return;
      last = t;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      hooks.level?.(Math.max(0, Math.min(1, rms * 4)));
    };
    raf = requestAnimationFrame(tick);
  } catch {
    /* без громкости: волна стоит, автостоп — по окончании речи от браузера */
  }
}
function stopMeter() {
  cancelAnimationFrame(raf);
  media?.getTracks().forEach((t) => t.stop());
  void audio?.close().catch(() => {});
  media = null;
  audio = null;
}

function settle() {
  running = false;
  stopMeter();
  const w = waiters;
  waiters = [];
  w.forEach((f) => f());
}

export async function startDeviceSpeech(lang: string, on: { level?: (v: number) => void; ended?: () => void }): Promise<'ok' | 'denied' | 'error'> {
  if (!Ctor) return 'error';
  try {
    hooks = on;
    finals = [];
    interim = '';
    failure = null;
    const r = new Ctor();
    // «АВТО» браузер не понимает — слушаем по-русски
    r.lang = lang === 'auto' ? 'ru-RU' : lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = (res?.[0]?.transcript ?? '').trim();
        if (!t) continue;
        if (res!.isFinal) finals.push(t);
        else interim = [interim, t].filter(Boolean).join(' ');
      }
    };
    r.onerror = (e) => {
      failure = e;
      if (FATAL.has(e.error)) broken = true;
    };
    r.onend = () => {
      const was = running;
      settle();
      if (was) hooks.ended?.();
    };
    rec = r;
    running = true;
    r.start();
    void startMeter();
    return 'ok';
  } catch (e) {
    running = false;
    return String((e as Error)?.name) === 'NotAllowedError' ? 'denied' : 'error';
  }
}

export async function stopDeviceSpeech(): Promise<SpeechOutcome> {
  if (rec && running) {
    const done = new Promise<void>((r) => waiters.push(r));
    try {
      rec.stop();
    } catch {
      settle();
    }
    await Promise.race([done, new Promise((r) => setTimeout(r, 4000))]);
    if (running) {
      try {
        rec.abort();
      } catch {}
      settle();
    }
  }
  hooks = {};
  const text = [...finals, interim].filter(Boolean).join(' ').trim();
  if (text) return { text };
  const f = failure;
  if (!f || f.error === 'no-speech' || f.error === 'aborted') return { text: '' };
  if (f.error === 'not-allowed' || f.error === 'audio-capture') return { error: 'denied', detail: f.message ?? f.error };
  if (f.error === 'network') return { error: 'network', detail: f.message ?? f.error };
  return { error: 'failed', detail: `${f.error}${f.message ? `: ${f.message}` : ''}` };
}

export function abortDeviceSpeech() {
  hooks = {};
  if (!rec || !running) return;
  try {
    rec.abort();
  } catch {}
  settle();
}
