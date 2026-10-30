/** Отзыв → задача в GitHub: метки, снимок файлом, текст задачи (сеть подменена) */
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createFeedbackIssue, issueBody, issueTitle } from '../src/githubFeedback.js';

const calls: { method: string; url: string; body: any }[] = [];
const fake = (async (url: string, init: RequestInit) => {
  calls.push({ method: String(init.method), url, body: init.body ? JSON.parse(String(init.body)) : null });
  if (url.endsWith('/issues')) return new Response(JSON.stringify({ html_url: 'https://github.com/o/r/issues/1' }), { status: 201 });
  return new Response('{}', { status: url.endsWith('/labels') ? 422 : 201 });
}) as unknown as typeof fetch;

const f = {
  id: 'ab12cd34',
  kind: 'bug' as const,
  text: 'Зависает при правке заметки\nвторая строка',
  user: { id: 'u1', name: 'Саня', email: 's@x.ru' },
  app: 'kstati/1.0',
  api: 3,
  device: 'ios 18',
  ts: '2026-10-30T10:00:00.000Z',
  context: { screen: '/note/1' },
  screenshot: 'AAAA',
};

assert.equal(await createFeedbackIssue(f, { fetch: fake }), null, 'не настроено — ничего');
assert.equal(calls.length, 0);
const saved = { ...config };
config.feedbackRepo = 'o/r';
config.githubFeedbackToken = 't';
assert.equal(await createFeedbackIssue(f, { fetch: fake }), 'https://github.com/o/r/issues/1');
assert.equal(calls.filter((c) => c.url.endsWith('/labels')).length, 4, 'метки создаются один раз');
const put = calls.find((c) => c.method === 'PUT');
assert.equal(put?.url, 'https://api.github.com/repos/o/r/contents/screenshots/2026-10/ab12cd34.jpg');
const issue = calls.find((c) => c.url.endsWith('/issues'))!.body;
assert.equal(issue.title, 'Ошибка: Зависает при правке заметки');
assert.deepEqual(issue.labels, ['ошибка', 'новое']);
assert.ok(issue.body.includes('![Снимок экрана](https://github.com/o/r/blob/main/screenshots/2026-10/ab12cd34.jpg?raw=true)'));
assert.ok(issue.body.includes('"screen": "/note/1"'));
await createFeedbackIssue({ ...f, kind: 'idea', screenshot: null }, { fetch: fake });
assert.equal(calls.filter((c) => c.url.endsWith('/labels')).length, 4, 'второй раз метки не создаются');
assert.equal(issueTitle({ kind: 'idea', text: 'x'.repeat(100) }).length, 'Предложение: '.length + 70);
assert.ok(!issueBody({ ...f, context: null }, null).includes('<details>'));
Object.assign(config, saved);
console.log('✓ отзыв → задача в GitHub');
