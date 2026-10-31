import { memo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Marquee } from './Marquee';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  /** Число справа в шапке («04»); строка — как есть («ПН 05») */
  count?: string;
  /**
   * inverted — главная секция: рамка border, шапка залита цветом текста;
   * muted — второстепенная («Подарено», «Архив»): рамка hairStrong, фон экрана, приглушённая шапка
   */
  variant?: 'inverted' | 'muted';
  /** Есть onToggle — шапка нажимается и показывает шеврон */
  collapsed?: boolean;
  onToggle?: () => void;
  /** Текстовая кнопка в шапке справа («ВЫБРАТЬ», «ВЫБРАТЬ ВСЕ») */
  action?: { label: string; onPress: () => void };
  /** Тело прокручивается внутри рамки, шапка остаётся на месте (секции во flex-колонке) */
  scrollable?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Секция в рамке 1.5px с шапкой 22px */
export const SectionBox = memo(function SectionBox({
  title,
  count,
  variant = 'inverted',
  collapsed = false,
  onToggle,
  action,
  scrollable = false,
  children,
  style,
}: Props) {
  const { c } = useTheme();
  const inverted = variant === 'inverted';
  const ink = inverted ? c.bg : c.muted;
  const header = (
    <>
      <Marquee ellipsis={false} style={[T.section, styles.title, { color: ink }]}>{title}</Marquee>
      <View style={styles.right}>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={{ top: 10, bottom: 10, left: 8, right: 4 }} onPress={action.onPress} style={[styles.action, { borderColor: ink }]}>
            <Text style={[T.section, { color: ink }]}>{action.label}</Text>
          </Pressable>
        ) : null}
        {count != null ? <Text style={[T.section, { color: ink }]}>{count}</Text> : null}
        {onToggle ? <Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={10} color={ink} /> : null}
      </View>
    </>
  );
  const headerStyle = [styles.header, inverted && { backgroundColor: c.text }];
  return (
    <View
      style={[
        styles.box,
        inverted ? { borderColor: c.border } : { borderColor: c.hairStrong, backgroundColor: c.bg },
        style,
      ]}
    >
      {onToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: !collapsed }}
          onPress={onToggle}
          style={headerStyle}
        >
          {header}
        </Pressable>
      ) : (
        <View style={headerStyle}>{header}</View>
      )}
      {collapsed ? null : scrollable ? (
        <ScrollView
          // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
          style={[styles.scroll, !inverted && { backgroundColor: c.bg }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border, flexShrink: 1, minHeight: 0 },
  header: {
    height: S.sectionHeader,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /** Длинное название не наезжает на счётчик */
    gap: 8,
  },
  /** Длинное название сжимается до счётчика и едет */
  title: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { paddingHorizontal: 6, height: 16, borderWidth: 1, justifyContent: 'center', marginRight: 2 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
