/**
 * Адрес сервера. Задаётся в mobile/.env:
 *   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000     — эмулятор Android (10.0.2.2 = ваш Mac)
 *   EXPO_PUBLIC_API_URL=http://192.168.1.47:3000 — настоящий телефон в той же Wi-Fi-сети (IP Mac)
 * Пусто — работает локальная заглушка без сервера.
 * После изменения .env перезапустите Metro: Ctrl+C и npx expo start --dev-client
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
