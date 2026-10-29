import { useLocalSearchParams } from 'expo-router';
import { NEW_NOTE, param } from '@/containers/common';
import { NoteContainer } from '@/containers/lists/NoteContainer';

/** Заметка (C-Note): id или «new» с темой ?topic */
export default function NoteRoute() {
  const { id, topic } = useLocalSearchParams<{ id: string; topic?: string }>();
  return <NoteContainer id={id ?? NEW_NOTE} topicId={param(topic) ?? null} />;
}
