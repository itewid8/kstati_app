/**
 * Заметка ⇄ HTML редактора (react-native-enriched-html). Хранится заметка по-прежнему строками с разметкой
 * (lib/note.ts) — сервер, голосовая правка списков и старые приложения видят тот же текст. Редактор работает с HTML:
 *   «# Название» / «## Заголовок» / «### Подзаголовок»  → <h1> / <h2> / <h3>
 *   «- [ ] пункт», «- [x] пункт»                          → <ul data-type="checkbox"><li> / <li checked>
 *   «- пункт», «1. пункт»                                  → <ul><li>, <ol><li>
 *   «> строка»                                             → <blockquote><p>
 *   строки между «```»                                     → <codeblock><p> (моноширинный)
 *   пустая строка                                          → <br>
 * Внутри строки: **жирный**, *курсив*, ++подчёркнутый++, ~~зачёркнутый~~, `код`, [текст](адрес).
 * Чистые функции, без DOM: HTML разбирается своим токенизатором (на телефоне DOM нет).
 */

/* ---------- Строки текста ---------- */

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code === 160 ? 32 : code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Адрес, который можно открыть: http(s), mailto, tel */
export const safeHref = (u: string): boolean => /^(https?:\/\/|mailto:|tel:)/i.test(u.trim());

/** Разметка внутри строки → HTML (текст уже не экранирован) */
export function inlineToHtml(md: string): string {
  // Код — первым: внутри него разметка не действует
  const codes: string[] = [];
  let s = md.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escape(s);
  // Ссылки — только http(s), почта и телефон: «javascript:» и прочие схемы остаются текстом
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t: string, u: string) => (safeHref(unescape(u)) ? `<a href="${u}">${t}</a>` : t));
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\+\+(.+?)\+\+/g, '<u>$1</u>');
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1<i>$2</i>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => `<code>${escape(codes[Number(i)] ?? '')}</code>`);
}

/** Строка без разметки внутри: для поиска, превью, буфера обмена */
export const stripInline = (md: string): string =>
  md
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\+\+(.+?)\+\+/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1$2');

/* ---------- Текст → HTML ---------- */

type Group = 'check' | 'ul' | 'ol' | 'quote' | 'code' | null;

const CHECK = /^[-*] \[( |x|X)\] ?(.*)$/;
const NUMBER = /^\d{1,3}[.)] (.*)$/;
const BULLET = /^[-*•] (.*)$/;
const HEADING = /^(#{1,3}) (.*)$/;
const QUOTE = /^> ?(.*)$/;
const FENCE = /^```\s*$/;

const OPEN: Record<Exclude<Group, null>, string> = {
  check: '<ul data-type="checkbox">',
  ul: '<ul>',
  ol: '<ol>',
  quote: '<blockquote>',
  code: '<codeblock>',
};
const CLOSE: Record<Exclude<Group, null>, string> = { check: '</ul>', ul: '</ul>', ol: '</ol>', quote: '</blockquote>', code: '</codeblock>' };

export function noteToHtml(text: string): string {
  const out: string[] = [];
  let group: Group = null;
  const enter = (g: Group) => {
    if (g === group) return;
    if (group) out.push(CLOSE[group]);
    if (g) out.push(OPEN[g]);
    group = g;
  };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (group === 'code') {
      if (FENCE.test(line)) enter(null);
      else out.push(line ? `<p>${escape(line)}</p>` : '<br>');
      continue;
    }
    if (FENCE.test(line)) {
      enter('code');
      continue;
    }
    let m = HEADING.exec(line);
    if (m) {
      enter(null);
      const level = (m[1] ?? '#').length;
      out.push(`<h${level}>${inlineToHtml(m[2] ?? '')}</h${level}>`);
      continue;
    }
    m = CHECK.exec(line);
    if (m) {
      enter('check');
      out.push(`<li${m[1] !== ' ' ? ' checked' : ''}>${inlineToHtml(m[2] ?? '')}</li>`);
      continue;
    }
    m = NUMBER.exec(line);
    if (m) {
      enter('ol');
      out.push(`<li>${inlineToHtml(m[1] ?? '')}</li>`);
      continue;
    }
    m = BULLET.exec(line);
    if (m) {
      enter('ul');
      out.push(`<li>${inlineToHtml(m[1] ?? '')}</li>`);
      continue;
    }
    m = QUOTE.exec(line);
    if (m) {
      enter('quote');
      out.push(m[1] ? `<p>${inlineToHtml(m[1])}</p>` : '<br>');
      continue;
    }
    enter(null);
    out.push(line ? `<p>${inlineToHtml(line)}</p>` : '<br>');
  }
  enter(null);
  return `<html>${out.join('')}</html>`;
}

/* ---------- HTML → текст ---------- */

type Token = { tag: string; close: boolean; attrs: string } | { text: string };

function tokens(html: string): Token[] {
  const out: Token[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) out.push({ text: m[4] });
    else out.push({ tag: (m[2] ?? '').toLowerCase(), close: m[1] === '/', attrs: m[3] ?? '' });
  }
  return out;
}

const attr = (attrs: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? unescape(m[2] ?? m[3] ?? m[4] ?? '') : null;
};
const hasAttr = (attrs: string, name: string) => new RegExp(`(^|\\s)${name}(\\s|=|$|/)`, 'i').test(attrs.trim() ? ` ${attrs.trim()}` : '');

const MARK: Record<string, string> = { b: '**', strong: '**', i: '*', em: '*', u: '++', s: '~~', strike: '~~', del: '~~', code: '`' };
const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div']);

type Line = { prefix: string; body: string; code: boolean };

export function htmlToNote(html: string): string {
  const lines: string[] = [];
  // Контейнер строк: список, цитата, код
  const containers: { tag: string; checkbox: boolean }[] = [];
  // Объявлено через as: TS не сужает до null — строку меняют вложенные функции
  let line = null as Line | null;
  // Ссылка внутри строки: адрес и место начала текста
  let link: { href: string; at: number } | null = null;
  // В коде разметка не пишется: только текст
  let inCode = 0;
  let olCount = 0;

  const container = () => containers[containers.length - 1];
  const prefixFor = (tag: string, attrs: string): string => {
    const c = container();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return `${'#'.repeat(Number(tag[1]))} `;
    if (tag === 'h4' || tag === 'h5' || tag === 'h6') return '### ';
    if (tag === 'li' && c?.tag === 'ul' && c.checkbox) return hasAttr(attrs, 'checked') || attr(attrs, 'data-checked') === 'true' ? '- [x] ' : '- [ ] ';
    if (tag === 'li' && c?.tag === 'ol') return `${++olCount}. `;
    if (tag === 'li') return '- ';
    if (c?.tag === 'blockquote') return '> ';
    return '';
  };
  const inCodeBlock = () => containers.some((c) => c.tag === 'codeblock' || c.tag === 'pre');
  const flush = () => {
    if (!line) return;
    const body = line.code ? line.body : line.body.replace(/\s+$/, '');
    // Пустой заголовок (новая заметка без названия) — пустая строка, а не «#»
    lines.push(!body && line.prefix.startsWith('#') ? '' : `${line.prefix}${body}`);
    line = null;
  };
  const start = (prefix: string) => {
    flush();
    line = { prefix, body: '', code: inCodeBlock() };
  };
  const ensure = () => {
    if (!line) start(prefixFor('p', ''));
    return line!;
  };

  for (const t of tokens(html)) {
    if ('text' in t) {
      // Переводы строк между тегами (так пишет телефон) — не текст
      if (!line && !t.text.trim()) continue;
      const text = unescape(t.text).replace(/\n/g, line?.code ? '\n' : ' ');
      if (!line && !text.trim()) continue;
      ensure().body += text;
      continue;
    }
    const { tag, close, attrs } = t;
    if (tag === 'html' || tag === 'body' || tag === 'head') continue;
    if (tag === 'ul' || tag === 'ol' || tag === 'blockquote' || tag === 'codeblock' || tag === 'pre') {
      flush();
      if (close) {
        containers.pop();
        if (tag === 'codeblock' || tag === 'pre') lines.push('```');
      } else {
        containers.push({ tag, checkbox: attr(attrs, 'data-type') === 'checkbox' || attr(attrs, 'data-type') === 'checkboxList' });
        if (tag === 'ol') olCount = 0;
        if (tag === 'codeblock' || tag === 'pre') lines.push('```');
      }
      continue;
    }
    if (tag === 'br') {
      if (line) flush();
      else lines.push(container()?.tag === 'blockquote' ? '>' : '');
      continue;
    }
    if (BLOCKS.has(tag)) {
      if (close) flush();
      // <li><p>…</p></li> (так пишет web) — <p> внутри пункта новую строку не начинает
      else if (!(tag === 'p' && line?.prefix && !line.body)) start(prefixFor(tag, attrs));
      continue;
    }
    if (tag === 'a') {
      const l = ensure();
      if (!close) link = { href: attr(attrs, 'href') ?? '', at: l.body.length };
      else if (link) {
        const text = l.body.slice(link.at);
        if (link.href && safeHref(link.href) && text.trim() !== link.href) l.body = `${l.body.slice(0, link.at)}[${text}](${link.href})`;
        link = null;
      }
      continue;
    }
    const mark = MARK[tag];
    if (mark) {
      const l = ensure();
      if (l.code) continue;
      if (tag === 'code') inCode += close ? -1 : 1;
      else if (inCode) continue;
      l.body += mark;
    }
    // Прочие теги (mention, img, span) — только их текст
  }
  flush();
  return tidy(lines).join('\n').replace(/\s+$/, '');
}

/** Пустые пары разметки («****» после стёртого текста) и пары вокруг одних пробелов — убрать */
const tidy = (lines: string[]): string[] =>
  lines.map((l) => (FENCE.test(l) ? l : l.replace(/\*\*\*\*|\+\+\+\+|~~~~|``/g, '').replace(/(\*\*|\+\+|~~)(\s+)\1/g, '$2')));

/** Пустой HTML новой заметки: первая строка — название (как «Заметки» на iPhone) */
export const NEW_NOTE_HTML = '<html><h1></h1></html>';

/* ---------- Выход из списка ---------- */

/** Строка для сравнения: без номера пункта и пробелов в конце (у последней строки текста их нет) */
const unnumber = (line: string) => line.replace(/^\d{1,3}\. ?/, '1. ').trimEnd();
const EMPTY_ITEM = /^(?:- \[[ xX]\]|-|\d{1,3}\.) ?$/;
const itemKind = (line: string) => (line.startsWith('- [') ? 'check' : line.startsWith('-') ? 'bullet' : 'number');
/** Длина строки в поле (без разметки вида строки) */
const shownLength = (line: string) => line.replace(/^(?:#{1,3} |- \[[ xX]\] ?|[-*•] |\d{1,3}[.)] |> ?)/, '').replace(/\*\*|\+\+|~~|`/g, '').length;

/**
 * Enter в пустом пункте списка: стало на одну строку больше, и новая строка — снова пустой пункт того же вида
 * сразу после пустого. Тогда — текст, где тот пустой пункт стал обычной пустой строкой, и место курсора в нём.
 */
export function listExit(before: string, after: string): { text: string; at: number } | null {
  // Номера пунктов после вставки сдвигаются — сравниваем без них
  const a = before.split('\n').map(unnumber);
  const b = after.split('\n');
  const bn = b.map(unnumber);
  if (b.length !== a.length + 1) return null;
  for (let k = 1; k < b.length; k++) {
    const prev = b[k - 1] ?? '';
    const cur = b[k] ?? '';
    if (!EMPTY_ITEM.test(prev) || !EMPTY_ITEM.test(cur) || itemKind(prev) !== itemKind(cur)) continue;
    // До Enter строки совпадали, пустой пункт был последним в своём месте
    if (a.slice(0, k).join('\n') !== bn.slice(0, k).join('\n') || a.slice(k).join('\n') !== bn.slice(k + 1).join('\n')) continue;
    const lines = [...b.slice(0, k - 1), '', ...b.slice(k + 1)];
    const at = lines.slice(0, k - 1).reduce((n, l) => n + shownLength(l) + 1, 0);
    return { text: lines.join('\n'), at };
  }
  return null;
}
