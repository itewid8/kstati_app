/** Ответ /sync: разбор без слепых приведений и слияние без лишних новых ссылок */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, KARINA, SANYA, TASKS, US } from '@/adapters/common/fixture';
import { isEmptyPatch, mergePull, parseSync, toTask, toTopic, toWatch, type LocalData } from './remote';
import type { Group, Task } from './types';

const local = (patch: Partial<LocalData> = {}): LocalData => ({
  me: SANYA,
  users: [SANYA, KARINA],
  groups: [US, FRIENDS],
  currentGroupId: 'g1',
  tasks: TASKS,
  watch: [],
  wishes: [],
  topics: [],
  ideas: [],
  revs: { groups: { g1: 5, g2: 2 }, owners: { s: 1, k: 1 } },
  ideaRevs: { s: '1', k: '0|g1' },
  reminders: { enabled: true, timed: ['m60'], allDay: ['d1@20:00'] },
  overrides: {},
  wishPersonId: null,
  outbox: [],
  ...patch,
});

/** Ответ сервера, когда ничего не поменялось: те же группы, люди и ревизии, записей нет */
const quiet = (s: LocalData): unknown =>
  JSON.parse(
    JSON.stringify({
      me: s.me,
      groups: s.groups,
      users: s.users,
      revs: s.revs,
      items: {},
      wishes: {},
      prefs: { reminders: s.reminders, overrides: s.overrides },
      ideaRevs: s.ideaRevs,
      notes: {},
    }),
  );

describe('mergePull', () => {
  test('ничего не поменялось — пустой патч (нет setState и перерисовок)', () => {
    const s = local();
    const { patch, uploadPrefs } = mergePull(s, parseSync(quiet(s)));
    assert.deepEqual(Object.keys(patch), []);
    assert.ok(isEmptyPatch(patch));
    assert.equal(uploadPrefs, false);
  });

  test('группа пришла целиком с той же одной правкой: остальные дела — прежние объекты', () => {
    const tasks = TASKS.map((t) => toTask(JSON.parse(JSON.stringify(t)), t.groupId)!);
    const s = local({ tasks });
    const raw = quiet(s) as { items: Record<string, unknown[]>; revs: { groups: Record<string, number> } };
    raw.revs.groups.g1 = 6;
    raw.items.g1 = tasks.map((t) => ({ ...t, type: 'task', updatedAt: 'x', ...(t.id === 'gift' && { title: 'Подарок Лене!' }) }));
    const { patch } = mergePull(s, parseSync(raw));
    assert.ok(patch.tasks);
    assert.notEqual(patch.tasks, s.tasks);
    for (const t of patch.tasks) {
      if (t.id === 'gift') assert.equal(t.title, 'Подарок Лене!');
      else assert.equal(t, tasks.find((x) => x.id === t.id), t.id);
    }
    assert.deepEqual(patch.revs?.groups.g1, 6);
    // Люди и группы не поменялись — в патче их нет
    assert.equal(patch.users, undefined);
    assert.equal(patch.groups, undefined);
    assert.equal(patch.me, undefined);
  });

  test('дела группы, созданной на телефоне во время запроса, не пропадают', () => {
    const fresh: Group = { id: 'gNew', name: 'Новая', category: 'other', inviteCode: '', memberIds: ['s'], ownerId: 's', adminIds: [] };
    const mine: Task = { ...TASKS[0]!, id: 'newTask', groupId: 'gNew' };
    const s = local({
      groups: [US, FRIENDS, fresh],
      tasks: [...TASKS, mine],
      outbox: [
        { op: 'group.create', group: { id: 'gNew', name: 'Новая', category: 'other' } },
        { op: 'task.put', task: { id: 'newTask', groupId: 'gNew', title: '', date: null, time: null, doneAt: null, repeat: null, doneDates: [], skipDates: [], reminders: null, endDate: null, endTime: null, people: [], parentId: null } },
      ],
    });
    const raw = quiet(local()); // сервер группу ещё не знает
    const { patch } = mergePull(s, parseSync(raw));
    const tasks = patch.tasks ?? s.tasks;
    assert.ok(tasks.some((t) => t.id === 'newTask'));
    assert.ok((patch.groups ?? s.groups).some((g) => g.id === 'gNew'));
  });

  test('записи группы, из которой вышли, убираются', () => {
    const s = local();
    const raw = quiet(s) as { groups: Group[] };
    raw.groups = raw.groups.filter((g) => g.id !== 'g1');
    const { patch } = mergePull(s, parseSync(raw));
    assert.deepEqual(patch.tasks, []);
    assert.equal(patch.currentGroupId, 'g2');
  });

  test('неотправленная правка группы: её записи с сервера не берём', () => {
    const s = local({ outbox: [{ op: 'item.delete', groupId: 'g1', id: 'gift' }], tasks: TASKS.filter((t) => t.id !== 'gift') });
    const raw = quiet(s) as { items: Record<string, unknown[]>; revs: { groups: Record<string, number> } };
    raw.revs.groups.g1 = 9;
    raw.items.g1 = TASKS.map((t) => ({ ...t, type: 'task' }));
    const { patch } = mergePull(s, parseSync(raw));
    assert.equal(patch.tasks, undefined);
    assert.equal(patch.revs, undefined);
  });
});

describe('мапперы', () => {
  test('дело: значения по умолчанию, чужие поля отбрасываются, без id — пропуск', () => {
    const t = toTask({ id: 'x', title: 'Дело', type: 'task', updatedAt: 'z', repeat: { freq: 'week', weekdays: [1, 'x'] }, junk: 1 }, 'g1');
    assert.deepEqual(t, {
      id: 'x',
      groupId: 'g1',
      title: 'Дело',
      date: null,
      time: null,
      note: '',
      createdBy: '',
      doneAt: null,
      createdAt: '',
      repeat: { freq: 'week', every: 1, weekdays: [1] },
      doneDates: [],
      skipDates: [],
      reminders: null,
      endDate: null,
      endTime: null,
      people: [],
      parentId: null,
    });
    assert.equal(toTask({ title: 'без id' }, 'g1'), null);
    assert.equal(toTask(null, 'g1'), null);
  });

  test('«Смотреть»: неизвестный жанр и вид отбрасываются', () => {
    const w = toWatch({ id: 'w', title: 'Фильм', kind: 'opera', genres: ['drama', 'opera'], origin: 'ru', year: '2020' }, 'g2');
    assert.equal(w?.groupId, 'g2');
    assert.equal(w?.kind, null);
    assert.deepEqual(w?.genres, ['drama']);
    assert.equal(w?.year, null);
  });

  test('тема: archivedAt только если сервер его прислал', () => {
    assert.equal('archivedAt' in toTopic({ id: 't', title: 'Т' }, 's')!, false);
    assert.equal(toTopic({ id: 't', title: 'Т', archivedAt: null }, 's')?.archivedAt, null);
  });

  test('ответ без полей не падает', () => {
    const r = parseSync({});
    assert.deepEqual(r.groups, []);
    assert.equal(r.prefs, null);
    assert.equal(r.ideaRevs, undefined);
  });
});
