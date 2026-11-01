import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { size as S, space } from './tokens';
import { useTheme } from './useTheme';
import { DIALOG_WIDTH, useDesktop } from './desktop';

type Props = {
  visible: boolean;
  /** Нажатие на затемнение */
  onClose?: () => void;
  /** Нижний отступ safe area */
  bottomInset?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Нижнее окно поверх затемнённого экрана: рамка сверху 1.5px, «ручка» 36×4,
 * поля 8 / 16 / 18, между блоками 10. Кладётся последним ребёнком экрана (absolute).
 */
export const BottomSheet = memo(function BottomSheet({ visible, onClose, bottomInset = 0, children, style }: Props) {
  const { c } = useTheme();
  const desktop = useDesktop();
  if (!visible) return null;
  if (desktop)
    return (
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
        <View accessibilityViewIsModal style={[styles.dialog, { borderColor: c.border, backgroundColor: c.bg }, style]}>
          {children}
        </View>
      </View>
    );
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
      />
      <View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { borderTopColor: c.border, backgroundColor: c.bg, paddingBottom: 18 + bottomInset },
          style,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: c.hair }]} />
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: S.border,
    paddingTop: 8,
    paddingHorizontal: space.side,
    gap: 10,
  },
  grabber: { alignSelf: 'center', width: S.grabberWidth, height: S.grabberHeight },
  center: { alignItems: 'center', justifyContent: 'center' },
  dialog: { width: DIALOG_WIDTH, maxWidth: '92%', maxHeight: '85%', borderWidth: S.border, padding: space.side, gap: 10 },
});
