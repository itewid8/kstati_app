import { config } from './config.js';

const headers = () => ({
  Authorization: `Api-Key ${config.apiKey}`,
  'x-folder-id': config.folderId,
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

/** SpeechKit v1, синхронное распознавание: OggOpus до 30 с и 1 МБ → текст */
export async function recognize(ogg: Buffer): Promise<string> {
  const url = new URL('https://stt.api.cloud.yandex.net/speech/v1/stt:recognize');
  url.searchParams.set('folderId', config.folderId);
  url.searchParams.set('lang', 'ru-RU');
  url.searchParams.set('format', 'oggopus');
  const res = await retryNet('stt', () => fetch(url, { method: 'POST', headers: headers(), body: new Uint8Array(ogg), signal: AbortSignal.timeout(20_000) }));
  const text = await res.text();
  if (!res.ok) throw new YandexError('stt', res.status, text);
  return (JSON.parse(text).result as string | undefined)?.trim() ?? '';
}

export type Msg = { role: 'system' | 'user' | 'assistant'; text: string };

/** Сколько токенов ушло на вызов (Яндекс присылает числа строками) */
export type Usage = { input: number; output: number; total: number };
export const addUsage = (a: Usage, b: Usage): Usage => ({ input: a.input + b.input, output: a.output + b.output, total: a.total + b.total });
export const NO_USAGE: Usage = { input: 0, output: 0, total: 0 };

/** Foundation Models API: сообщения → текст ответа модели (просим JSON) и расход токенов */
let jsonModeSupported = true;

export async function complete(messages: Msg[], model = config.model): Promise<{ text: string; usage: Usage }> {
  const call = (jsonMode: boolean) =>
    retryNet('llm', () => fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelUri: `gpt://${config.folderId}/${model}`,
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
