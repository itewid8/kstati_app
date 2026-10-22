/**
 * Строка списка 44px как ListRow из src/ui, но со значком сразу после названия
 * (C-Ideas: иконка «общая тема» 11px). Раскладка и отступы — один в один с ListRow.
 * Кандидат в src/ui: проп titleIcon у ListRow.
 */
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Checkbox, Icon, Marquee, size as S, type as T, useTheme, type IconName } from '@/ui';

type Props = {
  title: string;
  meta?: string;
  /** Полоса 1.5px слева */
  strip?: string;
  /** Значок после названия цветом muted */
  titleIcon?: IconName;
  titleIconLabel?: string;
  checked?: boolean;
  onToggle?: () => void;
  checkLabel: string;
  onPress?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const AccessoryListRow = memo(function AccessoryListRow({
  title,
  meta,
  strip,
  titleIcon,
  titleIconLabel,
  checked = false,
  onToggle,
  checkLabel,
  onPress,
  right,
  style,
}: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }, style]}
    >
      {strip ? <View style={[styles.strip, { backgroundColor: strip }]} /> : null}
      <Checkbox checked={checked} onPress={onToggle} accessibilityLabel={checkLabel} style={styles.check} />
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Marquee style={[T.rowTitle, styles.title, { color: c.text }]}>
            {title}
          </Marquee>
          {titleIcon ? (
            <View accessible={!!titleIconLabel} accessibilityLabel={titleIconLabel} style={styles.icon}>
              <Icon name={titleIcon} size={11} color={c.muted} />
            </View>
          ) : null}
        </View>
        {meta ? (
          <Marquee style={[T.rowMeta, { color: c.muted }]}>
            {meta}
          </Marquee>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: S.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 7,
    paddingRight: 8,
    borderTopWidth: S.hairline,
  },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  check: { marginLeft: 3 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, minWidth: 0 },
  icon: { flexShrink: 0 },
});
