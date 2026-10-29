/** Типы дел: мини-иконка и подпись (окно дела — выбор типа, списки и календарь — иконка у названия) */
import type { TaskKind } from '@/lib/types';
import type { IconName } from './Icon';

export const KIND_ICON: Record<TaskKind, IconName> = {
  task: 'kindTask',
  birthday: 'kindBirthday',
  important: 'kindImportant',
  trip: 'kindTrip',
};

export const KIND_LABEL: Record<TaskKind, string> = {
  task: 'ДЕЛО',
  birthday: 'ДЕНЬ РОЖДЕНИЯ',
  important: 'ВАЖНЫЙ ДЕНЬ',
  trip: 'ПУТЕШЕСТВИЕ',
};
