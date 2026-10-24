/**
 * Данные раскрытых строк окна дела / плана: календарь с колесом («КОГДА», «ПЕРИОД», конец),
 * повтор, напоминания, участники. Колбэки панелей добавляет контейнер.
 */
import { PERSONAL } from '@/lib/visibility';
import { weekdayOf } from '@/lib/recur';
import { effectiveSpecs, specLabel } from '@/lib/remind';
import { lastDay } from '@/lib/span';
import type { ID, PersonColor, ReminderSettings, ReminderSpec } from '@/lib/types';
import type { TimeValue } from '@/screens/editors/components/TimeWheel';
import type { DatePickerProps } from '@/screens/editors/panels/DatePanel';
import type { PeriodPanelProps } from '@/screens/editors/panels/PeriodPanel';
import type { ReminderPreset, RemindPanelProps, RemindScope } from '@/screens/editors/panels/RemindPanel';
import type { RepeatPanelProps } from '@/screens/editors/panels/RepeatPanel';
import type { WhoMember, WhoPanelProps } from '@/screens/editors/panels/WhoPanel';
import type { Clock, DataOf, Snapshot } from '../snapshot';
import { busyFor } from '../common/busy';
import { colorOf, letterOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { whenLabel } from '../common/when';
import { DEFAULT_TIME, draftPeople, repeatEndOf, repeatPresetOf, type Cursor, type EditorDraft, type EditorUi } from './draft';
import { applicable, busyWord, freeWord, orderSpecs, remindLabel, remindWhen, untilLabel } from './labels';

export const timeValue = (hhmm: string): TimeValue => ({ hour: Number(hhmm.slice(0, 2)), minute: Number(hhmm.slice(3, 5)) });
const pad2 = (n: number) => String(n).padStart(2, '0');
export const timeText = (t: TimeValue) => `${pad2(t.hour)}:${pad2(t.minute)}`;

/** «КОГДА»: месяц или год, выбранный день, колесо (шаг 5 минут — по умолчанию у колеса) */
export function whenPanel(d: EditorDraft, ui: Pick<EditorUi, 'dateView' | 'cursor'>, clock: Pick<Clock, 'today'>): DataOf<DatePickerProps> {
  return {
    view: ui.dateView,
    year: ui.cursor.year,
    month: ui.cursor.month,
    today: clock.today,
    selected: d.date,
    time: timeValue(d.time ?? d.lastTime),
    noTime: d.time === null,
  };
}

/** Окно конца дела: день конца (многодневное — диапазон цветом первого участника) и время конца */
export function endPanel(
  d: EditorDraft,
  view: { dateView: EditorUi['dateView']; cursor: Cursor },
  clock: Pick<Clock, 'today'>,
  color: PersonColor,
): DataOf<DatePickerProps> {
  const date = d.date ?? clock.today;
  const end = d.endDate ?? date;
  return {
    view: view.dateView,
    year: view.cursor.year,
    month: view.cursor.month,
    today: clock.today,
    ...(end > date ? { range: { start: date, end, color } } : { selected: end }),
    time: timeValue(d.endTime ?? d.lastEndTime ?? d.time ?? DEFAULT_TIME),
    noTime: d.endTime === null,
  };
}

/** «ПОВТОР»: пресет, «каждые N», дни недели, окончание */
export function repeatPanel(d: EditorDraft, ui: Pick<EditorUi, 'repeatCustom'>, clock: Pick<Clock, 'today'>): DataOf<RepeatPanelProps> {
  const date = d.date ?? clock.today;
  const r = d.repeat;
  const preset = ui.repeatCustom && r ? 'custom' : repeatPresetOf(r, d.date);
  if (!r) return { preset, every: 1, unit: 'week', weekdays: [weekdayOf(date)], end: 'never' };
  const end = repeatEndOf(r);
  return {
    preset,
    every: Math.max(1, r.every || 1),
    unit: r.freq,
    weekdays: r.weekdays?.length ? r.weekdays : [weekdayOf(date)],
    end,
    ...(end === 'until' && r.until ? { untilLabel: untilLabel(r.until) } : {}),
    ...(end === 'count' && r.count ? { count: r.count } : {}),
  };
}

/** Пресеты C-EditRemind: за 15 / 30 мин, за 1 ч, утром в 9, накануне в 20, за 2 дня в 18 */
export const REMIND_PRESETS: readonly ReminderSpec[] = ['m15', 'm30', 'm60', 'd0@09:00', 'd1@20:00', 'd2@18:00'];
/** Больше пяти напоминаний на дело не ставим (как в старом окне) */
export const MAX_REMINDERS = 5;

/** Напоминания, которые действуют для меня: личные → общие → мои по умолчанию */
export const mySpecs = (d: Pick<EditorDraft, 'time' | 'mine' | 'shared'>, settings: ReminderSettings): ReminderSpec[] =>
  effectiveSpecs({ time: d.time, reminders: d.shared }, d.mine, settings).specs;

/** Список в панели: «для меня» — что сработает у меня; «для всех» — общие напоминания группы */
export function remindList(d: EditorDraft, scope: RemindScope, settings: ReminderSettings): ReminderSpec[] {
  return orderSpecs(scope === 'me' ? mySpecs(d, settings) : (d.shared ?? []));
}

/** Список после «+ пресет» или «×» — новый порядок, не больше MAX_REMINDERS */
export function withSpec(list: readonly ReminderSpec[], spec: ReminderSpec): ReminderSpec[] {
  return orderSpecs([...list, spec]).slice(0, MAX_REMINDERS);
}
export const withoutSpec = (list: readonly ReminderSpec[], spec: ReminderSpec) => list.filter((s) => s !== spec);

/** «НАПОМНИТЬ»: для меня / для всех, список с точным временем, пресеты (уже добавленные и неприменимые — бледные) */
export function remindPanel(d: EditorDraft, ui: Pick<EditorUi, 'remindScope'>, settings: ReminderSettings): DataOf<RemindPanelProps> {
  const list = remindList(d, ui.remindScope, settings);
  const full = list.length >= MAX_REMINDERS;
  const presets: ReminderPreset[] = REMIND_PRESETS.map((key) => {
    const used = full || list.includes(key) || !applicable(key, d.time);
    return used ? { key, label: remindLabel(key), used } : { key, label: remindLabel(key) };
  });
  return {
    scope: ui.remindScope,
    reminders: list.map((spec) => ({ id: spec, rule: specLabel(spec), when: remindWhen(spec, d.date, d.time) })),
    presets,
  };
}

/** Участники группы черновика: я первым, потом по порядку вступления */
export function memberIds(s: Pick<Snapshot, 'me' | 'groups'>, groupId: ID | null): ID[] {
  // Личное дело — люди всех моих групп
  const ids = groupId === PERSONAL ? [...new Set(s.groups.flatMap((g) => g.memberIds))] : (s.groups.find((g) => g.id === groupId)?.memberIds ?? []);
  return [s.me.id, ...ids.filter((id) => id !== s.me.id)];
}

/** «КТО»: все в группе / выбрать; у каждого — свободен или «ЗАНЯТА 19:00–20:00 · ЙОГА» в это время */
export function whoPanel(d: EditorDraft, ui: Pick<EditorUi, 'whoMode'>, s: Snapshot, colors: ColorMap): DataOf<WhoPanelProps> {
  const chosen = new Set(draftPeople(d));
  const members = memberIds(s, d.groupId).flatMap((id): WhoMember[] => {
    const user = userOf(s, id);
    if (!user) return [];
    const [busy] = busyFor(s, d, [id], d.id);
    const base = {
      id,
      letter: letterOf(user),
      name: id === s.me.id ? `${user.name} (вы)` : user.name,
      color: colorOf(colors, id),
      selected: chosen.has(id),
    };
    return [
      busy
        ? { ...base, meta: `${busyWord(user.gender)} ${busy.range} · ${upper(busy.title)}`, busy: true }
        : { ...base, meta: freeWord(user.gender) },
    ];
  });
  return { mode: ui.whoMode, members };
}

/** «ПЕРИОД» плана: какой край правим, подписи краёв, календарь с диапазоном цветом плана, колесо края */
export function periodPanel(
  d: EditorDraft,
  ui: Pick<EditorUi, 'edge' | 'dateView' | 'cursor' | 'endFlash'>,
  clock: Pick<Clock, 'today'>,
  color: PersonColor,
): DataOf<PeriodPanelProps> {
  const start = d.date ?? clock.today;
  const endDate = d.endDate ?? start;
  const end = d.date ? (lastDay(d) ?? start) : start;
  const time = ui.edge === 'start' ? d.time : d.endTime;
  const wheel = ui.edge === 'start' ? (d.time ?? d.lastTime) : (d.endTime ?? d.lastEndTime ?? d.time ?? DEFAULT_TIME);
  return {
    edge: ui.edge,
    startLabel: whenLabel(d.date, d.time),
    endLabel: whenLabel(d.date ? endDate : null, d.endTime),
    ...(ui.endFlash !== undefined ? { endFlash: ui.endFlash } : {}),
    view: ui.dateView,
    year: ui.cursor.year,
    month: ui.cursor.month,
    today: clock.today,
    range: { start, end: end < start ? start : end, color },
    time: timeValue(wheel),
    noTime: time === null,
  };
}
