import { View } from 'react-native';
import { AuthScreen } from '@/screens/account/AuthScreen';
import { AvatarScreen } from '@/screens/account/AvatarScreen';
import { CreateGroupScreen } from '@/screens/account/CreateGroupScreen';
import { EditFieldScreen } from '@/screens/account/EditFieldScreen';
import { GroupPickerSheet } from '@/screens/account/GroupPickerSheet';
import { GroupScreen } from '@/screens/account/GroupScreen';
import { JoinGroupScreen } from '@/screens/account/JoinGroupScreen';
import { OnboardingScreen } from '@/screens/account/OnboardingScreen';
import { PasswordScreen } from '@/screens/account/PasswordScreen';
import { ProfileScreen } from '@/screens/account/ProfileScreen';
import { RemindersScreen } from '@/screens/account/RemindersScreen';
import { groupFixture } from '@/screens/fixtures/account/group';
import { profileFixture } from '@/screens/fixtures/account/profile';
import { remindersProps } from '@/adapters/account/reminders';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };
const rem = remindersProps({ timed: ['m60', 'd1@20:00'], allDay: ['d1@20:00', 'd0@09:00'] }, { timed: ['m60'], allDay: ['d1@20:00', 'd0@09:00'] });

export const screens = {
  'P-Login': (_: Props) => <AuthScreen mode="login" step="email" email="sasha@yandex.ru" password="" repeat="" name="" strength={0} canSubmit={false} />,
  'P-Register': (_: Props) => <AuthScreen mode="register" step="password" email="sasha@yandex.ru" password="qwerty12" repeat="qwe" name="Саня" strength={1} canSubmit={false} error={null} />,
  'P-RegEmail': (_: Props) => <AuthScreen mode="register" step="email" email="sasha@" password="" repeat="" name="" strength={0} canSubmit={false} error="Нет связи с сервером. Проверьте интернет." />,
  'P-Onboarding': (_: Props) => <OnboardingScreen />,
  'P-Create': (_: Props) => <CreateGroupScreen name="Семья" category="family" />,
  'P-Join': (_: Props) => <JoinGroupScreen code="K7p" errorText="Код не подошёл" error />,
  'P-Name': (_: Props) => <EditFieldScreen field="name" name="Саня" nick="sasha" gender="m" canSave />,
  'P-Nick': (_: Props) => <EditFieldScreen field="nick" name="Саня" nick="sa" gender="m" nickState="invalid" error="От 3 до 20 символов: буквы, цифры, «_» и «.»" canSave={false} />,
  'P-Gender': (_: Props) => <EditFieldScreen field="gender" name="Саня" nick="sasha" gender="f" canSave />,
  'P-Password': (_: Props) => <PasswordScreen hasOld old="xxxx" password="Secret-pass-77" repeat="Secret-pass-77" strength={2} canSave />,
  'P-Avatar': (_: Props) => <AvatarScreen name="Саня" color="#2fa3db" autoColor="blue" symbol="" canSave />,
  'P-Avatar2': (_: Props) => <AvatarScreen name="Саня" color={null} autoColor="green" symbol="🦊" canSave={false} />,
  'P-Reminders': (_: Props) => <RemindersScreen {...rem} />,
  'P-GroupDirty': (_: Props) => <GroupScreen {...groupFixture()} category="family" dirty />,
  'P-Picker': (_: Props) => (
    <View style={{ flex: 1 }}>
      <ProfileScreen {...profileFixture()} />
      <GroupPickerSheet visible groups={[{ id: 'a', name: 'Мы с Кариной', meta: 'ПАРА · 2', current: true }, { id: 'b', name: 'Друзья', meta: 'ДРУЗЬЯ · 4', current: false }, { id: 'c', name: 'Родители', meta: 'СЕМЬЯ · 3', current: false }]} onOpenSettings={() => {}} />
    </View>
  ),
};
