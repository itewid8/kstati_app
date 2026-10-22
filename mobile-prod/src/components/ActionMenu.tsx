import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStore, type Menu } from '@/lib/store';
import { space, useColors } from '@/theme';
import { Sheet } from './Sheet';
import { Divider, T } from './ui';

/** Меню действий по долгому нажатию: «Изменить · Удалить» и т. п. */
export function ActionMenu() {
  const c = useColors();
  const menu = useStore((s) => s.menu);
  const setMenu = useStore((s) => s.setMenu);
  const [shown, setShown] = useState<Menu | null>(menu);
  useEffect(() => {
    if (menu) setShown(menu);
  }, [menu]);

  return (
    <Sheet visible={!!menu} onClose={() => setMenu(null)}>
      {shown && (
        <View>
          <T variant="caption" muted numberOfLines={2} style={styles.title}>
            {shown.title}
          </T>
          <Divider />
          {shown.actions.map((a, i) => (
            <View key={a.label}>
              {i > 0 && <Divider inset={space.side} />}
              <Pressable
                onPress={() => {
                  setMenu(null);
                  a.onPress();
                }}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.background : 'transparent' }]}
              >
                <T danger={a.danger}>{a.label}</T>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** Открыть меню с лёгкой вибрацией */
export function openMenu(menu: Menu) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  useStore.getState().setMenu(menu);
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.side, paddingTop: 4, paddingBottom: 12 },
  row: { minHeight: 52, paddingHorizontal: space.side, justifyContent: 'center' },
});
