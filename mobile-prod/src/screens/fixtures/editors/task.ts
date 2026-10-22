/**
 * Данные макетов окна дела: C-EditDate, C-EditRepeat, C-EditRemind, C-EditWho (design/mockups/*.dc.html).
 * Октябрь 2026, сегодня — пн 5 октября.
 */
import type { TaskEditorScreenProps } from '../../editors/TaskEditorScreen';

const TODAY = '2026-10-05';

const sanya = { id: 'sanya', name: 'САНЯ', color: 'blue' } as const;
const karina = { id: 'karina', name: 'КАРИНА', color: 'pink' } as const;

/** «Ужин у родителей» — общее дело Сани и Карины */
const dinner: TaskEditorScreenProps = {
  caption: 'ДЕЛО · МЫ С КАРИНОЙ',
  title: 'Ужин у родителей',
  colors: ['blue', 'pink'],
  when: 'СБ 10 ОКТ · 19:00',
  end: null,
  repeat: null,
  people: [sanya, karina],
  remind: 'ЗА 2 Ч · НАКАНУНЕ В 20:00',
  note: 'Взять торт из «Север-Метрополь»',
  subtasks: null,
  notice: { label: 'КАРИНА ЗАНЯТА', text: 'Йога · 19:00–20:00', tone: 'red' },
  expanded: null,
};

export function editDateFixture(): TaskEditorScreenProps {
  return {
    ...dinner,
    expanded: 'when',
    whenPanel: {
      view: 'month',
      year: 2026,
      month: 9,
      today: TODAY,
      selected: '2026-10-10',
      time: { hour: 19, minute: 0 },
      noTime: false,
    },
  };
}

export function editRepeatFixture(): TaskEditorScreenProps {
  return {
    caption: 'ДЕЛО · МЫ С КАРИНОЙ',
    title: 'Йога',
    colors: ['pink'],
    when: 'СБ 10 ОКТ · 10:00',
    end: '11:30',
    repeat: 'КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК',
    people: [karina],
    remind: 'ЗА 1 Ч',
    note: 'Коврик и вода',
    expanded: 'repeat',
    repeatPanel: {
      preset: 'custom',
      every: 1,
      unit: 'week',
      weekdays: [6],
      end: 'until',
      untilLabel: '31 ДЕК 2026',
    },
  };
}

export function editRemindFixture(): TaskEditorScreenProps {
  return {
    ...dinner,
    subtasks: undefined,
    notice: null,
    expanded: 'remind',
    remindPanel: {
      scope: 'me',
      reminders: [
        { id: 'r1', rule: 'За 2 ч до начала', when: 'СБ 10 ОКТ, 17:00' },
        { id: 'r2', rule: 'Накануне в 20:00', when: 'ПТ 9 ОКТ, 20:00' },
      ],
      presets: [
        { key: 'm15', label: 'ЗА 15 МИН' },
        { key: 'm30', label: 'ЗА 30 МИН' },
        { key: 'm60', label: 'ЗА 1 Ч' },
        { key: 'd0@09:00', label: 'УТРОМ В 9:00' },
        { key: 'd1@20:00', label: 'НАКАНУНЕ В 20:00', used: true },
        { key: 'd2@18:00', label: 'ЗА 2 ДНЯ В 18:00' },
      ],
    },
  };
}

export function editWhoFixture(): TaskEditorScreenProps {
  return {
    ...dinner,
    expanded: 'who',
    whoPanel: {
      mode: 'pick',
      members: [
        { id: 'sanya', letter: 'С', name: 'Саня (вы)', meta: 'СВОБОДЕН', color: 'blue', selected: true },
        { id: 'karina', letter: 'К', name: 'Карина', meta: 'ЗАНЯТА 19:00–20:00 · ЙОГА', busy: true, color: 'pink', selected: true },
      ],
    },
  };
}
