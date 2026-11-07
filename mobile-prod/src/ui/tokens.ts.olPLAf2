/**
 * Дизайн-система «Инструмент» (макеты design/mockups/C-*.dc.html).
 * Квадратные углы, рамки 1.5px, Geist + Geist Mono. Все размеры в dp, letterSpacing — в px
 * (в макетах em: 0.08em × 10px = 0.8).
 */
import type { PaletteKey, PersonColor } from '@/lib/types';

export type Scheme = 'light' | 'dark';

export type Palette = {
  /** Фон экрана */
  bg: string;
  /** Плашки, кнопки, строки списка */
  panel: string;
  /** Чередование колонок (неделя) */
  alt: string;
  /** Рамки 1.5px */
  border: string;
  /** Разделители строк 1px */
  hair: string;
  /** Рамка приглушённой секции («Подарено», «Архив») */
  hairStrong: string;
  /** Дни чужого месяца, неактивное */
  faint: string;
  text: string;
  muted: string;
  /** Запись, «сегодня», удаление */
  red: string;
  /** Предупреждения */
  warn: string;
  /** Свечение точки REC */
  glow: string;
  /** Затемнение под нижним окном */
  scrim: string;
  /** Прозрачность заливки цветом человека (ярлыки, диапазоны) */
  tintAlpha: number;
};

/*
 * hair в тёмной теме в макетах разный: #222222 (Wishes, Watch, Ideas, EditDate), #1E1E1E (Week),
 * #242424 (List, Voice). Берём #222222 — разница ±2 на канал, на глаз не видна.
 * tintAlpha: 0.2 / 0.24 (Week, EditDate); в List — 0.14 / 0.16, там это заливка плана, не диапазона.
 */
export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: '#E7E6E1',
    panel: '#F4F3EF',
    alt: '#DEDDD7',
    border: '#161616',
    hair: '#CFCEC8',
    hairStrong: '#A3A29C',
    faint: '#A3A29C',
    text: '#111111',
    muted: '#5E5E58',
    red: '#E0281E',
    warn: '#A15C00',
    glow: 'rgba(224,40,30,0.6)',
    scrim: 'rgba(17,17,17,0.45)',
    tintAlpha: 0.2,
  },
  dark: {
    bg: '#0B0B0B',
    panel: '#151515',
    alt: '#121212',
    border: '#2E2E2E',
    hair: '#222222',
    hairStrong: '#3A3A3A',
    faint: '#4A4A47',
    text: '#F2F2F0',
    muted: '#7C7C78',
    red: '#FF3B30',
    warn: '#E5A50A',
    glow: 'rgba(255,59,48,0.6)',
    scrim: 'rgba(0,0,0,0.6)',
    tintAlpha: 0.24,
  },
};

/* ---------- Цвета людей ---------- */

/**
 * Цвет человека один и тот же во всех группах — из его профиля (User.color).
 * В макетах: s = blue (Саня), k = pink (Карина), g/o = green, y = yellow.
 * fill — заливка/полоса, ink — текст поверх заливки.
 */
const PERSON: Record<PaletteKey, Record<Scheme, { fill: string; ink: string }>> = {
  blue: { light: { fill: '#2F6BDB', ink: '#FFFFFF' }, dark: { fill: '#5B8DEF', ink: '#1A1A1A' } },
  pink: { light: { fill: '#E2407E', ink: '#1A1A1A' }, dark: { fill: '#F06A9B', ink: '#1A1A1A' } },
  green: { light: { fill: '#1F9D57', ink: '#FFFFFF' }, dark: { fill: '#3DBE76', ink: '#1A1A1A' } },
  yellow: { light: { fill: '#E0A800', ink: '#1A1A1A' }, dark: { fill: '#F2C230', ink: '#1A1A1A' } },
  orange: { light: { fill: '#F2711C', ink: '#1A1A1A' }, dark: { fill: '#FF8C42', ink: '#1A1A1A' } },
  violet: { light: { fill: '#7C4DDB', ink: '#FFFFFF' }, dark: { fill: '#9B74F0', ink: '#1A1A1A' } },
  teal: { light: { fill: '#0E9AA7', ink: '#1A1A1A' }, dark: { fill: '#2CC0CC', ink: '#1A1A1A' } },
};

const isHex = (c: PersonColor): c is `#${string}` => c.startsWith('#');

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/** Цвет человека под тему: ключ палитры или свой «#rrggbb» */
export function personColor(color: PersonColor, scheme: Scheme): string {
  return isHex(color) ? color : PERSON[color][scheme].fill;
}

/** Текст поверх цвета человека (буква на кнопке профиля и т.п.) */
export function personInk(color: PersonColor, scheme: Scheme): string {
  if (!isHex(color)) return PERSON[color][scheme].ink;
  const l = luminance(color);
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance('#1A1A1A') + 0.05) ? '#FFFFFF' : '#1A1A1A';
}

/** Полупрозрачная заливка цветом (hex → rgba) */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ---------- Размеры ---------- */

export const space = {
  /** Поля экрана слева и справа */
  side: 16,
  /** Зазор между кнопками верхней панели */
  barGap: 8,
  /** Зазор между ячейками нижней навигации */
  navGap: 4,
} as const;

export const size = {
  border: 1.5,
  hairline: 1,
  strip: 1.5,

  topBarTop: 20,
  topBarHeight: 40,
  iconButton: 40,
  /** Иконки верхней панели (в List и EditDate — 16) */
  icon: 18,
  iconSmall: 16,

  titleTop: 70,
  titleHeight: 42,

  tabsTop: 120,
  tab: 32,
  viewSwitch: 28,

  /** Где начинается основной контент под вкладками */
  contentTop: 162,
  /** Экраны с названием в верхней панели (Заметки, Хочу): вкладки — на месте заголовка, контент — на 50 выше */
  tabsTopCompact: 70,
  contentTopCompact: 112,
  /** Нижний край контента над навигацией */
  contentBottom: 98,

  sectionHeader: 22,
  row: 44,
  /** Строка свёрнутого списка «сделано» (34 + разделитель) */
  doneRow: 35,
  checkbox: 18,
  checkTap: 32,
  rowAction: 32,

  navBottom: 18,
  navHeight: 72,
  recWidth: 104,
  recDot: 26,

  grabberWidth: 36,
  grabberHeight: 4,
} as const;

/* ---------- Шрифты ---------- */

/**
 * Имена семейств из @expo-google-fonts: на телефоне у каждого начертания своё семейство,
 * fontWeight с ними не задаём (Android иначе подменяет шрифт).
 */
export const fonts = {
  sans400: 'Geist_400Regular',
  sans500: 'Geist_500Medium',
  sans600: 'Geist_600SemiBold',
  sans700: 'Geist_700Bold',
  mono400: 'GeistMono_400Regular',
  mono500: 'GeistMono_500Medium',
  mono600: 'GeistMono_600SemiBold',
} as const;

type TextPreset = {
  fontFamily: string;
  fontSize: number;
  letterSpacing?: number;
  lineHeight?: number;
};

/** em → px */
const em = (value: number, fontSize: number) => Math.round(value * fontSize * 1000) / 1000;

const mono = (fontFamily: string, fontSize: number, spacingEm = 0, lineHeight?: number): TextPreset => ({
  fontFamily,
  fontSize,
  ...(spacingEm ? { letterSpacing: em(spacingEm, fontSize) } : null),
  ...(lineHeight ? { lineHeight } : null),
});

export const type = {
  /** Заголовок экрана «Хочу» 40/42 */
  h1: { fontFamily: fonts.sans700, fontSize: 40, lineHeight: 42, letterSpacing: em(-0.05, 40) },
  /** Название экрана в верхней панели (40px высотой) вместо отдельной строки заголовка */
  barTitle: { fontFamily: fonts.sans700, fontSize: 34, lineHeight: 40, letterSpacing: em(-0.05, 34) },
  /** Заголовок карточки 24/28 */
  h2: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 28, letterSpacing: em(-0.04, 24) },
  /** Подпись в верхней панели «ВИШЛИСТЫ · 4 ЧЕЛОВЕКА» */
  caption: mono(fonts.mono400, 10, 0.08),
  /** Подпись рядом с «Назад» «ДЕЛО · МЫ С КАРИНОЙ» */
  backLabel: mono(fonts.mono400, 9.5, 0.08),
  /** Выбор группы в верхней панели */
  group: mono(fonts.mono500, 11, 0.08),
  /** Буква на кнопке профиля */
  avatar: mono(fonts.mono600, 15),
  /** Вкладки 32px */
  tab: mono(fonts.mono400, 9.5, 0.06),
  tabActive: mono(fonts.mono600, 9.5, 0.06),
  /** Переключатель вида 28px */
  view: mono(fonts.mono400, 9.5, 0.08),
  viewActive: mono(fonts.mono600, 9.5, 0.08),
  /** Шапка секции 22px */
  section: mono(fonts.mono600, 9, 0.08),
  /** Строка списка: название 13/16 и подпись 9/11 */
  rowTitle: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 16 },
  rowMeta: mono(fonts.mono400, 9, 0.02, 11),
  /** Число/время справа в строке */
  rowValue: mono(fonts.mono600, 12, -0.02),
  /** Строка «сделано» */
  doneTitle: { fontFamily: fonts.sans400, fontSize: 12 },
  doneMeta: mono(fonts.mono400, 9),
  /** Имя человека рядом с цветным квадратом */
  person: mono(fonts.mono600, 9.5, 0.06),
  /** Подпись поля в карточке «КОГДА» */
  fieldLabel: mono(fonts.mono600, 9, 0.08),
  fieldValue: mono(fonts.mono500, 11, 0.02),
  /** Нижняя навигация */
  nav: mono(fonts.mono400, 10.5, 0.08),
  navActive: mono(fonts.mono600, 10.5, 0.08),
  rec: mono(fonts.mono600, 10, 0.12),
  /** Кнопки действий в окнах «СОХРАНИТЬ» */
  action: mono(fonts.mono600, 10.5, 0.1),
} as const satisfies Record<string, TextPreset>;

/** «04» — счётчики в шапках секций */
export const pad2 = (n: number) => String(n).padStart(2, '0');
