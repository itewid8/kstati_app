/**
 * Детерминированные поправки к ответу модели. То, что можно надёжно вынуть из фразы кодом,
 * не доверяем модели: время («на восемь»), день недели при переносе, глагол изменения.
 */

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Есть ли во фразе глагол изменения существующей записи */
export const hasChangeVerb = (text: string) =>
  /(перенес|перенос|передвин|сдвин|измени|поменя|переимен|удали|удалить|убери|сотри|отмет|верни|сними отметку|посмотрели|сделал|выполнил|подарили)/.test(
    norm(text),
  );

/** «удали слона» → «слона»: для ответа «Не нашёл …», когда модель сдалась */
export function changeTarget(text: string): string | null {
  const m = norm(text).match(/^(удали|удалить|убери|сотри|перенеси|перенести|передвинь|отметь|переименуй|верни)\s+(.+)$/);
  return m ? m[2].replace(/\s+(на|в)\s+.*$/, '').trim() : null;
}

// Именительный и родительный падежи: «в семь», «к семи»
const NUM: Record<string, number> = {
  час: 1, один: 1, одного: 1, два: 2, двух: 2, три: 3, трех: 3, четыре: 4, четырех: 4, пять: 5, пяти: 5,
  шесть: 6, шести: 6, семь: 7, семи: 7, восемь: 8, восьми: 8, девять: 9, девяти: 9, десять: 10, десяти: 10,
  одиннадцать: 11, одиннадцати: 11, двенадцать: 12, двенадцати: 12,
};
const WORDS = Object.keys(NUM).sort((x, y) => y.length - x.length).join('|');

/**
 * Время, сказанное словами или цифрами: «на восемь» → 20:00, «в 10 утра» → 10:00, «на 19:30» → 19:30.
 * Часы 1–8 без «утра» считаются вечерними, как в правилах для модели.
 */
export function spokenTime(text: string): string | null {
  const t = norm(text)
    // «на 3 октября», «к 5 числу» — это даты, а не время
    .replace(/\d{1,2}\s+(январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр|числ)\S*/g, ' ')
    // «на два дня», «на неделю» — это срок, а не время
    .replace(/на\s+\S+\s+(дня|дней|недел\S*|месяц\S*|час(а|ов)?\s+(раньше|позже))/g, ' ');
  const m =
    t.match(/(?:^|\s)(?:в|на|к)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*час(?:а|ов)?)?\s*(утра|вечера|дня|ночи)?(?=\s|$|[,.!?])/) ??
    t.match(new RegExp(`(?:^|\\s)(?:в|на|к)\\s+(${WORDS})(?:\\s+час(?:а|ов)?)?(?:\\s+(утра|вечера|дня|ночи))?(?=\\s|$|[,.!?])`));
  if (!m) return null;
  let h: number;
  let min = 0;
  let part: string | undefined;
  if (/^\d/.test(m[1])) {
    h = Number(m[1]);
    min = m[2] && /^\d/.test(m[2]) ? Number(m[2]) : 0;
    part = m[3];
  } else {
    h = NUM[m[1]];
    part = m[2];
  }
  if (part === 'вечера' || part === 'дня') {
    if (h < 12) h += 12;
  } else if (part === 'ночи') {
    if (h === 12) h = 0;
  } else if (!part && h >= 1 && h <= 8) h += 12;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const WEEKDAYS: [RegExp, number][] = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред[ау]/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресень/, 0],
];

/** День недели во фразе, если он назван без уточнения «этот / следующий» */
export function plainWeekday(text: string): number | null {
  const t = norm(text);
  if (/(следующ|эт[уоа]т?|ближайш|\d{1,2}[.\s](числ|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[яй]|июн|июл|август))/.test(t)) return null;
  for (const [re, d] of WEEKDAYS) if (re.test(t)) return d;
  return null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

/**
 * «Перенеси дачу (сб 3 окт) на воскресенье» → вс 4 окт, а не ближайшее воскресенье 27 сен:
 * берём день недели, ближайший к старой дате записи, но не раньше сегодня.
 */
export function nearestWeekday(dow: number, oldDate: string, today: string): string {
  const old = utc(oldDate);
  let best: Date | null = null;
  for (let delta = -6; delta <= 6; delta++) {
    const d = new Date(old);
    d.setUTCDate(d.getUTCDate() + delta);
    if (d.getUTCDay() !== dow || iso(d) < today) continue;
    if (!best || Math.abs(delta) < Math.abs((+best - +old) / 86400000)) best = d;
  }
  if (best) return iso(best);
  // Старая дата в прошлом — ближайший такой день начиная с сегодня
  const t = utc(today);
  const diff = (dow - t.getUTCDay() + 7) % 7;
  t.setUTCDate(t.getUTCDate() + diff);
  return iso(t);
}

/* ---------- даты и периоды, сказанные словами ---------- */

const addDays = (isoDate: string, n: number) => {
  const d = utc(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** Понедельник недели, в которую входит дата */
const monday = (isoDate: string) => addDays(isoDate, -((utc(isoDate).getUTCDay() + 6) % 7));

// Граница слова для кириллицы (\b с ней не работает)
const W = '(?:^|[^а-яa-z0-9])';
const E = '(?=$|[^а-яa-z0-9])';

const COUNT: Record<string, number> = {
  один: 1, одну: 1, одна: 1, пару: 2, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
};
const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма[яй]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const DOW_FORMS: [string, number][] = [
  ['понедельник', 1], ['вторник', 2], ['сред[аувы]', 3], ['четверг', 4], ['пятниц[аеуы]', 5], ['суббот[аеуы]', 6], ['воскресень[еяю]', 0],
];

export type Period = { from: string; to: string };

/**
 * Дата или период из фразы: «завтра», «в следующую субботу», «на выходных», «на следующей неделе»,
 * «через две недели», «3 октября». Считаем кодом: облегчённая модель путается в календаре.
 * Неделя — с понедельника. «В субботу» — ближайшая будущая (не сегодня), «в следующую субботу» — суббота следующей недели.
 */
export function spokenPeriod(text: string, today: string): Period | null {
  const t = norm(text);
  const day = (d: string): Period => ({ from: d, to: d });
  const next = new RegExp(`${W}следующ\\S*\\s+`);
  const thisW = new RegExp(`${W}(эт[уоа]т?|эти[хм]?|ближайш\\S*)\\s+`);

  // Число и месяц: «3 октября», «на 15 ноября»
  const dm = t.match(new RegExp(`${W}(\\d{1,2})(?:-?го)?\\s+(${MONTHS.join('|')})`));
  if (dm) {
    const month = MONTHS.findIndex((m) => new RegExp(`^${m}`).test(dm[2]));
    const dd = Number(dm[1]);
    if (month >= 0 && dd >= 1 && dd <= 31) {
      let y = Number(today.slice(0, 4));
      let d = `${y}-${String(month + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      if (d < today) d = `${++y}${d.slice(4)}`;
      return day(d);
    }
  }

  if (new RegExp(`${W}послезавтра${E}`).test(t)) return day(addDays(today, 2));
  if (new RegExp(`${W}завтра${E}`).test(t)) return day(addDays(today, 1));
  if (new RegExp(`${W}сегодня${E}`).test(t)) return day(today);

  // «через неделю», «через две недели», «через 3 дня», «через месяц»
  const th = t.match(new RegExp(`${W}через\\s+(?:(\\d+|${Object.keys(COUNT).join('|')})\\s+)?(дн\\S*|день|недел\\S*|месяц\\S*)`));
  if (th) {
    const n = th[1] ? (COUNT[th[1]] ?? Number(th[1])) : 1;
    if (th[2].startsWith('недел')) return day(addDays(today, 7 * n));
    if (th[2].startsWith('месяц')) {
      const d = utc(today);
      d.setUTCMonth(d.getUTCMonth() + n);
      return day(iso(d));
    }
    return day(addDays(today, n));
  }

  // Выходные: суббота и воскресенье
  const we = t.match(new RegExp(`${W}(?:(следующ\\S*|эт\\S*|ближайш\\S*)\\s+)?выходн`));
  if (we) {
    let sat = addDays(monday(today), 5);
    if (we[1]?.startsWith('следующ')) sat = addDays(sat, 7);
    else if (today > addDays(sat, 1)) sat = addDays(sat, 7);
    return { from: sat < today ? today : sat, to: addDays(sat, 1) };
  }

  // Неделя
  if (new RegExp(`${W}следующ\\S*\\s+недел`).test(t)) {
    const mon = addDays(monday(today), 7);
    return { from: mon, to: addDays(mon, 6) };
  }
  if (new RegExp(`${W}эт\\S*\\s+недел`).test(t)) return { from: today, to: addDays(monday(today), 6) };

  // День недели
  for (const [form, dow] of DOW_FORMS) {
    const m = t.match(new RegExp(`${W}((?:следующ\\S*|эт\\S*|ближайш\\S*)\\s+)?${form}`));
    if (!m) continue;
    const thisWeek = addDays(monday(today), (dow + 6) % 7);
    if (m[1] && next.test(` ${m[1]}`)) return day(addDays(thisWeek, 7));
    if (m[1] && thisW.test(` ${m[1]}`) && thisWeek >= today) return day(thisWeek);
    // Ближайший будущий такой день, не сегодня
    const diff = (dow - utc(today).getUTCDay() + 7) % 7 || 7;
    return day(addDays(today, diff));
  }
  return null;
}

/** «Верни посылку в невыполненные», «сними отметку» — это снятие отметки, а не изменение */
export const isUnmark = (text: string) =>
  /(верни|вернуть|верн[её]м).*(невыполн|не выполн|несделан|не сделан|не просмотр|непросмотр|не посмотр|обратно|в список)|сними отметку|снять отметку|отмени (выполнение|отметку)/.test(
    norm(text),
  );

/** Тип записи для «Смотреть», если он назван словом: «фильм Интерстеллар», «мультик Шрэк» */
export function spokenKind(text: string): 'movie' | 'series' | 'cartoon' | 'show' | 'standup' | null {
  const t = norm(text);
  if (/мульт/.test(t)) return 'cartoon';
  if (/сериал/.test(t)) return 'series';
  if (/стендап|стенд-ап/.test(t)) return 'standup';
  if (/(^|[^а-я])(шоу|передач)/.test(t)) return 'show';
  if (/(^|[^а-я])(фильм|кино)/.test(t)) return 'movie';
  return null;
}
