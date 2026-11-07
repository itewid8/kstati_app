/**
 * Письма через Yandex Cloud Postbox (API, совместимый с Amazon SES v2), подпись SigV4.
 * Без настроек (MAIL_FROM пуст) — письмо выводится в консоль сервера: удобно на Mac.
 */
import { config } from './config.js';
import { signV4 } from './sigv4.js';

const ENDPOINT = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';

export const mailConfigured = () => !!(config.mailFrom && config.awsKeyId && config.awsSecret);

/** Вложение письма: имя файла, тип, содержимое в base64 */
export type MailFile = { name: string; type: string; base64: string };

const FROM_NAME = `=?UTF-8?B?${Buffer.from('Кстати').toString('base64')}?=`;
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
/** base64 строками по 76 знаков (RFC 2045) */
const wrap = (s: string) => s.replace(/.{1,76}/g, '$&\r\n');

/** Письмо MIME с текстом и вложениями (для Postbox Raw): UTF-8, всё в base64 */
export function mimeMessage(m: { from: string; to: string; subject: string; text: string; files: readonly MailFile[] }): string {
  const boundary = `kstati-${Date.now().toString(36)}`;
  const head = [
    `From: ${FROM_NAME} <${m.from}>`,
    `To: ${m.to}`,
    `Subject: =?UTF-8?B?${b64(m.subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
  ];
  const parts = [
    [`--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(m.text))].join('\r\n'),
    ...m.files.map((f) =>
      [
        `--${boundary}`,
        `Content-Type: ${f.type}; name="${f.name}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${f.name}"`,
        '',
        wrap(f.base64.replace(/\s+/g, '')),
      ].join('\r\n'),
    ),
  ];
  return [...head, ...parts, `--${boundary}--`, ''].join('\r\n');
}

/**
 * Письмо. С вложениями — в формате MIME (Raw); Postbox его не принял — то же письмо без вложений,
 * с пометкой, что они не дошли
 */
export async function sendMail(to: string, subject: string, text: string, files: readonly MailFile[] = []): Promise<void> {
  if (!mailConfigured()) {
    // На рабочем сервере текст письма (там коды входа) в журнал не пишем
    if (config.isProd) {
      console.warn(`Почта не настроена: письмо «${subject.replace(/\d{6}/g, '······')}» не отправлено`);
      return;
    }
    const att = files.length ? `\n  Вложения: ${files.map((f) => f.name).join(', ')}` : '';
    console.log(`\n✉ Письмо для ${to}\n  Тема: ${subject}\n  ${text.replace(/\n/g, '\n  ')}${att}\n`);
    return;
  }
  if (files.length) {
    const raw = mimeMessage({ from: config.mailFrom, to, subject, text, files });
    const sent = await post({ FromEmailAddress: `${FROM_NAME} <${config.mailFrom}>`, Destination: { ToAddresses: [to] }, Content: { Raw: { Data: b64raw(raw) } } }).then(
      () => true,
      (e: unknown) => {
        console.error(`Письмо с вложениями не отправлено: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      },
    );
    if (sent) return;
    text += `\n\n(Вложения не дошли: ${files.map((f) => f.name).join(', ')})`;
  }
  await post({
    // Имя отправителя не латиницей — только в MIME-кодировке (RFC 2047), иначе API отклоняет адрес
    FromEmailAddress: `${FROM_NAME} <${config.mailFrom}>`,
    Destination: { ToAddresses: [to] },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' } } } },
  });
}

const b64raw = (raw: string) => Buffer.from(raw, 'utf8').toString('base64');

async function post(payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
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
