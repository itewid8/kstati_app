import { useLocalSearchParams } from 'expo-router';
import { ShareContainer } from '@/containers/account/ShareContainer';
import { groupFromParam } from '@/containers/account/routes';
import { param } from '@/containers/common/nav';

/** C-ShareMine: мои дела в группе ?id=…; ?join=profile|onboarding — сразу после вступления (C-ShareJoin) */
export default function ShareRoute() {
  const p = useLocalSearchParams();
  const join = param(p.join);
  return <ShareContainer id={param(p.id) ?? ''} join={join ? groupFromParam(join) : null} />;
}
