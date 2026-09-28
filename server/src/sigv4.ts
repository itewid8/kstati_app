/**
 * Подпись запросов AWS Signature V4 — ею Yandex Cloud принимает запросы к YDB (Document API)
 * и Postbox (почта) по статическому ключу доступа сервисного аккаунта. Без SDK, только node:crypto.
 */
import { createHash, createHmac } from 'node:crypto';

const sha256hex = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest();

export type SignInput = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** для тестов; по умолчанию — сейчас */
  date?: Date;
};

const encodeSegment = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Возвращает заголовки, которые нужно добавить к запросу (x-amz-date, authorization) */
export function signV4(input: SignInput): Record<string, string> {
  const u = new URL(input.url);
  const date = input.date ?? new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20150830T123600Z
  const day = amzDate.slice(0, 8);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers)) headers[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  headers['host'] = u.host;
  headers['x-amz-date'] = amzDate;

  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalUri = u.pathname.split('/').map((seg) => encodeSegment(decodeURIComponent(seg))).join('/') || '/';
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeSegment(k), encodeSegment(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [input.method.toUpperCase(), canonicalUri, query, canonicalHeaders, signedHeaders.join(';'), sha256hex(input.body)].join('\n');
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${input.secretAccessKey}`, day);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`,
  };
}
