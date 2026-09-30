import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from '@expo-google-fonts/geist';
import { watchWidget } from '@/widget/sync';
import { registerBackgroundRefresh } from '@/lib/background';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { Appearance, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionMenu } from '@/components/ActionMenu';
import { CardSheet } from '@/components/CardSheet';
import { GroupSheet } from '@/components/GroupSheet';
import { UndoToast } from '@/components/UndoToast';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { initAnalytics } from '@/lib/analytics';
import { watchReminders } from '@/lib/notify';
import { startSync } from '@/lib/sync';
import { useStore } from '@/lib/store';
import type { ThemePref } from '@/lib/types';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

initAnalytics();

const applyTheme = (t: ThemePref) => Appearance.setColorScheme(t === 'system' ? 'unspecified' : t);
// Данные с телефона читаются сразу при запуске — тему ставим до первого кадра, без мигания
applyTheme(useStore.getState().theme);

export default function RootLayout() {
  const c = useColors();
  const theme = useStore((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  // Напоминания о делах — локальные уведомления на телефоне
  useEffect(() => watchReminders(), []);
  useEffect(() => watchWidget(), []);
  useEffect(() => {
    registerBackgroundRefresh();
  }, []);
  // Обмен с сервером: очередь изменений и новое от других участников
  useEffect(() => startSync(), []);
  // Шрифты вшиты в приложение (npm-пакеты с .ttf), сеть не нужна
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_400Regular });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.background).catch(() => {});
  }, [c.background]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.background },
              animation: 'fade',
              animationDuration: 150,
            }}
          />
          <UndoToast />
        </View>
        <VoiceRecorder />
        <CardSheet />
        <GroupSheet />
        <ActionMenu />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
