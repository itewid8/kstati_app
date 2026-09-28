/**
 * Журнал запросов: одна строка JSON на запрос, файл на месяц — logs/voice-2026-09.jsonl.
 * Хранит фразу, ответ модели, итог разбора, время и расход токенов — для анализа (npm run stats).
 * В журнале личные фразы пользователей: не коммитить и не пересылать.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config, pricePer1k } from './config.js';
import type { ParseResult } from './types.js';
import type { Usage } from './yandex.js';

export type LogEntry = {
  ts: string;
  source: 'voice' | 'text' | 'eval';
  model: string;
  /** Кто говорил (id аккаунта) */
  userId?: string;
  /** Длительность записи, с; размер файла, байт */
  audioSec?: number | null;
  audioBytes?: number;
  transcript: string;
  result?: ParseResult['type'];
  /** Полный результат — чтобы разбирать ошибки */
  detail?: ParseResult;
  /** Сырой ответ модели */
  raw?: string;
  attempts?: number;
  tokens?: Usage;
  /** Оценка стоимости LLM, ₽ */
  costRub?: number;
  /** Размер контекста: сколько записей ушло в запрос */
  ctx?: { tasks: number; watch: number; wishes: number; people: number };
  sttMs?: number;
  llmMs?: number;
  error?: string;
  /** Для прогонов eval: прошла ли проверка */
  pass?: boolean;
};

export const costOf = (tokens: Usage, model: string) => Math.round((tokens.total / 1000) * pricePer1k(model) * 10000) / 10000;

let ready: Promise<unknown> | null = null;

export async function writeLog(e: Omit<LogEntry, 'ts' | 'model' | 'costRub'> & { model?: string }) {
  const model = e.model ?? config.model;
  const entry: LogEntry = { ts: new Date().toISOString(), ...e, model, ...(e.tokens && { costRub: costOf(e.tokens, model) }) };
  try {
    // В облаке файлы контейнера живут недолго — пишем в stdout, оттуда журнал забирает Cloud Logging
    if (config.logDir === 'stdout') {
      console.log(JSON.stringify({ kind: 'voice-log', ...entry }));
      return;
    }
    ready ??= mkdir(config.logDir, { recursive: true });
    await ready;
    await appendFile(join(config.logDir, `voice-${entry.ts.slice(0, 7)}.jsonl`), JSON.stringify(entry) + '\n');
  } catch (err) {
    // Журнал не должен ронять запрос
    console.error('Журнал не записан:', (err as Error).message);
  }
}
