import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '@/ui';

/** Вкладка «Заметки»: список тем и экран темы — внутри вкладки, чтобы микрофон и вкладки оставались под рукой */
export default function IdeasLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade', animationDuration: 150 }}
    />
  );
}
