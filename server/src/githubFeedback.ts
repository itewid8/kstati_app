/**
 * Отзыв → задача (issue) в закрытом репозитории FEEDBACK_REPO (например itewid8/kstati-feedback).
 * Снимок экрана (если есть) кладётся файлом в репозиторий (screenshots/ГГГГ-ММ/<id>.jpg) и вставляется в задачу.
 * Метки: «ошибка» / «предложение» и «новое» (снимает разбор). Нет токена или репозитория — ничего не делаем.
 * Токен GITHUB_FEEDBACK_TOKEN (Lockbox): fine-grained, только этот репозиторий, Issues и Contents — чтение и запись.
 */
import { config } from './config.js';

export type FeedbackIssue = {
  id: string;
  kind: 'bug' | 'idea';
  text: string;
  user: { id: string; name: string; email: string | null };
  app: string | null;
  api: number;
  device: string | null;
  ts: string;
  /** Сведения из приложения (экран, связь, журнал событий) — JSON как есть */
  context?: Record<string, unknown> | null;
  /** JPEG в base64 */
  screenshot?: string | null;
};

export type GithubDeps = { fetch?: typeof fetch };

const LABELS: Record<string, string> = { ошибка: 'd73a4a', предложение: '0e8a16', новое: 'fbca04', разобрано: 'cccccc' };
let labelsReady = false;

const api = async (deps: GithubDeps, method: string, path: string, body?: unknown) => {
  const res = await (deps.fetch ?? fetch)(`https://api.github.com/repos/${config.feedbackRepo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.githubFeedbackToken}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'kstati-server',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res;
};

/** Метки создаются один раз за жизнь сервера; уже есть (422) — тоже хорошо */
async function ensureLabels(deps: GithubDeps) {
  if (labelsReady) return;
  for (const [name, color] of Object.entries(LABELS)) await api(deps, 'POST', '/labels', { name, color }).catch(() => null);
  labelsReady = true;
}

const quote = (s: string) =>
  s
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Текст задачи: что написали, снимок, таблица сведений, подробности под катом */
export function issueBody(f: FeedbackIssue, shotPath: string | null): string {
  const rows: [string, string][] = [
    ['Кто', `${f.user.name || '—'} (${f.user.email ?? f.user.id})`],
    ['Приложение', `${f.app ?? '—'} · API ${f.api}`],
    ['Устройство', f.device ?? '—'],
    ['Когда', f.ts],
    ['id отзыва', f.id],
  ];
  const ctx = f.context && Object.keys(f.context).length ? `\n\n<details><summary>Сведения из приложения</summary>\n\n\`\`\`json\n${JSON.stringify(f.context, null, 2).slice(0, 30_000)}\n\`\`\`\n</details>` : '';
  const shot = shotPath ? `\n\n![Снимок экрана](https://github.com/${config.feedbackRepo}/blob/main/${shotPath}?raw=true)` : '';
  return `${quote(f.text)}${shot}\n\n| | |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${cell(v)} |`).join('\n')}${ctx}`;
}

export const issueTitle = (f: Pick<FeedbackIssue, 'kind' | 'text'>) => {
  const first = f.text.trim().split('\n')[0] ?? '';
  return `${f.kind === 'bug' ? 'Ошибка' : 'Предложение'}: ${first.length > 70 ? `${first.slice(0, 69)}…` : first}`;
};

/** Создать задачу; вернуть её адрес. Не настроено или GitHub не ответил — null (отзыв всё равно сохранён) */
export async function createFeedbackIssue(f: FeedbackIssue, deps: GithubDeps = {}): Promise<string | null> {
  if (!config.githubFeedbackToken || !config.feedbackRepo) return null;
  await ensureLabels(deps);
  let shotPath: string | null = null;
  if (f.screenshot) {
    const path = `screenshots/${f.ts.slice(0, 7)}/${f.id}.jpg`;
    const res = await api(deps, 'PUT', `/contents/${path}`, { message: `Снимок к отзыву ${f.id}`, content: f.screenshot }).catch(() => null);
    if (res?.ok) shotPath = path;
  }
  const res = await api(deps, 'POST', '/issues', {
    title: issueTitle(f),
    body: issueBody(f, shotPath),
    labels: [f.kind === 'bug' ? 'ошибка' : 'предложение', 'новое'],
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const issue = (await res.json()) as { html_url?: unknown };
  return typeof issue.html_url === 'string' ? issue.html_url : null;
}
