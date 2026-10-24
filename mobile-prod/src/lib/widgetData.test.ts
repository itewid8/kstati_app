/** Данные виджета: ближайшие дела, подписи, цвета, настройки. Сегодня понедельник 2026-10-05, 17:52 (Москва) */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, snapshot, task } from '@/adapters/common/fixture';
import { palettes } from '@/ui/tokens';
import {
  DEFAULT_WIDGET_PREFS,
  cleanPrefs,
  faceColors,
  faceDayLabel,
  faceWhen,
  cleanPrefsFile,
  prefsFor,
  transparencyPercent,
  visibleAt,
  whenParts,
  widgetColors,
  widgetFile,
  widgetHeader,
  widgetItems,
  widgetScheme,
  withSharedPrefs,
  withWidgetPrefs,
  type WidgetPrefs,
} from './widgetData';

const NOW = new Date('2026-10-05T14:52:00.000Z');

describe('widgetItems', () => {
  test('ближайшие с датой: без прошедших, сделанных и без даты; по времени', () => {
    const items = widgetItems(snapshot(), NOW);
    const first = visibleAt(items, NOW.getTime(), 8, []).map((x) => `${x.id} ${x.date} ${x.time ?? '—'}`);
    assert.deepEqual(first, [
      'yoga 2026-10-05 19:00',
      'gift 2026-10-05 —',
      'trip 2026-10-07 07:00',
      'meet 2026-10-08 09:00',
      'mom 2026-10-08 —',
      'lunch 2026-10-09 14:00',
      'cinema 2026-10-09 19:30',
      'night 2026-10-09 23:00',
    ]);
    assert.ok(!items.some((x) => x.id === 'dent' || x.id === 'train1' || x.id === 'none'));
  });

  test('серия: в файле все разы на 60 дней, в виджете — только ближайший', () => {
    const items = widgetItems(snapshot(), NOW);
    const yoga = items.filter((x) => x.id === 'yoga');
    assert.equal(yoga[0]?.occ, '2026-10-05');
    assert.equal(yoga.at(-1)?.occ, '2026-11-30');
    assert.equal(visibleAt(items, NOW.getTime(), 20, []).filter((x) => x.id === 'yoga').length, 1);
  });

  test('после начала дела оно уходит, на весь день — в полночь', () => {
    const items = widgetItems(snapshot(), NOW);
    const at1901 = new Date('2026-10-05T16:01:00.000Z').getTime();
    assert.deepEqual(visibleAt(items, at1901, 2, []).map((x) => x.id), ['gift', 'trip']);
    const nextDay = new Date('2026-10-05T21:00:30.000Z').getTime();
    assert.deepEqual(visibleAt(items, nextDay, 2, []).map((x) => x.id), ['trip', 'meet']);
  });

  test('полоса: цвет человека в обеих темах, у общего дела — два', () => {
    const items = widgetItems(snapshot(), NOW);
    assert.deepEqual(items.find((x) => x.id === 'yoga')?.c, [['#E2407E', '#F06A9B']]);
    assert.deepEqual(items.find((x) => x.id === 'mom')?.c, [
      ['#2F6BDB', '#5B8DEF'],
      ['#E2407E', '#F06A9B'],
    ]);
  });

  test('фильтр по группе; чужие группы не попадают', () => {
    const party = task('party', '2026-10-06', '20:00', 'Вечеринка', ['d'], { groupId: 'g2' });
    const alien = task('alien', '2026-10-06', '10:00', 'Чужое', ['x'], { groupId: 'g9' });
    // В «Друзьях» мой режим — «Только выбранные»: там видна только вечеринка Димы
    const groups = snapshot().groups.map((g) => (g.id === 'g2' ? { ...g, selectOnly: ['s'] } : g));
    const s = snapshot({ tasks: [...snapshot().tasks, party, alien], groups });
    const items = widgetItems(s, NOW);
    assert.deepEqual(visibleAt(items, NOW.getTime(), 5, ['g2']).map((x) => x.id), ['party']);
    // Режим «Все»: мои дела видны и «Друзьям» — и в виджете под этой группой
    const all = widgetItems(snapshot({ tasks: [...snapshot().tasks, party] }), NOW);
    assert.ok(visibleAt(all, NOW.getTime(), 5, ['g2']).some((x) => x.id === 'gift'));
    assert.ok(!items.some((x) => x.id === 'alien'));
    const file = widgetFile(s, 'system', NOW);
    assert.deepEqual(file.groups, [
      { id: 'g1', name: 'Мы с Кариной' },
      { id: 'g2', name: FRIENDS.name },
    ]);
    assert.equal(file.dark, null);
    assert.equal(widgetFile(s, 'dark', NOW).dark, true);
  });
});

describe('подписи', () => {
  test('время справа', () => {
    const today = '2026-10-05';
    assert.deepEqual(whenParts('2026-10-05', '19:00', today), { day: null, time: '19:00' });
    assert.deepEqual(whenParts('2026-10-05', null, today), { day: null, time: '—' });
    assert.deepEqual(whenParts('2026-10-06', '10:00', today), { day: 'ЗАВТРА', time: '10:00' });
    assert.deepEqual(whenParts('2026-10-06', null, today), { day: null, time: 'ЗАВТРА' });
    assert.deepEqual(whenParts('2026-10-07', '07:00', today), { day: 'СР 07', time: '07:00' });
    assert.deepEqual(whenParts('2026-10-11', null, today), { day: null, time: 'ВС 11' });
    assert.deepEqual(whenParts('2026-10-17', '12:00', today), { day: '17 ОКТ', time: '12:00' });
  });

  test('шапка', () => {
    const groups = [{ id: 'g1', name: 'Мы с Кариной' }];
    assert.deepEqual(widgetHeader(groups, ['g1'], '2026-10-05'), { label: 'МЫ С КАРИНОЙ', weekday: 'ПН', day: '05' });
    assert.deepEqual(widgetHeader(groups, [], '2026-10-11'), { label: 'ВСЕ ГРУППЫ', weekday: 'ВС', day: '11' });
    assert.equal(widgetHeader(groups, ['gone'], '2026-10-05').label, 'ВСЕ ГРУППЫ');
    assert.equal(widgetHeader([...groups, { id: 'g2', name: 'Семья' }], ['g1', 'g2'], '2026-10-05').label, 'МЫ С КАРИНОЙ · СЕМЬЯ');
  });
});

describe('цвета', () => {
  test('как в теме — палитра приложения', () => {
    const c = widgetColors(DEFAULT_WIDGET_PREFS, 'light');
    assert.equal(c.card, palettes.light.bg);
    assert.equal(c.panel, palettes.light.panel);
    assert.equal(c.headBg, palettes.light.text);
    assert.equal(c.title, palettes.light.text);
    assert.equal(c.day, palettes.light.muted);
    assert.equal(c.today, palettes.light.red);
    const d = widgetColors(DEFAULT_WIDGET_PREFS, 'dark');
    assert.equal(d.card, palettes.dark.bg);
    assert.equal(d.recDot, palettes.dark.red);
  });

  test('явный выбор: светлые буквы, тёмная кнопка, светлый фон в тёмной теме', () => {
    const c = widgetColors({ ...DEFAULT_WIDGET_PREFS, bg: 'light', text: 'light', time: 'dark', micTone: 'dark' }, 'dark');
    assert.equal(c.card, palettes.light.bg);
    assert.equal(c.title, palettes.dark.text);
    assert.equal(c.time, palettes.light.text);
    assert.equal(c.day, palettes.light.text);
    assert.equal(c.recFill, palettes.dark.panel);
  });

  test('тема виджета', () => {
    assert.equal(widgetScheme(null, true), 'dark');
    assert.equal(widgetScheme(false, true), 'light');
    assert.equal(widgetScheme(true, false), 'dark');
  });
});

describe('настройки', () => {
  test('испорченное — по умолчанию, непрозрачность в 0…1', () => {
    assert.deepEqual(cleanPrefs('x'), DEFAULT_WIDGET_PREFS);
    assert.deepEqual(cleanPrefs({ mic: 'yes', bg: 'blue', opacity: 1.7, group: 5 }), { ...DEFAULT_WIDGET_PREFS, opacity: 1 });
    assert.equal(cleanPrefs({ opacity: 0.333 }).opacity, 0.33);
    assert.deepEqual(cleanPrefs({ group: 'g2' }).groups, ['g2']);
    assert.deepEqual(cleanPrefs({ groups: ['g1', 3, 'g2'] }).groups, ['g1', 'g2']);
    assert.equal(transparencyPercent(0.7), 30);
  });

  test('свои → общие → по умолчанию', () => {
    const shared: WidgetPrefs = { ...DEFAULT_WIDGET_PREFS, bg: 'dark' };
    const own: WidgetPrefs = { ...DEFAULT_WIDGET_PREFS, mic: false };
    const file = withWidgetPrefs(withSharedPrefs(shared), 12, own);
    assert.deepEqual(prefsFor(file, 12), own);
    assert.deepEqual(prefsFor(file, 13), shared);
    assert.deepEqual(prefsFor(file, null), shared);
    assert.deepEqual(prefsFor({}, 12), DEFAULT_WIDGET_PREFS);
    assert.deepEqual(cleanPrefsFile(JSON.parse(JSON.stringify(file))), file);
    assert.deepEqual(Object.keys(withSharedPrefs(own)), ['default']);
  });
});

describe('подписи раскладок (C-Widget*)', () => {
  const today = '2026-10-24';
  test('день', () => {
    assert.equal(faceDayLabel('2026-10-24', today), 'СБ 24 · СЕГОДНЯ');
    assert.equal(faceDayLabel('2026-10-25', today), 'ВС 25 · ЗАВТРА');
    assert.equal(faceDayLabel('2026-10-28', today), 'СР 28');
    assert.equal(faceDayLabel('2026-11-01', today), 'ВС 1 НОЯ');
    assert.equal(faceDayLabel('2026-11-04', today), 'СР 4 НОЯ');
  });
  test('когда', () => {
    assert.equal(faceWhen('2026-10-25', null, today), 'ЗАВТРА');
    assert.equal(faceWhen('2026-10-28', '18:00', today), 'СР 28 · 18:00');
    assert.equal(faceWhen('2026-11-01', null, today), '1 НОЯ');
    assert.equal(faceWhen('2026-10-24', '19:00', today), '19:00');
  });
  test('цвета по умолчанию — как в макете', () => {
    const c = faceColors(DEFAULT_WIDGET_PREFS, 'light');
    assert.equal(c.card, 'rgba(244,243,239,0.94)');
    assert.equal(c.recFill, '#F4F3EF');
    assert.equal(c.recBorder, '#CFCEC8');
    assert.equal(c.headBg, 'transparent');
  });
});
