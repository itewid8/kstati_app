/**
 * Быстрые действия по удержанию: какая запись открыта и её поднятая копия. Отдельный маленький стор (не сохраняется):
 * экраны зовут hold* из onLongPress*, окно рисует QuickActionsHost в корневом макете.
 */
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { parseKey } from '@/adapters/common/tasks';
import { parseWishKey } from '@/adapters/lists/wishes';
import type { QuickTarget } from '@/adapters/quick';
import type { ID } from '@/lib/types';
import type { LiftTarget } from '@/ui';

type QuickState = { target: QuickTarget | null; lift: LiftTarget | null };

export const useQuick = create<QuickState>()(() => ({ target: null, lift: null }));

/** Открыть окно с отдачей; lift — нажатый элемент (без него окно без поднятой строки) */
export const openQuickActions = (target: QuickTarget, lift?: LiftTarget | null): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  useQuick.setState({ target, lift: lift ?? null });
};

export const closeQuickActions = (): void => useQuick.setState({ target: null, lift: null });

/* Обработчики удержания для экранов: ключ строки → запись */

/** Дело по ключу «id@occ» (список, день, неделя, месяц, план) */
export const holdTask = (key: string, lift: LiftTarget) => openQuickActions({ kind: 'task', ...parseKey(key) }, lift);

/** Хотелка по ключу «ownerId/id» */
export const holdWish = (key: string, lift: LiftTarget): void => {
  const ref = parseWishKey(key);
  if (ref) openQuickActions({ kind: 'wish', ...ref }, lift);
};

export const holdWatch = (id: ID, lift: LiftTarget) => openQuickActions({ kind: 'watch', id }, lift);

export const holdIdea = (id: ID, lift?: LiftTarget) => openQuickActions({ kind: 'idea', id }, lift);
