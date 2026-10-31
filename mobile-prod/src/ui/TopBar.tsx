import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Marquee } from './Marquee';
import { size as S, space, type as T } from './tokens';
import { useTheme } from './useTheme';

export type TopBarAction = {
  key: string;
  accessibilityLabel: string;
  onPress?: () => void;
  icon?: IconName;
  letter?: string;
  fill?: string;
  ink?: string;
  badge?: boolean;
};

type Lead =
  /** Подпись слева «ВИШЛИСТЫ · 4 ЧЕЛОВЕКА» */
  | { kind: 'caption'; text: string }
  /** Выбор группы «МЫ С КАРИНОЙ ⌄» */
  | { kind: 'group'; label: string; onPress?: () => void }
  /** Назад + подпись «ДЕЛО · МЫ С КАРИНОЙ» */
  | { kind: 'back'; label: string; onBack?: () => void }
  /** Название экрана крупно — вместо отдельной строки заголовка (Заметки, Хочу) */
  | { kind: 'title'; text: string };

type Props = {
  lead: Lead;
  /** Между подписью (группой) и кнопками — переключатель «список / календарь» */
  after?: ReactNode;
  actions?: TopBarAction[];
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Верхняя панель: 40px, кнопки 40×40 через 8px */
export const TopBar = memo(function TopBar({ lead, after, actions = [], iconSize = S.icon, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      {lead.kind === 'back' ? (
        <IconButton icon="back" accessibilityLabel="Назад" onPress={lead.onBack} iconSize={S.iconSmall} />
      ) : null}
      {lead.kind === 'group' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lead.label}
          onPress={lead.onPress}
          style={[styles.group, { borderColor: c.border, backgroundColor: c.panel }]}
        >
          <Marquee style={[T.group, styles.flex, { color: c.text }]}>{lead.label}</Marquee>
          <Icon name="chevronDown" size={12} color={c.text} strokeWidth={2.5} />
        </Pressable>
      ) : lead.kind === 'title' ? (
        <Marquee style={[T.barTitle, styles.flex, styles.titleTail, { color: c.text }]}>
          {lead.text}
        </Marquee>
      ) : (
        <Marquee style={[lead.kind === 'back' ? T.backLabel : T.caption, styles.flex, { color: c.muted }]}>
          {lead.kind === 'caption' ? lead.text : lead.label}
        </Marquee>
      )}
      {after}
      {actions.map(({ key, ...a }) => (
        <IconButton key={key} {...a} iconSize={iconSize} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap },
  flex: { flex: 1 },
  /** Хвост последней буквы при отрицательном межбуквенном не срезается */
  titleTail: { paddingRight: 2 },
  group: {
    flex: 1,
    height: S.topBarHeight,
    borderWidth: S.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
