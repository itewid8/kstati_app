import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { busyLabel, genitive, plural, relativeDay, upper } from './ru';

describe('genitive', () => {
  test('имена из макетов: «ОТ КАРИНЫ», «ОТ ДИМЫ», «ОТ ЛЕНЫ», «ОТ ОЛЕГА»', () => {
    assert.equal(genitive('Карина', 'f'), 'КАРИНЫ');
    assert.equal(genitive('Дима', 'm'), 'ДИМЫ');
    assert.equal(genitive('Лена'), 'ЛЕНЫ');
    assert.equal(genitive('Олег'), 'ОЛЕГА');
  });

  test('после г, к, х, ж, ш, щ, ч — «и»; на «я», «й», «ь»', () => {
    assert.equal(genitive('Ольга'), 'ОЛЬГИ');
    assert.equal(genitive('Саша'), 'САШИ');
    assert.equal(genitive('Саня'), 'САНИ');
    assert.equal(genitive('Мария'), 'МАРИИ');
    assert.equal(genitive('Андрей'), 'АНДРЕЯ');
    assert.equal(genitive('Игорь', 'm'), 'ИГОРЯ');
    assert.equal(genitive('Любовь', 'f'), 'ЛЮБОВИ');
  });

  test('неправильные, несклоняемые, латиница, фамилия после имени', () => {
    assert.equal(genitive('Павел'), 'ПАВЛА');
    assert.equal(genitive('Лев'), 'ЛЬВА');
    assert.equal(genitive('Ирен', 'f'), 'ИРЕН');
    assert.equal(genitive('Тео'), 'ТЕО');
    assert.equal(genitive('Anna'), 'ANNA');
    assert.equal(genitive('  Карина Ким ', 'f'), 'КАРИНЫ КИМ');
  });
});

describe('busyLabel', () => {
  test('по полу', () => {
    assert.equal(busyLabel({ name: 'Карина', gender: 'f' }), 'КАРИНА ЗАНЯТА');
    assert.equal(busyLabel({ name: 'Саня', gender: 'm' }), 'САНЯ ЗАНЯТ');
    assert.equal(busyLabel({ name: 'Тео' }), 'ТЕО ЗАНЯТ(А)');
  });
});

describe('relativeDay', () => {
  const today = '2026-10-05';
  test('подписи C-Ideas', () => {
    assert.equal(relativeDay('2026-10-05', today), 'СЕГОДНЯ');
    assert.equal(relativeDay('2026-10-04', today), 'ВЧЕРА');
    assert.equal(relativeDay('2026-10-03', today), '2 ДНЯ НАЗАД');
    assert.equal(relativeDay('2026-10-02', today), '3 ДНЯ НАЗАД');
    assert.equal(relativeDay('2026-09-30', today), '5 ДНЕЙ НАЗАД');
    assert.equal(relativeDay('2026-09-28', today), 'НЕДЕЛЮ НАЗАД');
  });

  test('давно и в будущем — дата', () => {
    assert.equal(relativeDay('2026-09-14', today), '14 СЕН');
    assert.equal(relativeDay('2026-10-07', today), '7 ОКТ');
    assert.equal(relativeDay('2025-12-31', today), '31 ДЕК');
  });
});

describe('upper, plural', () => {
  test('ё и падежи числа', () => {
    assert.equal(upper('Ёлка у Лёши'), 'ЁЛКА У ЛЁШИ');
    assert.equal(plural(1, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ'), 'ДЕЛО');
    assert.equal(plural(3, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ'), 'ДЕЛА');
    assert.equal(plural(16, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ'), 'ДЕЛ');
    assert.equal(plural(21, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ'), 'ДЕЛО');
  });
});
