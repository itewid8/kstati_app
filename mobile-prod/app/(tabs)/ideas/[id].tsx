import { useLocalSearchParams } from 'expo-router';
import { TopicContainer } from '@/containers/lists/TopicContainer';
import { INBOX } from '@/lib/types';

/** Тема идей (и «Без темы»); макета нет — раскладка C-Ideas */
export default function TopicRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TopicContainer id={id ?? INBOX} />;
}
