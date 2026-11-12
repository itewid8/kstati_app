import { config } from './config.js';

const headers = () => ({
  Authorization: `Api-Key ${config.apiKey}`,
  'x-folder-id': config.folderId,
  // Яндекс не сохраняет запросы у себя (политика конфиденциальности, раздел 5)
  'x-data-logging-enabled': 'false',
});

/**
 * Сетевой сбой по дороге до Яндекса («fetch failed»: оборвалось соединение, DNS, VPN) — пробуем ещё раз
 * через полсекунды. Не вышло — ошибка с понятной причиной для журнала: «stt: нет связи с Яндексом (ECONNRESET)».
 */
async function retryNet(service: 'stt' | 'llm', call: () => Promise<Response>): Promise<Response> {
  try {
    return await call();
  } catch (e) {
    if (!isNetError(e)) throw e;
    await new Promise((r) => setTimeout(r, 500));
    try {
      return await call();
    } catch (e2) {
      if (!isNetError(e2)) throw e2;
      const cause = (e2 as { cause?: { code?: string; message?: string } }).cause;
      throw new Error(`${service}: нет связи с Яндексом (${cause?.code ?? cause?.message ?? 'fetch failed'})`);
    }
  }
}
const isNetError = (e: unknown) => e instanceof TypeError && /fetch failed/i.test(e.message);

export class YandexError extends Error {
  constructor(
    public service: 'stt' | 'llm',
    public status: number,
    body: string,
  ) {
    super(`${service} ${status}: ${body.slice(0, 300)}`);
  }
}

/** Язык распознавания (S7): по умолчанию русский; auto — SpeechKit определяет сам */
export const STT_LANGS = ['ru-RU', 'en-US', 'auto'] as const;
export type SttLang = (typeof STT_LANGS)[number];

/** SpeechKit v1, синхронное распознавание: OggOpus до 30 с и 1 МБ → текст */
export async function recognize(ogg: Buffer, lang: SttLang = 'ru-RU'): Promise<string> {
  const call = async (l: SttLang) => {
    const url = new URL('https://stt.api.cloud.yandex.net/speech/v1/stt:recognize');
    url.searchParams.set('folderId', config.folderId);
    url.searchParams.set('lang', l);
    url.searchParams.set('format', 'oggopus');
    const res = await retryNet('stt', () => fetch(url, { method: 'POST', headers: headers(), body: new Uint8Array(ogg), signal: AbortSignal.timeout(20_000) }));
    return { res, text: await res.text() };
  };
  let { res, text } = await call(lang);
  // auto поддерживается не всеми моделями SpeechKit v1 — при отказе распознаём по-русски, а не теряем запись
  if (res.status === 400 && lang === 'auto') ({ res, text } = await call('ru-RU'));
  if (!res.ok) throw new YandexError('stt', res.status, text);
  return (JSON.parse(text).result as string | undefined)?.trim() ?? '';
}

export type Msg = { role: 'system' | 'user' | 'assistant'; text: string };

/** Сколько токенов ушло на вызов (Яндекс присылает числа строками). cached — часть input, взятая из кэша (дешевле) */
export type Usage = { input: number; output: number; total: number; cached?: number };
export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  total: a.total + b.total,
  ...((a.cached || b.cached) && { cached: (a.cached ?? 0) + (b.cached ?? 0) }),
});
export const NO_USAGE: Usage = { input: 0, output: 0, total: 0 };

/**
 * Новые модели AI Studio (Alice AI LLM, открытые модели) — через OpenAI-совместимый API: он отдаёт число токенов
 * из кэша. YandexGPT и дообученные (ds://) — через свой Foundation Models API
 */
const openAiStyle = (model: string) => !!config.llmBaseUrl || (!/^ds:\/\//.test(model) && !/yandexgpt/.test(model));
const modelUri = (model: string) => (/^(ds|gpt):\/\//.test(model) ? model : `gpt://${config.folderId}/${model}`);

/** Foundation Models API: сообщения → текст ответа модели (просим JSON) и расход токенов */
let jsonModeSupported = true;

/** Имя своей модели в настройках (TUNED_MODEL=own): запрос идёт в свой контейнер (OWN_LLM_URL), а не в Яндекс */
export const OWN_MODEL = 'own';

/**
 * Своя модель: один запрос с коротким ожиданием, без повторов — на любой сбой есть облачная модель.
 * Расход токенов не считаем: платим за время работы контейнера, а не за токены
 */
async function completeOwn(messages: Msg[]): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(`${config.ownLlmUrl}/v1/chat/completions`, {
    method: 'POST',
    // Ключ — в X-Api-Key: заголовок Authorization сервис контейнеров Яндекса считает своим IAM-токеном и отклоняет запрос (403)
    headers: { 'Content-Type': 'application/json', ...(config.ownLlmKey && { 'X-Api-Key': config.ownLlmKey }) },
    body: JSON.stringify({ temperature: 0, max_tokens: 400, response_format: { type: 'json_object' }, messages: messages.map((m) => ({ role: m.role, content: m.text })) }),
    signal: AbortSignal.timeout(config.ownLlmTimeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new YandexError('llm', res.status, text);
  return { text: String(JSON.parse(text).choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, ''), usage: NO_USAGE };
}

let warmedAt = 0;
/**
 * Разбудить контейнер своей модели заранее: после простоя он запускается несколько секунд. Зовётся на любой
 * запрос приложения (не чаще раза в минуту) — к моменту голосовой команды модель уже загружена
 */
export function warmOwnModel(now = Date.now()): void {
  if (config.promptMode !== 'tuned' || !config.ownLlmUrl || now - warmedAt < 60_000) return;
  warmedAt = now;
  fetch(`${config.ownLlmUrl}/health`, { signal: AbortSignal.timeout(20_000) }).catch(() => undefined);
}

export async function complete(messages: Msg[], model = config.model): Promise<{ text: string; usage: Usage }> {
  if (model === OWN_MODEL && config.ownLlmUrl) return completeOwn(messages);
  if (openAiStyle(model)) return completeChat(messages, model);
  const call = (jsonMode: boolean) =>
    retryNet('llm', () => fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Дообученная модель приходит готовым адресом (ds://…), базовая — именем в каталоге
        modelUri: modelUri(model),
        // Ответ — короткий JSON; 600 токенов с запасом хватает и на несколько записей
        completionOptions: { stream: false, temperature: 0, maxTokens: 600 },
        // Режим «только JSON»; если модель его не поддерживает — повторяем без него
        ...(jsonMode && { jsonObject: true }),
        messages,
      }),
      signal: AbortSignal.timeout(30_000),
    }));

  let res = await call(jsonModeSupported);
  let text = await res.text();
  if (res.status === 400 && jsonModeSupported && /json/i.test(text)) {
    jsonModeSupported = false;
    res = await call(false);
    text = await res.text();
  }
  if (!res.ok) throw new YandexError('llm', res.status, text);
  const r = JSON.parse(text).result ?? {};
  const u = r.usage ?? {};
  return {
    text: r.alternatives?.[0]?.message?.text ?? '',
    usage: { input: Number(u.inputTextTokens ?? 0), output: Number(u.completionTokens ?? 0), total: Number(u.totalTokens ?? 0) },
  };
}

/** OpenAI-совместимый Chat Completions AI Studio: те же сообщения, JSON-режим, расход с токенами из кэша */
let chatJsonSupported = true;

async function completeChat(messages: Msg[], model: string): Promise<{ text: string; usage: Usage }> {
  // Своя модель на Mac или своём сервере (LLM_BASE_URL): без ключа Яндекса, имя модели — как есть
  const local = !!config.llmBaseUrl;
  const call = (jsonMode: boolean) =>
    retryNet('llm', () => fetch(local ? `${config.llmBaseUrl}/v1/chat/completions` : 'https://llm.api.cloud.yandex.net/v1/chat/completions', {
      method: 'POST',
      headers: local ? { 'Content-Type': 'application/json' } : { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Свой сервер отвечает той моделью, что запущена в нём, — имя не передаём
        ...(!local && { model: modelUri(model) }),
        temperature: 0,
        max_tokens: 600,
        ...(jsonMode && { response_format: { type: 'json_object' } }),
        // Правила — всегда первыми и одинаковыми: так их начало берётся из кэша
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      }),
      signal: AbortSignal.timeout(30_000),
    }));

  let res = await call(chatJsonSupported);
  let text = await res.text();
  if (res.status === 400 && chatJsonSupported && /json|response_format/i.test(text)) {
    chatJsonSupported = false;
    res = await call(false);
    text = await res.text();
  }
  if (!res.ok) throw new YandexError('llm', res.status, text);
  const r = JSON.parse(text);
  const u = r.usage ?? {};
  const cached = Number(u.prompt_tokens_details?.cached_tokens ?? 0);
  return {
    // Qwen3 и другие «думающие» модели присылают рассуждение в <think> — в нём бывают скобки, мешающие найти JSON
    text: String(r.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, ''),
    usage: { input: Number(u.prompt_tokens ?? 0), output: Number(u.completion_tokens ?? 0), total: Number(u.total_tokens ?? 0), ...(cached && { cached }) },
  };
}
