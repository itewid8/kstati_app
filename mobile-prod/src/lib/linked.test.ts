import { describe, test as it } from 'node:test';
import assert from 'node:assert/strict';
import { canLink, linkedToDeleted, linksOf, pairsToLink, taskRef, watchRef } from './linked';
import type { Link, LinkRef } from './types';

const t = { id: 't1', createdBy: 'u1' } as const;
const m = { id: 'm1', groupId: 'g1' } as const;
const note: LinkRef = { type: 'note', id: 'n1', owner: 'u1' };
const world = {
  tasks: [{ id: 't1', createdBy: 'u1' }] as never[],
  watch: [{ id: 'm1', groupId: 'g1' }] as never[],
  wishes: [] as never[],
  topics: [{ id: 'n1', ownerId: 'u1' }] as never[],
  ideas: [] as never[],
};
const link = (id: string, a: LinkRef, b: LinkRef): Link => ({ id, ownerId: 'u1', a, b, createdAt: '' });

describe('связи', () => {
  it('видны в обе стороны, только если оба конца есть', () => {
    const links = [link('l1', taskRef(t), note), link('l2', note, { type: 'wish', id: 'w9', owner: 'u2' })];
    assert.deepEqual(linksOf(note, links, world).map((x) => x.other.id), ['t1']);
    assert.deepEqual(linksOf(taskRef(t), links, world).map((x) => x.other.id), ['n1']);
  });
  it('одинаковые типы и повтор — нельзя', () => {
    const links = [link('l1', taskRef(t), note)];
    assert.equal(canLink(note, taskRef(t), links), false);
    assert.equal(canLink(note, { type: 'note', id: 'n2', owner: 'u1' }, []), false);
    assert.equal(canLink(note, watchRef(m), links), true);
  });
  it('записи одной команды связываются попарно, кроме одинаковых типов', () => {
    const pairs = pairsToLink([taskRef(t), note, { type: 'note', id: 'n2', owner: 'u1' }]);
    assert.deepEqual(pairs.map(([a, b]) => `${a.id}-${b.id}`), ['t1-n1', 't1-n2']);
  });
  it('при удалении — связанные, кроме удаляемых', () => {
    const links = [link('l1', taskRef(t), note), link('l2', watchRef(m), note)];
    assert.deepEqual(linkedToDeleted([note], links, world).map((r) => r.id).sort(), ['m1', 't1']);
    assert.deepEqual(linkedToDeleted([note, taskRef(t)], links, world).map((r) => r.id), ['m1']);
  });
});
