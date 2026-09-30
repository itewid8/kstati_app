/**
 * Повтор, сказанный словами: «каждую субботу», «по будням», «раз в две недели по средам»,
 * «каждое 15 число», «каждый год 8 марта», «через день», «до конца года», «10 раз».
 * Считаем кодом, как даты и время: облегчённая модель тут ошибается, а правила простые.
 *
 * Этот файл один и тот же в двух местах: server/src/repeat.ts и mobile/src/lib/spokenRepeat.ts
 * (приложение разбирает фразы само в режиме без сервера). Правите один — скопируйте во второй.
 */

/** Как в mobile/src/lib/types.ts (Repeat) */
export type Repeat = {
  freq: 'day' | 'week' | 'month' | 'year';
  every: number;
  weekdays?: number[];
  monthDays?: number[];
  months?: number[];
  until?: string | null;
  count?: number | null;
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
// Граница слова для кириллицы (\b с ней не работает)
const B = '(?:^|[^а-яa-z0-9])';
const A = '(?=$|[^а-яa-z0-9])';

const COUNT: Record<string, number> = {
  один: 1, одну: 1, одна: 1, пару: 2, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, пятнадцать: 15, двадцать: 20, тридцать: 30,
};
const NUM = `(\\d{1,3}|${Object.keys(COUNT).join('|')})`;
const num = (s: string) => COUNT[s] ?? Number(s);

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма[яй]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const MONTH_RE = `(${MONTHS.join('|')})\\S*`;
const monthNo = (w: string) => MONTHS.findIndex((m) => new RegExp(`^${m}`).test(w)) + 1;

// Дни недели в любых формах: «субботу», «по субботам», «понедельник и среду»
const WEEKDAYS: [string, number][] = [
  ['понедельник\\S*', 1],
  ['вторник\\S*', 2],
  ['сред(?:а|у|ы|е|ам|ой)', 3],
  ['четверг\\S*', 4],
  ['пятниц\\S*', 5],
  ['суббот\\S*', 6],
  ['воскресень\\S*', 7],
];

// «первое», «пятнадцатого» — если распознавание речи написало число словами
const ORD: Record<string, number> = {
  перв: 1, втор: 2, трет: 3, четверт: 4, пят: 5, шест: 6, седьм: 7, восьм: 8, девят: 9, десят: 10,
  пятнадцат: 15, двадцат: 20, тридцат: 30,
};

const UNIT = '(дн\\S*|день|сутки|недел\\S*|месяц\\S*|год\\S*|лет|полгода|квартал\\S*)';
const unitOf = (w: string): { freq: Repeat['freq']; mul: number } | null => {
  if (/^(дн|день|сутки)/.test(w)) return { freq: 'day', mul: 1 };
  if (/^недел/.test(w)) return { freq: 'week', mul: 1 };
  if (/^полгода/.test(w)) return { freq: 'month', mul: 6 };
  if (/^квартал/.test(w)) return { freq: 'month', mul: 3 };
  if (/^месяц/.test(w)) return { freq: 'month', mul: 1 };
  if (/^(год|лет)/.test(w)) return { freq: 'year', mul: 1 };
  return null;
};

/** Есть ли во фразе повтор вообще */
export const hasRepeat = (text: string) =>
  new RegExp(
    `${B}(кажд\\S*|ежедневн\\S*|еженедельн\\S*|ежемесячн\\S*|ежегодн\\S*|через день|раз в|по будн\\S*|в будни|по рабочим|по выходным|по (?:понедельникам|вторникам|средам|четвергам|пятницам|субботам|воскресеньям))${A}`,
  ).test(norm(text));

/** «Больше не повторяй зарядку», «сделай баню разовой» — снять повтор */
export const stopsRepeat = (text: string) => /(не повтор|без повтор|перестань повтор|отмени повтор|убери повтор|разов|однократн|только один раз)/.test(norm(text));

/** «Баню теперь каждое воскресенье», «зарядка теперь по будням», «больше не повторяй» — правка повтора существующего дела */
export const changesRepeat = (text: string) => stopsRepeat(text) || (/(^|\s)теперь\s/.test(norm(text)) && hasRepeat(text));

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = utc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Дата «до 1 декабря» — ближайшая будущая */
function futureDate(day: number, month: number, today: string): string {
  let y = Number(today.slice(0, 4));
  let d = `${y}-${pad(month)}-${pad(Math.min(day, lastDay(y, month)))}`;
  if (d < today) d = `${++y}-${pad(month)}-${pad(Math.min(day, lastDay(y, month)))}`;
  return d;
}

/** Повтор из фразы или null. today — YYYY-MM-DD */
export function spokenRepeat(text: string, today: string): Repeat | null {
  if (!hasRepeat(text)) return null;
  const t = norm(text);
  let freq: Repeat['freq'] | null = null;
  let every = 1;

  // «каждые 2 недели», «раз в три дня», «раз в полгода», «каждый месяц», «ежедневно»
  const iv =
    t.match(new RegExp(`${B}(?:кажд\\S*|раз в)\\s+(?:${NUM}\\s+)?${UNIT}${A}`)) ??
    t.match(new RegExp(`${B}раз в\\s+${UNIT}${A}`));
  if (iv) {
    const u = unitOf(iv[2] ?? iv[1]);
    if (u) {
      freq = u.freq;
      every = (iv[2] && iv[1] ? num(iv[1]) : 1) * u.mul;
    }
  }
  if (!freq) {
    if (/ежедневн/.test(t)) freq = 'day';
    else if (/еженедельн/.test(t)) freq = 'week';
    else if (/ежемесячн/.test(t)) freq = 'month';
    else if (/ежегодн/.test(t)) freq = 'year';
  }
  if (new RegExp(`${B}через день${A}`).test(t)) {
    freq = 'day';
    every = 2;
  }

  // Дни недели
  let weekdays: number[] = [];
  const workdays = /(по будн|в будни|по рабочим|кроме выходных)/.test(t);
  if (workdays) weekdays = [1, 2, 3, 4, 5];
  else if (/по выходным/.test(t)) weekdays = [6, 7];
  else for (const [re, d] of WEEKDAYS) if (new RegExp(`${B}${re}${A}`).test(t)) weekdays.push(d);

  // Число и месяц: «каждое 8 марта», «каждый год 15 мая»
  const dm = t.match(new RegExp(`${B}(\\d{1,2})(?:-?(?:го|е|ое))?\\s+${MONTH_RE}`));
  // «до 1 декабря» — это окончание, а не дата повтора
  const dmIsEnd = !!dm && new RegExp(`${B}до\\s+${dm[1]}`).test(t);

  // Числа месяца: «15 числа», «1 и 15 числа», «каждое 5-е число», «первого числа», «в последний день месяца»
  let monthDays: number[] = [];
  const nums = t.match(/((?:\d{1,2}(?:-?(?:го|е|ое))?(?:\s*(?:,|и)\s*)?)+)\s*числ/);
  if (nums) monthDays = [...nums[1].matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((d) => d >= 1 && d <= 31);
  else {
    const ord = t.match(/(перв|втор|трет|четверт|пят|шест|седьм|восьм|девят|десят|пятнадцат|двадцат|тридцат)\S*\s+числ/);
    if (ord) monthDays = [ORD[ord[1]]];
  }
  if (/(последн\S* (?:день|числ)|в конце месяца|конец месяца)/.test(t)) monthDays.push(-1);
  monthDays = [...new Set(monthDays)].sort((a, b) => a - b);

  // Какой повтор получился
  if (!freq) {
    if (dm && !dmIsEnd) freq = 'year';
    else if (weekdays.length) freq = 'week';
    else if (monthDays.length) freq = 'month';
    else return null;
  }
  // «Каждый день кроме выходных» — это по будням
  if (freq === 'day' && every === 1 && workdays) freq = 'week';

  const r: Repeat = { freq, every: Math.max(1, Math.min(99, every)) };
  if (freq === 'week' && weekdays.length) r.weekdays = weekdays.sort((a, b) => a - b);
  if (freq === 'month' && monthDays.length) r.monthDays = monthDays;
  if (freq === 'year' && dm && !dmIsEnd) {
    r.months = [monthNo(dm[2])];
    r.monthDays = [Number(dm[1])];
  }

  // Окончание: «до конца года», «до 1 декабря», «до нового года», «10 раз»
  if (/до конца года|до нового года/.test(t)) r.until = `${today.slice(0, 4)}-12-31`;
  else if (/до конца месяца/.test(t)) {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    r.until = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
  } else {
    const u = t.match(new RegExp(`${B}до\\s+(\\d{1,2})(?:-?го)?\\s+${MONTH_RE}`));
    if (u) r.until = futureDate(Number(u[1]), monthNo(u[2]), today);
  }
  // «10 раз», «всего пять раз» — но не «два раза в неделю» (это частота)
  const cnt = t.match(new RegExp(`${B}${NUM}\\s+раз(?:а)?${A}(?!\\s*в\\s)`));
  if (cnt && !r.until) {
    const n = num(cnt[1]);
    if (n >= 1 && n <= 999) r.count = n;
  }
  return r;
}

/** Подходит ли день под «где» повтора (дни недели, числа, месяцы) — без учёта «каждые N» */
function fitsDay(r: Repeat, day: string): boolean {
  const d = utc(day);
  const wd = ((d.getUTCDay() + 6) % 7) + 1;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  const inDays = (list: number[]) => list.some((x) => x === dd || (x === -1 && dd === lastDay(y, m)));
  if (r.freq === 'week' && r.weekdays?.length) return r.weekdays.includes(wd);
  if (r.freq === 'month' && r.monthDays?.length) return inDays(r.monthDays);
  if (r.freq === 'year') return (!r.months?.length || r.months.includes(m)) && (!r.monthDays?.length || inDays(r.monthDays));
  return true;
}

/**
 * Первый раз серии: названная дата (если подходит и не в прошлом), иначе ближайший подходящий день с сегодня.
 * «Баня каждую субботу» в пятницу → завтрашняя суббота; «оплатить интернет каждое 20 число» → ближайшее 20-е.
 */
export function firstDate(r: Repeat, said: string | null, today: string): string {
  const from = said && said >= today ? said : today;
  for (let i = 0; i < 800; i++) {
    const d = addDays(from, i);
    if (fitsDay(r, d)) return d;
  }
  return from;
}

/** Убрать слова о повторе из названия: «Баня каждую субботу» → «Баня» */
export function stripRepeat(title: string): string {
  const wd = WEEKDAYS.map(([re]) => re).join('|');
  const out = title
    .replace(new RegExp(`(?:кажд\\S*|раз в)(?:\\s+(?:\\d{1,3}|${Object.keys(COUNT).join('|')}))?\\s+(?:${UNIT.slice(1, -1)}|${wd})(?:\\s+и\\s+(?:${wd}))?`, 'gi'), ' ')
    .replace(new RegExp(`по\\s+(?:будн\\S*|выходным|рабочим\\s+дням|понедельникам|вторникам|средам|четвергам|пятницам|субботам|воскресеньям)(?:\\s+и\\s+\\S+ам)?`, 'gi'), ' ')
    .replace(/(ежедневн\S*|еженедельн\S*|ежемесячн\S*|ежегодн\S*|через день)/gi, ' ')
    // «каждое 20 число», «1 и 15 числа», «в последний день месяца», «каждое 8 марта»
    .replace(/(?:кажд\S*\s+(?:месяц\S*\s+)?)?(?:\d{1,2}(?:-?(?:го|е|ое))?(?:\s*(?:,|и)\s*)?)+\s*числ\S*(?:\s+каждого\s+месяца)?/gi, ' ')
    .replace(/(?:в\s+)?(?:последн\S*\s+(?:день|числ\S*)|конц\S*)\s+месяца/gi, ' ')
    .replace(new RegExp(`кажд\\S*\\s+(?:год\\S*\\s+)?\\d{1,2}(?:-?го)?\\s+${MONTH_RE}`, 'gi'), ' ')
    .replace(/(^|\s)кажд\S*(?=\s|$)/gi, ' ')
    .replace(/\s+[,.]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();
  return out ? out[0].toUpperCase() + out.slice(1) : title;
}
