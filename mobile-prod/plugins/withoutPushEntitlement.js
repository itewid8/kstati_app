/**
 * Убирает у iPhone-приложения разрешение на push-уведомления (aps-environment).
 * Его добавляет expo-notifications, но пуши нам не нужны (напоминания — локальные), а бесплатная
 * учётная запись разработчика Apple с ним не подписывает сборку. Раньше его приходилось удалять в Xcode руками.
 * Когда понадобятся настоящие пуши (и платный аккаунт) — убрать плагин из app.json.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
