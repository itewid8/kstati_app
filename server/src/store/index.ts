import { config } from '../config.js';
import { MemoryStore } from './memory.js';
import type { Store } from './types.js';
import { YdbStore } from './ydb.js';

export function createStore(): Store {
  if (config.db === 'ydb') {
    return new YdbStore({ endpoint: config.ydbEndpoint, accessKeyId: config.awsKeyId, secretAccessKey: config.awsSecret });
  }
  return new MemoryStore(config.dataFile);
}

export * from './types.js';
