/**
 * Создать таблицы в YDB (один раз после создания базы). Нужны переменные:
 *   YDB_DOCAPI_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   npm run tables
 */
import { config } from '../src/config.js';
import { YdbStore } from '../src/store/ydb.js';

if (!config.ydbEndpoint || !config.awsKeyId || !config.awsSecret) {
  console.error('Нужны YDB_DOCAPI_ENDPOINT, AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY (в .env или окружении)');
  process.exit(1);
}
const store = new YdbStore({ endpoint: config.ydbEndpoint, accessKeyId: config.awsKeyId, secretAccessKey: config.awsSecret });
await store.ensureTables();
// Проверка: запись и чтение
await store.putTemp('selftest', { ok: true }, 60);
console.log((await store.getTemp('selftest')) ? '✓ YDB отвечает, таблицы готовы' : '✗ запись не читается');
await store.deleteTemp('selftest');
