/**
 * Простые команды без модели: «завтра в 7 йога», «купить молоко», «по будням зарядка в 8 утра», «хочу новые наушники».
 * Отдаём те же действия, что вернула бы модель, — дальше их обрабатывает normalize (дата, время, повтор, длительность
 * считаются там из фразы). Любое сомнение — null, и фразу разбирает YandexGPT: люди, несколько действий, правки,
 * вопросы, фильмы, заметки, планы, подробности через запятую.
 */
import { changesRepeat, hasRepeat, stripRepeat } from './repeat.js';
import { hasChangeVerb, spokenDateRange, spokenPeriod, spokenSpan, spokenTime } from './spoken.js';
import type { Context } from './types.js';

export type QuickAction = { intent: 'add'; type: 'task' | 'wish'; [k: string]: unknown };

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const NUMW = 'час|один|одного|два|двух|три|трех|трёх|четыре|четырех|четырёх|пять|пяти|шесть|шести|семь|семи|восемь|восьми|девять|девяти|десять|десяти|одиннадцать|одиннадцати|двенадцать|двенадцати';
const T = `(?:\\d{1,2}(?:[:.]\\d{2})?|${NUMW})`;
const PART = '(?:\\s+(?:утра|вечера|дня|ночи))?';
const HOURS = '(?:\\s*час(?:а|ов)?)?';
const MONTH = '(?:январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)\\S*';
const DOW = '(?:понедельник\\S*|вторник\\S*|сред[аеуы]|четверг\\S*|пятниц[аеуы]|суббот[аеуы]|воскресень[еяю])';
const COUNTW = 'одну|один|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять';
const B = '(?<=^|[\\s,.])';
const A = '(?=$|[\\s,.!])';

/** Что вырезаем из названия: время, даты, сроки (их normalize возьмёт из фразы) */
const STRIP: RegExp[] = [
  new RegExp(`${B}(?:с|от)\\s+${T}${HOURS}\\s+(?:до|по)\\s+${T}${HOURS}${PART}${A}`, 'gi'),
  new RegExp(`${B}с\\s+\\d{1,2}(?:-?го)?(?:\\s+${MONTH})?\\s+(?:по|до)\\s+\\d{1,2}(?:-?е|-?го)?\\s+${MONTH}${A}`, 'gi'),
  new RegExp(`${B}с\\s+${DOW}\\s+(?:по|до)\\s+${DOW}${A}`, 'gi'),
  new RegExp(`${B}на\\s+(?:полчаса|полтора\\s+час\\S*|(?:\\S+\\s+)?(?:час(?:а|ов)?|минут\\S*))(?!\\s+(?:утра|вечера|дня|ночи))${A}`, 'gi'),
  new RegExp(`${B}(?:в|на|к|около|примерно\\s+в)\\s+${T}${HOURS}${PART}${A}`, 'gi'),
  new RegExp(`${B}(?:на\\s+|к\\s+)?\\d{1,2}(?:-?го)?\\s+${MONTH}${A}`, 'gi'),
  new RegExp(`${B}(?:послезавтра|завтра|сегодня)${A}`, 'gi'),
  new RegExp(`${B}через\\s+(?:(?:\\d+|${COUNTW})\\s+)?(?:дн\\S*|день|недел\\S*|месяц\\S*)${A}`, 'gi'),
  new RegExp(`${B}(?:(?:в|во|на)\\s+)?(?:(?:следующ|эт|ближайш)\\S*\\s+)?${DOW}${A}`, 'gi'),
  new RegExp(`${B}на\\s+(?:(?:следующ|эт|ближайш)\\S*\\s+)?(?:выходн\\S*|недел\\S*)${A}`, 'gi'),
  new RegExp(`${B}(?:утром|вечером|днём|днем)${A}`, 'gi'),
];

/** Слова-команды в начале: «запиши», «надо», «не забыть» */
const LEAD = /^(?:запиши(?:те)?|запомни|напомни(?:\s+мне)?|добавь|поставь|создай|надо|нужно|не\s+забыть|не\s+забудь|пожалуйста|дело)(?:[\s,:]+|$)/i;

/** Это не простое дело: фильмы, заметки, подарки, планы, напоминания, вопросы */
const SKIP = /(посмотр|смотреть|фильм|сериал|мульт|кино|шоу|стендап|иде[яиюе]|заметк|мысл|(?:^|\s)тем[аеуы]?(?:\s|$)|списк|список|вишлист|подар|день рожд|(?:^|\s)др(?:\s|$)|годовщин|юбиле|поездк|отпуск|командиров|путешеств|план|подзадач|напоминани|погод)/;
const QUESTION = /^(что|чего|какие|какой|какая|какую|каких|когда|где|сколько|кто|кому|почему|зачем|покажи|открой|найди|как|есть ли|ли)(\s|$)/;
/** Кто занят — решает модель: «мы», «мне», «с Кариной» */
const PEOPLE = /(?:^|\s)(мы|нам|нас|я|мне|меня|мой|моя|мое|мои|наш\S*|ты|тебе|вы|вам|он|она|они|его|ее|им|ей|ему|вместе|все|всем)(?=\s|$)/;
const INFINITIVE = /^[а-яё-]+(?:ть|ти|чь|ться|тись|чься)$/i;

const personStem = (name: string) => norm(name).slice(0, Math.max(3, name.length - 1));
function namesPerson(text: string, ctx: Context): boolean {
  const words = norm(text).split(/[^а-яa-z]+/).filter((w) => w.length >= 3);
  return [ctx.me, ...ctx.people].some((p) => {
    const s = personStem(p.name);
    // Имя в любом падеже: «Карине», «Димы», «с Машей»; «машину» — не Маша
    const re = new RegExp(`^${s}(?:а|я|у|ю|е|и|ы|ой|ей|ою|ею|ом|ем|ь)?$`);
    return s.length >= 3 && words.some((w) => re.test(w));
  });
}

/** Именительный падеж для хотелки: «новую книгу» → «новая книга» (женский род в винительном) */
function nominative(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((w) => w.replace(/ую$/i, 'ая').replace(/юю$/i, 'яя').replace(/([бвгджзйклмнпрстфхцчшщ])у$/i, '$1а').replace(/([^аеёиоуыэюя])ю$/i, '$1я'))
    .join(' ');
}

function cleanTitle(s: string): string {
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.:;!-]+|[\s,.:;!-]+$/g, '')
    .replace(/(?:\s+(?:в|во|на|к|с|по|до|от|и|а))+$/i, '')
    .trim();
}

/** Простая команда → действия как у модели, иначе null */
export function quickParse(input: string, ctx: Context): QuickAction[] | null {
  const raw = input.trim().replace(/[.!]+$/, '');
  const t = norm(raw);
  if (!t || t.length > 120 || /[?;]/.test(t)) return null;
  // Открыт план или тема: новое дело станет подзадачей, заметка — в тему; это решает модель
  if (ctx.currentParentId || ctx.currentTopicId) return null;
  if (QUESTION.test(t) || SKIP.test(t) || hasChangeVerb(t) || changesRepeat(t) || namesPerson(t, ctx)) return null;

  // Хотелка: «хочу новые наушники» — одна вещь, 1–3 слова, без дат и глаголов
  const w = raw.match(/^(?:я\s+)?хочу\s+(.+)$/i);
  if (w) {
    const thing = w[1].trim();
    const words = thing.split(/\s+/);
    if (words.length > 3 || /[\d,:]/.test(thing) || PEOPLE.test(norm(thing))) return null;
    if (/^(в|во|на|к|с|чтобы|что|бы|есть|пить|спать)$/i.test(words[0] ?? '') || words.some((x) => INFINITIVE.test(x))) return null;
    if (spokenTime(raw) || spokenPeriod(raw, ctx.today)) return null;
    return [{ intent: 'add', type: 'wish', title: cap(nominative(thing)), note: '', link: '' }];
  }
  if (/(^|\s)хоч/.test(t)) return null;

  // Дело
  let title = raw;
  let lead = false;
  for (let i = 0; i < 3 && LEAD.test(title); i++) {
    title = title.replace(LEAD, '');
    lead = true;
  }
  if (PEOPLE.test(norm(title))) return null;
  const when =
    spokenTime(raw) !== null || spokenSpan(raw) !== null || spokenPeriod(raw, ctx.today) !== null || spokenDateRange(raw, ctx.today) !== null || hasRepeat(raw);
  title = ` ${title} `;
  for (const re of STRIP) title = title.replace(re, ' ');
  title = cleanTitle(stripRepeat(cleanTitle(title)));
  if (!title || /[\d,:;]|(?:^|\s)(?:и|а|или)(?:\s|$)/i.test(title)) return null;
  const words = title.split(/\s+/);
  if (words.length > 5 || title.length > 40 || !words.some((x) => x.length >= 3)) return null;
  // Без даты и времени — только с глаголом в начале: «купить молоко», «позвонить в управляющую компанию»
  if (!when && !INFINITIVE.test(words[0] ?? '')) return null;
  // «Запиши завтра баню» — дело называем в именительном: «Баня»
  if (lead && words.length <= 2 && !INFINITIVE.test(words[0] ?? '') && !/^(в|во|на|к|ко|с|со|у|по|за|из|от|до)$/i.test(words[0] ?? '')) title = nominative(title);
  return [{ intent: 'add', type: 'task', title: cap(title), date: null, time: spokenTime(raw), note: '', people: [] }];
}
