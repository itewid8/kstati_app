/**
 * Окно дела (C-EditDate, C-EditRepeat, C-EditRemind, C-EditWho). Презентационное: все значения уже
 * подписаны вызывающим («СБ 10 ОКТ · 19:00»), раскрытая строка и данные её панели приходят пропсами,
 * действия уходят колбэками. Раскрыта не больше одной строки.
 *
 * Строки: КОГДА, КОНЕЦ, ПОВТОР, КТО, ВИДНО (своё дело), НАПОМНИТЬ, ОПИСАНИЕ, ПОДЗАДАЧИ. Строку подзадач вызывающий
 * не передаёт у повторяющегося дела (subtasks undefined) — у серии нет плана.
 */
import { memo, useCallback, useMemo, type RefObject } from 'react';
import type { TextInput } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { useTheme } from '@/ui';
import { EditorScaffold, Notice, type EditorInsets, type EditorNotice } from './components/EditorScaffold';
import {
  ExpandedPanel,
  FieldDescription,
  FieldInputRow,
  FieldPeople,
  FieldRow,
  FieldTable,
  FieldValue,
  type EditorPerson,
} from './components/FieldTable';
import { NOTE_MAX } from './components/limits';
import { DatePicker, type DatePickerProps } from './panels/DatePanel';
import { RemindPanel, type RemindPanelProps } from './panels/RemindPanel';
import { RepeatPanel, type RepeatPanelProps } from './panels/RepeatPanel';
import { VisiblePanel, type VisiblePanelProps } from './panels/VisiblePanel';
import { WhoPanel, type WhoPanelProps } from './panels/WhoPanel';

export type TaskField = 'when' | 'end' | 'repeat' | 'who' | 'visible' | 'remind' | 'note' | 'subtasks';

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
  /** «ДРУЗЬЯ, СЕМЬЯ» — кому видно; null — «ТОЛЬКО Я»; undefined — строки нет (чужое дело: видимость меняет владелец) */
  visible?: string | null;
  visiblePanel?: VisiblePanelProps;

  /** «СОХРАНИТЬ» недоступна: нет названия */
  saveDisabled?: boolean;
  /** Поля названия и описания — фокус снаружи (назвать дело перед «Сделать планом», открыть план сразу на описании) */
  titleRef?: RefObject<TextInput | null>;
  noteRef?: RefObject<TextInput | null>;

  insets?: EditorInsets;
  onBack?: () => void;
  onMore?: () => void;
  /** Название правится прямо в заголовке (без колбэка заголовок только текст) */
  onChangeTitle?: (title: string) => void;
  /** Описание правится прямо в строке «ОПИСАНИЕ» (без колбэка строка открывает onField('note')) */
  onChangeNote?: (note: string) => void;
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
      saveDisabled={props.saveDisabled}
      titleRef={props.titleRef}
      onBack={props.onBack}
      onMore={props.onMore}
      onChangeTitle={props.onChangeTitle}
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

        {props.visible !== undefined ? (
          <FieldRow label="ВИДНО" expanded={expanded === 'visible'} onPress={tap('visible')}>
            <FieldValue text={props.visible ?? 'ТОЛЬКО Я'} muted={props.visible === null} />
          </FieldRow>
        ) : null}
        {expanded === 'visible' && props.visiblePanel ? (
          <ExpandedPanel>
            <VisiblePanel {...props.visiblePanel} />
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

        {props.onChangeNote ? (
          <FieldInputRow
            label="ОПИСАНИЕ"
            value={props.note}
            empty="+ ОПИСАНИЕ"
            maxLength={NOTE_MAX}
            inputRef={props.noteRef}
            onChangeText={props.onChangeNote}
          />
        ) : (
          <FieldRow label="ОПИСАНИЕ" onPress={tap('note')}>
            {props.note ? <FieldDescription text={props.note} /> : <FieldValue text="+ ОПИСАНИЕ" muted />}
          </FieldRow>
        )}

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
