/**
 * Точка входа. На Android дополнительно регистрируем экран настроек виджета на рабочем столе.
 */
import { Platform } from 'react-native';
// Фоновое обновление (виджет, напоминания) — задача должна быть объявлена при загрузке кода
import './src/lib/background';

if (Platform.OS === 'android') {
  // Настройки виджета на рабочем столе (долгое нажатие на виджет → «Настроить»): нативное окно
  // KstatiWidgetConfigActivity из modules/kstati-widget показывает этот экран
  const { AppRegistry } = require('react-native');
  const { WidgetConfig } = require('./src/widget/WidgetConfig');
  AppRegistry.registerComponent('KstatiWidgetConfig', () => WidgetConfig);
}

import 'expo-router/entry';
