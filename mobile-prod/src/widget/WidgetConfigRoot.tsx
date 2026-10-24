/**
 * Окно «Настроить» виджета на Android (KstatiWidgetConfigActivity): отдельный корень React Native, без навигации.
 * Шрифты, жесты и safe area — как в app/_layout.tsx.
 */
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WidgetSettingsContainer } from '@/containers/widget/WidgetSettingsContainer';
import { useTheme } from '@/ui';
import { uiFonts } from '@/ui/fonts';

type Props = { widgetId?: number };

export function WidgetConfigRoot({ widgetId }: Props) {
  const [loaded] = useFonts(uiFonts);
  const { c } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>{loaded ? <WidgetSettingsContainer widgetId={widgetId} /> : <View style={{ flex: 1 }} />}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
