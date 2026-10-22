import { Stack } from 'expo-router';
import React from 'react';
import { useColors } from '@/theme';

/** Вкладка «Дела»: список/календарь и план большого дела — внутри вкладки, микрофон остаётся под рукой */
export default function TasksLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'fade', animationDuration: 150 }}
    />
  );
}
