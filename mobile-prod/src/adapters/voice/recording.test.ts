import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL_DRAG,
  MIN_HOLD_MS,
  cancelDrag,
  dragProgress,
  recButtons,
  recStep,
  type RecEvent,
  type RecMode,
  type RecPhase,
  type RecState,
} from './recording';

const st = (phase: RecPhase, mode: RecMode = 'tap'): RecState => ({ phase, mode });

/** Прогнать события по очереди: фазы после каждого и команды */
function run(start: RecState, events: RecEvent[]) {
  let s = start;
  const phases: RecPhase[] = [];
  const commands: string[] = [];
  for (const e of events) {
    const r = recStep(s, e);
    s = r.state;
    phases.push(s.phase);
    commands.push(r.command);
  }
  return { s, phases, commands };
}

const pressHold: RecEvent = { type: 'press', mode: 'hold' };
const pressTap: RecEvent = { type: 'press', mode: 'tap' };
const release = (heldMs: number, cancelled = false): RecEvent => ({ type: 'release', heldMs, cancelled });

describe('recStep — запись пальцем (hold)', () => {
  test('удержание → запись → отпустил → разбор → ответ', () => {
    const r = run(st('idle'), [pressHold, { type: 'micReady' }, release(2400), { type: 'answer' }]);
    assert.deepEqual(r.phases, ['arming', 'recording', 'processing', 'result']);
    assert.deepEqual(r.commands, ['start', 'none', 'stop', 'none']);
    assert.equal(r.s.mode, 'hold');
  });

  test('увёл палец за порог — отмена, без разбора', () => {
    const r = run(st('idle'), [pressHold, { type: 'micReady' }, release(3000, true)]);
    assert.deepEqual(r.phases, ['arming', 'recording', 'idle']);
    assert.equal(r.commands[2], 'cancel');
  });

  test('короткое касание — не запись', () => {
    const r = run(st('idle'), [pressHold, { type: 'micReady' }, release(MIN_HOLD_MS - 1)]);
    assert.deepEqual(r.phases, ['arming', 'recording', 'idle']);
    assert.equal(r.commands[2], 'cancel');
    assert.equal(recStep(st('recording', 'hold'), release(MIN_HOLD_MS)).command, 'stop');
  });

  test('отпустил, пока микрофон включается, — отмена', () => {
    const r = run(st('idle'), [pressHold, release(200)]);
    assert.deepEqual(r.phases, ['arming', 'idle']);
    assert.deepEqual(r.commands, ['start', 'cancel']);
  });

  test('автостоп по 10 с: палец ещё на кнопке, отпускание ничего не делает', () => {
    const r = run(st('recording', 'hold'), [{ type: 'done' }, release(12_000), release(12_000, true)]);
    assert.deepEqual(r.phases, ['processing', 'processing', 'processing']);
    assert.deepEqual(r.commands, ['stop', 'none', 'none']);
  });

  test('без кнопок ИЗМЕНИТЬ / СОХРАНИТЬ: во время записи кнопок нет, при разборе — только ОТМЕНА', () => {
    assert.deepEqual(recButtons(st('recording', 'hold')), []);
    assert.deepEqual(recButtons(st('processing', 'hold')), ['cancel']);
  });
});

describe('recStep — запись нажатием (tap)', () => {
  test('REC → запись → ГОТОВО → разбор → ответ', () => {
    const r = run(st('idle'), [pressTap, { type: 'micReady' }, { type: 'done' }, { type: 'answer' }]);
    assert.deepEqual(r.phases, ['arming', 'recording', 'processing', 'result']);
    assert.deepEqual(r.commands, ['start', 'none', 'stop', 'none']);
  });

  test('REC ещё раз во время записи = ГОТОВО', () => {
    assert.deepEqual(recStep(st('recording'), pressTap), { state: st('processing'), command: 'stop' });
    // В режиме «удерживать» REC поверх записи, начатой ЗАПИСАТЬ, — тоже ГОТОВО; отпускание потом ничего не делает
    const r = run(st('recording', 'tap'), [pressHold, release(5000)]);
    assert.deepEqual(r.commands, ['stop', 'none']);
  });

  test('отпускание пальца не заканчивает запись нажатием', () => {
    assert.equal(recStep(st('recording', 'tap'), release(5000)).command, 'none');
    assert.equal(recStep(st('recording', 'tap'), release(5000, true)).command, 'none');
  });

  test('ОТМЕНА во время записи — стереть; при разборе — не показывать ответ', () => {
    assert.deepEqual(recStep(st('recording'), { type: 'cancel' }), { state: st('idle'), command: 'cancel' });
    assert.deepEqual(recStep(st('arming'), { type: 'cancel' }), { state: st('idle'), command: 'cancel' });
    assert.deepEqual(recStep(st('processing'), { type: 'cancel' }), { state: st('idle'), command: 'drop' });
    // Ответ после ОТМЕНЫ: фаза уже idle — окно не открывается
    assert.equal(recStep(st('idle'), { type: 'answer' }).state.phase, 'idle');
  });

  test('кнопки: запись — ОТМЕНА и ГОТОВО, разбор — только ОТМЕНА, остальное — без кнопок записи', () => {
    assert.deepEqual(recButtons(st('recording')), ['cancel', 'done']);
    assert.deepEqual(recButtons(st('processing')), ['cancel']);
    for (const p of ['idle', 'prompt', 'arming', 'result'] as const) assert.deepEqual(recButtons(st(p)), []);
  });
});

describe('recStep — общее', () => {
  test('повторное нажатие, пока микрофон включается или идёт разбор, вторую запись не начинает', () => {
    for (const p of ['arming', 'processing'] as const) {
      assert.equal(recStep(st(p), pressTap).command, 'none');
      assert.equal(recStep(st(p, 'hold'), pressHold).command, 'none');
    }
  });

  test('ссылка kstatiapp://record только спрашивает; ЗАПИСАТЬ — запись нажатием', () => {
    const r = run(st('idle'), [{ type: 'link' }, pressTap, { type: 'micReady' }]);
    assert.deepEqual(r.phases, ['prompt', 'arming', 'recording']);
    assert.deepEqual(r.commands, ['none', 'start', 'none']);
    assert.equal(r.s.mode, 'tap');
    assert.deepEqual(recStep(st('prompt'), { type: 'cancel' }), { state: st('idle'), command: 'close' });
    // Во время записи ссылка ничего не меняет
    assert.equal(recStep(st('recording'), { type: 'link' }).state.phase, 'recording');
  });

  test('микрофон не включился — окно ошибки; ОТМЕНА его закрывает; ЕЩЁ РАЗ — новая запись', () => {
    const r = run(st('idle'), [pressTap, { type: 'micFailed' }]);
    assert.deepEqual(r.phases, ['arming', 'result']);
    assert.equal(recStep(r.s, { type: 'cancel' }).command, 'close');
    assert.deepEqual(recStep(r.s, pressTap), { state: st('arming'), command: 'start' });
  });

  test('ГОТОВО и отмена вне записи ничего не делают', () => {
    assert.equal(recStep(st('idle'), { type: 'done' }).command, 'none');
    assert.equal(recStep(st('idle'), { type: 'cancel' }).command, 'none');
    assert.equal(recStep(st('processing'), { type: 'done' }).command, 'none');
  });
});

describe('жест отмены', () => {
  test('порог влево или вверх', () => {
    assert.equal(cancelDrag(-CANCEL_DRAG + 1, 0), false);
    assert.equal(cancelDrag(-CANCEL_DRAG, 0), true);
    assert.equal(cancelDrag(0, -CANCEL_DRAG), true);
    assert.equal(cancelDrag(-50, -50), false);
    // Вправо и вниз — никогда
    assert.equal(cancelDrag(300, 300), false);
  });

  test('прогресс 0…1 по большему из сдвигов влево / вверх', () => {
    assert.equal(dragProgress(0, 0), 0);
    assert.equal(dragProgress(40, 60), 0);
    assert.equal(dragProgress(-CANCEL_DRAG / 2, 0), 0.5);
    assert.equal(dragProgress(-10, -CANCEL_DRAG / 4), 0.25);
    assert.equal(dragProgress(-500, 0), 1);
  });
});
