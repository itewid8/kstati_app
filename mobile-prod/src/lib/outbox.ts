/**
 * Отправка очереди правок пачками (POST /ops). Чистый модуль: запрос, очередь и разбор ошибок передаются снаружи.
 *
 * Ошибка запроса:
 *   auth   — токен не действует (401 нашего сервера): пробрасываем (выход из аккаунта, очередь откладывается);
 *   retry  — нет связи, таймаут, 5xx, 408, 429, ответ не нашего сервера (страница прокси/VPN): пробрасываем,
 *            пачка остаётся в очереди до следующей попытки;
 *   reject — наш сервер отверг пачку (JSON с кодом, 400, 409, 422 и прочие 4xx): делим пополам, пока не найдём плохую операцию;
 *            её убираем из очереди (onReject — в журнал и карантин), остальное отправляется.
 * Раньше любая 4xx оставляла пачку в очереди навсегда, и синхронизация вставала: pull не шёл, пока очередь не пуста.
 */

export type FailKind = 'auth' | 'retry' | 'reject';

export type OutboxDeps<O> = {
  /** Текущая очередь */
  read: () => readonly O[];
  /** Отправить пачку; ошибка — исключение */
  send: (batch: O[]) => Promise<void>;
  /** Убрать из очереди отправленное (по ссылке: пока шёл запрос, в конец могли добавиться новые операции) */
  remove: (done: readonly O[]) => void;
  classify: (e: unknown) => FailKind;
  /** Операция, которую сервер не принимает: в журнал, из очереди её уберёт remove */
  onReject: (op: O, e: unknown) => void;
  batchSize?: number;
};

async function sendSplit<O>(batch: O[], d: OutboxDeps<O>): Promise<void> {
  try {
    await d.send(batch);
  } catch (e) {
    if (d.classify(e) !== 'reject') throw e;
    if (batch.length === 1) {
      d.onReject(batch[0] as O, e);
      d.remove(batch);
      return;
    }
    const mid = Math.ceil(batch.length / 2);
    await sendSplit(batch.slice(0, mid), d);
    await sendSplit(batch.slice(mid), d);
    return;
  }
  d.remove(batch);
}

/** Отправить всю очередь. Пробрасывает только auth и retry */
export async function flushOutbox<O>(d: OutboxDeps<O>): Promise<void> {
  const size = d.batchSize ?? 100;
  for (;;) {
    const outbox = d.read();
    if (!outbox.length) return;
    await sendSplit(outbox.slice(0, size), d);
    // Защита от бесконечного цикла: отправленное должно было уйти из очереди
    if (d.read()[0] === outbox[0]) return;
  }
}

/* ---------- постановка в очередь ---------- */

export type EnqueueDeps<O> = {
  read: () => readonly O[];
  /** Записать новую очередь в состояние */
  write: (outbox: O[]) => void;
  /** Сохранить на диск сейчас, не дожидаясь отложенной записи: приложение могут закрыть сразу после правки */
  persistNow: () => void;
  /** Запустить отправку */
  kick: () => void;
  /** Ключ записи: новая правка той же записи заменяет прежнюю, ещё не отправленную */
  keyOf: (o: O) => string | null;
};

export function enqueue<O>(ops: readonly O[], d: EnqueueDeps<O>): void {
  if (!ops.length) return;
  const keys = new Set(ops.map(d.keyOf).filter((k): k is string => k !== null));
  d.write([...d.read().filter((o) => !keys.has(d.keyOf(o) ?? '')), ...ops]);
  d.persistNow();
  d.kick();
}

/* ---------- правка, на которую нужен ответ сразу, но которую нельзя потерять ---------- */

export type DirectOutcome<R> =
  /** Сервер ответил на операцию (ok — принял) */
  | { kind: 'sent'; result: R }
  /** Связи нет (или токен истёк): операция в очереди, правка остаётся на экране */
  | { kind: 'queued' }
  /** Окончательный отказ: правку откатили. result — ответ на операцию, error — отказ запроса целиком */
  | { kind: 'rejected'; result: R | null; error: unknown };

/**
 * Правка уже на экране; пробуем отправить сразу, чтобы показать отказ (подарок уже подарили, ник занят).
 * Отказ сервера — откат; нет связи — операция встаёт в постоянную очередь и уйдёт позже. Правка не теряется
 */
export async function sendOrQueue<R extends { ok: boolean }>(d: {
  send: () => Promise<R>;
  classify: (e: unknown) => FailKind;
  enqueue: () => void;
  rollback: () => void;
}): Promise<DirectOutcome<R>> {
  let result: R;
  try {
    result = await d.send();
  } catch (e) {
    if (d.classify(e) !== 'reject') {
      d.enqueue();
      return { kind: 'queued' };
    }
    d.rollback();
    return { kind: 'rejected', result: null, error: e };
  }
  if (result.ok) return { kind: 'sent', result };
  d.rollback();
  return { kind: 'rejected', result, error: null };
}
