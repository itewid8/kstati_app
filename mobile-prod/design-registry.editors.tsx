// Реестр окон редактирования дела/плана для стенда сверки (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом (и через useColorScheme).
// Название и описание — поля ввода, как в приложении (правятся прямо в окне), поэтому колбэки правки переданы.
import { PlanEditorScreen } from '@/screens/editors/PlanEditorScreen';
import { TaskEditorScreen } from '@/screens/editors/TaskEditorScreen';
import { editPeriodFixture, editPlanFixture, editYearFixture } from '@/screens/fixtures/editors/plan';
import { editDateFixture, editRemindFixture, editRepeatFixture, editVisibleFixture, editWhoFixture } from '@/screens/fixtures/editors/task';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

const edit = (_text: string) => undefined;

export const screens = {
  'C-EditDate': (_: Props) => <TaskEditorScreen {...editDateFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditRepeat': (_: Props) => <TaskEditorScreen {...editRepeatFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditRemind': (_: Props) => <TaskEditorScreen {...editRemindFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditWho': (_: Props) => <TaskEditorScreen {...editWhoFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditVisible': (_: Props) => <TaskEditorScreen {...editVisibleFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditPlan': (_: Props) => <PlanEditorScreen {...editPlanFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditPeriod': (_: Props) => <PlanEditorScreen {...editPeriodFixture()} onChangeTitle={edit} onChangeNote={edit} />,
  'C-EditYear': (_: Props) => <PlanEditorScreen {...editYearFixture()} onChangeTitle={edit} onChangeNote={edit} />,
};
