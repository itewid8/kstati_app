import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from '@/lib/store';
import { space, useColors } from '@/theme';
import { useBottomSpace } from './BottomBar';
import { Button, T } from './ui';

const UNDO_MS = 5000;

/** «Удалено · Отменить» — 5 секунд после смахивания влево */
export function UndoToast() {
  const c = useColors();
  const undo = useStore((s) => s.undo);
  const clearUndo = useStore((s) => s.clearUndo);
  const bottom = useBottomSpace() - 16;

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(clearUndo, UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, clearUndo]);

  if (!undo) return null;
  return (
    <View style={[styles.toast, { bottom, backgroundColor: c.primary }]}>
      <T color={c.onPrimary} style={{ flex: 1 }}>
        {undo.label}
      </T>
      <Button kind="text" title="Отменить" color={c.onPrimary} onPress={undo.restore} style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.side,
    right: space.side,
    minHeight: 48,
    borderRadius: 10,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
