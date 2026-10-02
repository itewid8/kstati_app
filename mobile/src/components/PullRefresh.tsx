import React, { useCallback, useState } from 'react';
// RefreshControl из gesture-handler, а не из react-native: он участвует в общем распределении жестов.
// Обычный на Android замирал — свайпы строк / календаря или ScrollView из gesture-handler забирали касание
// посреди потягивания, и значок обновления оставался висеть на месте.
import { RefreshControl } from 'react-native-gesture-handler';
import { fetchActivity, syncNow } from '@/lib/sync';
import { useColors } from '@/theme';

/** Дольше крутилку не держим: синхронизация доделается в фоне, а экран не выглядит зависшим */
const MAX_MS = 8_000;

/**
 * «Потянуть вниз, чтобы обновить»: сразу отправляет несохранённое и забирает новое с сервера.
 * Крутилка держится, пока идёт синхронизация (не меньше 400 мс — чтобы было видно, что сработало,
 * и не больше 8 с — при плохой связи).
 */
export function usePullRefresh(enabled = true) {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const work = syncNow().then(() => fetchActivity(true)).catch(() => {});
      await Promise.all([
        Promise.race([work, new Promise((r) => setTimeout(r, MAX_MS))]),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    } catch {
      /* ошибки синхронизации показывает строка состояния сети */
    } finally {
      setRefreshing(false);
    }
  }, []);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      tintColor={c.textMuted}
      colors={[c.text]}
      progressBackgroundColor={c.surface}
    />
  );
}
