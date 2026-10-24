/**
 * Первая группа после входа: создать или вступить по коду; «ПОЗЖЕ» — к вишлисту без группы.
 * Презентационный экран.
 */
import { memo } from 'react';
import { SectionBox } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { BrandTile } from './components/AccountIcons';
import { AccountRow } from './components/AccountRow';
import { TextLink } from './components/TextLink';

export type OnboardingScreenProps = {
  insets?: PageInsets;
  onCreate?: () => void;
  onJoin?: () => void;
  onLater?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

export const OnboardingScreen = memo(function OnboardingScreen({ insets = NO_INSETS, onCreate, onJoin, onLater }: OnboardingScreenProps) {
  return (
    <AccountPage
      title="Группа"
      insets={insets}
      back={false}
      headerRight={<BrandTile />}
      footer={<TextLink label="ПОЗЖЕ →" onPress={onLater} />}
    >
      <SectionBox title="ГРУППА">
        <AccountRow label="Создать группу" value="+" onPress={onCreate} />
        <AccountRow label="Вступить по коду" onPress={onJoin} />
      </SectionBox>
    </AccountPage>
  );
});
