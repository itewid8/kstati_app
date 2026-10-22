/** Разбор ответа: отказом считается только JSON нашего сервера с кодом, всё остальное (VPN, прокси, таймаут) — повтор */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, exchange, failKind, NetError, opsResults, readBody, type ResponseLike } from './http';

const JSON_CT = 'application/json; charset=utf-8';
const HTML_CT = 'text/html; charset=utf-8';

/** Чем закончился разбор: данные или ошибка */
function outcome(status: number, contentType: string | null, text: string): { data: unknown } | { error: unknown } {
  try {
    return { data: readBody(status, contentType, text) };
  } catch (error) {
    return { error };
  }
}
const kindOf = (status: number, contentType: string | null, text: string) => {
  const r = outcome(status, contentType, text);
  assert.ok('error' in r, `ожидалась ошибка для ${status} ${text.slice(0, 30)}`);
  return failKind(r.error);
};

const response = (status: number, contentType: string | null, text: string | (() => Promise<string>)): ResponseLike => ({
  status,
  headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
  text: typeof text === 'string' ? async () => text : text,
});

/** Отмена, как AbortController (в шимах тестов его типа нет) */
const controller = () => {
  const signal = { aborted: false };
  return {
    signal,
    abort: () => {
      signal.aborted = true;
    },
  };
};

async function caught(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('ожидалась ошибка');
}

describe('readBody: что считать отказом сервера', () => {
  test('HTML 403/451/502/503 от прокси или VPN — повтор, не отказ', () => {
    for (const status of [403, 451, 502, 503]) {
      const r = outcome(status, HTML_CT, '<html><body><h1>Access denied</h1></body></html>');
      assert.ok('error' in r && r.error instanceof NetError, `${status}: NetError`);
      assert.equal(kindOf(status, HTML_CT, '<html></html>'), 'retry');
    }
  });

  test('JSON 400 { error: code } нашего сервера — окончательный отказ с кодом и текстом', () => {
    const r = outcome(400, JSON_CT, JSON.stringify({ error: 'bad_request', message: 'Нет названия' }));
    assert.ok('error' in r && r.error instanceof ApiError);
    const e = r.error as ApiError;
    assert.equal(e.status, 400);
    assert.equal(e.code, 'bad_request');
    assert.equal(e.message, 'Нет названия');
    assert.equal(failKind(e), 'reject');
    assert.equal(kindOf(403, JSON_CT, '{"error":"not_member","message":"Нет доступа к группе"}'), 'reject');
    assert.equal(kindOf(409, JSON_CT, '{"error":"nick_taken"}'), 'reject');
  });

  test('401: выход только по JSON нашего сервера; страница прокси 401/407 — повтор', () => {
    assert.equal(kindOf(401, JSON_CT, '{"error":"unauthorized","message":"unauthorized"}'), 'auth');
    assert.equal(kindOf(401, HTML_CT, '<h1>401 Authorization Required</h1>'), 'retry');
    assert.equal(kindOf(407, HTML_CT, '<h1>Proxy Authentication Required</h1>'), 'retry');
  });

  test('JSON без нашего кода, не тот content-type, пустое тело — повтор', () => {
    assert.equal(kindOf(403, JSON_CT, '{"message":"Forbidden"}'), 'retry');
    assert.equal(kindOf(404, JSON_CT, '{"statusCode":404,"error":"Not Found","message":"Route not found"}'), 'retry');
    assert.equal(kindOf(400, JSON_CT, '{"error":42}'), 'retry');
    assert.equal(kindOf(400, JSON_CT, '["bad_request"]'), 'retry');
    assert.equal(kindOf(400, 'text/plain', '{"error":"bad_request"}'), 'retry');
    assert.equal(kindOf(400, null, '{"error":"bad_request"}'), 'retry');
    assert.equal(kindOf(400, JSON_CT, ''), 'retry');
  });

  test('5xx, 408 и 429 даже в нашем формате — повтор', () => {
    assert.equal(kindOf(500, JSON_CT, '{"error":"server"}'), 'retry');
    assert.equal(kindOf(502, JSON_CT, '{"error":"upstream","service":"llm"}'), 'retry');
    assert.equal(kindOf(429, JSON_CT, '{"error":"rate_limited"}'), 'retry');
    assert.equal(kindOf(408, JSON_CT, '{"error":"timeout"}'), 'retry');
  });

  test('200: JSON — данные, пусто — null, HTML или не JSON (портал Wi-Fi) — NetError', () => {
    assert.deepEqual(outcome(200, JSON_CT, '{"results":[{"ok":true}]}'), { data: { results: [{ ok: true }] } });
    assert.deepEqual(outcome(204, null, ''), { data: null });
    const html = outcome(200, HTML_CT, '<html>Войдите в сеть Wi-Fi</html>');
    assert.ok('error' in html && html.error instanceof NetError && failKind(html.error) === 'retry');
    const garbage = outcome(200, 'application/octet-stream', 'not json');
    assert.ok('error' in garbage && garbage.error instanceof NetError);
  });
});

describe('exchange: таймаут и обрывы', () => {
  test('таймаут: запрос отменён, NetError("timeout") — повтор; очередь не висит', async () => {
    const ctrl = controller();
    const started = Date.now();
    // Соединение «висит»: fetch не отвечает и отмену не замечает
    const e = await caught(exchange(ctrl, () => new Promise<ResponseLike>(() => {}), 30));
    assert.ok(e instanceof NetError);
    assert.equal(e.message, 'timeout');
    assert.equal(failKind(e), 'retry');
    assert.equal(ctrl.signal.aborted, true);
    assert.ok(Date.now() - started < 1000);
  });

  test('тело ответа зависло — тот же таймаут', async () => {
    const e = await caught(exchange(controller(), async () => response(200, JSON_CT, () => new Promise<string>(() => {})), 30));
    assert.ok(e instanceof NetError && e.message === 'timeout');
  });

  test('ошибка TLS или сети — NetError (повтор)', async () => {
    const e = await caught(
      exchange(
        controller(),
        async () => {
          throw new TypeError('Network request failed: SSL handshake aborted');
        },
        1000,
      ),
    );
    assert.ok(e instanceof NetError);
    assert.equal(failKind(e), 'retry');
  });

  test('обрыв при чтении ответа 200 — NetError, а не «пустой успех»', async () => {
    const e = await caught(
      exchange(
        controller(),
        async () =>
          response(200, JSON_CT, async () => {
            throw new Error('connection reset');
          }),
        1000,
      ),
    );
    assert.ok(e instanceof NetError);
  });

  test('ответ пришёл вовремя — данные', async () => {
    const data = await exchange(controller(), async () => response(200, JSON_CT, '{"ok":true}'), 1000);
    assert.deepEqual(data, { ok: true });
  });
});

describe('opsResults', () => {
  test('по результату на операцию', () => {
    assert.deepEqual(opsResults({ results: [{ ok: true }, { ok: false, error: 'not_member' }] }, 2), [
      { ok: true },
      { ok: false, error: 'not_member' },
    ]);
  });

  test('не тот ответ — NetError (пачка остаётся в очереди)', () => {
    for (const bad of [null, {}, { results: [] }, { results: [{ ok: true }] }, { results: [{}, {}] }, [{ ok: true }, { ok: true }]]) {
      assert.throws(() => opsResults(bad, 2));
      try {
        opsResults(bad, 2);
      } catch (e) {
        assert.equal(failKind(e), 'retry');
      }
    }
  });
});
