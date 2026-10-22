import { Redirect } from 'expo-router';
import { useSignedIn } from '@/containers/common/signedIn';
import { useStore } from '@/lib/store';

/** Вход в приложение и место, куда сворачивается стек при выходе: без входа (нет токена, 401) — на вход */
export default function Index() {
  const signedIn = useSignedIn();
  const hasGroups = useStore((s) => s.groups.length > 0);
  if (!signedIn) return <Redirect href="/login" />;
  if (!hasGroups) return <Redirect href="/onboarding" />;
  return <Redirect href="/tasks" />;
}
