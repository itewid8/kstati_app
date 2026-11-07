// Настройки из server/.env (Node 22 читает файл сам, без пакетов).
// В Yandex Cloud те же переменные приходят из настроек контейнера и секрета Lockbox.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
} catch {
  // .env нет — берём переменные окружения как есть
}

// Пустое значение — как не задано: выкладка передаёт пустую строку, если переменной в GitHub нет
const env = (k: string, d = '') => process.env[k] || d;
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
  /** Куда пересылать «Сообщить об ошибке / предложить»; пусто — отзывы только сохраняются на сервере */
  feedbackEmail: env('FEEDBACK_EMAIL'),
  /** ПоискКино (данные Кинопоиска): ключ из Lockbox; пусто — рейтинг и жанры фильмов не подтягиваются */
  poiskkinoKey: env('POISKKINO_API_KEY'),
  poiskkinoUrl: (env('POISKKINO_URL') || 'https://api.poiskkino.dev').replace(/\/$/, ''),
  /** Запросов к ПоискКино в сутки (бесплатный тариф — 200) */
  poiskkinoDaily: Number(env('POISKKINO_DAILY', '190')),
  /** Отзывы задачами в закрытый репозиторий GitHub («владелец/репозиторий»); пусто — не отправляются */
  /** Сколько отзывов в сутки на человека */
  feedbackDailyLimit: Number(env('FEEDBACK_DAILY_LIMIT', '20')),

  /** VK ID: ID приложения из id.vk.com */
  vkClientId: env('VK_CLIENT_ID'),

  /** Сколько голосовых команд в сутки на человека */
  /** Бесплатно: удачных голосовых команд в сутки. В тестовых сборках переменная VOICE_DAILY_LIMIT снимает ограничение */
  voiceDailyLimit: Number(env('VOICE_DAILY_LIMIT', '3')),
  /** Все запросы: в минуту с одного адреса */
  ratePerMinute: Number(env('RATE_PER_MINUTE', '120')),
  /** Вход, регистрация, коды из писем: запросов в минуту с одного адреса */
  authPerMinute: Number(env('AUTH_PER_MINUTE', '20')),
  /** С подпиской: удачных голосовых команд в сутки */
  paidDailyLimit: Number(env('PAID_DAILY_LIMIT', '50')),
  /** Кто выдаёт подписки (страница /admin): почты через точку с запятой (запятая занята в списке переменных выкладки) */
  adminEmails: env('ADMIN_EMAILS').split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
  /** Простые команды разбирать правилами, без YandexGPT (QUICK_RULES=0 — всё через модель) */
  /** Цена распознавания SpeechKit за отрезок 15 с, ₽ с НДС — для расхода команды в ответе */
  sttPrice15s: Number(env('STT_PRICE_15S', '0.1626')),
  /** Сайты, которым можно обращаться к API из браузера (веб-версия). Не в продакшене — ещё любой localhost */
  webOrigins: env('WEB_ORIGINS', 'https://app.kstati-app.ru,https://kstati-app.ru').split(',').map((s) => s.trim()).filter(Boolean),
  quickRules: env('QUICK_RULES', '1') !== '0',
  /** Промпт модели: compact — только нужные фразе правила (полный — если не понял), full — всегда полный */
  /** compact — короткий промпт; full — полный; tuned — дообученная модель (TUNED_MODEL), «не понял» — повтор коротким */
  promptMode: (['full', 'tuned'].includes(env('PROMPT_MODE')) ? env('PROMPT_MODE') : 'compact') as 'compact' | 'full' | 'tuned',
  /** Адрес дообученной модели из Yandex AI Studio (ds://…) — для PROMPT_MODE=tuned */
  tunedModel: env('TUNED_MODEL'),
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
