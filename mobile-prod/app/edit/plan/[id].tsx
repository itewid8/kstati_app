import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { param, type PlanEditorField } from '@/containers/common/nav';
import { PlanEditorContainer } from '@/containers/editors/PlanEditorContainer';

const FIELDS: readonly PlanEditorField[] = ['period', 'note', 'subtasks'];
const fieldOf = (v: string | undefined) => FIELDS.find((f) => f === v);

/** Окно плана (C-EditPlan / -Period / -Year): /edit/plan/<id>?field= */
export default function PlanEditorRoute() {
  const p = useLocalSearchParams();
  return <PlanEditorContainer id={param(p.id) ?? ''} field={fieldOf(param(p.field))} />;
}
