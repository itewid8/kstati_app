import { useLocalSearchParams } from 'expo-router';
import { JoinGroupContainer } from '@/containers/account/JoinGroupContainer';
import { groupFromParam } from '@/containers/account/routes';
import { param } from '@/containers/common/nav';

/** Вступить по коду; ?from=onboarding — первая группа (после — на вкладки) */
export default function JoinGroupRoute() {
  return <JoinGroupContainer from={groupFromParam(param(useLocalSearchParams().from))} />;
}
