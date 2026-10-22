/**
 * Раскрытая строка «КТО» (C-EditWho): все в группе / выбрать, список участников группы —
 * буква в квадрате цвета человека, имя, занятость (занят — красным) и отметка цветом человека.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { Icon, Marquee, size as S, useTheme } from '@/ui';
import { Segmented, type SegmentItem } from '../components/Segmented';
import { ET } from '../components/text';

export type WhoMode = 'all' | 'pick';

const MODES: ReadonlyArray<SegmentItem<WhoMode>> = [
  { key: 'all', label: 'ВСЕ В ГРУППЕ' },
  { key: 'pick', label: 'ВЫБРАТЬ' },
];

export type WhoMember = {
  id: ID;
  /** «С» */
  letter: string;
  /** «Саня (вы)» */
  name: string;
  /** «СВОБОДЕН», «ЗАНЯТА 19:00–20:00 · ЙОГА» */
  meta: string;
  /** Занят в это время — подпись красным */
  busy?: boolean;
  color: PersonColor;
  selected: boolean;
};

export type WhoPanelProps = {
  mode: WhoMode;
  members: readonly WhoMember[];
  onMode?: (mode: WhoMode) => void;
  onToggleMember?: (id: ID) => void;
};

export const WhoPanel = memo(function WhoPanel({ mode, members, onMode, onToggleMember }: WhoPanelProps) {
  const { c, person, personInk } = useTheme();
  return (
    <>
      <Segmented items={MODES} value={mode} onChange={onMode} />
      <View style={[styles.box, { borderColor: c.border }]}>
        {members.map((m, i) => {
          const fill = person(m.color);
          const ink = personInk(m.color);
          return (
            <Pressable
              key={m.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: m.selected }}
              accessibilityLabel={`${m.name}, ${m.meta}`}
              onPress={onToggleMember ? () => onToggleMember(m.id) : undefined}
              style={[styles.member, { backgroundColor: c.panel }, i > 0 && [styles.divided, { borderTopColor: c.hair }]]}
            >
              <View style={[styles.avatar, { backgroundColor: fill }]}>
                <Text style={[ET.memberLetter, { color: ink }]}>{m.letter}</Text>
              </View>
              <View style={styles.text}>
                <Marquee style={[ET.memberName, { color: c.text }]}>
                  {m.name}
                </Marquee>
                <Marquee style={[ET.memberMeta, { color: m.busy ? c.red : c.muted }]}>
                  {m.meta}
                </Marquee>
              </View>
              <View
                style={[
                  styles.check,
                  { borderColor: m.selected ? fill : c.border, backgroundColor: m.selected ? fill : c.bg },
                ]}
              >
                {m.selected ? <Icon name="check" size={11} color={ink} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border },
  /** Кнопка 44 вместе с разделителем (border-box) */
  member: { height: S.row, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  divided: { borderTopWidth: S.hairline },
  avatar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  check: {
    width: S.checkbox,
    height: S.checkbox,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
