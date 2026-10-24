import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '@/ui';

/** Вкладка «Дела»: список/календарь и план большого дела — внутри вкладки, микрофон остаётся под рукой */
export default function TasksLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade', animationDuration: 150 }}
    />
  );
}
