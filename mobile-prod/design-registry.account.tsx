// Реестр экранов аккаунта для стенда сверки с макетами (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом.
import { CodeScreen } from '@/screens/account/CodeScreen';
import { GroupScreen } from '@/screens/account/GroupScreen';
import { ProfileScreen } from '@/screens/account/ProfileScreen';
import { SettingsScreen } from '@/screens/account/SettingsScreen';
import { codeFixture } from '@/screens/fixtures/account/code';
import { groupFixture } from '@/screens/fixtures/account/group';
import { profileFixture } from '@/screens/fixtures/account/profile';
import { settingsFixture } from '@/screens/fixtures/account/settings';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

export const screens = {
  'C-Profile': (_: Props) => <ProfileScreen {...profileFixture()} />,
  'C-Settings': (_: Props) => <SettingsScreen {...settingsFixture()} />,
  'C-Group': (_: Props) => <GroupScreen {...groupFixture()} />,
  'C-Code': (_: Props) => <CodeScreen {...codeFixture()} />,
};
