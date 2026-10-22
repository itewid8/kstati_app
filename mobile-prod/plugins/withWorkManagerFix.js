/**
 * Android: одна версия WorkManager на всё приложение.
 * react-native-android-widget требует work-runtime 2.8.1, а другая библиотека тянет work-runtime-ktx 2.7.1.
 * С версии 2.8 «ktx» — пустая обёртка над work-runtime, а 2.7.1 содержит те же классы → «Duplicate class».
 * Принудительно ставим ktx 2.8.1 — дубли исчезают.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// withWorkManagerFix';
const BLOCK = `
${MARK}
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.8.1'
        force 'androidx.work:work-runtime-ktx:2.8.1'
    }
}
`;

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK)) cfg.modResults.contents += BLOCK;
    return cfg;
  });
