/**
 * Раскрытая строка «ВИДНО» (C-EditVisible): «Только я», мои группы с отметкой и подписью режима группы,
 * у каждой — «ВРУЧНУЮ» (отмечено в этом деле) или «ПО ГРУППЕ» (по режиму), и сброс к режимам групп.
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
  /** Отмечено вручную в этом деле */
  manual: boolean;
};

export type VisiblePanelProps = {
  onlyMe: boolean;
  groups: readonly VisibleGroup[];
  onToggleOnly?: () => void;
  onToggleGroup?: (id: ID) => void;
  onReset?: () => void;
};

const Box = memo(function Box({ checked }: { checked: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.check, { borderColor: checked ? c.text : c.border, backgroundColor: checked ? c.text : c.bg }]}>
      {checked ? <Icon name="check" size={11} color={c.bg} /> : null}
    </View>
  );
});

export const VisiblePanel = memo(function VisiblePanel({ onlyMe, groups, onToggleOnly, onToggleGroup, onReset }: VisiblePanelProps) {
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
            accessibilityLabel={`${g.name}, ${g.manual ? 'вручную' : 'по группе'}`}
            onPress={onToggleGroup ? () => onToggleGroup(g.id) : undefined}
            style={[styles.group, { backgroundColor: c.panel }, i > 0 && [styles.divided, { borderTopColor: c.hair }]]}
          >
            <View style={styles.text}>
              <Marquee style={[ET.memberName, { color: c.text }]}>{g.name}</Marquee>
              <Marquee style={[styles.mode, { color: c.muted }]}>{g.mode}</Marquee>
            </View>
            <View style={[styles.tag, { borderColor: g.manual ? c.border : c.hair }]}>
              <Text style={[styles.tagText, { color: g.manual ? c.text : c.muted }]}>{g.manual ? 'ВРУЧНУЮ' : 'ПО ГРУППЕ'}</Text>
            </View>
            <Box checked={g.visible} />
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Сбросить к настройкам групп"
        onPress={onReset}
        style={[styles.reset, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Text style={[styles.resetText, { color: c.text }]}>СБРОСИТЬ К НАСТРОЙКАМ ГРУПП</Text>
      </Pressable>
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
  tag: { height: 20, borderWidth: S.border, paddingHorizontal: 6, justifyContent: 'center' },
  tagText: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.68 },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  reset: { height: 32, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.54 },
});
