import { buildApp } from './app.js';
import { assertConfig, config } from './config.js';
import { createStore } from './store/index.js';
import { YdbStore } from './store/ydb.js';

assertConfig();

const store = createStore();
// Новые таблицы (например, лента активности) создаются сами при запуске — если у сервера есть права.
// Не получилось — не страшно: `npm run tables` с ключом администратора сделает то же самое.
if (store instanceof YdbStore) store.ensureTables(() => {}).catch((e) => console.warn('Таблицы YDB не проверены:', (e as Error).message));

const app = await buildApp({ store });
await app.listen({ host: '0.0.0.0', port: config.port });
console.log(
  `\n✓ Сервер: http://localhost:${config.port}  (эмулятор Android: http://10.0.2.2:${config.port})\n` +
    `  модель: ${config.model} · база: ${config.db === 'memory' ? `файл ${config.dataFile}` : 'YDB'} · журнал: ${config.logDir}\n`,
);
