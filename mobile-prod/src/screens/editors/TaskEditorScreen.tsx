/**
 * Окно дела (C-EditDate, C-EditRepeat, C-EditRemind, C-EditWho). Презентационное: все значения уже
 * подписаны вызывающим («СБ 10 ОКТ · 19:00»), раскрытая строка и данные её панели приходят пропсами,
 * действия уходят колбэками. Раскрыта не больше одной строки.
 *
 * Строки: КОГДА, КОНЕЦ, ПОВТОР, КТО, НАПОМНИТЬ, ОПИСАНИЕ, ПОДЗАДАЧИ. Строку подзадач вызывающий
 * не передаёт у повторяющегося дела (subtasks undefined) — у серии нет плана.
 */
import { memo, useCallback, useMemo } from 'react';
import type { PersonColor } from '@/lib/types';
import { useTheme } from '@/ui';
import { EditorScaffold, Notice, type EditorInsets, type EditorNotice } from './components/EditorScaffold';
import {
  ExpandedPanel,
  FieldDescription,
  FieldPeople,
  FieldRow,
  FieldTable,
  FieldValue,
  type EditorPerson,
} from './components/FieldTable';
import { DatePicker, type DatePickerProps } from './panels/DatePanel';
import { RemindPanel, type RemindPanelProps } from './panels/RemindPanel';
import { RepeatPanel, type RepeatPanelProps } from './panels/RepeatPanel';
import { WhoPanel, type WhoPanelProps } from './panels/WhoPanel';

export type TaskField = 'when' | 'end' | 'repeat' | 'who' | 'remind' | 'note' | 'subtasks';

/** Выбранный человек в строке «КТО» */
export type EditorPersonRef = {
  id: string;
  /** «САНЯ» */
  name: string;
  color: PersonColor;
};

export type TaskEditorScreenProps = {
  /** «ДЕЛО · МЫ С КАРИНОЙ» */
  caption: string;
  title: string;
  /** Цвета участников — полоса у заголовка */
  colors: readonly PersonColor[];
  /** «СБ 10 ОКТ · 19:00» */
  when: string;
  /** «11:30»; null — «+ КОНЕЦ» */
  end: string | null;
  /** «КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК»; null — «НЕ ПОВТОРЯЕТСЯ» */
  repeat: string | null;
  /** Выбранные участники */
  people: readonly EditorPersonRef[];
  /** «ЗА 2 Ч · НАКАНУНЕ В 20:00»; null — «НЕ НАПОМИНАТЬ» */
  remind: string | null;
  /** null — «+ ОПИСАНИЕ» */
  note: string | null;
  /** Сводка подзадач «05 · 1 СДЕЛАНО»; null — «+ ПЛАН»; undefined — строки нет */
  subtasks?: string | null;
  /** Плашка под полями: «КАРИНА ЗАНЯТА · Йога 19:00–20:00» */
  notice?: EditorNotice | null;

  /** Раскрытая строка */
  expanded: TaskField | null;
  /** Данные панелей — нужны только для раскрытой строки */
  whenPanel?: DatePickerProps;
  repeatPanel?: RepeatPanelProps;
  remindPanel?: RemindPanelProps;
  whoPanel?: WhoPanelProps;

  insets?: EditorInsets;
  onBack?: () => void;
  onMore?: () => void;
  /** Тап по заголовку — переименовать (необязательный: без него заголовок только текст) */
  onEditTitle?: () => void;
  /** Тап по строке: раскрыть/свернуть (или открыть отдельное окно — описание, подзадачи) */
  onField?: (field: TaskField) => void;
  onClearEnd?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
};

export const TaskEditorScreen = memo(function TaskEditorScreen(props: TaskEditorScreenProps) {
  const { expanded, onField, people, colors } = props;
  const { person } = useTheme();
  const tap = useCallback((field: TaskField) => (onField ? () => onField(field) : undefined), [onField]);
  const stripColors = useMemo(() => colors.map(person), [colors, person]);
  const tags = useMemo<EditorPerson[]>(() => people.map((p) => ({ id: p.id, name: p.name, color: person(p.color) })), [people, person]);

  return (
    <EditorScaffold
      caption={props.caption}
      title={props.title}
      colors={stripColors}
      insets={props.insets}
      onBack={props.onBack}
      onMore={props.onMore}
      onEditTitle={props.onEditTitle}
      onDelete={props.onDelete}
      onSave={props.onSave}
    >
      <FieldTable>
        <FieldRow label="КОГДА" first expanded={expanded === 'when'} onPress={tap('when')}>
          <FieldValue text={props.when} />
        </FieldRow>
        {expanded === 'when' && props.whenPanel ? (
          <ExpandedPanel>
            <DatePicker {...props.whenPanel} />
          </ExpandedPanel>
        ) : null}

        <FieldRow
          label="КОНЕЦ"
          expanded={expanded === 'end'}
          trailing={props.end ? 'clear' : 'none'}
          onClear={props.onClearEnd}
          onPress={tap('end')}
        >
          <FieldValue text={props.end ?? '+ КОНЕЦ'} muted={!props.end} />
        </FieldRow>

        <FieldRow label="ПОВТОР" expanded={expanded === 'repeat'} onPress={tap('repeat')}>
          <FieldValue text={props.repeat ?? 'НЕ ПОВТОРЯЕТСЯ'} muted={!props.repeat} />
        </FieldRow>
        {expanded === 'repeat' && props.repeatPanel ? (
          <ExpandedPanel>
            <RepeatPanel {...props.repeatPanel} />
          </ExpandedPanel>
        ) : null}

        <FieldRow label="КТО" expanded={expanded === 'who'} onPress={tap('who')}>
          <FieldPeople people={tags} />
        </FieldRow>
        {expanded === 'who' && props.whoPanel ? (
          <ExpandedPanel>
            <WhoPanel {...props.whoPanel} />
          </ExpandedPanel>
        ) : null}

        <FieldRow label="НАПОМНИТЬ" expanded={expanded === 'remind'} onPress={tap('remind')}>
          <FieldValue text={props.remind ?? 'НЕ НАПОМИНАТЬ'} muted={!props.remind} />
        </FieldRow>
        {expanded === 'remind' && props.remindPanel ? (
          <ExpandedPanel>
            <RemindPanel {...props.remindPanel} />
          </ExpandedPanel>
        ) : null}

        <FieldRow label="ОПИСАНИЕ" onPress={tap('note')}>
          {props.note ? <FieldDescription text={props.note} /> : <FieldValue text="+ ОПИСАНИЕ" muted />}
        </FieldRow>

        {props.subtasks !== undefined ? (
          <FieldRow label="ПОДЗАДАЧИ" onPress={tap('subtasks')}>
            <FieldValue text={props.subtasks ?? '+ ПЛАН'} muted={props.subtasks === null} />
          </FieldRow>
        ) : null}
      </FieldTable>
      {props.notice ? <Notice {...props.notice} /> : null}
    </EditorScaffold>
  );
});
