/**
 * Сверка ответа модели с фразой. Маленькая модель понимает команду, но незнакомые слова переписывает с ошибками
 * («тренер» → «Трениер», «поставить» → «Постирать»). Название, текст заметки и пункты списка состоят из слов
 * самой фразы — поэтому слово, которого во фразе нет, заменяем похожим словом фразы.
 *
 * Не трогаем: слово, у которого во фразе есть однокоренное («Стоматолог» при «к стоматологу»); слово, не похожее
 * ни на одно во фразе («Поездка» при «едем в Питер», «42» при «сорок второй») — это не описка, а пересказ.
 * Большой модели сверка не мешает: её слова во фразе есть.
 */

const low = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const WORD = /[\p{L}\p{N}]+/gu;
const wordsOf = (s: string) => low(s).match(WORD) ?? [];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Однокоренные: общее начало без двух последних букв, не короче трёх («баня» — «баню», «стоматолог» — «стоматологу») */
function related(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 3) return false;
  // Слипшийся предлог: «вприхожую» — это «прихожую»
  if (Math.abs(a.length - b.length) <= 2 && (a.endsWith(b) || b.endsWith(a))) return true;
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i >= Math.max(3, min - 2);
}

/** То же слово в другой форме: расходятся только окончания, до двух букв («путешествия» — «путешествии») */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 3 && Math.abs(a.length - b.length) <= 2 && (a.endsWith(b) || b.endsWith(a))) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 3 && a.length - i <= 2 && b.length - i <= 2;
}

/** Похожесть слов от 0 до 1 (расстояние Левенштейна к длине большего) */
export function similar(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length]! / Math.max(a.length, b.length);
}

const ENOUGH = 0.6;

/**
 * Тексты одного действия (название, заметка, пункты) — вместе: слово фразы подставляется один раз.
 * verbatim — тексты, которые диктуют дословно (заметка, пункты списка): там слово должно быть во фразе в той же
 * форме. Название модель вправе привести к начальной форме («к стоматологу» → «Стоматолог») — там хватает однокоренного
 */
export function groundTexts(texts: string[], transcript: string, verbatim: boolean[] = []): string[] {
  const said = wordsOf(transcript);
  if (!said.length) return texts;
  const tokens = texts.flatMap((t, n) => wordsOf(t).map((w) => ({ w, known: verbatim[n] ? sameWord : related })));
  // Слова фразы, которые модель уже перенесла верно, для замены не годятся
  const free = said.filter((p) => !tokens.some((t) => t.known(t.w, p)));
  if (!free.length) return texts;
  return texts.map((text, n) =>
    text.replace(WORD, (word) => {
      const w = low(word);
      const known = verbatim[n] ? sameWord : related;
      if (w.length < 3 || /\d/.test(w) || said.some((p) => known(w, p))) return word;
      let best = -1;
      let score = ENOUGH;
      free.forEach((p, i) => {
        // Разбитое распознаванием слово («воск ресеньям») модель склеила верно — обломок не подставляем
        if (w.includes(p)) return;
        const s = similar(w, p);
        if (s >= score && (s > score || best < 0)) [best, score] = [i, s];
      });
      if (best < 0) return word;
      const [fix] = free.splice(best, 1);
      return /^\p{Lu}/u.test(word) ? cap(fix!) : fix!;
    }),
  );
}

/**
 * Пункты списка по запятым фразы: «…список что взять в баню: веник, шапка, простыня». Маленькая модель делит перечень
 * неточно («Малярный», «Скотч») или коверкает пункты. Если запятые во фразе есть, а пункты модели с ними расходятся
 * (другое число или остались слова, которых во фразе нет), — берём пункты по запятым. Сошлось — оставляем модель:
 * её пункты чище (без «так», без повторов распознавания)
 */
export function commaItems(title: string, items: string[], transcript: string): string[] | null {
  const last = wordsOf(title).pop();
  if (!last || items.length < 2 || !transcript.includes(',')) return null;
  const at = low(transcript).indexOf(last);
  if (at < 0) return null;
  const tail = transcript.slice(at + last.length).replace(/^[\s:—-]+/, '');
  const clean = (parts: string[]) => parts.map((x) => x.trim().replace(/[.;!]+$/, '')).filter(Boolean);
  const byComma = clean(tail.split(','));
  if (byComma.length < 2) return null;
  const said = wordsOf(tail);
  const foreign = items.some((it) => wordsOf(it).some((w) => w.length >= 3 && !/\d/.test(w) && !said.some((p) => related(w, p))));
  // «…, хлеб и яйца»: модель разделила и по «и» — это не расхождение
  const counts = [byComma.length, clean(tail.split(/,|\s+и\s+/i)).length];
  if (!foreign && counts.includes(items.length)) return null;
  return byComma.map(cap);
}

/* ---------- заметка дословно ---------- */

const FILLER = new Set(['ну', 'вот', 'так', 'слушай', 'короче', 'типа', 'кстати', 'э', 'ээ', 'эээ']);
const SAVE = new Set(['запиши', 'добавь', 'сохрани', 'внеси', 'запомни', 'создай', 'сделай']);
const NOTE = new Set(['заметка', 'заметку', 'идея', 'идею', 'мысль', 'запись']);

/**
 * Текст заметки, как его продиктовали: фраза без начала-команды («запиши в заметки …», «идея: …», «добавь в <тема> …»).
 * Начало не распознано — null (текст остаётся за моделью)
 */
export function noteTail(transcript: string, topic: string): string | null {
  const found = [...transcript.matchAll(WORD)].map((m) => ({ w: low(m[0]), at: m.index, end: m.index + m[0].length }));
  const title = wordsOf(topic);
  let i = 0;
  const skip = () => {
    while (i < found.length && FILLER.has(found[i]!.w)) i++;
  };
  skip();
  if (i < found.length && SAVE.has(found[i]!.w)) i++;
  skip();
  let lead = false;
  if (found[i] && (found[i]!.w === 'в' || found[i]!.w === 'во')) {
    // «в заметки», «в идеи», «в <название темы>» — название может стоять в другом падеже
    let j = i + 1;
    if (found[j] && (found[j]!.w === 'заметки' || found[j]!.w === 'идеи') && !title.length) j++;
    else while (found[j] && title.some((t) => related(t, found[j]!.w))) j++;
    if (j > i + 1) [i, lead] = [j, true];
  } else {
    let j = i;
    if (found[j] && (found[j]!.w === 'новая' || found[j]!.w === 'новую' || found[j]!.w === 'есть')) j++;
    if (found[j] && NOTE.has(found[j]!.w)) [i, lead] = [j + 1, true];
  }
  if (!lead || i >= found.length) return null;
  return transcript.slice(found[i]!.at).trim() || null;
}

/**
 * Модель передала заметку дословно? Слова те же и в том же порядке; пропустить она вправе только слово-паразит,
 * склеить — разбитое распознаванием слово («кале ндаря»). Пропущено или заменено значимое слово — нет
 */
export function faithful(text: string, said: string): boolean {
  const a = wordsOf(text);
  // Повтор слова подряд — огрех распознавания («больше больше спать»), его модель убирает по праву
  const b = wordsOf(said).filter((w, i, all) => i === 0 || w !== all[i - 1]);
  const extra = (j: number) => j < b.length && FILLER.has(b[j]!);
  let j = 0;
  for (const w of a) {
    while (extra(j) && !sameWord(w, b[j]!)) j++;
    if (j < b.length && sameWord(w, b[j]!)) j++;
    else if (j + 1 < b.length && sameWord(w, b[j]! + b[j + 1]!)) j += 2;
    // Предлог, проглоченный распознаванием («виджете показывать» → «В виджете показывать»), модель вернула верно
    else if (w.length > 2) return false;
  }
  while (extra(j)) j++;
  return j === b.length;
}

/**
 * Название списка звучит во фразе подряд и дословно («…список чем заняться с детьми: лепка, пазлы»). Если во фразе
 * есть такое же место, отличающееся одним словом («Что заняться с детьми»), — берём слово из фразы
 */
export function spanTitle(title: string, transcript: string): string {
  const want = wordsOf(title);
  const said = wordsOf(transcript);
  if (want.length < 3 || said.length < want.length) return title;
  let at = -1;
  let wrong = -1;
  for (let i = 0; i + want.length <= said.length; i++) {
    const miss = want.map((w, k) => (sameWord(w, said[i + k]!) ? -1 : k)).filter((k) => k >= 0);
    if (!miss.length) return title;
    if (miss.length === 1 && at < 0) [at, wrong] = [i, miss[0]!];
  }
  if (at < 0) return title;
  let k = -1;
  return title.replace(WORD, (word) => (++k === wrong ? (/^\p{Lu}/u.test(word) ? cap(said[at + wrong]!) : said[at + wrong]!) : word));
}
