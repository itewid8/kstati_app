/** Поднятый элемент: рамка строки как в макете C-Quick*, рамка блока, сдвиг над нижним окном */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFrame, liftShift } from './liftMath';

describe('liftFrame', () => {
  test('строка списка (C-QuickTask, третья строка) → рамка 12 / 232, 366×51', () => {
    // Секция с top 122: рамка 1.5 + шапка 22 + 2 строки по 45 → строка с 235.5, высота 44 + разделитель
    assert.deepEqual(liftFrame({ x: 17.5, y: 235.5, width: 355, height: 45 }, 'row'), { x: 12, y: 232, width: 366, height: 51 });
  });
  test('блок календаря — обводка снаружи', () => {
    assert.deepEqual(liftFrame({ x: 50, y: 300, width: 40, height: 60 }, 'block'), { x: 48.5, y: 298.5, width: 43, height: 63 });
  });
});

describe('liftShift', () => {
  const frame = { x: 12, y: 600, width: 366, height: 51 };
  test('над окном — без сдвига', () => assert.equal(liftShift({ ...frame, y: 142 }, 560), 0));
  test('под окном — поднимается до его края', () => assert.equal(liftShift(frame, 560), -91));
  test('не выше minTop', () => assert.equal(liftShift(frame, 60, 40), -560));
  test('окно ещё не измерено — без сдвига', () => assert.equal(liftShift(frame, 0), 0));
});
