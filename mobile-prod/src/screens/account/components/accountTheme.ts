/**
 * Цвета и стили текста экранов аккаунта (C-Profile, C-Settings, C-Group, C-Code), которых нет в src/ui/tokens.
 * Кандидаты в tokens: danger (деструктивные действия), ok (статус «в сети»), meterEmpty, fieldHair.
 */
import { StyleSheet } from 'react-native';
import { fonts, useTheme, type Scheme } from '@/ui';

export type AccountPalette = {
  /** «Удалить аккаунт», «Покинуть группу» — глубже, чем red (запись/«сегодня») */
  danger: string;
  /** Зелёная точка «СЕРВЕР» */
  ok: string;
  /** Пустые деления счётчика «ГОЛОС СЕГОДНЯ» */
  meterEmpty: string;
  /** Рамка неактивной кнопки «ОТПРАВИТЬ ЕЩЁ РАЗ» */
  fieldHair: string;
};

const PALETTES: Record<Scheme, AccountPalette> = {
  light: { danger: '#C8231A', ok: '#1F9D57', meterEmpty: '#E2E1DB', fieldHair: '#B9B8B2' },
  dark: { danger: '#FF453A', ok: '#3DBE76', meterEmpty: '#222222', fieldHair: '#2E2E2E' },
};

export function useAccountPalette(): AccountPalette {
  return PALETTES[useTheme().scheme];
}

/** Знак «Кстати» в плитке — цвета иконки приложения, от темы не зависят */
export const BRAND = { tile: '#1E1E1E', bar: '#E6E6E6', accent: '#D13438' } as const;

/**
 * Ширина колонки сетки из n равных («grid-template-columns: repeat(n, 1fr)»).
 * У flex:1 рамка или отступ ячейки прибавляются к базе и делают колонки неравными — проценты нет.
 */
export const gridColumn = (n: number): `${number}%` => `${100 / n}%`;

/** em → px */
const em = (value: number, fontSize: number) => Math.round(value * fontSize * 1000) / 1000;

export const accountText = StyleSheet.create({
  /** Название строки 13 / 500 */
  rowLabel: { fontFamily: fonts.sans500, fontSize: 13 },
  /** Название строки с подписью 13/16 */
  rowLabelTight: { fontFamily: fonts.sans500, fontSize: 13, lineHeight: 16 },
  /** Значение справа «САНЯ», «ПАРА · 2» */
  rowValue: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: em(0.04, 9.5) },
  /** Значение справа помельче («1.0.3 (42)») */
  rowValueSmall: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: em(0.04, 9) },
  /** Подпись под названием 9/11 */
  rowMeta: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: em(0.04, 9), lineHeight: 11 },
  /** Варианты в сетке выбора («СИСТЕМА») */
  option: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: em(0.08, 9.5) },
  optionActive: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: em(0.08, 9.5) },
  /** Кнопка во всю ширину «ПОКИНУТЬ ГРУППУ» */
  wideAction: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: em(0.1, 10.5) },
});
