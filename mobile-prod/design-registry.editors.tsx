// Реестр окон редактирования дела/плана для стенда сверки (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом (и через useColorScheme).
import { PlanEditorScreen } from '@/screens/editors/PlanEditorScreen';
import { TaskEditorScreen } from '@/screens/editors/TaskEditorScreen';
import { editPeriodFixture, editPlanFixture, editYearFixture } from '@/screens/fixtures/editors/plan';
import { editDateFixture, editRemindFixture, editRepeatFixture, editWhoFixture } from '@/screens/fixtures/editors/task';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

export const screens = {
  'C-EditDate': (_: Props) => <TaskEditorScreen {...editDateFixture()} />,
  'C-EditRepeat': (_: Props) => <TaskEditorScreen {...editRepeatFixture()} />,
  'C-EditRemind': (_: Props) => <TaskEditorScreen {...editRemindFixture()} />,
  'C-EditWho': (_: Props) => <TaskEditorScreen {...editWhoFixture()} />,
  'C-EditPlan': (_: Props) => <PlanEditorScreen {...editPlanFixture()} />,
  'C-EditPeriod': (_: Props) => <PlanEditorScreen {...editPeriodFixture()} />,
  'C-EditYear': (_: Props) => <PlanEditorScreen {...editYearFixture()} />,
};
