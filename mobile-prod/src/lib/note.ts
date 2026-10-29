/**
 * Заметка (бывшая идея): текст хранится строками с разметкой, как в Markdown, — сервер и старые приложения
 * видят обычный текст, новые показывают строки по видам:
 *   «# Заголовок»          — заголовок
 *   «- [ ] пункт», «- [x]» — чек-лист
 *   «1. пункт»             — нумерованный список (номера считаются заново при сохранении)
 *   «- пункт»              — маркированный список
 *   «**строка**»           — жирная строка (у текста и пунктов)
 *   остальное              — обычный текст
 * Старые идеи без разметки — просто текст.
 */

export type NoteKind = 'text' | 'heading' | 'check' | 'number' | 'bullet';

export type NoteBlock = {
  kind: NoteKind;
  text: string;
  /** Чек-лист: отмечено */
  checked?: boolean;
  /** Жирная строка (у заголовка не бывает — он и так жирный) */
  bold?: boolean;
};

const CHECK = /^[-*] \[( |x|X)\] ?(.*)$/;
const NUMBER = /^\d{1,3}[.)] (.*)$/;
const BULLET = /^[-*•] (.*)$/;
const HEADING = /^#{1,3} (.*)$/;
const BOLD = /^\*\*(.+)\*\*$/;

function boldOf(text: string): { text: string; bold?: true } {
  const m = BOLD.exec(text);
  return m?.[1] !== undefined ? { text: m[1], bold: true } : { text };
}

export function parseLine(line: string): NoteBlock {
  let m = HEADING.exec(line);
  if (m) return { kind: 'heading', text: m[1] ?? '' };
  m = CHECK.exec(line);
  if (m) return { kind: 'check', checked: m[1] !== ' ', ...boldOf(m[2] ?? '') };
  m = NUMBER.exec(line);
  if (m) return { kind: 'number', ...boldOf(m[1] ?? '') };
  m = BULLET.exec(line);
  if (m) return { kind: 'bullet', ...boldOf(m[1] ?? '') };
  return { kind: 'text', ...boldOf(line) };
}

export const parseNote = (text: string): NoteBlock[] => text.replace(/\r\n?/g, '\n').split('\n').map(parseLine);

/** Номер пункта: по порядку в непрерывном нумерованном списке */
export function numberOf(blocks: readonly NoteBlock[], i: number): number {
  let n = 0;
  for (let j = i; j >= 0 && blocks[j]?.kind === 'number'; j--) n++;
  return n;
}

export function serializeNote(blocks: readonly NoteBlock[]): string {
  return blocks
    .map((b, i) => {
      const body = b.bold && b.kind !== 'heading' && b.text.trim() ? `**${b.text}**` : b.text;
      switch (b.kind) {
        case 'heading':
          return `# ${b.text}`;
        case 'check':
          return `- [${b.checked ? 'x' : ' '}] ${body}`;
        case 'number':
          return `${numberOf(blocks, i)}. ${body}`;
        case 'bullet':
          return `- ${body}`;
        default:
          return body;
      }
    })
    .join('\n')
    .replace(/\s+$/, '');
}

/** Пустая заметка: ни одной строки с текстом */
export const isBlankNote = (blocks: readonly NoteBlock[]) => blocks.every((b) => !b.text.trim());

/** Строка без разметки — для поиска, голоса, превью */
export const plainLine = (line: string) => parseLine(line).text.trim();

export type NotePreview = {
  /** Первая непустая строка */
  title: string;
  /** Вторая непустая строка */
  line: string;
  /** Чек-лист: «2/5» */
  checks: string | null;
};

export function notePreview(text: string): NotePreview {
  const blocks = parseNote(text);
  const lines = blocks.map((b) => b.text.trim()).filter(Boolean);
  const checks = blocks.filter((b) => b.kind === 'check' && b.text.trim());
  return {
    title: lines[0] ?? '',
    line: lines[1] ?? '',
    checks: checks.length ? `${checks.filter((b) => b.checked).length}/${checks.length}` : null,
  };
}

/** Вид строки после «Enter»: пункт списка продолжает список, заголовок — обычный текст */
export const nextKind = (kind: NoteKind): NoteKind => (kind === 'heading' ? 'text' : kind);

/** Переключить вид строки кнопкой панели: тот же вид — обратно в текст */
export function toggleKind(b: NoteBlock, kind: NoteKind): NoteBlock {
  const to: NoteKind = b.kind === kind ? 'text' : kind;
  return { kind: to, text: b.text, ...(to === 'check' && { checked: false }), ...(b.bold && to !== 'heading' && { bold: true }) };
}

/** Название заметки — первая строка-заголовок («# …»); остальное — текст */
export function splitTitle(text: string): { title: string; body: string } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const first = parseLine(lines[0] ?? '');
  if (first.kind !== 'heading') return { title: '', body: text };
  return { title: first.text, body: lines.slice(1).join('\n') };
}

/** Обратно: название первой строкой-заголовком (пустое — без неё) */
export const joinTitle = (title: string, body: string): string => {
  const t = title.trim();
  return t ? (body.trim() ? `# ${t}\n${body}` : `# ${t}`) : body;
};

/** Текст для буфера обмена: без разметки, пункты — «☐ / ☑», «1.», «•» */
export function notePlain(text: string): string {
  const blocks = parseNote(text);
  return blocks
    .map((b, i) => {
      switch (b.kind) {
        case 'check':
          return `${b.checked ? '☑' : '☐'} ${b.text}`;
        case 'number':
          return `${numberOf(blocks, i)}. ${b.text}`;
        case 'bullet':
          return `• ${b.text}`;
        default:
          return b.text;
      }
    })
    .join('\n')
    .trim();
}
