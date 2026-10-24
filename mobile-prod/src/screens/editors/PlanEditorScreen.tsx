/**
 * Окно плана — дела с подзадачами (C-EditPlan, C-EditPeriod, C-EditYear). Презентационное, как TaskEditorScreen.
 *
 * Строки: ПЕРИОД, ПОВТОР, КТО, НАПОМНИТЬ, ОПИСАНИЕ, ПОДЗАДАЧИ (сводкой). Под полями — список подзадач
 * с «ПЛАН СЕТКОЙ ›» или плашка «ВНЕ ПЕРИОДА». Что показывать, решает вызывающий: в макетах при раскрытом
 * периоде описание и список подзадач свёрнуты в сводку, чтобы всё помещалось над кнопками.
 */
import { memo, useCallback, useMemo, type RefObject } from 'react';
import type { TextInput } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { useTheme } from '@/ui';
import { LinkButton } from './components/Buttons';
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
import { SubtaskBox, type SubtaskItem } from './components/SubtaskBox';
import { PeriodPanel, type PeriodPanelProps } from './panels/PeriodPanel';
import { RemindPanel, type RemindPanelProps } from './panels/RemindPanel';
import { RepeatPanel, type RepeatPanelProps } from './panels/RepeatPanel';
import { VisiblePanel, type VisiblePanelProps } from './panels/VisiblePanel';
import { WhoPanel, type WhoPanelProps } from './panels/WhoPanel';
import type { EditorPersonRef } from './TaskEditorScreen';

export type PlanField = 'period' | 'repeat' | 'who' | 'visible' | 'remind' | 'note' | 'subtasks';

export type PlanEditorScreenProps = {
  /** «ПЛАН · МЫ С КАРИНОЙ» */
  caption: string;
  title: string;
  colors: readonly PersonColor[];
  /** «СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00» */
  period: string;
  repeat: string | null;
  people: readonly EditorPersonRef[];
  remind: string | null;
  /** undefined — строки нет; null — «+ ОПИСАНИЕ» */
  note?: string | null;
  /** Сводка «05 · 1 СДЕЛАНО»; undefined — строки нет */
  subtaskSummary?: string;
  /** Список подзадач под полями (с «ПЛАН СЕТКОЙ»); undefined — списка нет */
  subtasks?: readonly SubtaskItem[];
  /** Цвет плана: полоса подзадач, прогресс */
  color: PersonColor;
  notice?: EditorNotice | null;

  expanded: PlanField | null;
  periodPanel?: PeriodPanelProps;
  repeatPanel?: RepeatPanelProps;
  remindPanel?: RemindPanelProps;
  whoPanel?: WhoPanelProps;
  /** «ДРУЗЬЯ, СЕМЬЯ» — кому видно; null — «ТОЛЬКО Я»; undefined — строки нет (чужой план) */
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
  onField?: (field: PlanField) => void;
  onToggleSubtask?: (id: ID, done: boolean) => void;
  onOpenSubtask?: (id: ID) => void;
  onAddSubtask?: () => void;
  /** «ПЛАН СЕТКОЙ» — C-Plan */
  onOpenGrid?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
};

export const PlanEditorScreen = memo(function PlanEditorScreen(props: PlanEditorScreenProps) {
  const { expanded, onField, people, colors } = props;
  const { person } = useTheme();
  const tap = useCallback((field: PlanField) => (onField ? () => onField(field) : undefined), [onField]);
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
        <FieldRow label="ПЕРИОД" first expanded={expanded === 'period'} onPress={tap('period')}>
          <FieldValue text={props.period} />
        </FieldRow>
        {expanded === 'period' && props.periodPanel ? (
          <ExpandedPanel>
            <PeriodPanel {...props.periodPanel} />
          </ExpandedPanel>
        ) : null}

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

        {props.note !== undefined && props.onChangeNote ? (
          <FieldInputRow
            label="ОПИСАНИЕ"
            value={props.note}
            empty="+ ОПИСАНИЕ"
            maxLength={NOTE_MAX}
            inputRef={props.noteRef}
            onChangeText={props.onChangeNote}
          />
        ) : props.note !== undefined ? (
          <FieldRow label="ОПИСАНИЕ" onPress={tap('note')}>
            {props.note ? <FieldDescription text={props.note} /> : <FieldValue text="+ ОПИСАНИЕ" muted />}
          </FieldRow>
        ) : null}

        {props.subtaskSummary !== undefined ? (
          <FieldRow label="ПОДЗАДАЧИ" onPress={tap('subtasks')}>
            <FieldValue text={props.subtaskSummary} />
          </FieldRow>
        ) : null}
      </FieldTable>

      {props.subtasks ? (
        <>
          <SubtaskBox
            items={props.subtasks}
            color={person(props.color)}
            onToggle={props.onToggleSubtask}
            onOpen={props.onOpenSubtask}
            onAdd={props.onAddSubtask}
          />
          <LinkButton label="ПЛАН СЕТКОЙ" variant="action" onPress={props.onOpenGrid} />
        </>
      ) : null}
      {props.notice ? <Notice {...props.notice} /> : null}
    </EditorScaffold>
  );
});
