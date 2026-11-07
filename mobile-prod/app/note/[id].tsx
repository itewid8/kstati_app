import { useLocalSearchParams } from 'expo-router';
import { NEW_NOTE, param } from '@/containers/common';
import { useNoteContainer } from '@/containers/lists/noteLoader';

/** Заметка (C-Note): id или «new» с темой ?topic */
export default function NoteRoute() {
  const { id, topic } = useLocalSearchParams<{ id: string; topic?: string }>();
  const NoteContainer = useNoteContainer();
  return NoteContainer && <NoteContainer id={id ?? NEW_NOTE} topicId={param(topic) ?? null} />;
}
