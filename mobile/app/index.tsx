import { Redirect } from 'expo-router';
import { useStore } from '@/lib/store';

export default function Index() {
  const me = useStore((s) => s.me);
  const hasGroups = useStore((s) => s.groups.length > 0);
  if (!me) return <Redirect href="/login" />;
  if (!hasGroups) return <Redirect href="/onboarding" />;
  return <Redirect href="/tasks" />;
}
