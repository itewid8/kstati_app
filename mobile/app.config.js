/**
 * Поверх app.json. Виджет для iPhone (expo-widgets) требует общую группу приложений (App Groups),
 * а бесплатная учётная запись разработчика Apple её не подписывает. Поэтому в сборке только для iPhone
 * (`npx expo prebuild -p ios`, `npx expo run:ios`) плагин виджета выключен; Android и общие команды — как раньше.
 * Когда появится платный аккаунт — запускать с KSTATI_IOS_WIDGET=1 или удалить этот файл.
 */
module.exports = ({ config }) => {
  const args = process.argv.slice(2).join(' ');
  const iosOnly = /(^|\s)(-p|--platform)\s+ios\b|run:ios/.test(args) && !/android/.test(args);
  if (!iosOnly || process.env.KSTATI_IOS_WIDGET === '1') return config;
  const name = (p) => (Array.isArray(p) ? p[0] : p);
  return { ...config, plugins: (config.plugins || []).filter((p) => name(p) !== 'expo-widgets') };
};
