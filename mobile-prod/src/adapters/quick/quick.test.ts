/**
 * Быстрые действия по удержанию: данные окна на данных макетов C-Quick* (сегодня ПН 2026-10-05) и правки:
 * перенос (раз серии — отдельно), копия, ряд «В ТЕМУ», хотелка без следов подарка у владельца.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Idea, Topic, WatchItem, Wish } from '@/lib/types';
import { quickIdeaFixture, quickTaskFixture, quickWatchFixture, quickWishFixture } from '@/screens/fixtures/quick';
import { CLOCK, snapshot, task } from '../common/fixture';
import { colorMap } from '../common/people';
import { NO_TOPIC, giftTaskTitle, moveChange, moveToDate, movePatches, nextSaturday, quickView, splitIdea, taskCopy, topicSegments } from './index';
import type { QuickEnv, QuickTarget } from './types';

const ENV: QuickEnv = { today: CLOCK.today, gifts: true };

const wishes: Wish[] = [
  { id: 'w1', ownerId: 'k', title: 'Наушники Sony WH-1000XM5', note: '', link: 'https://www.ozon.ru/product/1', receivedAt: null, createdAt: '2026-09-28T10:00:00.000Z' },
  { id: 'w2', ownerId: 's', title: 'Кофемолка', note: '', link: 'tel:123', receivedAt: null, createdAt: '2026-10-01T10:00:00.000Z', giftedBy: 'k', giftedAt: '2026-10-02T10:00:00.000Z' },
];
const watch: WatchItem[] = [
  { id: 'v1', groupId: 'g1', title: 'Разделение', kind: 'series', genres: ['thriller'], origin: null, year: null, addedBy: 's', watchedAt: null, createdAt: '2026-09-01T10:00:00.000Z' },
];
const topic = (id: string, title: string, createdAt: string, extra: Partial<Topic> = {}): Topic => ({ id, ownerId: 's', title, groupIds: [], createdAt, ...extra });
const topics: Topic[] = [
  topic('t-repair', 'Ремонт', '2026-09-01T10:00:00.000Z'),
  topic('t-vacation', 'Отпуск', '2026-09-20T10:00:00.000Z'),
  topic('t-gifts', 'Подарки', '2026-09-10T10:00:00.000Z'),
  topic('t-books', 'Книги', '2026-08-01T10:00:00.000Z'),
  topic('t-old', 'Старое', '2026-10-04T10:00:00.000Z', { archivedAt: '2026-10-04T12:00:00.000Z' }),
  { id: 't-karina', ownerId: 'k', title: 'Карина', groupIds: ['g1'], createdAt: '2026-10-01T10:00:00.000Z' },
];
const idea = (id: string, ownerId: string, topicId: string | null, text: string, createdAt: string): Idea => ({ id, ownerId, topicId, text, createdAt, updatedAt: createdAt });
const ideas: Idea[] = [
  idea('i1', 's', 't-repair', 'Полки над столом', '2026-10-12T10:00:00.000Z'),
  idea('i2', 's', 't-gifts', 'Свеча с инжиром', '2026-10-03T10:00:00.000Z'),
  idea('i3', 'k', 't-karina', 'Билеты в театр. На субботу', '2026-10-02T10:00:00.000Z'),
  idea('i4', 's', null, 'Позвонить маме', '2026-10-01T10:00:00.000Z'),
  idea('i5', 's', 't-vacation', 'Билеты в Калининград', '2026-10-04T10:00:00.000Z'),
];

const s = snapshot({ wishes, watch, topics, ideas });
const colors = colorMap(s);
const view = (target: QuickTarget, env: QuickEnv = ENV) => quickView(s, colors, env, target);
const labels = (list: readonly { label: string }[]) => list.map((x) => x.label);

describe('C-QuickTask', () => {
  const v = view({ kind: 'task', id: 'yoga', occ: '2026-10-05' });

  test('карточка раза серии — как в макете', () => {
    assert.ok(v && v.kind === 'task');
    assert.deepEqual(v.sheet.card, quickTaskFixture.sheet.card);
    assert.equal(v.occ, '2026-10-05');
  });
  test('плитки и ряд «ПЕРЕНЕСТИ» — как в макете', () => {
    assert.ok(v && v.kind === 'task');
    assert.deepEqual(labels(v.sheet.tiles), labels(quickTaskFixture.sheet.tiles));
    assert.deepEqual(v.sheet.section, quickTaskFixture.sheet.section);
    assert.equal(v.sheet.deletable, true);
    // Расхождение с макетом: там В ПЛАН у серии активна, но серию планом не сделать (как «Сделать планом» в окне дела)
    assert.equal(v.sheet.tiles.find((t) => t.key === 'plan')?.disabled, true);
  });
  test('отмеченный раз — ВЕРНУТЬ', () => {
    const done = quickView(snapshot({ tasks: [task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { repeat: { freq: 'week', every: 1 }, doneDates: ['2026-10-05'] })] }), colors, ENV, { kind: 'task', id: 'yoga', occ: '2026-10-05' });
    assert.equal(done?.sheet.tiles[0]?.label, 'ВЕРНУТЬ');
  });
  test('серия без раза — ближайший несделанный', () => {
    const next = view({ kind: 'task', id: 'yoga' });
    assert.ok(next && next.kind === 'task');
    assert.equal(next.occ, '2026-10-05');
  });
  test('подзадача и план — ОТКРЫТЬ ПЛАН; план не копируется', () => {
    const step = view({ kind: 'task', id: 'meet' });
    assert.ok(step && step.kind === 'task');
    assert.equal(step.planId, 'trip');
    assert.equal(step.sheet.card.tag, 'КОМАНДИРОВКА В КАЗАНЬ');
    assert.deepEqual(labels(step.sheet.tiles), ['ГОТОВО', 'ИЗМЕНИТЬ', 'ОТКРЫТЬ ПЛАН', 'КОПИЯ']);
    const plan = view({ kind: 'task', id: 'trip' });
    assert.ok(plan && plan.kind === 'task');
    assert.equal(plan.planId, 'trip');
    assert.equal(plan.sheet.card.tag, 'ПЛАН · 1/2');
    assert.equal(plan.sheet.tiles.find((t) => t.key === 'copy')?.disabled, true);
  });
  test('без времени +1 ЧАС выключен; без даты — «БЕЗ ДАТЫ»', () => {
    const gift = view({ kind: 'task', id: 'gift' });
    assert.equal(gift?.sheet.section?.segments.find((x) => x.key === 'hour')?.disabled, true);
    const none = view({ kind: 'task', id: 'none' });
    assert.equal(none?.sheet.card.meta, 'БЕЗ ДАТЫ · САНЯ');
    assert.equal(none?.sheet.section?.segments.find((x) => x.key === 'hour')?.disabled, true);
  });
  test('дела нет — null', () => assert.equal(view({ kind: 'task', id: 'gone' }), null));
});

describe('перенос', () => {
  test('ближайшая суббота после сегодня', () => {
    assert.equal(nextSaturday('2026-10-05'), '2026-10-10');
    assert.equal(nextSaturday('2026-10-09'), '2026-10-10');
    assert.equal(nextSaturday('2026-10-10'), '2026-10-17');
    assert.equal(nextSaturday('2026-10-11'), '2026-10-17');
  });
  test('ЗАВТРА и ВЫХОДНЫЕ — дата, время прежнее', () => {
    const m = movePatches({ date: '2026-10-05', time: '19:00', endDate: null, endTime: '20:00' }, '2026-10-05');
    assert.deepEqual(m.tomorrow, { date: '2026-10-06' });
    assert.deepEqual(m.weekend, { date: '2026-10-10' });
    assert.deepEqual(m.hour, { date: '2026-10-05', time: '20:00', endTime: '21:00', endDate: null });
  });
  test('многодневное везёт конец', () => {
    const m = movePatches({ date: '2026-10-07', time: '07:00', endDate: '2026-10-09', endTime: '15:00' }, '2026-10-05');
    assert.deepEqual(m.tomorrow, { date: '2026-10-06', endDate: '2026-10-08' });
    assert.deepEqual(m.hour, { date: '2026-10-07', time: '08:00', endTime: '16:00', endDate: '2026-10-09' });
  });
  test('+1 ЧАС через полночь', () => {
    const m = movePatches({ date: '2026-10-09', time: '23:30', endDate: null, endTime: '23:50' }, '2026-10-05');
    assert.deepEqual(m.hour, { date: '2026-10-10', time: '00:30', endTime: '00:50', endDate: null });
  });
  test('уже завтра / уже в субботу — кнопка выключена; без даты — ставится дата', () => {
    assert.equal(movePatches({ date: '2026-10-06', time: null }, '2026-10-05').tomorrow, null);
    assert.equal(movePatches({ date: '2026-10-10', time: null }, '2026-10-05').weekend, null);
    assert.deepEqual(movePatches({ date: null, time: null }, '2026-10-05').tomorrow, { date: '2026-10-06' });
  });
  test('ДАТА… у раза серии: выбранный день, время прежнее', () => {
    assert.deepEqual(moveToDate({ date: '2026-10-05', time: '19:00', endDate: null, endTime: '20:00' }, '2026-10-08'), { date: '2026-10-08' });
    assert.equal(moveToDate({ date: '2026-10-05', time: '19:00' }, '2026-10-05'), null);
  });
  test('правка: у серии — только этот раз (occ), у обычного дела — без occ', () => {
    const yoga = s.tasks.find((t) => t.id === 'yoga');
    const dent = s.tasks.find((t) => t.id === 'dent');
    assert.ok(yoga && dent);
    assert.equal(moveChange(yoga, '2026-10-05', { date: '2026-10-06' }).occ, '2026-10-05');
    assert.equal(moveChange(dent, null, { date: '2026-10-06' }).occ, undefined);
    assert.deepEqual(moveChange(dent, null, { date: '2026-10-06' }).candidates, ['dent']);
  });
});

describe('КОПИЯ дела', () => {
  test('новый id, те же дата, время и люди, не отмечена', () => {
    const src = task('x', '2026-10-05', '09:30', 'Стоматолог', [], { createdBy: 'k', doneAt: '2026-10-05T10:00:00.000Z', endTime: '10:30', occ: '2026-10-05' });
    const copy = taskCopy(src, { id: 'new', meId: 's', now: CLOCK.nowIso });
    assert.equal(copy.id, 'new');
    assert.equal(copy.date, '2026-10-05');
    assert.equal(copy.time, '09:30');
    assert.equal(copy.endTime, '10:30');
    assert.deepEqual(copy.people, ['k']);
    assert.equal(copy.doneAt, null);
    assert.equal('occ' in copy, false);
  });
});

describe('C-QuickWish', () => {
  test('чужая хотелка — как в макете', () => {
    const v = view({ kind: 'wish', ownerId: 'k', id: 'w1' });
    assert.ok(v && v.kind === 'wish');
    assert.deepEqual(v.sheet, quickWishFixture.sheet);
    assert.equal(v.link, 'https://www.ozon.ru/product/1');
  });
  test('сервер без API 2 — ПОДАРЮ выключена', () => {
    const v = view({ kind: 'wish', ownerId: 'k', id: 'w1' }, { ...ENV, gifts: false });
    assert.equal(v?.sheet.tiles[0]?.disabled, true);
  });
  test('своя — ПОЛУЧИЛ / ИЗМЕНИТЬ / ССЫЛКА и УДАЛИТЬ; подарок не виден; ссылка не http — выключена', () => {
    const v = view({ kind: 'wish', ownerId: 's', id: 'w2' });
    assert.ok(v && v.kind === 'wish');
    assert.deepEqual(labels(v.sheet.tiles), ['ПОЛУЧИЛ', 'ИЗМЕНИТЬ', 'ССЫЛКА']);
    assert.equal(v.sheet.tiles[0]?.disabled, undefined);
    assert.equal(v.sheet.tiles[2]?.disabled, true);
    assert.equal(v.sheet.deletable, true);
    assert.equal(v.sheet.card.meta, 'САНЯ · ДОБАВЛЕНО 1 ОКТ');
    assert.equal(/КАРИН|ПОДАР/.test(JSON.stringify(v.sheet)), false);
  });
  test('дело из хотелки', () => assert.equal(giftTaskTitle(' Плед '), 'Купить подарок: Плед'));
});

describe('C-QuickWatch', () => {
  test('плитки как в макете; ярлык — вид, подпись — кто добавил и жанр', () => {
    const v = view({ kind: 'watch', id: 'v1' });
    assert.ok(v && v.kind === 'watch');
    assert.deepEqual(v.sheet.tiles, quickWatchFixture.sheet.tiles);
    assert.equal(v.sheet.deletable, true);
    // В макете ещё сезон «S2» и двое — у записи «Смотреть» нет сезонов, добавил один человек
    assert.deepEqual(v.sheet.card, { title: 'Разделение', tag: 'СЕРИАЛ', meta: 'САНЯ · ТРИЛЛЕР', colors: ['blue'] });
  });
});

describe('C-QuickIdea', () => {
  test('своя идея в теме — как в макете (кроме автора: в макете Карина)', () => {
    const v = view({ kind: 'idea', id: 'i1' });
    assert.ok(v && v.kind === 'idea');
    assert.deepEqual(v.sheet.tiles, quickIdeaFixture.sheet.tiles);
    assert.deepEqual(v.sheet.section, quickIdeaFixture.sheet.section);
    assert.deepEqual(v.sheet.card, { ...quickIdeaFixture.sheet.card, meta: 'САНЯ · 12 ОКТ', colors: ['blue'] });
  });
  test('«В ТЕМУ»: без текущей и архивных, свежие первыми; все темы списком', () => {
    assert.deepEqual(
      topicSegments(s, { topicId: null }).map((x) => x.key),
      ['t-repair', 't-vacation', 't-gifts', 't-books'],
    );
    assert.deepEqual(
      topicSegments(s, { topicId: 't-vacation' }).map((x) => x.key),
      ['t-repair', 't-gifts', 't-books', NO_TOPIC],
    );
  });
  test('чужая идея — без правки, темы и удаления', () => {
    const v = view({ kind: 'idea', id: 'i3' });
    assert.ok(v && v.kind === 'idea');
    assert.equal(v.sheet.tiles[0]?.disabled, true);
    assert.equal(v.sheet.section, undefined);
    assert.equal(v.sheet.deletable, false);
    assert.equal(v.sheet.card.title, 'Билеты в театр');
    assert.equal(v.sheet.card.tag, 'КАРИНА');
  });
  test('идея → дело: первая фраза в название', () => {
    assert.deepEqual(splitIdea('Билеты в театр. На субботу'), { title: 'Билеты в театр', note: 'Билеты в театр. На субботу' });
    assert.deepEqual(splitIdea('Позвонить маме'), { title: 'Позвонить маме', note: '' });
  });
});
