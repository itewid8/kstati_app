// Реестр экранов области «lists» для стенда сверки (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом.
import { ActivityScreen } from '@/screens/lists/ActivityScreen';
import { IdeasScreen } from '@/screens/lists/IdeasScreen';
import { NoteScreen } from '@/screens/lists/NoteScreen';
import { TopicScreen } from '@/screens/sheets/TopicScreen';
import { TasksListScreen } from '@/screens/lists/TasksListScreen';
import { WatchScreen } from '@/screens/lists/WatchScreen';
import { activityFixture } from '@/screens/fixtures/lists/activity';
import { ideasFixture } from '@/screens/fixtures/lists/ideas';
import { noteFixture, topicFixture } from '@/screens/fixtures/lists/notes';
import { tasksListFixture } from '@/screens/fixtures/lists/tasks';
import { watchFixture } from '@/screens/fixtures/lists/watch';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

export const screens = {
  'C-List': (_: Props) => <TasksListScreen {...tasksListFixture()} />,
  'C-Watch': ({ theme }: Props) => <WatchScreen {...watchFixture(theme)} />,
  'C-Ideas': ({ theme }: Props) => <IdeasScreen {...ideasFixture(theme)} />,
  'C-Activity': (_: Props) => <ActivityScreen {...activityFixture()} />,
  'C-Topic': (_: Props) => <TopicScreen {...topicFixture()} />,
  'C-Note': (_: Props) => <NoteScreen {...noteFixture()} />,
};
