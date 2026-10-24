import type { GroupCategory } from '@/lib/types';

/** Подписи категорий в сетке из пяти — короче, чем CATEGORY_LABEL */
export const CATEGORY_SHORT: Record<GroupCategory, string> = {
  couple: 'ПАРА',
  family: 'СЕМЬЯ',
  parents: 'РОДИТ.',
  friends: 'ДРУЗЬЯ',
  other: 'ДРУГОЕ',
};
