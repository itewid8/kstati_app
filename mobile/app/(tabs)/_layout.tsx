import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { BottomBar } from '@/components/BottomBar';
import { useStore } from '@/lib/store';
import { useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  const me = useStore((s) => s.me);
  if (!me) return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <BottomBar {...(props as any)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
    >
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="wishes" />
      <Tabs.Screen name="watch" />
      <Tabs.Screen name="ideas" />
    </Tabs>
  );
}
