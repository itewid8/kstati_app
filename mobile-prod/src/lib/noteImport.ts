/**
 * Заметки из других приложений → заметки «Кстати» (текст с разметкой lib/note.ts: «# название», «- [ ] пункт»).
 *
 * Источники:
 *  - «Поделиться» (Android): тема письма (Keep кладёт туда название) и текст; списки приходят строками
 *    «☐ / ☑ / □ / ✓ пункт» или «- [ ] пункт» — становятся чек-листом;
 *  - Google Takeout (Keep/*.json): title, textContent или listContent, ярлыки, архив, корзина;
 *  - .txt / .md: название — первый «# заголовок» или имя файла.
 * Уже перенесённая — та, чей текст совпадает с моей заметкой.
 */
import { joinTitle } from './note';

export type IncomingNote = {
  /** Ключ в списке */
  key: string;
  title: string;
  /** Текст с разметкой (без названия) */
  body: string;
  /** Ярлыки (Keep) — темы при «по ярлыкам» */
  labels: string[];
  /** Дата (ISO), если известна */
  at?: string;
  /** Из корзины Keep — не предлагаем */
  trashed?: boolean;
};

const CHECKED = /^\s*(?:☑|☒|✓|✔|\[x\]|\[X\]|[-*] \[[xX]\])\s*(.*)$/;
const UNCHECKED = /^\s*(?:☐|□|▢|◻|\[ \]|[-*] \[ \])\s*(.*)$/;

/** Строки-списки «☐ / ☑» → разметка чек-листа; остальное как есть */
export function toMarkup(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      let m = CHECKED.exec(line);
      if (m) return `- [x] ${m[1]?.trim() ?? ''}`;
      m = UNCHECKED.exec(line);
      if (m) return `- [ ] ${m[1]?.trim() ?? ''}`;
      return line.replace(/\s+$/, '');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Текст заметки «Кстати» */
export const noteText = (n: Pick<IncomingNote, 'title' | 'body'>) => joinTitle(n.title, n.body).slice(0, 20000);

/** Сколько пунктов в чек-листе */
export const checkCount = (body: string) => body.split('\n').filter((l) => l.startsWith('- [')).length;

const TITLE_MAX = 80;

/**
 * Пришло через «Поделиться»: тема (если есть) — название; иначе первая короткая строка, когда за ней есть текст.
 * Несколько текстов — несколько заметок.
 */
export function fromShare(p: { subject?: string | null; texts: readonly string[] }, now = new Date().toISOString()): IncomingNote[] {
  const subject = p.subject?.trim() ?? '';
  return p.texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((raw, i) => {
      let title = p.texts.length === 1 ? subject : '';
      let body = raw;
      if (title && body.startsWith(title)) body = body.slice(title.length).trim();
      if (!title) {
        const [first = '', ...rest] = raw.split(/\r?\n/);
        const f = first.trim();
        if (rest.join('').trim() && f.length <= TITLE_MAX && !UNCHECKED.test(f) && !CHECKED.test(f)) {
          title = f.replace(/^#+\s*/, '');
          body = rest.join('\n');
        }
      }
      return { key: `s${i}`, title, body: toMarkup(body), labels: [], at: now };
    });
}

/** Подпись источника по пакету Android: «GOOGLE KEEP»; не знаем — null */
export function sourceLabel(pkg: string | null | undefined): string | null {
  if (!pkg) return null;
  const known: Record<string, string> = {
    'com.google.android.keep': 'GOOGLE KEEP',
    'com.samsung.android.app.notes': 'SAMSUNG NOTES',
    'com.miui.notes': 'XIAOMI NOTES',
    'com.huawei.notepad': 'HUAWEI NOTES',
    'com.hihonor.notepad': 'HONOR NOTES',
    'org.telegram.messenger': 'TELEGRAM',
    'com.whatsapp': 'WHATSAPP',
    'com.microsoft.office.onenote': 'ONENOTE',
    'com.evernote': 'EVERNOTE',
    'md.obsidian': 'OBSIDIAN',
    'ru.yandex.disk': 'ЯНДЕКС ДИСК',
  };
  return known[pkg] ?? null;
}

const usecToIso = (v: unknown) => (typeof v === 'number' && v > 0 ? new Date(Math.round(v / 1000)).toISOString() : undefined);

/** Заметка Google Keep из Takeout (Keep/<имя>.json); не заметка — null */
export function fromKeepJson(json: unknown, key: string): IncomingNote | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  let body = '';
  if (Array.isArray(r.listContent)) {
    body = r.listContent
      .map((x) => (x && typeof x === 'object' ? (x as { text?: unknown; isChecked?: unknown }) : {}))
      .filter((x) => typeof x.text === 'string' && x.text.trim())
      .map((x) => `- [${x.isChecked ? 'x' : ' '}] ${String(x.text).trim()}`)
      .join('\n');
  } else if (typeof r.textContent === 'string') body = toMarkup(r.textContent);
  if (!title && !body.trim()) return null;
  const labels = Array.isArray(r.labels)
    ? r.labels.map((l) => (l && typeof l === 'object' && typeof (l as { name?: unknown }).name === 'string' ? (l as { name: string }).name.trim() : '')).filter(Boolean)
    : [];
  return {
    key,
    title,
    body,
    labels,
    ...(usecToIso(r.userEditedTimestampUsec) && { at: usecToIso(r.userEditedTimestampUsec) }),
    ...(r.isTrashed === true && { trashed: true }),
  };
}

/** .txt / .md: название — «# заголовок» в первой строке или имя файла без расширения */
export function fromTextFile(name: string, text: string, key: string): IncomingNote | null {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return null;
  const lines = clean.split('\n');
  const h = /^#{1,3}\s+(.*)$/.exec(lines[0] ?? '');
  const title = h ? (h[1] ?? '').trim() : name.replace(/\.[^.]+$/, '').trim();
  const body = toMarkup(h ? lines.slice(1).join('\n') : clean);
  return { key, title, body, labels: [] };
}

/** Название для списка: своё, иначе первая строка текста */
export function displayTitle(n: Pick<IncomingNote, 'title' | 'body'>): string {
  if (n.title.trim()) return n.title.trim();
  const first = n.body.split('\n').find((l) => l.trim()) ?? '';
  return first.replace(/^- \[[ x]\] /, '').trim().slice(0, TITLE_MAX) || 'Пустая заметка';
}

/** Куда переносить: по ярлыкам, без темы, в новую тему, в свою тему (t:<id>) */
export type NoteDest = 'labels' | 'none' | 'new' | 'each' | `t:${string}`;
export type NoteTarget = { id: string } | { title: string } | null;

/** Тема для заметки при выбранном «куда» */
export function targetOf(n: Pick<IncomingNote, 'labels'>, dest: NoteDest, newTitle: string): NoteTarget {
  if (dest === 'none' || dest === 'each') return null;
  if (dest === 'new') return { title: newTitle };
  if (dest === 'labels') return n.labels[0] ? { title: n.labels[0] } : null;
  return { id: dest.slice(2) };
}

/** Группы списка: по ярлыку (при «по ярлыкам»), иначе одна; ключ группы — ярлык или «*» */
export function groupNotes<T extends Pick<IncomingNote, 'labels'>>(notes: readonly T[], byLabels: boolean): { key: string; label: string | null; notes: T[] }[] {
  if (!byLabels) return notes.length ? [{ key: '*', label: null, notes: [...notes] }] : [];
  const map = new Map<string, T[]>();
  for (const n of notes) {
    const k = n.labels[0] ?? '';
    map.set(k, [...(map.get(k) ?? []), n]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'ru')))
    .map(([k, list]) => ({ key: k || '*', label: k || null, notes: list }));
}
