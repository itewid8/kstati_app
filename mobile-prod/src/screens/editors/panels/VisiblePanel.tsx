/**
 * Раскрытая строка «ВИДНО» (C-EditVisible): «Только я» и мои группы с отметкой и подписью режима группы.
 * Отметка у группы — решение для этого дела: режим группы на него больше не влияет.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID } from '@/lib/types';
import { Icon, Marquee, fonts, size as S, useTheme } from '@/ui';
import { PanelLabel } from '../components/FieldTable';
import { ET } from '../components/text';

export type VisibleGroup = {
  id: ID;
  name: string;
  /** «ВСЕ, КРОМЕ СКРЫТЫХ» / «ТОЛЬКО ВЫБРАННЫЕ» — мой режим в группе */
  mode: string;
  visible: boolean;
};

export type VisiblePanelProps = {
  onlyMe: boolean;
  groups: readonly VisibleGroup[];
  onToggleOnly?: () => void;
  onToggleGroup?: (id: ID) => void;
};

const Box = memo(function Box({ checked }: { checked: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.check, { borderColor: checked ? c.text : c.border, backgroundColor: checked ? c.text : c.bg }]}>
      {checked ? <Icon name="check" size={11} color={c.bg} /> : null}
    </View>
  );
});

export const VisiblePanel = memo(function VisiblePanel({ onlyMe, groups, onToggleOnly, onToggleGroup }: VisiblePanelProps) {
  const { c } = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: onlyMe }}
        accessibilityLabel="Только я"
        onPress={onToggleOnly}
        style={[styles.only, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Icon name="lock" size={13} color={c.text} />
        <Text style={[styles.onlyText, { color: c.text }]}>ТОЛЬКО Я</Text>
        <Box checked={onlyMe} />
      </Pressable>
      <PanelLabel text="ГРУППЫ" />
      <View style={[styles.box, { borderColor: c.border }]}>
        {groups.map((g, i) => (
          <Pressable
            key={g.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: g.visible }}
            accessibilityLabel={g.name}
            onPress={onToggleGroup ? () => onToggleGroup(g.id) : undefined}
            style={[styles.group, { backgroundColor: c.panel }, i > 0 && [styles.divided, { borderTopColor: c.hair }]]}
          >
            <View style={styles.text}>
              <Marquee style={[ET.memberName, { color: c.text }]}>{g.name}</Marquee>
              <Marquee style={[styles.mode, { color: c.muted }]}>{g.mode}</Marquee>
            </View>
            <Box checked={g.visible} />
          </Pressable>
        ))}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  only: { height: 40, borderWidth: S.border, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlyText: { flex: 1, fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8 },
  box: { borderWidth: S.border },
  /** Кнопка 44 вместе с разделителем (border-box) */
  group: { height: S.row, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  divided: { borderTopWidth: S.hairline },
  text: { flex: 1, minWidth: 0, gap: 1 },
  mode: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.18, lineHeight: 11 },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
