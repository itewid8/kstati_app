/**
 * Карантин: операции, которые сервер окончательно отверг (ответ нашего сервера с кодом ошибки).
 * Они не теряются молча: хранятся на телефоне (последние 50) для разбора.
 * Отказ с кодом, который бывает временным (гонка: группу ещё не создали, участника ещё не добавили, права
 * только что поменялись), один раз повторяется после следующей удачной синхронизации (sync.ts → retryQuarantined).
 * Чистый модуль: без Expo и хранилища.
 */
import { opKey, type Op } from './ops';

/**
 * held     — ждёт повтора (временный код);
 * retrying — снова в очереди: принят сервером — запись уходит из карантина, отвергнут — done;
 * done     — больше не повторяем (постоянный код, уже повторяли или запись с тех пор изменили)
 */
export type QuarantineState = 'held' | 'retrying' | 'done';
export type Quarantined = { op: Op; code: string; at: string; state: QuarantineState };

export const QUARANTINE_MAX = 50;

/** Коды, которые бывают из-за гонки, а не из-за самой операции */
export const TRANSIENT_CODES: ReadonlySet<string> = new Set(['not_member', 'bad_member', 'forbidden', 'not_found']);

/** Что меняет операция: более новая операция с тем же ключом делает старую неактуальной */
export function supersedeKey(o: Op): string {
  const k = opKey(o);
  if (k) return k;
  switch (o.op) {
    case 'group.create':
      return `group.create:${o.group.id}`;
    case 'group.update':
      return `group.update:${o.id}:${o.name !== undefined ? 'n' : ''}${o.category !== undefined ? 'c' : ''}`;
    case 'group.join':
      return `group.join:${o.code}`;
    case 'group.leave':
      return `group.leave:${o.id}`;
    case 'group.admin':
      return `group.admin:${o.id}:${o.userId}`;
    case 'group.remove':
      return `group.remove:${o.id}:${o.userId}`;
    case 'profile':
      return `profile:${Object.keys(o).filter((f) => f !== 'op').sort().join(',')}`;
    case 'prefs':
      return 'prefs';
    default:
      return o.op;
  }
}

const same = (a: Op, b: Op) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Сервер отверг операцию. Повторную (retrying) не добавляем второй раз — она остаётся одной записью, done */
export function quarantineReject(list: readonly Quarantined[], op: Op, code: string, at: string): Quarantined[] {
  const i = list.findIndex((q) => q.state === 'retrying' && same(q.op, op));
  if (i >= 0) return list.map((q, j) => (j === i ? { op: q.op, code, at, state: 'done' } : q));
  const state: QuarantineState = TRANSIENT_CODES.has(code) ? 'held' : 'done';
  return [...list, { op, code, at, state }].slice(-QUARANTINE_MAX);
}

/** Сервер принял отправленное: повторённые операции выходят из карантина. Ничего не поменялось — та же ссылка */
export function quarantineAccept(list: readonly Quarantined[], sent: readonly Op[]): readonly Quarantined[] {
  if (!list.some((q) => q.state === 'retrying')) return list;
  const next = list.filter((q) => q.state !== 'retrying' || !sent.some((o) => same(o, q.op)));
  return next.length === list.length ? list : next;
}

/** В очередь встали новые правки: ожидающие повтора старые операции тех же записей больше не повторяем */
export function quarantineSupersede(list: readonly Quarantined[], fresh: readonly Op[]): readonly Quarantined[] {
  if (!list.some((q) => q.state !== 'done')) return list;
  const keys = new Set(fresh.map(supersedeKey));
  let changed = false;
  const next = list.map((q) => {
    if (q.state === 'done' || !keys.has(supersedeKey(q.op))) return q;
    changed = true;
    return { ...q, state: 'done' as const };
  });
  return changed ? next : list;
}

/**
 * Что повторить после удачной синхронизации: held-операции, по записям которых в очереди нет более новой правки.
 * Повторяются один раз: состояние retrying, при новом отказе — done
 */
export function quarantineTake(list: readonly Quarantined[], outbox: readonly Op[]): { list: readonly Quarantined[]; ops: Op[] } {
  if (!list.some((q) => q.state === 'held')) return { list, ops: [] };
  const pending = new Set(outbox.map(supersedeKey));
  const ops: Op[] = [];
  const next = list.map((q): Quarantined => {
    if (q.state !== 'held') return q;
    if (pending.has(supersedeKey(q.op))) return { ...q, state: 'done' };
    ops.push(q.op);
    return { ...q, state: 'retrying' };
  });
  return { list: next, ops };
}

/** Сохранённый карантин версии хранилища < 4 — просто список операций (без кода): только для разбора */
export function migrateQuarantine(raw: unknown): Quarantined[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Op => !!x && typeof x === 'object' && typeof (x as { op?: unknown }).op === 'string')
    .map((op) => ({ op, code: 'unknown', at: '', state: 'done' as const }));
}
