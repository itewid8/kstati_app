/** Быстрые действия по удержанию: запись → данные окна (QuickActionsSheet) и всё, что нужно действиям */
import type { ColorMap } from '../common/people';
import { quickIdeaView, quickWatchView, quickWishView, type QuickIdeaView, type QuickWatchView, type QuickWishView } from './items';
import { quickTaskView, type QuickTaskView } from './task';
import type { QuickEnv, QuickSnapshot, QuickTarget } from './types';

export type QuickView = QuickTaskView | QuickWishView | QuickWatchView | QuickIdeaView;

/** null — записи уже нет (удалили, пришла синхронизация): окно закрывается */
export const quickView = (s: QuickSnapshot, colors: ColorMap, env: QuickEnv, target: QuickTarget): QuickView | null => {
  switch (target.kind) {
    case 'task':
      return quickTaskView(s, colors, env, target);
    case 'wish':
      return quickWishView(s, colors, env, target);
    case 'watch':
      return quickWatchView(s, colors, target);
    case 'idea':
      return quickIdeaView(s, colors, target);
  }
};

export { giftTaskTitle, moveChange, splitIdea, taskCopy, undatedTask } from './convert';
export { NO_TOPIC, topicSegments, type QuickIdeaView, type QuickWatchView, type QuickWishView } from './items';
export { moveToDate, movePatches, nextSaturday, type QuickTaskView } from './task';
export { isMoveKey, type MoveKey, type QuickEnv, type QuickSnapshot, type QuickTarget } from './types';
