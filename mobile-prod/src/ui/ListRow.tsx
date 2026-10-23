import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Checkbox } from './Checkbox';
import { Icon } from './Icon';
import { LONG_PRESS_MS, useLift, type LiftHandler } from './lift';
import { Marquee } from './Marquee';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  meta?: string;
  /** Полоса 1.5px слева: цвет человека; два цвета — общее (верх/низ) */
  strip?: string | readonly [string, string];
  checked?: boolean;
  onToggle?: () => void;
  /** Что делает галочка: «Подарено», «Посмотрели», «Готово» */
  checkLabel: string;
  /** Нажатие на строку (открыть карточку) */
  onPress?: () => void;
  /** Удержание: строка отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
  /** Справа: число, время, кнопка-ссылка */
  right?: ReactNode;
  /** Отступ справа (8 по умолчанию; 6, если справа кнопка 32px) */
  rightInset?: number;
  style?: StyleProp<ViewStyle>;
};

/** Копия поднятой строки: без разделителя сверху (вокруг — рамка) */
const LIFTED: ViewStyle = { borderTopWidth: 0 };

/** Строка списка 44px: полоса, галочка в зоне 32px, название 13/16 и подпись 9/11 */
export const ListRow = memo(function ListRow(props: Props) {
  const { title, meta, strip, checked = false, onToggle, checkLabel, onPress, onLongPress, right, rightInset = 8, style } = props;
  const { c } = useTheme();
  const lift = useLift(onLongPress, 'row', () => <ListRow {...props} onToggle={undefined} onPress={undefined} onLongPress={undefined} style={[style, LIFTED]} />);
  return (
    <Pressable
      ref={lift.ref}
      onPress={onPress}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      disabled={!onPress && !lift.onLongPress}
      style={[styles.row, { paddingRight: rightInset, backgroundColor: c.panel, borderTopColor: c.hair }, style]}
    >
      {typeof strip === 'string' ? <View style={[styles.strip, { backgroundColor: strip }]} /> : null}
      {Array.isArray(strip) ? (
        <View style={styles.strip}>
          <View style={[styles.half, { backgroundColor: strip[0] }]} />
          <View style={[styles.half, { backgroundColor: strip[1] }]} />
        </View>
      ) : null}
      <Checkbox checked={checked} onPress={onToggle} accessibilityLabel={checkLabel} style={styles.check} />
      <View style={styles.text}>
        <Marquee style={[T.rowTitle, { color: c.text }]}>{title}</Marquee>
        {meta ? <Marquee style={[T.rowMeta, { color: c.muted }]}>{meta}</Marquee> : null}
      </View>
      {right}
    </Pressable>
  );
});

type LinkProps = { onPress?: () => void; accessibilityLabel?: string };

/** Квадратная кнопка 32px со стрелкой «открыть ссылку» для правого слота строки */
export const RowLinkButton = memo(function RowLinkButton({ onPress, accessibilityLabel = 'Открыть ссылку' }: LinkProps) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.link, { borderColor: c.border }]}
    >
      <Icon name="link" size={13} color={c.text} />
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
    borderTopWidth: S.hairline,
  },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  half: { flex: 1 },
  check: { marginLeft: 3 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  link: {
    width: S.rowAction,
    height: S.rowAction,
    borderWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
