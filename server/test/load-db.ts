/** Поддельная база для test/load.ts — отдельным процессом: её работа не отнимает время у сервера */
import { startFakeDocApi } from './fake-docapi.js';

const f = await startFakeDocApi({ pageSize: 1000, latencyMs: Number(process.argv[2] ?? 10) });
console.log(f.url);
