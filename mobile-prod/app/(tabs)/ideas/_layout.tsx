import { Stack } from 'expo-router';
import React from 'react';
import { useColors } from '@/theme';

/** Вкладка «Идеи»: список тем и экран темы — внутри вкладки, чтобы микрофон и вкладки оставались под рукой */
export default function IdeasLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'fade', animationDuration: 150 }}
    />
  );
}
