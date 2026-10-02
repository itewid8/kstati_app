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

/** POST /voice/text → ParseResult («Разобрать заново», текст без микрофона) */
export async function parseOnServer(text: string): Promise<{ ok: true; result: ParseResult } | VoiceFail> {
  try {
    const json = await request<{ result: ParseResult }>('/voice/text', {
      token: useStore.getState().session?.token,
      body: { ...meta(), text },
      timeoutMs: 60_000,
    });
    return { ok: true, result: json.result };
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

/**
 * POST /voice: запись → { transcript, result }.
 * Файл читаем сами и шлём JSON с base64 — без FormData, с которым у fetch в Expo проблемы на Android.
 */
export async function uploadVoice(uri: string): Promise<{ ok: true; transcript: string; result: ParseResult } | VoiceFail> {
  let audio: string;
  try {
    const fileUri = /^(file|content):\/\//.test(uri) ? uri : `file://${uri}`;
    audio = toBase64(await new File(fileUri).arrayBuffer());
  } catch (e) {
    return { ok: false, problem: 'server', detail: `чтение записи: ${(e as Error).message ?? e}` };
  }
  try {
    const json = await request<{ transcript: string; result: ParseResult }>('/voice', {
      token: useStore.getState().session?.token,
      body: { ...meta(), audio },
      timeoutMs: 60_000,
    });
    return { ok: true, transcript: json.transcript, result: json.result };
  } catch (e) {
    return fail(e);
  }
}
