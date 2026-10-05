/**
 * Цвета людей в календаре — как стикеры-закладки в блокноте.
 * У каждого участника группы свой цвет: выбранный в настройках, а если не выбран или уже занят
 * в этой группе (первым по порядку вступления) — первый свободный из палитры.
 * Все телефоны группы считают одинаково: порядок участников общий.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { peopleOf } from './span';
import { useCurrentGroup, useStore } from './store';
import { PERSON_COLORS, type ID, type PaletteKey, type PersonColor, type Task, type User } from './types';

const HEX: Record<PaletteKey, { light: string; dark: string }> = {
  blue: { light: '#2F6BDB', dark: '#5B8DEF' },
  pink: { light: '#E2407E', dark: '#F06A9B' },
  green: { light: '#1F9D57', dark: '#3DBE76' },
  yellow: { light: '#E0A800', dark: '#F2C230' },
  orange: { light: '#F2711C', dark: '#FF8C42' },
  violet: { light: '#7C4DDB', dark: '#9B74F0' },
  teal: { light: '#0E9AA7', dark: '#2CC0CC' },
};

/** Цвет на экране: из палитры — под тему, свой — как есть */
export const colorHex = (key: PersonColor, dark: boolean) => (key.startsWith('#') ? key : HEX[key as PaletteKey][dark ? 'dark' : 'light']);

/** Цвет полосы спектра: оттенок 0–360 при насыщенности и яркости, в которых ярлыки читаются в обеих темах */
export function hueHex(hue: number): `#${string}` {
  const s = 0.68;
  const l = 0.5;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const h = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${h(f(0))}${h(f(8))}${h(f(4))}`;
}

/** Оттенок своего цвета (для ползунка спектра) */
export function hexHue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const INK_DARK = '#1A1A1A';
const INK_LIGHT = '#FFFFFF';

/** Относительная яркость по WCAG */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/** Текст поверх цвета: белый или тёмный — тот, что контрастнее */
export function inkOn(hex: string): string {
  const l = luminance(hex);
  const onLight = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  return onLight >= onDark ? INK_LIGHT : INK_DARK;
}

/** Цвет каждого участника: свой, если не занят раньше вступившим, иначе первый свободный */
export function memberColors(memberIds: ID[], users: User[]): Map<ID, PersonColor> {
  const out = new Map<ID, PersonColor>();
  const used = new Set<PersonColor>();
  for (const id of memberIds) {
    const own = users.find((u) => u.id === id)?.color;
    if (own && !used.has(own)) {
      out.set(id, own);
      used.add(own);
    }
  }
  let next = 0;
  for (const id of memberIds) {
    if (out.has(id)) continue;
    const free = PERSON_COLORS.find((k) => !used.has(k));
    // Людей больше, чем цветов — идём по кругу
    const key: PersonColor = free ?? PERSON_COLORS[next++ % PERSON_COLORS.length];
    out.set(id, key);
    used.add(key);
  }
  return out;
}

/** Полупрозрачная заливка ярлыка цветом человека */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export type Palette = {
  /** Цвет человека (hex) — для кончика ярлыка и полосок */
  of: (id: ID) => string;
  /** Цвета людей дела по порядку: один — личное, несколько — общее */
  task: (t: Pick<Task, 'people' | 'createdBy'>) => string[];
  /** Прозрачность тела ярлыка под тему */
  bodyAlpha: number;
};

/** Цвета текущей группы. Чужой (не участник) — серым */
export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';
  const group = useCurrentGroup();
  const users = useStore((s) => s.users);
  const memberIds = group?.memberIds;
  return useMemo(() => {
    const map = memberColors(memberIds ?? [], users);
    const of = (id: ID) => {
      // Не в группе (или групп нет) — свой цвет человека, иначе серый
      const key = map.get(id) ?? users.find((u) => u.id === id)?.color;
      return key ? colorHex(key, dark) : dark ? '#8B8B8B' : '#6B6B6B';
    };
    return { of, task: (t) => peopleOf(t).map(of), bodyAlpha: dark ? 0.24 : 0.15 };
  }, [memberIds, users, dark]);
}
