/**
 * Тип дела в окне дела: четыре плитки — мини-иконка и подпись мелким шрифтом (ДЕЛО, ДЕНЬ РОЖДЕНИЯ, ВАЖНЫЙ ДЕНЬ,
 * ПУТЕШЕСТВИЕ). Выбранная залита цветом текста. Без onChange — только показывает (чужое дело).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TASK_KINDS, type TaskKind } from '@/lib/types';
import { Icon, KIND_ICON, KIND_LABEL, fonts, size as S, useTheme } from '@/ui';

export const KindPicker = memo(function KindPicker({ value, onChange }: { value: TaskKind; onChange?: (kind: TaskKind) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {TASK_KINDS.map((k) => {
        const on = k === value;
        const ink = on ? c.bg : c.text;
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={KIND_LABEL[k]}
            disabled={!onChange}
            onPress={onChange && !on ? () => onChange(k) : undefined}
            style={[styles.tile, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }]}
          >
            <Icon name={KIND_ICON[k]} size={16} color={ink} />
            <Text numberOfLines={1} style={[styles.label, { color: on ? c.bg : c.muted }]}>
              {KIND_LABEL[k]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, height: 46, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 },
  label: { fontFamily: fonts.mono600, fontSize: 7, letterSpacing: 0.35 },
});
