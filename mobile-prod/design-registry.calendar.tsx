// Реестр экранов области «calendar» для стенда сверки (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом (и через prefers-color-scheme).
import { DayScreen } from '@/screens/calendar/DayScreen';
import { MonthScreen } from '@/screens/calendar/MonthScreen';
import { PlanScreen } from '@/screens/calendar/PlanScreen';
import { WeekScreen } from '@/screens/calendar/WeekScreen';
import { YearScreen } from '@/screens/calendar/YearScreen';
import { dayFixture } from '@/screens/fixtures/calendar/day';
import { monthFixture } from '@/screens/fixtures/calendar/month';
import { planFixture } from '@/screens/fixtures/calendar/plan';
import { weekFixture } from '@/screens/fixtures/calendar/week';
import { yearFixture } from '@/screens/fixtures/calendar/year';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

export const screens = {
  'C-Day': (_: Props) => <DayScreen {...dayFixture()} />,
  'C-Week': (_: Props) => <WeekScreen {...weekFixture()} />,
  'C-Month': (_: Props) => <MonthScreen {...monthFixture()} />,
  'C-Year': (_: Props) => <YearScreen {...yearFixture()} />,
  'C-Plan': (_: Props) => <PlanScreen {...planFixture()} />,
};
