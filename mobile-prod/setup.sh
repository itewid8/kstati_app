#!/usr/bin/env bash
# Устанавливает зависимости в версиях, совместимых с актуальным Expo SDK.
# Запуск: cd mobile && bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Expo SDK (последний)"
npm install expo@latest

echo "→ Зависимости, подобранные под SDK"
npx expo install \
  react react-native react-dom react-native-web \
  expo-router expo-linking expo-constants expo-status-bar expo-system-ui \
  expo-font expo-haptics expo-splash-screen \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated react-native-worklets \
  react-native-svg lucide-react-native \
  @react-native-community/datetimepicker \
  @expo-google-fonts/geist @expo-google-fonts/geist-mono \
  expo-audio expo-build-properties \
  zustand

echo "→ TypeScript"
npx expo install typescript @types/react -- --save-dev

echo "→ Проверка совместимости"
npx expo install --check || true

echo "Готово. Дальше: npx expo run:android"
