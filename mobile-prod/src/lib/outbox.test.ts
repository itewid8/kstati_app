/** Очередь правок: отвергнутая сервером операция не держит очередь, ошибки связи и 5xx — ждут */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, failKind, NetError, readBody } from './http';
import { enqueue, flushOutbox, sendOrQueue, type FailKind, type OutboxDeps } from './outbox';

class HttpErr extends Error {
  constructor(public status: number) {
    super(`http ${status}`);
  }
}
const classify = (e: unknown): FailKind =>
  e instanceof HttpErr ? (e.status === 401 ? 'auth' : e.status >= 500 ? 'retry' : 'reject') : 'retry';

type Op = { id: string };

/** Промис отклонён ошибкой, которая проходит check (в шиме node:assert нет rejects) */
async function rejects(p: Promise<unknown>, check: (e: unknown) => boolean = () => true): Promise<void> {
  let error: unknown = null;
  let failed = false;
  try {
    await p;
  } catch (e) {
    failed = true;
    error = e;
  }
  assert.ok(failed, 'ожидалась ошибка');
  assert.ok(check(error), `не та ошибка: ${String(error)}`);
}

/** Очередь в памяти и сервер, который отвергает пачку целиком, если в ней есть плохая операция */
function setup(ops: Op[], fail: (batch: Op[]) => number | null, batchSize = 4) {
  let outbox = [...ops];
  const sent: string[][] = [];
  const rejected: string[] = [];
  const deps: OutboxDeps<Op> = {
    read: () => outbox,
    send: async (batch) => {
      const status = fail(batch);
      if (status) throw new HttpErr(status);
      sent.push(batch.map((o) => o.id));
    },
    remove: (done) => {
      outbox = outbox.filter((o) => !done.includes(o));
    },
    classify,
    onReject: (op) => rejected.push(op.id),
    batchSize,
  };
  return { deps, sent, rejected, outbox: () => outbox };
}

const ops = (n: number): Op[] => Array.from({ length: n }, (_, i) => ({ id: `op${i}` }));

describe('flushOutbox', () => {
  test('400 на пачку: плохая операция находится делением и уходит в карантин, остальные отправлены', async () => {
    const q = setup(ops(10), (b) => (b.some((o) => o.id === 'op5') ? 400 : null));
    await flushOutbox(q.deps);
    assert.deepEqual(q.rejected, ['op5']);
    assert.deepEqual(q.outbox(), []);
    assert.deepEqual(q.sent.flat().sort(), ops(10).map((o) => o.id).filter((id) => id !== 'op5').sort());
    // Порядок отправки сохраняется
    assert.deepEqual(q.sent.flat(), ['op0', 'op1', 'op2', 'op3', 'op4', 'op6', 'op7', 'op8', 'op9']);
  });

  test('409 и 422 — тоже отказ, не вечная очередь', async () => {
    for (const status of [409, 422]) {
      const q = setup(ops(3), (b) => (b.some((o) => o.id === 'op0') ? status : null));
      await flushOutbox(q.deps);
      assert.deepEqual(q.rejected, ['op0']);
      assert.deepEqual(q.outbox(), []);
    }
  });

  test('5xx и нет связи: пачка остаётся в очереди, ошибка пробрасывается (повтор позже)', async () => {
    const q = setup(ops(3), () => 503);
    await rejects(flushOutbox(q.deps), (e: unknown) => e instanceof HttpErr && e.status === 503);
    assert.equal(q.outbox().length, 3);
    assert.deepEqual(q.rejected, []);
    let outbox = ops(2);
    await rejects(
      flushOutbox({
        read: () => outbox,
        send: async () => {
          throw new Error('network');
        },
        remove: (done) => {
          outbox = outbox.filter((o) => !done.includes(o));
        },
        classify,
        onReject: () => {
          throw new Error('связь — не отказ');
        },
      }),
    );
    assert.equal(outbox.length, 2);
  });

  test('401 пробрасывается без деления пачки', async () => {
    let calls = 0;
    const q = setup(ops(8), () => {
      calls++;
      return 401;
    });
    await rejects(flushOutbox(q.deps), (e: unknown) => e instanceof HttpErr && e.status === 401);
    assert.equal(calls, 1);
    assert.equal(q.outbox().length, 8);
  });

  test('операции, добавленные во время отправки, не теряются', async () => {
    let outbox = ops(2);
    const sent: string[] = [];
    await flushOutbox<Op>({
      read: () => outbox,
      send: async (batch) => {
        sent.push(...batch.map((o) => o.id));
        if (batch[0]?.id === 'op0') outbox = [...outbox, { id: 'late' }];
      },
      remove: (done) => {
        outbox = outbox.filter((o) => !done.includes(o));
      },
      classify,
      onReject: () => {},
    });
    assert.deepEqual(sent, ['op0', 'op1', 'late']);
    assert.deepEqual(outbox, []);
  });
});

describe('enqueue: правка сразу на диске', () => {
  type K = { key: string; v: number };
  test('очередь сохраняется на диск сразу после записи и до отправки; правка той же записи заменяет прежнюю', () => {
    let outbox: K[] = [{ key: 'a', v: 1 }, { key: 'b', v: 1 }];
    let disk: K[] = [...outbox];
    const log: string[] = [];
    enqueue([{ key: 'a', v: 2 }], {
      read: () => outbox,
      write: (next) => {
        outbox = next;
        log.push('write');
      },
      persistNow: () => {
        disk = [...outbox];
        log.push('persist');
      },
      kick: () => log.push('kick'),
      keyOf: (o) => o.key,
    });
    assert.deepEqual(log, ['write', 'persist', 'kick']);
    assert.deepEqual(disk, [{ key: 'b', v: 1 }, { key: 'a', v: 2 }]);
  });

  test('пустой список — ничего не пишем', () => {
    let calls = 0;
    enqueue<K>([], { read: () => [], write: () => calls++, persistNow: () => calls++, kick: () => calls++, keyOf: (o) => o.key });
    assert.equal(calls, 0);
  });
});

describe('sendOrQueue: правка с ответом сразу не теряется без связи', () => {
  type R = { ok: boolean; error?: string };
  const run = (send: () => Promise<R>) => {
    const calls = { enqueue: 0, rollback: 0 };
    const p = sendOrQueue<R>({
      send,
      classify: failKind,
      enqueue: () => calls.enqueue++,
      rollback: () => calls.rollback++,
    });
    return { p, calls };
  };
  /** Ответ сервера/прокси как исключение, которое бросает request */
  const reply = (status: number, contentType: string, text: string) => async (): Promise<R> => {
    readBody(status, contentType, text);
    return { ok: true };
  };

  test('нет связи, таймаут, страница VPN — правка остаётся на экране, операция в очереди', async () => {
    for (const send of [
      async (): Promise<R> => {
        throw new NetError('Network request failed');
      },
      async (): Promise<R> => {
        throw new NetError('timeout');
      },
      reply(403, 'text/html', '<html>blocked</html>'),
      reply(503, 'text/html', '<html>Service Unavailable</html>'),
    ]) {
      const { p, calls } = run(send);
      assert.deepEqual(await p, { kind: 'queued' });
      assert.deepEqual(calls, { enqueue: 1, rollback: 0 });
    }
  });

  test('отказ нашего сервера (JSON с кодом) — откат и причина', async () => {
    const { p, calls } = run(reply(409, 'application/json', '{"error":"already_gifted","message":"Эту хотелку уже подарили"}'));
    const res = await p;
    assert.equal(res.kind, 'rejected');
    assert.ok(res.kind === 'rejected' && res.error instanceof ApiError && res.error.code === 'already_gifted');
    assert.deepEqual(calls, { enqueue: 0, rollback: 1 });
  });

  test('операция отвергнута в ответе (ok:false) — откат; принята — без очереди', async () => {
    const rejected = run(async () => ({ ok: false, error: 'forbidden' }));
    assert.deepEqual(await rejected.p, { kind: 'rejected', result: { ok: false, error: 'forbidden' }, error: null });
    assert.deepEqual(rejected.calls, { enqueue: 0, rollback: 1 });
    const sent = run(async () => ({ ok: true }));
    assert.deepEqual(await sent.p, { kind: 'sent', result: { ok: true } });
    assert.deepEqual(sent.calls, { enqueue: 0, rollback: 0 });
  });

  test('401 — тоже в очередь: при выходе очередь откладывается до входа, правка не теряется', async () => {
    const { p, calls } = run(reply(401, 'application/json', '{"error":"unauthorized"}'));
    assert.deepEqual(await p, { kind: 'queued' });
    assert.deepEqual(calls, { enqueue: 1, rollback: 0 });
  });
});
