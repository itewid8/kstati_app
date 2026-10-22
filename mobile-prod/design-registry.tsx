// Реестр экранов для стенда сверки с макетами (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом.
import { WishesScreen } from '@/screens/WishesScreen';
import { wishesFixture } from '@/screens/fixtures/wishes';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

export const screens = {
  'C-Wishes': ({ theme }: Props) => <WishesScreen {...wishesFixture(theme)} />,
};
