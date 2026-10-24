import { router } from 'expo-router';
import { OnboardingScreen } from '@/screens/account/OnboardingScreen';
import { signedInOnly, useInsets } from '../common';
import { accountRoutes } from './routes';

const create = () => router.push(accountRoutes.createGroup('onboarding'));
const join = () => router.push(accountRoutes.joinGroup('onboarding'));
/** Без группы есть только вишлист */
const later = () => router.replace('/wishes');

/** Первая группа после входа: создать / вступить по коду / позже */
export const OnboardingContainer = signedInOnly(function Onboarding() {
  const insets = useInsets();
  return <OnboardingScreen insets={insets} onCreate={create} onJoin={join} onLater={later} />;
});
