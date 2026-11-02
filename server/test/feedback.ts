/** Отзывы письмом (src/mail.ts): MIME с текстом, снимком экрана и сведениями из приложения — всё в base64 */
import assert from 'node:assert/strict';
import { mimeMessage } from '../src/mail.js';

const jpg = Buffer.from('fake-jpeg').toString('base64');
const raw = mimeMessage({
  from: 'noreply@kstati-app.ru',
  to: 'support@kstati-app.ru',
  subject: 'Ошибка от Саши',
  text: 'Зависает при правке заметки',
  files: [
    { name: 'screen-ab12.jpg', type: 'image/jpeg', base64: jpg },
    { name: 'context-ab12.json', type: 'application/json', base64: Buffer.from('{"screen":"/note/1"}').toString('base64') },
  ],
});
const boundary = /boundary="([^"]+)"/.exec(raw)?.[1];
assert.ok(boundary, 'multipart с границей');
assert.match(raw, /^From: =\?UTF-8\?B\?[^?]+\?= <noreply@kstati-app\.ru>\r\n/);
assert.ok(raw.includes(`Subject: =?UTF-8?B?${Buffer.from('Ошибка от Саши').toString('base64')}?=`));
assert.equal(raw.split(`--${boundary}\r\n`).length - 1, 3, 'текст и два вложения');
assert.ok(raw.endsWith(`--${boundary}--\r\n`));
assert.ok(raw.includes(Buffer.from('Зависает при правке заметки').toString('base64')));
assert.ok(raw.includes('Content-Disposition: attachment; filename="screen-ab12.jpg"'));
assert.ok(raw.includes(jpg));
// Строки base64 не длиннее 76 знаков
const long = 'A'.repeat(500);
const lines = mimeMessage({ from: 'a@b', to: 'c@d', subject: 's', text: 't', files: [{ name: 'x.bin', type: 'application/octet-stream', base64: long }] }).split('\r\n');
assert.ok(lines.every((l) => l.length <= 998) && lines.filter((l) => /^A+$/.test(l)).every((l) => l.length <= 76));
console.log('feedback: ok');
