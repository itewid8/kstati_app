import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { PlanContainer } from '@/containers/calendar/PlanContainer';
import { param } from '@/containers/common/nav';

/** C-Plan: план по дням — внутри вкладки «Дела» */
export default function PlanRoute() {
  const p = useLocalSearchParams();
  return <PlanContainer id={param(p.id) ?? ''} />;
}
