import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCandidates, linkRows, type LinkData } from './links';
import type { Link, Task } from '@/lib/types';

const task = (id: string, title: string, date: string | null): Task => ({ id, title, date, time: null, createdBy: 's', groupId: 'g1', doneAt: null }) as unknown as Task;
const data = (links: Link[] = []): LinkData => ({
  meId: 's',
  users: [],
  tasks: [task('t1', 'Ужин у родителей', '2026-11-15'), task('t2', 'Свадьба', '2026-05-22'), task('t3', 'Стрижка', null)],
  watch: [{ id: 'm1', groupId: 'g1', title: 'Дюна', year: 2021, watchedAt: null } as never],
  wishes: [],
  topics: [{ id: 'n1', ownerId: 's', title: 'Продукты', groupIds: [], createdAt: '', body: '- [ ] Хлеб\n- [x] Вино' }],
  ideas: [],
  links,
});

describe('блок «Связи»', () => {
  test('связанное видно с обеих сторон, со списком — сколько отмечено', () => {
    const l: Link = { id: 'l1', ownerId: 's', a: { type: 'task', id: 't1', owner: 's' }, b: { type: 'note', id: 'n1', owner: 's' }, createdAt: '' };
    assert.deepEqual(linkRows({ type: 'task', id: 't1', owner: 's' }, data([l])).map((r) => [r.kind, r.title, r.meta, r.linkId]), [['Заметка', 'Продукты', 'список 1/2', 'l1']]);
    assert.equal(linkRows({ type: 'note', id: 'n1', owner: 's' }, data([l]))[0]!.title, 'Ужин у родителей');
  });
  test('кандидаты: другого типа, ближайшие дела первыми, поиск по словам', () => {
    const self = { type: 'note' as const, id: 'n1', owner: 's' };
    assert.deepEqual(linkCandidates(self, data(), '', '2026-11-14').map((r) => r.title), ['Ужин у родителей', 'Стрижка', 'Свадьба', 'Дюна']);
    assert.deepEqual(linkCandidates(self, data(), 'свад', '2026-11-14').map((r) => r.title), ['Свадьба']);
  });
});
