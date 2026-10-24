/**
 * Запись голосовой команды — чистый автомат без react и хранилища: что делают REC (нажать / удерживать),
 * отпускание пальца, жест отмены, ОТМЕНА / ГОТОВО, и какие кнопки у окна записи.
 * lib/voice.ts собирает состояние из хранилища, вызывает recStep и выполняет команду.
 *
 *   idle ─ссылка→ prompt ─ЗАПИСАТЬ→ arming ─микрофон включился→ recording ─ГОТОВО / отпустил→ processing ─ответ→ result
 *   arming, recording ─ОТМЕНА / жест / короткое касание→ idle;  processing ─ОТМЕНА→ idle (опоздавший ответ не показываем)
 */
import type { RecordingMode } from '@/screens/voice/types';

export type RecMode = RecordingMode;

/**
 * prompt — окно «Записать команду?» (ссылка kstatiapp://record, микрофон не включён);
 * arming — микрофон включается; result — открыто окно ответа или ошибки
 */
export type RecPhase = 'idle' | 'prompt' | 'arming' | 'recording' | 'processing' | 'result';

/** mode — как начата текущая запись: пальцем на REC (hold) или нажатием (tap) */
export type RecState = { phase: RecPhase; mode: RecMode };

export type RecEvent =
  /** Ссылка kstatiapp://record */
  | { type: 'link' }
  /** Палец лёг на REC (hold) или нажатие REC (tap) */
  | { type: 'press'; mode: RecMode }
  /** Палец отпущен; cancelled — увёл его жестом отмены */
  | { type: 'release'; heldMs: number; cancelled: boolean }
  | { type: 'micReady' }
  | { type: 'micFailed' }
  /** ГОТОВО (или REC ещё раз) */
  | { type: 'done' }
  /** ОТМЕНА, затемнение, Android «назад» */
  | { type: 'cancel' }
  | { type: 'answer' };

/**
 * start — включить микрофон; stop — закончить и отправить; cancel — выключить и стереть запись;
 * drop — не показывать ответ разбора; close — закрыть окно (ссылки или ответа)
 */
export type RecCommand = 'none' | 'start' | 'stop' | 'cancel' | 'drop' | 'close';

export type RecStep = { state: RecState; command: RecCommand };

/** Короче — случайное касание, а не запись: отменяем молча */
export const MIN_HOLD_MS = 700;
/** На сколько увести палец влево (или вверх), чтобы отменить запись */
export const CANCEL_DRAG = 80;

const to = (s: RecState, phase: RecPhase, command: RecCommand = 'none', mode = s.mode): RecStep => ({
  state: { phase, mode },
  command,
});
const stay = (s: RecState): RecStep => ({ state: s, command: 'none' });

export function recStep(s: RecState, e: RecEvent): RecStep {
  const { phase } = s;
  switch (e.type) {
    case 'link':
      // Ссылка микрофон не включает: только окно с ЗАПИСАТЬ (иначе запись мог бы начать любой сайт)
      return phase === 'idle' || phase === 'result' ? to(s, 'prompt') : stay(s);
    case 'press':
      if (phase === 'idle' || phase === 'prompt' || phase === 'result') return to(s, 'arming', 'start', e.mode);
      // REC во время записи — ГОТОВО (в любом режиме); пока микрофон включается — вторая запись не начинается
      if (phase === 'recording') return to(s, 'processing', 'stop');
      return stay(s);
    case 'release':
      // Отпускание важно только для записи пальцем: начатую нажатием заканчивают ГОТОВО
      if (s.mode !== 'hold') return stay(s);
      if (phase === 'arming') return to(s, 'idle', 'cancel');
      if (phase !== 'recording') return stay(s);
      return e.cancelled || e.heldMs < MIN_HOLD_MS ? to(s, 'idle', 'cancel') : to(s, 'processing', 'stop');
    case 'micReady':
      return phase === 'arming' ? to(s, 'recording') : stay(s);
    case 'micFailed':
      return phase === 'arming' ? to(s, 'result') : stay(s);
    case 'done':
      return phase === 'recording' ? to(s, 'processing', 'stop') : stay(s);
    case 'cancel':
      if (phase === 'arming' || phase === 'recording') return to(s, 'idle', 'cancel');
      if (phase === 'processing') return to(s, 'idle', 'drop');
      if (phase === 'prompt' || phase === 'result') return to(s, 'idle', 'close');
      return stay(s);
    case 'answer':
      return phase === 'processing' ? to(s, 'result') : stay(s);
  }
}

/** Кнопки окна записи */
export type RecButton = 'cancel' | 'done';

const NO_BUTTONS: readonly RecButton[] = [];
const TAP_BUTTONS: readonly RecButton[] = ['cancel', 'done'];
const CANCEL_ONLY: readonly RecButton[] = ['cancel'];

/**
 * Запись пальцем — без кнопок (отмена жестом, конец — отпустить); нажатием — ОТМЕНА и ГОТОВО;
 * разбор — только ОТМЕНА. ИЗМЕНИТЬ / СОХРАНИТЬ появляются только в окне ответа
 */
export function recButtons(s: RecState): readonly RecButton[] {
  if (s.phase === 'recording') return s.mode === 'hold' ? NO_BUTTONS : TAP_BUTTONS;
  if (s.phase === 'processing') return CANCEL_ONLY;
  return NO_BUTTONS;
}

/** Палец увели влево или вверх на CANCEL_DRAG и дальше (сдвиг от точки касания, px) */
export function cancelDrag(dx: number, dy: number): boolean {
  'worklet';
  return dx <= -CANCEL_DRAG || dy <= -CANCEL_DRAG;
}

/** Насколько палец близок к отмене: 0 — на месте (или ушёл вправо / вниз), 1 — порог */
export function dragProgress(dx: number, dy: number): number {
  'worklet';
  return Math.min(1, Math.max(0, -dx, -dy) / CANCEL_DRAG);
}
