/**
 * Экран «Расходы на ИИ» (прототип, отладка): итоги за период, столбики по дням, разбивка по источникам.
 * Данные — дни с сервера (GET /stats/spend), здесь только счёт и подписи.
 */
import type { SpendCommand, SpendDay, SpendPart } from '@/lib/api';

export type SpendBar = { day: string; label: string; kop: number; share: number; today: boolean };
export type SpendSourceRow = { key: string; label: string; value: string; meta: string };
/** id — оценить можно (команда запомнена сервером); rating — уже оценена */
export type SpendCommandRow = { key: string; text: string; meta: string; value: string; warn: boolean; id?: string; rating?: 'up' | 'down' };
export type SpendView = {
  total: string;
  totals: ReadonlyArray<{ value: string; label: string }>;
  bars: readonly SpendBar[];
  barsMax: string;
  sources: readonly SpendSourceRow[];
  todayLine: string;
  empty: boolean;
  recent: readonly SpendCommandRow[];
};

const PATH: Record<string, string> = { rules: 'без модели', compact: 'модель', fallback: 'модель ×2, повтор полным промптом', full: 'полный промпт' };
const SRC: Record<string, string> = { voice: 'голос на сервере', device: 'распознал телефон', text: 'текстом' };
const pad = (n: number) => String(n).padStart(2, '0');

/** Строка последней команды: фраза, когда · откуда · как разобрали · токены, цена. warn — был повтор (дорого) */
export function commandRow(c: SpendCommand, i: number): SpendCommandRow {
  const d = new Date(c.ts);
  const when = `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const how = c.path ? (PATH[c.path] ?? c.path) + (c.path === 'compact' && c.calls > 1 ? ', повтор: ответ не JSON' : '') : 'речь не распознана';
  const tokens = c.tokens ? ` · ${thousands(c.tokens)} ток.` : '';
  return {
    key: `${c.ts}-${i}`,
    text: c.text || '—',
    meta: `${when} · ${SRC[c.src] ?? c.src} · ${how}${tokens}`,
    value: rub(c.kop),
    warn: c.path === 'fallback' || c.calls > 1,
    ...(c.id && { id: c.id }),
    ...(c.rating && { rating: c.rating }),
  };
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const rub = (kop: number) => `${(kop / 100).toFixed(2).replace('.', ',')} ₽`;
export const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;
const sum = (rows: readonly SpendPart[]): SpendPart => rows.reduce((a, r) => ({ n: a.n + r.n, tokens: a.tokens + r.tokens, kop: a.kop + r.kop }), { n: 0, tokens: 0, kop: 0 });

const SOURCES = [
  { key: 'voice', label: 'Голос через сервер', hint: 'распознавание и модель' },
  { key: 'device', label: 'Распознал телефон', hint: 'только модель' },
  { key: 'text', label: 'Текстом', hint: '«разобрать заново»' },
] as const;

export function spendView(days: readonly SpendDay[], today: string, recent: readonly SpendCommand[] = []): SpendView {
  const t = sum(days);
  const max = Math.max(0, ...days.map((d) => d.kop));
  const rules = days.reduce((a, d) => a + d.rules, 0);
  const stt = days.reduce((a, d) => a + d.sttSec, 0);
  const todayRow = days.find((d) => d.day === today);
  const sources: SpendSourceRow[] = SOURCES.map((s) => {
    const p = sum(days.map((d) => d.src[s.key] ?? { n: 0, tokens: 0, kop: 0 }));
    return { key: s.key, label: s.label, value: rub(p.kop), meta: `${p.n} ${plural(p.n, 'команда', 'команды', 'команд')} · ${thousands(p.tokens)} ток. · ${s.hint}` };
  });
  sources.push({ key: 'rules', label: 'Без модели', value: '0,00 ₽', meta: `${rules} ${plural(rules, 'команда', 'команды', 'команд')} разобрали правила` });
  sources.push({ key: 'stt', label: 'Распознавание на сервере', value: `${Math.round(stt)} с`, meta: 'SpeechKit считает по 15 секунд' });
  return {
    total: rub(t.kop),
    totals: [
      { value: thousands(t.n), label: plural(t.n, 'команда', 'команды', 'команд') },
      { value: thousands(t.tokens), label: 'токенов' },
      { value: t.n ? rub(Math.round(t.kop / t.n)) : '—', label: 'за команду' },
    ],
    bars: days.map((d) => ({ day: d.day, label: dayLabel(d.day), kop: d.kop, share: max ? d.kop / max : 0, today: d.day === today })),
    barsMax: rub(max),
    sources,
    todayLine: todayRow ? `Сегодня: ${rub(todayRow.kop)} · ${todayRow.n} ${plural(todayRow.n, 'команда', 'команды', 'команд')}` : 'Сегодня: 0,00 ₽',
    empty: t.n === 0,
    recent: recent.map(commandRow),
  };
}
