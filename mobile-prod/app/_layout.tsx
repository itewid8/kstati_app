import { useFonts } from 'expo-font';
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
import { PullIndicator } from '@/components/PullRefresh';
import { UndoToast } from '@/components/UndoToast';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useSignedIn } from '@/containers/common/signedIn';
import { QuickActionsHost } from '@/containers/quick/QuickActionsHost';
import { VoiceHost } from '@/containers/voice/VoiceHost';
import { initAnalytics } from '@/lib/analytics';
import { registerBackgroundRefresh } from '@/lib/background';
import { watchReminders } from '@/lib/notify';
import { useStore } from '@/lib/store';
import { startSync } from '@/lib/sync';
import type { ThemePref } from '@/lib/types';
import { holdEnd, holdStart } from '@/lib/voice';
import { RecButtonContext, useTheme, type RecButtonHandlers } from '@/ui';
import { uiFonts } from '@/ui/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

initAnalytics();

const applyTheme = (t: ThemePref) => Appearance.setColorScheme(t === 'system' ? 'unspecified' : t);
// Данные с телефона читаются сразу при запуске — тему ставим до первого кадра, без мигания
applyTheme(useStore.getState().theme);

/** Режим «удерживать»: REC пишет, пока палец на кнопке */
const HOLD: RecButtonHandlers = { onPressIn: () => void holdStart(), onPressOut: holdEnd };

/** Окна редактирования — экраны корневого стека, выезжают снизу */
const EDITOR = { animation: 'slide_from_bottom' as const, animationDuration: 250 };

export default function RootLayout() {
  const { c } = useTheme();
  const theme = useStore((s) => s.theme);
  const hold = useStore((s) => s.micMode === 'hold');
  const signedIn = useSignedIn();
  useEffect(() => applyTheme(theme), [theme]);
  // Напоминания о делах — локальные уведомления на телефоне
  useEffect(() => watchReminders(), []);
  useEffect(() => {
    registerBackgroundRefresh();
  }, []);
  // Обмен с сервером: очередь изменений и новое от других участников
  useEffect(() => startSync(), []);
  // Шрифты вшиты в приложение (npm-пакеты с .ttf), сеть не нужна. Старые экраны используют часть этих начертаний
  const [loaded] = useFonts(uiFonts);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RecButtonContext.Provider value={hold ? HOLD : null}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: c.bg },
                animation: 'fade',
                animationDuration: 150,
              }}
            >
              {/* Первый — index: после выхода (и 401) стек сворачивается сюда, а он ведёт на вход */}
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="record" />
              {/*
               * Экраны после входа. Выход или 401 (authLost) убирает их из стека разом — под входом не остаются вкладки
               * прошлого аккаунта с подписками и таймерами (QA-1 С5, М5)
               */}
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="edit/task/[id]" options={EDITOR} />
                <Stack.Screen name="edit/plan/[id]" options={EDITOR} />
                <Stack.Screen name="activity" />
                <Stack.Screen name="group/[id]" />
                <Stack.Screen name="settings/index" />
                <Stack.Screen name="settings/app" />
                <Stack.Screen name="settings/edit" />
                <Stack.Screen name="settings/avatar" />
                <Stack.Screen name="settings/reminders" />
              </Stack.Protected>
            </Stack>
            <UndoToast />
            <PullIndicator />
          </View>
          <VoiceRecorder />
          <VoiceHost />
          {/* Быстрые действия по удержанию записи; карточка, группы и меню, которые они открывают, — выше */}
          <QuickActionsHost />
          <CardSheet />
          <GroupSheet />
          <ActionMenu />
        </RecButtonContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
