import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { GroupContainer } from '@/containers/account/GroupContainer';
import { param } from '@/containers/common/nav';

/** C-Group: настройки группы */
export default function GroupRoute() {
  const p = useLocalSearchParams();
  return <GroupContainer id={param(p.id) ?? ''} />;
}
