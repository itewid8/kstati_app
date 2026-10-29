/**
 * «ИМЕНИННИК» у дня рождения: имя пишется прямо в строке, под ней — участники групп метками.
 * Выбранный участник залит своим цветом; повторное нажатие снимает выбор.
 */
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { fonts, size as S, space, useTheme } from '@/ui';
import { FieldInputRow } from './FieldTable';

export type CelebrantOption = { id: ID; name: string; color: PersonColor; selected: boolean };

export type CelebrantField = {
  /** Имя; null — «+ ИМЯ» */
  name: string | null;
  options: readonly CelebrantOption[];
};

type Props = CelebrantField & {
  first?: boolean;
  onChangeName?: (name: string) => void;
  onPick?: (id: ID, name: string) => void;
};

export const CelebrantRow = memo(function CelebrantRow({ name, options, first, onChangeName, onPick }: Props) {
  const { c, person, personInk } = useTheme();
  return (
    <>
      <FieldInputRow first={first} label="ИМЕНИННИК" value={name} empty="+ ИМЯ" maxLength={80} onChangeText={onChangeName ?? noop} />
      {options.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={[styles.chips, { backgroundColor: c.panel, borderTopColor: c.hair }]}
          contentContainerStyle={styles.chipsRow}
        >
          {options.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityState={{ selected: o.selected }}
              accessibilityLabel={o.name}
              disabled={!onPick}
              onPress={onPick ? () => onPick(o.id, o.name) : undefined}
              style={[styles.chip, { borderColor: o.selected ? person(o.color) : c.border, backgroundColor: o.selected ? person(o.color) : c.panel }]}
            >
              <Text numberOfLines={1} style={[styles.chipText, { color: o.selected ? personInk(o.color) : c.text }]}>
                {o.name.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
});

const noop = () => {};

const styles = StyleSheet.create({
  chips: { borderTopWidth: S.hairline, flexGrow: 0 },
  chipsRow: { gap: 6, paddingHorizontal: space.side / 2 + 4, paddingVertical: 8 },
  chip: { height: 26, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8 },
});
