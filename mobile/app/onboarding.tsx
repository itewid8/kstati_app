import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupPanel } from '@/components/GroupSheet';
import { Button, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { space, useColors } from '@/theme';

/** Первая группа: «Создать группу» / «Вступить по коду» */
export default function Onboarding() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');

  const afterPanel = () => {
    if (useStore.getState().groups.length > 0) router.replace('/tasks');
    else setMode('choose');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 }}>
      {mode === 'choose' ? (
        <View style={styles.wrap}>
          <T variant="title">Группа</T>
          <T muted style={{ marginTop: 8 }}>
            Общие дела и список «Смотреть» живут в группе.
          </T>
          <View style={{ gap: 12, marginTop: 32 }}>
            <Button title="Создать группу" onPress={() => setMode('create')} />
            <Button kind="outline" title="Вступить по коду" onPress={() => setMode('join')} />
          </View>
          <View style={{ flex: 1 }} />
          <Button kind="text" title="Позже" color={c.textMuted} onPress={() => router.replace('/wishes')} style={{ alignSelf: 'center' }} />
        </View>
      ) : (
        <GroupPanel initial={mode} onDone={afterPanel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space.side * 1.5 },
});
