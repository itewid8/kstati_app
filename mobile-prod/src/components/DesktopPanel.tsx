/**
 * Редактор дела или плана на компьютере (веб, окно от 1024 px): панель справа поверх раздела,
 * щелчок мимо панели или Esc закрывают. На телефоне — обычный экран, без обёртки.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { PANEL_WIDTH, useDesktop, useTheme } from '@/ui';

export function DesktopPanel({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const { c } = useTheme();
  if (!desktop) return <>{children}</>;
  return (
    <View style={styles.fixed}>
      <Pressable
        accessibilityLabel="Закрыть"
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/tasks'))}
      />
      <View style={[styles.panel, { backgroundColor: c.bg, borderColor: c.hair }]}>{children}</View>
    </View>
  );
}

/** Во всё окно браузера, а не в колонку раздела */
const FIXED = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 } as unknown as ViewStyle;

const styles = StyleSheet.create({
  fixed: FIXED,
  scrim: { backgroundColor: 'rgba(0,0,0,0.18)', cursor: 'auto' },
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: PANEL_WIDTH, maxWidth: '100%', borderLeftWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
