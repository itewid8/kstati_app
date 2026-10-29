/**
 * Данные макетов голосовых окон (design/mockups/C-Voice, C-AskDelete, C-AskMove, C-AskWeek, C-AskWeekend)
 * для стенда сверки и превью. Обе темы показывают одно и то же состояние.
 */
import type { PersonColor } from '@/lib/types';
import type {
  AgendaDay,
  AskAgendaSheetProps,
  AskDeleteSheetProps,
  AskMoveSheetProps,
  RecordingSheetProps,
  VoiceCreateSheetProps,
  VoicePerson,
  VoiceSheetHeader,
} from '../../voice';

/** Громкость по столбикам из макетов (40 штук) */
export const voiceLevels = [
  8, 12, 20, 34, 52, 44, 30, 60, 72, 56, 40, 64, 78, 66, 48, 30, 22, 38, 58, 70, 54, 36, 26, 44, 62, 50, 34, 20, 14, 26,
  40, 30, 18, 12, 8, 6, 6, 6, 6, 6,
] as const;

const sanya: VoicePerson = { id: 'sanya', name: 'САНЯ', color: 'blue' };
const karina: VoicePerson = { id: 'karina', name: 'КАРИНА', color: 'pink' };

/** C-Voice: идёт запись 4 секунды, записано 34 столбика из 40 */
export const voiceCreateFixture: VoiceCreateSheetProps = {
  duration: '00:04',
  levels: voiceLevels.slice(0, 34),
  recording: true,
  phrase: 'В субботу в семь ужин у родителей',
  fields: [
    { key: 'type', label: 'ТИП', kind: 'tag', value: 'ДЕЛО' },
    { key: 'title', label: 'ЧТО', kind: 'title', value: 'Ужин у родителей' },
    { key: 'when', label: 'КОГДА', kind: 'text', value: 'СБ 10 ОКТ · 19:00' },
    { key: 'who', label: 'КТО', kind: 'people', people: [sanya, karina] },
    { key: 'group', label: 'ГРУППА', kind: 'text', value: 'МЫ С КАРИНОЙ' },
    { key: 'remind', label: 'НАПОМНИТЬ', kind: 'text', value: 'ЗА 2 Ч' },
  ],
};

const done = (badge: string): VoiceSheetHeader => ({ duration: '00:03', levels: voiceLevels, badge });

export const askDeleteFixture: AskDeleteSheetProps = {
  header: done('УДАЛИТЬ'),
  phrase: 'Удали йогу в субботу',
  task: { id: 'yoga', title: 'Йога', tag: 'КАЖДУЮ НЕДЕЛЮ', meta: 'СБ 10 ОКТ · 10:00–11:30 · КАРИНА', colors: ['pink'] },
  onceLabel: 'ТОЛЬКО 10 ОКТ',
  scope: 'one',
};

export const askMoveFixture: AskMoveSheetProps = {
  header: done('ПЕРЕНЕСТИ'),
  phrase: 'Перенеси стоматолога на пятницу на два и добавь Карину',
  task: { id: 'dentist', title: 'Стоматолог', tag: 'КЛИНИКА НА МИРА', meta: 'ПН 05 ОКТ · 09:30–10:30 · САНЯ', colors: ['blue'] },
  changes: [
    { key: 'when', label: 'КОГДА', was: 'ПН 05 ОКТ · 09:30', now: 'ПТ 09 ОКТ · 14:00' },
    { key: 'who', label: 'КТО', was: 'САНЯ', now: 'САНЯ, КАРИНА' },
  ],
  conflicts: [
    { key: 'sanya', who: 'САНЯ ЗАНЯТ', what: 'Обед с Олегом · 14:00–16:30' },
    { key: 'karina', who: 'КАРИНА ЗАНЯТА', what: 'Поезд домой · 13:00–15:00' },
  ],
};

/* ---------- Ответы списком ---------- */

type Who = 's' | 'k' | 'sk';
type RowSpec = [time: string, title: string, who: Who, done?: boolean, multiDay?: boolean];
type DaySpec = [label: string, note: string, rows: RowSpec[], today?: boolean];

const COLORS: Record<Who, PersonColor[]> = { s: ['blue'], k: ['pink'], sk: ['blue', 'pink'] };
const NAMES: Record<Who, string> = { s: 'САНЯ', k: 'КАРИНА', sk: 'САНЯ, КАРИНА' };

const days = (specs: DaySpec[]): AgendaDay[] =>
  specs.map(([label, note, rows, today], d) => ({
    key: label,
    label,
    note: note || undefined,
    today,
    items: rows.map(([time, title, who, isDone, multiDay], i) => ({
      id: `${d}-${i}`,
      time,
      title,
      who: NAMES[who],
      colors: COLORS[who],
      done: isDone,
      multiDay,
    })),
  }));

export const askWeekFixture: AskAgendaSheetProps = {
  header: done('ПОКАЗАТЬ'),
  phrase: 'Что у нас на этой неделе?',
  title: '05—11 ОКТ · МЫ С КАРИНОЙ',
  count: '16 ДЕЛ',
  openLabel: 'ОТКРЫТЬ НЕДЕЛЮ',
  days: days([
    ['ПН 05 · СЕГОДНЯ', '', [['09:30', 'Стоматолог', 's'], ['19:00', 'Йога', 'k']], true],
    ['ВТ 06', '', [['16:00', 'МФЦ', 's'], ['19:00', 'Ужин с Леной', 'sk']]],
    ['СР 07', 'КОМАНДИРОВКА → ПТ', [['07:00', 'Поезд в Казань', 'k'], ['18:00', 'Футбол', 's', true]]],
    ['ЧТ 08', 'МАМА В ГОСТЯХ → СБ', [['09:00', 'Встреча с заказчиком', 'k'], ['10:15', 'Тренировка', 's']]],
    ['ПТ 09', '', [['13:00', 'Поезд домой', 'k'], ['14:00', 'Обед с Олегом', 's'], ['19:30', 'Кино', 'sk']]],
    ['СБ 10', 'ДАЧА', [['09:00', 'Полить грядки', 's'], ['13:00', 'Шашлыки', 'k'], ['17:00', 'Звонок маме', 's']]],
    ['ВС 11', '', [['11:00', 'Бранч у Ани', 'sk']]],
  ]),
};

export const askWeekendFixture: AskAgendaSheetProps = {
  header: done('ПОКАЗАТЬ'),
  phrase: 'Что я делаю на выходных?',
  title: 'СБ 10 — ВС 11 ОКТ · САНЯ',
  count: '5 ДЕЛ',
  openLabel: 'ОТКРЫТЬ ДЕНЬ',
  free: 'СБ 18:30 → · ВС ДО 11:00 · ВС 13:00 →',
  days: days([
    [
      'СБ 10',
      '',
      [
        ['ВЕСЬ', 'Дача', 'sk', false, true],
        ['ВЕСЬ', 'Мама в гостях', 'sk', false, true],
        ['09:00', 'Полить грядки', 's'],
        ['17:00', 'Звонок маме', 's'],
      ],
    ],
    ['ВС 11', '', [['11:00', 'Бранч у Ани', 'sk']]],
  ]),
};

/* ---------- Окно записи (без макетов: X-RecordHold, X-RecordTap, X-RecordWait) ---------- */

/** Палец на REC 3 секунды: шапка без кнопок, «‹ ОТМЕНА» на месте разделов */
export const recordHoldFixture: RecordingSheetProps = {
  header: { duration: '00:03', levels: voiceLevels.slice(0, 26), live: true },
  mode: 'hold',
  actions: [],
};

/** Запись нажатием: ОТМЕНА и ГОТОВО */
export const recordTapFixture: RecordingSheetProps = {
  header: { duration: '00:04', levels: voiceLevels.slice(0, 34), live: true },
  mode: 'tap',
  actions: [
    { key: 'cancel', label: 'ОТМЕНА' },
    { key: 'done', label: 'ГОТОВО', tone: 'primary' },
  ],
};

/** Разбор: записанная волна, только ОТМЕНА */
export const recordWaitFixture: RecordingSheetProps = {
  header: { duration: '00:04', levels: voiceLevels.slice(0, 34) },
  mode: 'tap',
  actions: [{ key: 'cancel', label: 'ОТМЕНА' }],
};
