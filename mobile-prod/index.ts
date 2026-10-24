/**
 * Точка входа. На Android дополнительно регистрируем окно «Настроить» виджета на рабочем столе:
 * нативное KstatiWidgetConfigActivity (modules/kstati-widget) показывает этот экран.
 */
import { AppRegistry, Platform } from 'react-native';
// Фоновое обновление (виджет, напоминания) — задача должна быть объявлена при загрузке кода
import './src/lib/background';
import { WidgetConfigRoot } from './src/widget/WidgetConfigRoot';

if (Platform.OS === 'android') AppRegistry.registerComponent('KstatiWidgetConfig', () => WidgetConfigRoot);

import 'expo-router/entry';
