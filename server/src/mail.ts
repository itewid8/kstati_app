/**
 * Письма через Yandex Cloud Postbox (API, совместимый с Amazon SES v2), подпись SigV4.
 * Без настроек (MAIL_FROM пуст) — письмо выводится в консоль сервера: удобно на Mac.
 */
import { config } from './config.js';
import { signV4 } from './sigv4.js';

const ENDPOINT = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';

export const mailConfigured = () => !!(config.mailFrom && config.awsKeyId && config.awsSecret);

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailConfigured()) {
    console.log(`\n✉ Письмо для ${to}\n  Тема: ${subject}\n  ${text.replace(/\n/g, '\n  ')}\n`);
    return;
  }
  const body = JSON.stringify({
    // Имя отправителя не латиницей — только в MIME-кодировке (RFC 2047), иначе API отклоняет адрес
    FromEmailAddress: `=?UTF-8?B?${Buffer.from('Кстати').toString('base64')}?= <${config.mailFrom}>`,
    Destination: { ToAddresses: [to] },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' } } } },
  });
  const headers = { 'content-type': 'application/json' };
  const signed = signV4({
    method: 'POST',
    url: ENDPOINT,
    headers,
    body,
    region: 'ru-central1',
    service: 'ses',
    accessKeyId: config.awsKeyId,
    secretAccessKey: config.awsSecret,
  });
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { ...headers, ...signed }, body, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Postbox ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
