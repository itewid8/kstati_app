/**
 * Виджет «Кстати» на рабочем столе — чистые данные, без react-native и хранилища (тесты: widgetData.test.ts).
 *
 * Приложение пишет в папку документов два файла, Android-виджет (modules/kstati-widget, KstatiWidget.kt) читает их сам:
 *   widget.json        — WidgetFile: ближайшие дела всех моих групп, названия групп, тема приложения;
 *   widget-prefs.json  — WidgetPrefsFile: настройки по id виджета и общие («default», экран настроек в приложении).
 * Подписи времени (whenParts) и цвета (widgetColors) Kotlin считает так же — меняя одно, менять и другое.
 * Прошедшие дела виджет отбрасывает сам: каждое дело несёт until — момент, после которого оно уходит.
 */
import { PERSONAL, taskGroups } from './visibility';
import { colorMap, colorOf } from '@/adapters/common/people';
import type { Snapshot } from '@/adapters/snapshot';
import { palettes, type Palette, type Scheme } from '@/ui/tokens';
import { colorHex } from './personColors';
import { dayNo, expandTasks, isoOf, weekdayOf } from './recur';
import { peopleOf } from './span';
import type { ID, PersonColor, Task, ThemePref } from './types';

/* ---------- настройки ---------- */

/** Цвет элемента виджета: как в теме (приложения или телефона), светлый, тёмный */
export type WidgetTone = 'auto' | 'light' | 'dark';
export const WIDGET_TONES: readonly WidgetTone[] = ['auto', 'light', 'dark'];

/**
 * Настройки одного виджета (те же, что у виджета старого приложения, плюс группа):
 * кнопка REC и её цвет, фон и его непрозрачность 0…1, цвет названий и времени; group — дела одной группы (null — всех моих)
 */
export type WidgetPrefs = {
  mic: boolean;
  micTone: WidgetTone;
  bg: WidgetTone;
  opacity: number;
  text: WidgetTone;
  time: WidgetTone;
  /** Цвет верхней плашки (группа и сегодня) */
  head: WidgetTone;
  /** Группы, дела которых показывать; пусто — все мои */
  groups: ID[];
};

export const DEFAULT_WIDGET_PREFS: WidgetPrefs = { mic: true, micTone: 'auto', bg: 'auto', opacity: 0.94, text: 'auto', time: 'auto', head: 'auto', groups: [] };

/** Ключ общих настроек в widget-prefs.json: экран в приложении меняет его, виджет без своих настроек берёт его */
export const PREFS_DEFAULT_KEY = 'default';

export type WidgetPrefsFile = Record<string, WidgetPrefs>;

const isTone = (v: unknown): v is WidgetTone => v === 'auto' || v === 'light' || v === 'dark';
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Настройки из файла (что угодно) → полные и проверенные; чего нет или что испорчено — по умолчанию */
export function cleanPrefs(raw: unknown, base: WidgetPrefs = DEFAULT_WIDGET_PREFS): WidgetPrefs {
  if (!isRecord(raw)) return base;
  const tone = (v: unknown, d: WidgetTone): WidgetTone => (isTone(v) ? v : d);
  const opacity = typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? Math.min(1, Math.max(0, raw.opacity)) : base.opacity;
  return {
    mic: typeof raw.mic === 'boolean' ? raw.mic : base.mic,
    micTone: tone(raw.micTone, base.micTone),
    bg: tone(raw.bg, base.bg),
    opacity: Math.round(opacity * 100) / 100,
    text: tone(raw.text, base.text),
    time: tone(raw.time, base.time),
    head: tone(raw.head, base.head),
    groups: Array.isArray(raw.groups)
      ? raw.groups.filter((g): g is string => typeof g === 'string' && g.length > 0)
      : typeof raw.group === 'string' && raw.group
        ? [raw.group]
        : base.groups,
  };
}

/** Все записи файла настроек, проверенные */
export function cleanPrefsFile(raw: unknown): WidgetPrefsFile {
  if (!isRecord(raw)) return {};
  const out: WidgetPrefsFile = {};
  for (const [key, value] of Object.entries(raw)) if (isRecord(value)) out[key] = cleanPrefs(value);
  return out;
}

/** Настройки виджета: свои → общие → по умолчанию (как readPrefs в KstatiWidget.kt) */
export function prefsFor(file: WidgetPrefsFile, widgetId: number | null): WidgetPrefs {
  const shared = file[PREFS_DEFAULT_KEY] ?? DEFAULT_WIDGET_PREFS;
  if (widgetId === null) return shared;
  return file[String(widgetId)] ?? shared;
}

/** Экран в приложении меняет все виджеты разом: общие настройки, свои у виджетов сбрасываются */
export const withSharedPrefs = (prefs: WidgetPrefs): WidgetPrefsFile => ({ [PREFS_DEFAULT_KEY]: prefs });

/** Окно настроек одного виджета (долгое нажатие → «Настроить»): только его запись */
export const withWidgetPrefs = (file: WidgetPrefsFile, widgetId: number, prefs: WidgetPrefs): WidgetPrefsFile => ({
  ...file,
  [String(widgetId)]: prefs,
});

/** «30» — прозрачность фона в процентах (в настройках хранится непрозрачность) */
export const transparencyPercent = (opacity: number) => Math.round((1 - opacity) * 100);

/* ---------- данные ---------- */

/** Цвет полосы человека в обеих темах: [светлая, тёмная] */
export type StripColor = readonly [string, string];

export type WidgetItem = {
  /** id дела: у серии в виджете одна строка — ближайший раз */
  id: ID;
  /** Дата повтора серии (для перехода к этому разу); у обычного дела null */
  occ: string | null;
  /** Группа */
  g: ID;
  title: string;
  date: string;
  time: string | null;
  /** Когда дело уходит из виджета (мс): со временем — его начало, на весь день — полночь следующего дня */
  until: number;
  /** Полоса слева: один человек или двое (верх / низ) */
  c: StripColor[];
  /** Сделано (сегодняшнее) — зачёркнуто */
  d?: true;
};

export type WidgetGroup = { id: ID; name: string };

export type WidgetFile = {
  v: 2;
  /** Когда записано (мс) */
  at: number;
  /** Тема приложения: null — как в телефоне (виджет узнаёт тему сам и меняет цвета вместе с ней) */
  dark: boolean | null;
  /** Мои группы по порядку: подпись в шапке виджета и выбор в настройках */
  groups: WidgetGroup[];
  items: WidgetItem[];
};

/** На сколько дней вперёд и сколько дел на группу кладём в файл */
export const WIDGET_DAYS = 60;
export const WIDGET_PER_GROUP = 40;

const pad2 = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Момент, когда дело уходит из виджета (местное время) */
function untilOf(date: string, time: string | null): number {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  if (!time) return new Date(y, m - 1, d + 1).getTime();
  const [h = 0, mi = 0] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}

const strip = (color: PersonColor): StripColor => [colorHex(color, false), colorHex(color, true)];

export type WidgetSource = Pick<Snapshot, 'me' | 'users' | 'groups' | 'tasks'>;

/** Мои группы (где я участник) по порядку */
export const myGroups = (s: Pick<Snapshot, 'me' | 'groups'>): WidgetGroup[] =>
  s.groups.filter((g) => g.memberIds.includes(s.me.id)).map((g) => ({ id: g.id, name: g.name }));

/**
 * Ближайшие дела моих групп с датой (с повторами, на WIDGET_DAYS дней вперёд), без сделанных и прошедших,
 * по времени; у каждой группы не больше WIDGET_PER_GROUP — чтобы фильтр по группе в виджете не остался пустым.
 * Дела без даты не показываем — их бывает много, они забивают виджет (как в старом виджете)
 */
export function widgetItems(s: WidgetSource, now: Date): WidgetItem[] {
  const from = localIso(now);
  const to = isoOf(dayNo(from) + WIDGET_DAYS);
  const colors = colorMap(s);
  const nowMs = now.getTime();
  // Где дело видно: мои группы; своё, не видное ни одной группе, — личное (lib/visibility.ts)
  const where = (t: Task): ID[] => {
    const gs = taskGroups(t, s.groups, s.me.id);
    return gs.length ? gs : t.createdBy === s.me.id ? [PERSONAL] : [];
  };
  const dated: Task[] = s.tasks.filter((t) => t.date && where(t).length);
  const items = expandTasks(dated, from, to).flatMap((t): WidgetItem[] => {
    const date = t.date;
    // Сделанное — только сегодняшнее, зачёркнутым (макет C-WidgetLarge), до конца дня
    if (!date || (t.doneAt && date !== from) || date < from || date > to) return [];
    const done = !!t.doneAt;
    const until = done ? untilOf(date, null) : untilOf(date, t.time);
    if (until <= nowMs) return [];
    const [a = t.createdBy, b] = peopleOf(t);
    const c = [strip(colorOf(colors, a)), ...(b ? [strip(colorOf(colors, b))] : [])];
    // По записи на каждую группу, где дело видно: фильтр виджета по группам; одинаковые id виджет показывает один раз
    return where(t).map((g) => ({ id: t.id, occ: t.occ ?? null, g, title: t.title, date, time: t.time, until, c, ...(done ? { d: true } : {}) }));
  });
  // По дням; в дне сделанное сверху, дальше по времени
  const key = (x: WidgetItem) => (x.d ? Date.parse(`${x.date}T00:00:00`) - 1 : x.until);
  items.sort((x, y) => x.date.localeCompare(y.date) || key(x) - key(y) || x.title.localeCompare(y.title, 'ru'));
  const per = new Map<ID, number>();
  return items.filter((x) => {
    const n = per.get(x.g) ?? 0;
    per.set(x.g, n + 1);
    return n < WIDGET_PER_GROUP;
  });
}

/** Тема приложения для виджета: «система» — null, виджет следует за телефоном сам */
export const widgetDark = (theme: ThemePref): boolean | null => (theme === 'system' ? null : theme === 'dark');

export function widgetFile(s: WidgetSource, theme: ThemePref, now: Date): WidgetFile {
  return { v: 2, at: now.getTime(), dark: widgetDark(theme), groups: myGroups(s), items: widgetItems(s, now) };
}

/** Что показать в момент now: дела группы (или всех), ещё не прошедшие, у серии — ближайший раз; первые n */
export function visibleAt(items: readonly WidgetItem[], now: number, n: number, groups: readonly ID[]): WidgetItem[] {
  const only = new Set(groups);
  const seen = new Set<string>();
  const out: WidgetItem[] = [];
  for (const x of items) {
    if (out.length >= n) break;
    if (x.until <= now || (only.size > 0 && !only.has(x.g)) || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

/* ---------- подписи ---------- */

const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MON = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

/** «ПН 05» */
const dayShort = (iso: string) => `${WD[weekdayOf(iso) - 1] ?? ''} ${iso.slice(8, 10)}`;
/** «17 ОКТ» */
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1] ?? ''}`;

/**
 * Правая часть строки (как время в строке C-List): day — приглушённая подпись дня перед временем, time — жирное.
 *   сегодня: «19:00», без времени «—»;
 *   завтра: «ЗАВТРА» + «19:00», без времени просто «ЗАВТРА»;
 *   до 6 дней вперёд: «СБ 10» + время; дальше «17 ОКТ» + время
 */
export function whenParts(date: string, time: string | null, today: string): { day: string | null; time: string } {
  const diff = dayNo(date) - dayNo(today);
  if (diff <= 0) return { day: null, time: time ?? '—' };
  const day = diff === 1 ? 'ЗАВТРА' : diff <= 6 ? dayShort(date) : dayMonth(date);
  return time ? { day, time } : { day: null, time: day };
}

/** Шапка: группа заглавными (или «ВСЕ ГРУППЫ») и сегодня — «ПН» и число в красном квадрате */
export function widgetHeader(groups: readonly WidgetGroup[], chosen: readonly ID[], today: string): { label: string; weekday: string; day: string } {
  const names = groups.filter((g) => chosen.includes(g.id)).map((g) => g.name);
  const name = names.length > 0 ? names.join(' · ') : null;
  return {
    label: name ? name.toLocaleUpperCase('ru-RU') : 'ВСЕ ГРУППЫ',
    weekday: WD[weekdayOf(today) - 1] ?? '',
    day: today.slice(8, 10),
  };
}

export const todayOf = (now: number) => localIso(new Date(now));

/* ---------- цвета ---------- */

/** Палитра виджета — цвета приложения (src/ui/tokens) */
export type WidgetPalette = Pick<Palette, 'bg' | 'panel' | 'border' | 'hair' | 'text' | 'muted' | 'red'>;

export type WidgetColors = {
  /** Подложка виджета и её непрозрачность */
  card: string;
  alpha: number;
  /** Рамка списка 1.5, его заливка (с той же непрозрачностью), разделители строк 1 */
  panel: string;
  border: string;
  hair: string;
  /** Шапка залита цветом текста, буквы — цветом фона (SectionBox) */
  headBg: string;
  headInk: string;
  /** Квадрат «сегодня» в шапке */
  today: string;
  todayInk: string;
  title: string;
  /** Подпись дня перед временем и само время */
  day: string;
  time: string;
  empty: string;
  /** Кнопка REC: заливка, рамка, точка, буквы */
  recFill: string;
  recBorder: string;
  recDot: string;
  recInk: string;
  showMic: boolean;
};

/** Белые цифры в красном квадрате «сегодня» — как в C-Week */
export const TODAY_INK = '#FFFFFF';

/**
 * Цвета по настройкам. scheme — тема, в которой сейчас виджет (тема приложения или телефона).
 * «Как в теме» — по scheme; фон «светлый» — светлая палитра; названия и время «светлые» — светлые буквы (из тёмной
 * палитры); кнопка REC «светлая» — светлая кнопка. Время «как в теме» — цвет текста, подпись дня — приглушённая;
 * выбранное явно — обе в полную яркость (иначе не видно на обоях)
 */
export function widgetColors(prefs: WidgetPrefs, scheme: Scheme): WidgetColors {
  const look = (tone: WidgetTone): WidgetPalette => (tone === 'light' ? palettes.light : tone === 'dark' ? palettes.dark : palettes[scheme]);
  const ink = (tone: WidgetTone): WidgetPalette => (tone === 'light' ? palettes.dark : tone === 'dark' ? palettes.light : look(prefs.bg));
  const bg = look(prefs.bg);
  const rec = look(prefs.micTone);
  const time = ink(prefs.time);
  return {
    card: bg.bg,
    alpha: prefs.opacity,
    panel: bg.panel,
    border: bg.border,
    hair: bg.hair,
    headBg: look(prefs.head).text,
    headInk: look(prefs.head).bg,
    today: bg.red,
    todayInk: TODAY_INK,
    title: ink(prefs.text).text,
    day: prefs.time === 'auto' ? bg.muted : time.text,
    time: time.text,
    empty: bg.muted,
    recFill: rec.panel,
    recBorder: rec.border,
    recDot: rec.red,
    recInk: rec.text,
    showMic: prefs.mic,
  };
}

/** Тема виджета: тема приложения, а «система» — тема телефона */
export const widgetScheme = (dark: boolean | null, phoneDark: boolean): Scheme => ((dark ?? phoneDark) ? 'dark' : 'light');

/* ---------- цвета виджета (макеты C-Widget*): превью и KstatiWidget.kt считают одинаково ---------- */

/** Цвета раскладок виджета (src/screens/widget/WidgetFace.tsx) */
export type FaceColors = {
  /** Поверхность с прозрачностью фона */
  card: string;
  text: string;
  /** Подписи дней, «Дел нет» */
  muted: string;
  hair: string;
  /** Квадрат «сегодня» */
  today: string;
  /** Время справа и подпись «день · время» в 2×2 / 2×1 */
  time: string;
  day: string;
  /** Плашка шапки: «как в теме» — без заливки (поверхность), светлая/тёмная — залита */
  headBg: string;
  headInk: string;
  headMuted: string;
  /** Капсула REC: непрозрачная заливка и мягкий контур */
  recFill: string;
  recBorder: string;
  recDot: string;
  recGlow: string;
  recInk: string;
  showRec: boolean;
};

/** Непрозрачность поверхности по умолчанию и наименьшая (прозрачность в настройках — до 80%) */
export const WIDGET_OPACITY_DEFAULT = 0.94;
export const WIDGET_OPACITY_MIN = 0.2;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.round(a * 1000) / 1000})`;
};

export function faceColors(prefs: WidgetPrefs, scheme: Scheme): FaceColors {
  const look = (tone: WidgetTone): WidgetPalette => (tone === 'light' ? palettes.light : tone === 'dark' ? palettes.dark : palettes[scheme]);
  const ink = (tone: WidgetTone): WidgetPalette => (tone === 'light' ? palettes.dark : tone === 'dark' ? palettes.light : look(prefs.bg));
  const bg = look(prefs.bg);
  const rec = look(prefs.micTone);
  const head = prefs.head === 'auto' ? null : look(prefs.head);
  const time = ink(prefs.time);
  const opacity = Math.max(WIDGET_OPACITY_MIN, Math.min(1, prefs.opacity));
  return {
    card: rgba(bg.panel, opacity),
    text: ink(prefs.text).text,
    muted: bg.muted,
    hair: bg.hair,
    today: bg.red,
    time: time.text,
    day: prefs.time === 'auto' ? bg.muted : time.text,
    headBg: head ? head.panel : 'transparent',
    headInk: head ? head.text : ink(prefs.text).text,
    headMuted: head ? head.muted : bg.muted,
    recFill: rec.panel,
    recBorder: rec.hair,
    recDot: rec.red,
    recGlow: rgba(rec.red, rec === palettes.dark ? 0.22 : 0.18),
    recInk: rec.text,
    showRec: prefs.mic,
  };
}

/* ---------- подписи раскладок (как в KstatiWidget.kt) ---------- */

/** Подпись дня в 4×2 / 4×4: «СБ 24 · СЕГОДНЯ», «ВС 25 · ЗАВТРА», до 6 дней «СР 28», дальше «ВС 1 НОЯ» */
export function faceDayLabel(date: string, today: string): string {
  const diff = dayNo(date) - dayNo(today);
  const wd = WD[weekdayOf(date) - 1] ?? '';
  const d = Number(date.slice(8, 10));
  if (diff === 0) return `${wd} ${pad2s(d)} · СЕГОДНЯ`;
  if (diff === 1) return `${wd} ${pad2s(d)} · ЗАВТРА`;
  if (diff > 1 && diff <= 6) return `${wd} ${pad2s(d)}`;
  return `${wd} ${d} ${MON[Number(date.slice(5, 7)) - 1] ?? ''}`;
}

/** Подпись под названием в 2×2 / 2×1: «18:00», «ЗАВТРА», «ЗАВТРА · 10:00», «СР 28 · 18:00», «1 НОЯ» */
export function faceWhen(date: string, time: string | null, today: string, short = false): string {
  const diff = dayNo(date) - dayNo(today);
  const day =
    diff <= 0 ? null : diff === 1 ? 'ЗАВТРА' : diff <= 6 ? `${WD[weekdayOf(date) - 1] ?? ''} ${pad2s(Number(date.slice(8, 10)))}` : `${Number(date.slice(8, 10))} ${MON[Number(date.slice(5, 7)) - 1] ?? ''}`;
  if (!day) return time ?? 'СЕГОДНЯ';
  // short — строка 2×2: на другие дни только день (время сегодня — как есть)
  return time && !short ? `${day} · ${time}` : day;
}

const pad2s = (n: number) => String(n).padStart(2, '0');

/** Дела по дням для 4×2 / 4×4 (до n строк всего) */
export function faceDays(items: readonly WidgetItem[], today: string): { date: string; label: string; items: WidgetItem[] }[] {
  const out: { date: string; label: string; items: WidgetItem[] }[] = [];
  for (const x of items) {
    const last = out[out.length - 1];
    if (last && last.date === x.date) last.items.push(x);
    else out.push({ date: x.date, label: faceDayLabel(x.date, today), items: [x] });
  }
  return out;
}
