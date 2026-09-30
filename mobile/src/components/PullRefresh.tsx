import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { fetchActivity, syncNow } from '@/lib/sync';
import { useColors } from '@/theme';

/**
 * «Потянуть вниз, чтобы обновить»: сразу отправляет несохранённое и забирает новое с сервера.
 * Крутилка держится, пока идёт синхронизация (но не меньше 400 мс — чтобы было видно, что сработало).
 */
export function usePullRefresh(enabled = true) {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncNow().then(() => fetchActivity(true)), new Promise((r) => setTimeout(r, 400))]);
    setRefreshing(false);
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
