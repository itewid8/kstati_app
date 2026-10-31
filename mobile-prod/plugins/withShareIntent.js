/**
 * «Поделиться → Кстати» на Android: MainActivity принимает текст и текстовые файлы (SEND / SEND_MULTIPLE).
 * Читает их модуль modules/kstati-share.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const filter = (action) => ({
  action: [{ $: { 'android:name': action } }],
  category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
  data: [{ $: { 'android:mimeType': 'text/*' } }],
});

module.exports = function withShareIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (!main) return cfg;
    main['intent-filter'] = main['intent-filter'] ?? [];
    for (const action of ['android.intent.action.SEND', 'android.intent.action.SEND_MULTIPLE']) {
      const has = main['intent-filter'].some((f) => f.action?.some((a) => a.$['android:name'] === action));
      if (!has) main['intent-filter'].push(filter(action));
    }
    return cfg;
  });
};
