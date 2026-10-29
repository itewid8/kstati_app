/**
 * Заметки-списки голосом. Тема — сама заметка (её текст — строки с разметкой, как в приложении: «- [ ] пункт»).
 *  listBody — пункты в текст чек-листа;
 *  spokenList — «Список продуктов: молоко, яйца и хлеб» → название и пункты (запасной разбор, если модель вернула текст);
 *  applyListEdit — добавить, убрать, заменить, отметить пункты в тексте темы; changes — что поменялось, для карточки.
 * Пункты сравниваются без регистра, «ё/е» и знаков; совпадение — равенство или одно слово внутри другого.
 */

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.trim().replace(/[.;!]+$/, '').trim();
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const listBody = (items: readonly string[]): string =>
  items
    .map(clean)
    .filter(Boolean)
    .map((x) => `- [ ] ${cap(x)}`)
    .join('\n');

/** «Название: а, б, в и г» → { title, items }; меньше двух пунктов — не список */
export function spokenList(text: string): { title: string; items: string[] } | null {
  const m = /^\s*([^:\n]{2,60}):\s*(.+)$/s.exec(text);
  if (!m) return null;
  const items = m[2]!
    .split(/\s*(?:,|;|\n|\s+и\s+|\s+а также\s+)\s*/i)
    .map(clean)
    .filter(Boolean);
  if (items.length < 2) return null;
  return { title: cap(clean(m[1]!)), items };
}

type Line = { raw: string; item: string | null; checked: boolean };

const CHECK = /^[-*] \[( |x|X)\] ?(.*)$/;
const BULLET = /^(?:[-*•]|\d{1,3}[.)]) (.*)$/;

function lines(body: string): Line[] {
  if (!body.trim()) return [];
  return body.split('\n').map((raw) => {
    const c = CHECK.exec(raw);
    if (c) return { raw, item: c[2] ?? '', checked: c[1] !== ' ' };
    const b = BULLET.exec(raw);
    return { raw, item: b ? (b[1] ?? '') : null, checked: false };
  });
}

/** Пункт, который назвали: точное совпадение, иначе — одно внутри другого (первое) */
function find(ls: Line[], name: string): number {
  const n = norm(name);
  if (!n) return -1;
  const exact = ls.findIndex((l) => l.item !== null && norm(l.item) === n);
  if (exact >= 0) return exact;
  return ls.findIndex((l) => {
    if (l.item === null) return false;
    const x = norm(l.item);
    return !!x && (x.includes(n) || n.includes(x));
  });
}

const line = (item: string, checked = false) => `- [${checked ? 'x' : ' '}] ${cap(item)}`;

export type ListEdit = {
  add?: string[];
  remove?: string[];
  replace?: { from: string; to: string }[];
  check?: string[];
  uncheck?: string[];
};

export function applyListEdit(body: string, edit: ListEdit): { body: string; changes: string[] } {
  const ls = lines(body);
  const changes: string[] = [];
  for (const r of edit.replace ?? []) {
    const i = find(ls, r.from);
    const to = clean(r.to);
    if (i < 0 || !to) continue;
    const l = ls[i]!;
    ls[i] = { raw: line(to, l.checked), item: cap(to), checked: l.checked };
    changes.push(`${l.item} → ${cap(to)}`);
  }
  for (const name of edit.remove ?? []) {
    const i = find(ls, name);
    if (i < 0) continue;
    changes.push(`− ${ls[i]!.item}`);
    ls.splice(i, 1);
  }
  for (const [names, checked] of [
    [edit.check ?? [], true],
    [edit.uncheck ?? [], false],
  ] as const) {
    for (const name of names) {
      const i = find(ls, name);
      if (i < 0) continue;
      const l = ls[i]!;
      ls[i] = { raw: line(l.item ?? '', checked), item: l.item, checked };
      changes.push(`${checked ? '✓' : '○'} ${l.item}`);
    }
  }
  const add = (edit.add ?? []).map(clean).filter((x) => x && find(ls, x) < 0);
  if (add.length) {
    // Новые пункты — после последнего пункта списка (или в конец)
    let at = ls.length;
    for (let i = ls.length - 1; i >= 0; i--)
      if (ls[i]!.item !== null) {
        at = i + 1;
        break;
      }
    ls.splice(at, 0, ...add.map((x) => ({ raw: line(x), item: cap(x), checked: false })));
    changes.push(...add.map((x) => `+ ${cap(x)}`));
  }
  return { body: ls.map((l) => l.raw).join('\n'), changes };
}

/** Текст темы для подсказки модели: пункты через «; », не длиннее limit */
export function bodyHint(body: string, limit = 300): string {
  const items = lines(body).map((l) => (l.item !== null ? `${l.checked ? '✓' : ''}${l.item}` : l.raw.replace(/^#+ /, ''))).filter((x) => x.trim());
  const s = items.join('; ');
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}
