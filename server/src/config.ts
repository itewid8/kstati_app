// Настройки из server/.env (Node 22 читает файл сам, без пакетов).
// В Yandex Cloud те же переменные приходят из настроек контейнера и секрета Lockbox.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
} catch {
  // .env нет — берём переменные окружения как есть
}

const env = (k: string, d = '') => process.env[k] ?? d;
const isProd = env('NODE_ENV') === 'production';

export const config = {
  isProd,
  /* Yandex AI Studio: распознавание речи и YandexGPT */
  apiKey: env('YANDEX_API_KEY'),
  folderId: env('YANDEX_FOLDER_ID'),
  model: env('YANDEX_MODEL') || 'yandexgpt-lite/latest',

  port: Number(env('PORT', '3000')),
  /** Адрес сервера снаружи — для возврата из VK ID (https://…) */
  publicUrl: env('PUBLIC_URL', `http://localhost:${env('PORT', '3000')}`).replace(/\/$/, ''),
  /** Схема приложения: kstati://… — сюда VK ID возвращает человека в приложение */
  appScheme: env('APP_SCHEME', 'kstati'),

  /** Папка для журнала запросов (JSONL, файл на месяц) */
  logDir: env('LOG_DIR') || new URL('../logs', import.meta.url).pathname,

  /* База: memory (файл на Mac) или ydb. По умолчанию ydb, если задан адрес Document API */
  db: (env('DB') || (env('YDB_DOCAPI_ENDPOINT') ? 'ydb' : 'memory')) as 'memory' | 'ydb',
  dataFile: env('DATA_FILE') || new URL('../.data/dev.json', import.meta.url).pathname,
  ydbEndpoint: env('YDB_DOCAPI_ENDPOINT'),
  /** Статический ключ сервисного аккаунта (формат AWS) — для YDB и Postbox */
  awsKeyId: env('AWS_ACCESS_KEY_ID'),
  awsSecret: env('AWS_SECRET_ACCESS_KEY'),

  /** Подпись токенов входа. В продакшене — обязательно длинная случайная строка */
  jwtSecret: env('JWT_SECRET') || (isProd ? '' : 'dev-only-secret-do-not-use-in-production'),

  /** Почта через Yandex Cloud Postbox: адрес на подтверждённом домене. Пусто — письма пишутся в консоль */
  mailFrom: env('MAIL_FROM'),

  /** VK ID: ID приложения из id.vk.com */
  vkClientId: env('VK_CLIENT_ID'),

  /** Сколько голосовых команд в сутки на человека */
  voiceDailyLimit: Number(env('VOICE_DAILY_LIMIT', '30')),
};

/**
 * Цена 1000 токенов в рублях с НДС, синхронный режим — для оценки расхода в журнале.
 * Точные цены — в прайсе AI Studio; можно переопределить через LLM_PRICE_PER_1K в .env.
 */
export function pricePer1k(model: string): number {
  if (process.env.LLM_PRICE_PER_1K) return Number(process.env.LLM_PRICE_PER_1K);
  return /lite/.test(model) ? 0.2 : 1.2;
}

export function assertConfig() {
  const missing = [
    !config.apiKey && 'YANDEX_API_KEY',
    !config.folderId && 'YANDEX_FOLDER_ID',
    !config.jwtSecret && 'JWT_SECRET',
    config.db === 'ydb' && !config.ydbEndpoint && 'YDB_DOCAPI_ENDPOINT',
    config.db === 'ydb' && !(config.awsKeyId && config.awsSecret) && 'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`\n✗ Не заполнено: ${missing.join(', ')}\n  На Mac: cp .env.example .env && open -e .env\n`);
    process.exit(1);
  }
}
