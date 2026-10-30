import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { monoWidth, syllables, timeLines, timeOptions, titlePlan } from './weekText';

describe('weekText — текст в узком блоке недели', () => {
  test('время: целиком, двумя строками или никак', () => {
    const w = monoWidth('18:00–20:00', 7);
    assert.deepEqual(timeLines('18:00–20:00', w, 0, 7), ['18:00–20:00']);
    assert.deepEqual(timeLines('18:00–20:00', w - 1, 0, 7), ['18:00', '20:00']);
    assert.deepEqual(timeLines('18:00–20:00', monoWidth('18:00', 7) + 9, 9, 7), ['18:00', '20:00'], 'значки — на первой строке');
    assert.deepEqual(timeLines('18:00–20:00', monoWidth('18:0', 7), 0, 7), [], 'и так не влезает — без времени');
    assert.deepEqual(timeLines('→ 15:00', monoWidth('15:00', 7), 0, 7), [], '«→ 15:00» не делится');
  });
  test('значки не прячут время: тесно — значки отдельной строкой', () => {
    const w = monoWidth('18:00', 7) + 2;
    const opts = timeOptions('18:00–22:00', w, 9, 7);
    assert.deepEqual(opts[0], [{ marks: false, text: '18:00' }, { marks: false, text: '22:00' }, { marks: true, text: '' }]);
    assert.deepEqual(opts[1], [{ marks: true, text: '' }], 'по высоте не влезло — хотя бы значки');
  });
  test('слоги по правилам переноса', () => {
    assert.deepEqual(syllables('командировка'), ['ко', 'ман', 'ди', 'ров', 'ка']);
    assert.deepEqual(syllables('транспондер'), ['тран', 'спон', 'дер'], 'по правилам допустимо');
    assert.deepEqual(syllables('йога'), ['йо', 'га']);
    assert.deepEqual(syllables('кот'), ['кот']);
    assert.deepEqual(syllables('майка'), ['май', 'ка']);
  });
  test('название: по словам, по слогам или бегущей строкой', () => {
    assert.deepEqual(titlePlan('Футбол', 100, 8), { text: 'Футбол', marquee: false });
    const p = titlePlan('Командировка в Питер', 30, 8);
    assert.equal(p.marquee, false);
    assert.equal(p.text, 'Ко­ман­ди­ров­ка в Питер');
    assert.equal(titlePlan('Командировка', 8, 8).marquee, true, 'слог не влезает — бегущая строка');
  });
});
