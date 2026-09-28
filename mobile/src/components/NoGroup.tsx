import React from 'react';
import { View } from 'react-native';
import { useStore } from '@/lib/store';
import { space } from '@/theme';
import { Button, T } from './ui';

/** Вкладки «Дела» и «Смотреть» без группы */
export function NoGroup() {
  const setGroupSheet = useStore((s) => s.setGroupSheet);
  return (
    <View style={{ padding: space.side, gap: 16, paddingTop: 32 }}>
      <T muted>Нужна группа, чтобы вести общие списки.</T>
      <Button kind="outline" title="Создать или вступить" onPress={() => setGroupSheet(true)} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}
