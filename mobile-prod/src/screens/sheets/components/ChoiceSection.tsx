import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '@/ui';
import { ChipGrid, type ChipItem } from '../../editors/components/ChipGrid';

/** Подпись блока моноширинным 8.5 («ВИД», «ЖАНРЫ», «ТЕМА») и содержимое под ней (как «ПЕРЕНЕСТИ» в C-Quick*) */
export const SheetSection = memo(function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      {children}
    </View>
  );
});

type ChoiceProps<K extends string> = {
  label: string;
  items: ReadonlyArray<ChipItem<K>>;
  columns?: number;
  onPress?: (key: K) => void;
};

/** Выбор плитками 32px: выбранные инвертированы */
function ChoiceSectionInner<K extends string>({ label, items, columns = 3, onPress }: ChoiceProps<K>) {
  return (
    <SheetSection label={label}>
      <ChipGrid items={items} columns={columns} onPress={onPress} />
    </SheetSection>
  );
}

export const ChoiceSection = memo(ChoiceSectionInner) as typeof ChoiceSectionInner;

const styles = StyleSheet.create({
  section: { gap: 5 },
  label: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
});
