import { buildApp } from './app.js';
import { assertConfig, config } from './config.js';
import { createStore } from './store/index.js';

assertConfig();

const app = await buildApp({ store: createStore() });
await app.listen({ host: '0.0.0.0', port: config.port });
console.log(
  `\n✓ Сервер: http://localhost:${config.port}  (эмулятор Android: http://10.0.2.2:${config.port})\n` +
    `  модель: ${config.model} · база: ${config.db === 'memory' ? `файл ${config.dataFile}` : 'YDB'} · журнал: ${config.logDir}\n`,
);
