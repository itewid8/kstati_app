/**
 * Точка входа. На Android сначала регистрируем обработчик виджета на рабочем столе:
 * Android вызывает его без открытия приложения (добавили виджет, прошло 30 минут).
 */
import { Platform } from 'react-native';
// Фоновое обновление (виджет, напоминания) — задача должна быть объявлена при загрузке кода
import './src/lib/background';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler, registerWidgetConfigurationScreen } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/android');
  const { WidgetConfig } = require('./src/widget/WidgetConfig');
  registerWidgetTaskHandler(widgetTaskHandler);
  // Настройки виджета: долгое нажатие на виджет → «Настроить»
  registerWidgetConfigurationScreen(WidgetConfig);
}

import 'expo-router/entry';
