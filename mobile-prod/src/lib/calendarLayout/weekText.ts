/**
 * Текст в узком блоке недели (C-Week): что и как показать, считается заранее — без замеров и мигания.
 *  timeLines — время: целиком одной строкой, иначе начало и конец двумя строками («18:00» / «20:00»), иначе не показываем.
 *  titlePlan — название: перенос по словам; слово шире колонки — по слогам (мягкие переносы, правила русского переноса);
 *    если и слог не влезает — бегущая строка (marquee).
 * Ширины — оценка: моноширинный знак 0.6 кегля; у Geist 600 — по группам букв, с запасом.
 */

/** Ширина строки моноширинного шрифта (Geist Mono: знак ≈ 0.58 кегля — по замеру на телефоне) */
export const monoWidth = (s: string, fontSize: number, tracking = 0) => s.length * (fontSize * 0.58 + tracking);

/** Строка времени: значки перед текстом (marks) и текст; только значки — text пустой */
export type TimeRow = { marks: boolean; text: string };

/**
 * Варианты строк времени, от лучшего к худшему; первый, что влезает по высоте, и берётся (timeRows → fitTextLines).
 * width — ширина текста, marks — ширина значков с зазором (0 — значков нет).
 *  1) значки + «18:00–20:00»;  2) значки + «18:00» / «20:00»;  3) «18:00» / «20:00» / значки отдельной строкой;
 *  4) только значки;  5) ничего. «→ 15:00», «07:00 →», «весь день» не делятся
 */
export function timeOptions(time: string, width: number, marks: number, fontSize: number, tracking = 0): TimeRow[][] {
  const w = (s: string) => monoWidth(s, fontSize, tracking);
  const fits = (s: string, withMarks: boolean) => w(s) + (withMarks ? marks : 0) <= width + 0.01;
  const has = marks > 0;
  const out: TimeRow[][] = [];
  if (time && fits(time, has)) out.push([{ marks: has, text: time }]);
  const [start, end, ...rest] = time ? time.split('–') : [];
  const split = !!start && !!end && !rest.length;
  if (split && fits(start!, has) && fits(end!, false)) out.push([{ marks: has, text: start! }, { marks: false, text: end! }]);
  if (has && split && fits(start!, false) && fits(end!, false) && marks <= width) out.push([{ marks: false, text: start! }, { marks: false, text: end! }, { marks: true, text: '' }]);
  if (has && time && !split && fits(time, false) && marks <= width) out.push([{ marks: false, text: time }, { marks: true, text: '' }]);
  if (has && marks <= width) out.push([{ marks: true, text: '' }]);
  return out;
}

/** Строки времени без значков (совместимость): целиком, двумя строками или [] */
export function timeLines(time: string, width: number, marks: number, fontSize: number, tracking = 0): string[] {
  const best = timeOptions(time, width, marks, fontSize, tracking).find((rows) => rows.every((r) => r.text));
  return best ? best.map((r) => r.text) : [];
}

const WIDE = new Set('жмшщюфыЖМШЩЮФЫmwMW@%');
const NARROW = new Set("ijlrtfгтІі1!.,:;'|()[]- ");
/** Ширина строки Geist 600 в долях кегля (с запасом: лучше перенести лишний раз, чем обрезать) */
export function sansWidth(s: string, fontSize: number, tracking = 0): number {
  let em = 0;
  for (const ch of s) {
    if (WIDE.has(ch)) em += 0.8;
    else if (NARROW.has(ch)) em += 0.34;
    else if (ch !== ch.toLowerCase()) em += 0.7;
    else em += 0.6;
  }
  return em * fontSize + s.length * tracking;
}

const L = '[а-яё]';
const V = '[аеёиоуыэюя]';
const C = '[бвгджзйклмнпрстфхцчшщ]';
const X = '[йьъ]';
/** Правила русского переноса (упрощённые, П. Христов): где можно поставить перенос внутри слова */
const RULES = [
  new RegExp(`(${L}${X})(${L}${L})`, 'giu'),
  new RegExp(`(${V}${C})(${C}${V})`, 'giu'),
  new RegExp(`(${C}${V})(${C}${V})`, 'giu'),
  new RegExp(`(${V}${C})(${C}${C}${V})`, 'giu'),
  new RegExp(`(${V}${C}${C})(${C}${C}${V})`, 'giu'),
  new RegExp(`(${C}${V})(${V}${L})`, 'giu'),
];
const SOFT = '­';

/** Слово по слогам для переноса: «командировка» → ["ко", "ман", "ди", "ров", "ка"] */
export function syllables(word: string): string[] {
  let s = word;
  // Правила перекрываются — каждое по два раза, чтобы найти соседние места
  for (let k = 0; k < 2; k++) for (const r of RULES) s = s.replace(r, `$1${SOFT}$2`);
  // Одна буква на строке не остаётся — приклеиваем к соседнему слогу
  const parts = s.split(SOFT).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last !== undefined && (p.length < 2 || last.length < 2)) out[out.length - 1] = last + p;
    else out.push(p);
  }
  return out;
}

export type TitlePlan = { text: string; marquee: boolean };

/**
 * Название для колонки ширины width: слова, которые не влезают, — с мягкими переносами;
 * если и кусок по слогам (с дефисом) не влезает — marquee (одна бегущая строка)
 */
export function titlePlan(title: string, width: number, fontSize: number, tracking = 0): TitlePlan {
  const words = title.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (sansWidth(w, fontSize, tracking) <= width) {
      out.push(w);
      continue;
    }
    const parts = syllables(w);
    if (parts.some((p, i) => sansWidth(i < parts.length - 1 ? `${p}-` : p, fontSize, tracking) > width)) return { text: title, marquee: true };
    out.push(parts.join(SOFT));
  }
  return { text: out.join(' '), marquee: false };
}
