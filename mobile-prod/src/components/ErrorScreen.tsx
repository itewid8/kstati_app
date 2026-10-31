/**
 * Экран «Что-то сломалось» (ErrorBoundary корня): ошибка в интерфейсе — текст ошибки, ОТПРАВИТЬ ОТЧЁТ
 * (стек и журнал событий приложатся сами) и ПОПРОБОВАТЬ СНОВА. Окно отчёта — здесь же: корень приложения не отрисован.
 */
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useBug } from '@/lib/bugReport';
import { logError } from '@/lib/diag';
import { fonts, size as S, useTheme } from '@/ui';
import { BugReport } from './BugReport';

export function ErrorScreen({ error, retry }: { error: Error; retry: () => void | Promise<void> }) {
  const { c } = useTheme();
  const info = useRef<ReturnType<typeof logError> | null>(null);
  useEffect(() => {
    info.current = logError(error, true);
  }, [error]);
  const report = () =>
    useBug.getState().open({
      shot: null,
      route: 'error-boundary',
      crash: { at: new Date().toISOString(), message: error.message, stack: error.stack, events: [] },
    });
  return (
    <SafeAreaProvider>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>Что-то сломалось</Text>
        <Text style={[styles.message, { color: c.muted }]} numberOfLines={6}>
          {error.message}
        </Text>
        <Pressable accessibilityRole="button" onPress={report} style={[styles.button, { backgroundColor: c.text, borderColor: c.text }]}>
          <Text style={[styles.buttonText, { color: c.bg }]}>ОТПРАВИТЬ ОТЧЁТ</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void retry()} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
          <Text style={[styles.buttonText, { color: c.text }]}>ПОПРОБОВАТЬ СНОВА</Text>
        </Pressable>
        <BugReport />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontFamily: fonts.sans700, fontSize: 28, letterSpacing: -1 },
  message: { fontFamily: fonts.mono400, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  button: { height: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9 },
});
