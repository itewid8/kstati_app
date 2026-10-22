import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { size as S } from '@/ui';

/** Зазор между содержимым и нижней навигацией */
const NAV_GAP = 8;

/** Сколько места снизу закрывает нижняя навигация (BottomNav: отступ 18 + высота 72) и зазор над ней */
export const useBottomSpace = () => useSafeAreaInsets().bottom + S.navBottom + S.navHeight + NAV_GAP;
