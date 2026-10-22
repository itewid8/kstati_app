/**
 * Цвета людей в календаре — как стикеры-закладки в блокноте.
 * У каждого участника группы свой цвет: выбранный в настройках, а если не выбран или уже занят
 * в этой группе (первым по порядку вступления) — первый свободный из палитры.
 * Все телефоны группы считают одинаково: порядок участников общий.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colorHex, memberColors } from './personColors';
import { peopleOf } from './span';
import { useCurrentGroup, useStore } from './store';
import type { ID, Task } from './types';

export { colorHex, hexHue, hueHex, inkOn, memberColors, tint } from './personColors';

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
