import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useSignedIn } from '@/containers/common/signedIn';
import { useTheme } from '@/ui';

/** Вкладки без своей панели: нижнюю навигацию (BottomNav) рисует каждый экран сам */
export default function TabsLayout() {
  const { c } = useTheme();
  const signedIn = useSignedIn();
  if (!signedIn) return <Redirect href="/login" />;

  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="wishes" />
      <Tabs.Screen name="watch" />
      <Tabs.Screen name="ideas" />
    </Tabs>
  );
}
