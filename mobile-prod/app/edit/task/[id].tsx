import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { NEW_TASK, param } from '@/containers/common/nav';
import { TaskEditorContainer } from '@/containers/editors/TaskEditorContainer';

/** Окно дела (C-EditDate / -Repeat / -Remind / -Who): /edit/task/<id | new>?occ=&date=&time=&parentId= */
export default function TaskEditorRoute() {
  const p = useLocalSearchParams();
  const id = param(p.id);
  return (
    <TaskEditorContainer
      id={id && id !== NEW_TASK ? id : null}
      occ={param(p.occ)}
      date={param(p.date)}
      time={param(p.time)}
      parentId={param(p.parentId)}
    />
  );
}
