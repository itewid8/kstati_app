/** Карантин: отвергнутое не теряется; временный отказ повторяется один раз, постоянный — только хранится */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Op } from './ops';
import {
  migrateQuarantine,
  QUARANTINE_MAX,
  quarantineAccept,
  quarantineReject,
  quarantineSupersede,
  quarantineTake,
  type Quarantined,
} from './quarantine';

const AT = '2026-10-22T10:00:00.000Z';
const idea = (id: string, text = 'идея'): Op => ({ op: 'idea.put', idea: { id, topicId: null, text } });
const admin: Op = { op: 'group.admin', id: 'g1', userId: 'u2', admin: true };

describe('quarantine', () => {
  test('временный код (not_member) — ждёт повтора, постоянный (conflict) — только для разбора', () => {
    let q: readonly Quarantined[] = [];
    q = quarantineReject(q, idea('a'), 'not_member', AT);
    q = quarantineReject(q, idea('b'), 'conflict', AT);
    assert.deepEqual(
      q.map((x) => [x.code, x.state]),
      [
        ['not_member', 'held'],
        ['conflict', 'done'],
      ],
    );
  });

  test('повтор один раз: снова отвергнута — done, вторая запись не появляется; повторов больше нет', () => {
    const op = idea('a');
    let q: readonly Quarantined[] = quarantineReject([], op, 'not_member', AT);
    const first = quarantineTake(q, []);
    assert.deepEqual(first.ops, [op]);
    q = first.list;
    assert.equal(q[0]?.state, 'retrying');
    // Пока ждёт отправки, повторно не берётся
    assert.deepEqual(quarantineTake(q, [op]).ops, []);
    // После перезапуска операция из файла — другой объект, но та же операция
    q = quarantineReject(q, JSON.parse(JSON.stringify(op)) as Op, 'not_member', AT);
    assert.equal(q.length, 1);
    assert.equal(q[0]?.state, 'done');
    assert.deepEqual(quarantineTake(q, []).ops, []);
  });

  test('повтор принят сервером — запись уходит из карантина', () => {
    const op = idea('a');
    const taken = quarantineTake(quarantineReject([], op, 'forbidden', AT), []);
    assert.deepEqual(quarantineAccept(taken.list, [op]), []);
    // Ничего не повторяли — та же ссылка
    const held = quarantineReject([], op, 'conflict', AT);
    assert.equal(quarantineAccept(held, [op]), held);
  });

  test('новая правка той же записи: старый отказ не повторяем (не затрём новое старым)', () => {
    const q = quarantineReject(quarantineReject([], idea('a', 'старое'), 'not_member', AT), admin, 'forbidden', AT);
    const after = quarantineSupersede(q, [idea('a', 'новое')]);
    assert.deepEqual(
      after.map((x) => x.state),
      ['done', 'held'],
    );
    // В очереди уже лежит новая правка — повторять нечего
    const t = quarantineTake(q, [{ ...admin, admin: false }]);
    assert.deepEqual(t.ops, [idea('a', 'старое')]);
    assert.deepEqual(
      t.list.map((x) => x.state),
      ['retrying', 'done'],
    );
  });

  test('храним последние 50', () => {
    let q: readonly Quarantined[] = [];
    for (let i = 0; i < QUARANTINE_MAX + 5; i++) q = quarantineReject(q, idea(`i${i}`), 'bad_request', AT);
    assert.equal(q.length, QUARANTINE_MAX);
    assert.deepEqual(q[0]?.op, idea('i5'));
  });

  test('старый карантин (список операций) переносится для разбора, без повторов', () => {
    const q = migrateQuarantine([idea('a'), null, { foo: 1 }]);
    assert.deepEqual(q, [{ op: idea('a'), code: 'unknown', at: '', state: 'done' }]);
    assert.deepEqual(migrateQuarantine(undefined), []);
  });
});
