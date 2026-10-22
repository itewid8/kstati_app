/**
 * Стили текста окон редактирования (C-Edit*, C-Plan), которых нет в tokens.type.
 * letterSpacing — в px (em × размер шрифта), как в tokens.
 */
import { fonts } from '@/ui';

type TextPreset = {
  fontFamily: string;
  fontSize: number;
  letterSpacing?: number;
  lineHeight?: number;
};

const em = (value: number, fontSize: number) => Math.round(value * fontSize * 1000) / 1000;

const mono = (fontFamily: string, fontSize: number, spacingEm = 0, lineHeight?: number): TextPreset => ({
  fontFamily,
  fontSize,
  ...(spacingEm ? { letterSpacing: em(spacingEm, fontSize) } : null),
  ...(lineHeight ? { lineHeight } : null),
});

export const ET = {
  /** Заголовок окна редактирования 24/28 «Ужин у родителей» */
  editorTitle: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 28, letterSpacing: em(-0.04, 24) },
  /** Подпись внутри раскрытой панели «КАЖДЫЕ», «ДОБАВИТЬ» */
  panelLabel: mono(fonts.mono400, 8.5, 0.08),
  /** Описание в строке поля 13/17 */
  description: { fontFamily: fonts.sans400, fontSize: 13, lineHeight: 17 },
  /** «×» — очистить поле */
  clear: { fontFamily: fonts.sans400, fontSize: 14 },

  /** Месяц/год над календарём «ОКТЯБРЬ 2026» */
  monthLabel: mono(fonts.mono600, 10, 0.08),
  weekday: mono(fonts.mono400, 8.5, 0.06),
  day: mono(fonts.mono400, 11),
  dayStrong: mono(fonts.mono600, 11),
  miniMonth: mono(fonts.mono400, 8.5, 0.08),
  miniMonthStrong: mono(fonts.mono600, 8.5, 0.08),

  wheel: mono(fonts.mono400, 12),
  wheelCurrent: mono(fonts.mono600, 17),
  noTime: mono(fonts.mono600, 9, 0.06),

  /** Сегменты и пресеты 32px */
  chip: mono(fonts.mono400, 9, 0.04),
  chipMedium: mono(fonts.mono500, 9, 0.04),
  chipStrong: mono(fonts.mono600, 9, 0.04),
  /** Двухстрочный сегмент «НАЧАЛО / СР 7 ОКТ · 07:00» */
  segCaption: mono(fonts.mono400, 8, 0.08),
  segValue: mono(fonts.mono600, 11),

  stepperSign: { fontFamily: fonts.sans400, fontSize: 14 },
  stepperValue: mono(fonts.mono600, 13),

  /** Кнопка-значение «31 ДЕК 2026 ›» */
  linkValue: mono(fonts.mono500, 10.5),
  /** Кнопка-действие «ПЛАН СЕТКОЙ ›», «+ ПОДЗАДАЧА» */
  blockAction: mono(fonts.mono600, 9.5, 0.08),
  /** Пункт меню «СВОЁ: ЗА … ДО НАЧАЛА» */
  menuItem: mono(fonts.mono400, 9.5, 0.04),

  reminderRule: { fontFamily: fonts.sans500, fontSize: 12.5, lineHeight: 15 },
  reminderWhen: mono(fonts.mono400, 9, 0.02),
  removeSign: { fontFamily: fonts.sans400, fontSize: 15 },

  memberLetter: mono(fonts.mono600, 12),
  memberName: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 16 },
  memberMeta: mono(fonts.mono400, 9),

  warnLabel: mono(fonts.mono600, 9, 0.06),
  warnText: { fontFamily: fonts.sans400, fontSize: 12 },

  subtaskTitle: { fontFamily: fonts.sans500, fontSize: 13, lineHeight: 16 },
  subtaskMeta: mono(fonts.mono400, 9, 0.02, 11),

  /* C-Plan */
  planCaption: mono(fonts.mono400, 10, 0.08),
  planTitle: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 26, letterSpacing: em(-0.04, 24) },
  planRange: mono(fonts.mono400, 9, 0.06, 11),
  planCount: mono(fonts.mono600, 10, 0, 12),
  planDay: mono(fonts.mono600, 9, 0.06, 11),
  planHour: mono(fonts.mono400, 8.5, 0, 10),
  planEventTitle: { fontFamily: fonts.sans600, fontSize: 10, lineHeight: 12 },
  planEventTime: mono(fonts.mono400, 8.5, 0, 10),
  planEventNote: { fontFamily: fonts.sans400, fontSize: 8.5, lineHeight: 10 },
} as const satisfies Record<string, TextPreset>;
