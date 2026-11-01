import { File } from 'expo-file-system';
import { toHHMM, toISODate } from './dates';
import type { ParseResult } from './mockParser';
import { ApiError, NetError, request } from './net';
import { useStore } from './store';

export type VoiceProblem = 'offline' | 'server' | 'limit';
type VoiceFail = { ok: false; problem: VoiceProblem; detail: string };

/**
 * Что знает сервер для разбора фразы: какая группа и тема идей открыты и который час у человека.
 * Остальное (люди, дела группы, хотелки) сервер берёт из базы сам.
 */
function meta() {
  const s = useStore.getState();
  const now = new Date();
  // Открытая тема идей: идея без названной темы ляжет в неё
  return { groupId: s.currentGroupId ?? '', today: toISODate(now), now: toHHMM(now), topicId: s.voiceTopicId, parentId: s.voiceParentId };
}

function fail(e: unknown): VoiceFail {
  if (e instanceof ApiError && e.code === 'daily_limit') return { ok: false, problem: 'limit', detail: e.message };
  if (e instanceof ApiError) return { ok: false, problem: 'server', detail: `${e.status} ${e.message}` };
  if (e instanceof NetError) return { ok: false, problem: 'offline', detail: e.message === 'timeout' ? 'нет ответа за 60 с' : e.message };
  return { ok: false, problem: 'server', detail: String((e as Error)?.message ?? e) };
}

/** POST /voice/text → ParseResult («Разобрать заново», текст без микрофона). left — сколько команд осталось на сегодня */
export async function parseOnServer(text: string, src?: 'device'): Promise<{ ok: true; result: ParseResult; left?: number } | VoiceFail> {
  try {
    const json = await request<{ result: ParseResult; left?: number }>('/voice/text', {
      token: useStore.getState().session?.token,
      body: { ...meta(), text, ...(src && { src, lang: useStore.getState().voiceLang }) },
      timeoutMs: 60_000,
    });
    return { ok: true, result: json.result, ...(typeof json.left === 'number' && { left: json.left }) };
  } catch (e) {
    return fail(e);
  }
}

/** ArrayBuffer → base64 без зависимостей (btoa есть не везде) */
function toBase64(buf: ArrayBuffer): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const b = new Uint8Array(buf);
  let out = '';
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + abc[(n >> 6) & 63] + abc[n & 63];
  }
  if (i < b.length) {
    const n = (b[i] << 16) | ((i + 1 < b.length ? b[i + 1] : 0) << 8);
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < b.length ? abc[(n >> 6) & 63] : '=') + '=';
  }
  return out;
}

const fileUriOf = (uri: string) => (/^(file|content):\/\//.test(uri) ? uri : `file://${uri}`);

/**
 * Удалить файл записи: после отправки, отмены или слишком короткой записи он не нужен.
 * expo-audio на каждую запись создаёт новый файл в кэше и сам их не удаляет — голос копился бы на телефоне
 */
export function deleteRecording(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(fileUriOf(uri));
    if (f.exists) f.delete();
  } catch {
    /* файла уже нет */
  }
}

/**
 * POST /voice: запись → { transcript, result }.
 * Файл читаем сами и шлём JSON с base64 — без FormData, с которым у fetch в Expo проблемы на Android.
 */
export async function uploadVoice(uri: string): Promise<{ ok: true; transcript: string; result: ParseResult; left?: number } | VoiceFail> {
  let audio: string;
  try {
    audio = toBase64(await new File(fileUriOf(uri)).arrayBuffer());
  } catch (e) {
    return { ok: false, problem: 'server', detail: `чтение записи: ${(e as Error).message ?? e}` };
  }
  try {
    const s = useStore.getState();
    const json = await request<{ transcript: string; result: ParseResult; left?: number }>('/voice', {
      token: s.session?.token,
      body: { ...meta(), audio, lang: s.voiceLang },
      timeoutMs: 60_000,
    });
    return { ok: true, transcript: json.transcript, result: json.result, ...(typeof json.left === 'number' && { left: json.left }) };
  } catch (e) {
    return fail(e);
  }
}

export type VoiceQuota = { limit: number; used: number; left: number };

/** GET /voice/quota — голосовые команды за сегодня (лимит не тратит). Нет связи или старый сервер — null */
export async function fetchVoiceQuota(): Promise<VoiceQuota | null> {
  const token = useStore.getState().session?.token;
  if (!token) return null;
  try {
    const q = await request<Partial<VoiceQuota> | null>('/voice/quota', { token, timeoutMs: 10_000 });
    if (!q || typeof q.limit !== 'number' || typeof q.used !== 'number' || typeof q.left !== 'number') return null;
    return { limit: q.limit, used: q.used, left: q.left };
  } catch {
    return null;
  }
}

/** GET /health — уровень API сервера (старый сервер поля api не отдаёт — это уровень 1). Нет связи — null */
export async function fetchHealth(): Promise<{ api: number } | null> {
  try {
    const h = await request<{ api?: unknown } | null>('/health', { timeoutMs: 10_000 });
    return { api: typeof h?.api === 'number' ? h.api : 1 };
  } catch {
    return null;
  }
}

export type FeedbackKind = 'bug' | 'idea';

/** POST /feedback — ошибка или предложение. Возвращает текст проблемы или null, если отправлено */
export async function sendFeedback(
  kind: FeedbackKind,
  text: string,
  device: string,
  extra: { screenshot?: string | null; context?: Record<string, unknown> } = {},
): Promise<string | null> {
  try {
    const body = { kind, text, device, ...(extra.screenshot && { screenshot: extra.screenshot }), ...(extra.context && { context: extra.context }) };
    await request('/feedback', { token: useStore.getState().session?.token, body, timeoutMs: extra.screenshot ? 60_000 : 20_000 });
    return null;
  } catch (e) {
    if (e instanceof ApiError) return e.message;
    if (e instanceof NetError) return 'Нет связи с сервером';
    return String((e as Error)?.message ?? e);
  }
}

/** POST /feedback/voice — отзыв голосом: запись → текст (без разбора). Ошибка — { problem } */
export async function transcribeFeedback(uri: string): Promise<{ text: string } | { problem: string }> {
  let audio: string;
  try {
    audio = toBase64(await new File(fileUriOf(uri)).arrayBuffer());
  } catch (e) {
    return { problem: `Не прочиталась запись: ${(e as Error).message ?? e}` };
  } finally {
    deleteRecording(uri);
  }
  try {
    const s = useStore.getState();
    const r = await request<{ text?: unknown }>('/feedback/voice', { token: s.session?.token, body: { audio, lang: s.voiceLang }, timeoutMs: 60_000 });
    return { text: typeof r.text === 'string' ? r.text : '' };
  } catch (e) {
    if (e instanceof ApiError) return { problem: e.message };
    if (e instanceof NetError) return { problem: 'Нет связи с сервером' };
    return { problem: String((e as Error)?.message ?? e) };
  }
}

/** POST /watch/enrich — дополнить старые фильмы группы рейтингом и описанием (ПоискКино). Нет связи — null */
export async function enrichWatch(groupId: string): Promise<{ updated: number; left: number } | null> {
  const token = useStore.getState().session?.token;
  if (!token) return null;
  try {
    const r = await request<{ updated?: unknown; left?: unknown }>('/watch/enrich', { token, body: { groupId }, timeoutMs: 60_000 });
    return { updated: typeof r.updated === 'number' ? r.updated : 0, left: typeof r.left === 'number' ? r.left : 0 };
  } catch {
    return null;
  }
}
