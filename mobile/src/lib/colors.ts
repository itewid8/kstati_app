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
import { PERSON_COLORS, type ID, type PersonColor, type Task, type User } from './types';

const HEX: Record<PersonColor, { light: string; dark: string }> = {
  blue: { light: '#2F6BDB', dark: '#5B8DEF' },
  pink: { light: '#E2407E', dark: '#F06A9B' },
  green: { light: '#1F9D57', dark: '#3DBE76' },
  yellow: { light: '#E0A800', dark: '#F2C230' },
  orange: { light: '#F2711C', dark: '#FF8C42' },
  violet: { light: '#7C4DDB', dark: '#9B74F0' },
  teal: { light: '#0E9AA7', dark: '#2CC0CC' },
};

export const colorHex = (key: PersonColor, dark: boolean) => HEX[key][dark ? 'dark' : 'light'];

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
    const key = free ?? PERSON_COLORS[next++ % PERSON_COLORS.length];
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
      const key = map.get(id);
      return key ? colorHex(key, dark) : dark ? '#8B8B8B' : '#6B6B6B';
    };
    return { of, task: (t) => peopleOf(t).map(of), bodyAlpha: dark ? 0.24 : 0.15 };
  }, [memberIds, users, dark]);
}
