import { useLocalSearchParams } from 'expo-router';
import { CreateGroupContainer } from '@/containers/account/CreateGroupContainer';
import { groupFromParam } from '@/containers/account/routes';
import { param } from '@/containers/common/nav';

/** Новая группа; ?from=onboarding — первая группа (после — на вкладки) */
export default function CreateGroupRoute() {
  return <CreateGroupContainer from={groupFromParam(param(useLocalSearchParams().from))} />;
}
