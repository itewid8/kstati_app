/**
 * Вкладки людей у правого края сетки (неделя, день): 26×84, рамка без правой стороны, подпись снизу вверх.
 * Видимый человек — заливка его цветом, скрытый — панель (дела скрытых отфильтровывает владелец данных).
 * Место вкладок закреплено (PERSON_TAB.top): не зависит от вида, числа полос на весь день и дел — не прыгают
 * при переключении дня, недели и вида.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ID } from '@/lib/types';
import { Marquee, fonts, size as S, useTheme } from '@/ui';
import type { PersonFilterProps } from '../types';

export const PERSON_TAB = {
  width: 26,
  height: 84,
  /** Шаг вкладок: 84 + 4 */
  pitch: 88,
  /** Верх первой вкладки, px от верха экрана без safe area — в дне и неделе одинаково (на 10px ниже черты шапки недели) */
  top: 200,
} as const;

type Props = PersonFilterProps & {
  /** safe area сверху */
  insetTop: number;
};

/** Внутренняя область кнопки (без рамки слева, сверху и снизу) — повёрнутая подпись центрируется в ней */
const INNER_W = PERSON_TAB.width - S.border;
const INNER_H = PERSON_TAB.height - 2 * S.border;
/** В макете подпись — writing-mode: vertical-rl + rotate(180°); её строка встаёт на 1px ниже повёрнутого текста */
const VERTICAL_RL_SHIFT = 1;

export const PersonTabs = memo(function PersonTabs({ people, hiddenPeople, onTogglePerson, insetTop }: Props) {
  const { c, person, personInk } = useTheme();
  const hidden = new Set<ID>(hiddenPeople ?? []);
  return (
    <>
      {people.map((p, i) => {
        const on = !hidden.has(p.id);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={p.name}
            onPress={onTogglePerson ? () => onTogglePerson(p.id) : undefined}
            style={[
              styles.tab,
              { top: insetTop + PERSON_TAB.top + i * PERSON_TAB.pitch, borderColor: c.border, backgroundColor: on ? person(p.color) : c.panel },
            ]}
          >
            <View style={styles.rotated}>
              <Marquee style={[styles.label, { color: on ? personInk(p.color) : c.text }]}>
                {p.tabLabel}
              </Marquee>
            </View>
          </Pressable>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  tab: {
    position: 'absolute',
    right: 0,
    width: PERSON_TAB.width,
    height: PERSON_TAB.height,
    borderWidth: S.border,
    borderRightWidth: 0,
  },
  rotated: {
    position: 'absolute',
    width: INNER_H,
    height: INNER_W,
    left: (INNER_W - INNER_H) / 2,
    top: (INNER_H - INNER_W) / 2 + VERTICAL_RL_SHIFT,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  label: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 1 },
});
