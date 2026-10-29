import { useLocalSearchParams } from 'expo-router';
import { TopicContainer } from '@/containers/lists/TopicContainer';
import { INBOX } from '@/lib/types';

/** Тема заметок (и «Без темы») — C-Topic */
export default function TopicRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TopicContainer id={id ?? INBOX} />;
}
