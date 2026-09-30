/**
 * Точка входа. На Android сначала регистрируем обработчик виджета на рабочем столе:
 * Android вызывает его без открытия приложения (добавили виджет, прошло 30 минут).
 */
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/android');
  registerWidgetTaskHandler(widgetTaskHandler);
}

import 'expo-router/entry';
