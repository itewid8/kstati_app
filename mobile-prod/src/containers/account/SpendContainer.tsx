import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { spendView } from '@/adapters/account/spend';
import { fetchSpend, type SpendData } from '@/lib/api';
import { SpendScreen } from '@/screens/account/SpendScreen';
import { useClock, useInsets } from '../common';

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/app'));
const PERIODS = [
  { key: 7, label: '7 ДНЕЙ' },
  { key: 30, label: '30 ДНЕЙ' },
  { key: 90, label: '90 ДНЕЙ' },
];

/** Расходы на ИИ: мои команды, токены и рубли по дням (сервер, GET /stats/spend) */
export function SpendContainer() {
  const insets = useInsets();
  const clock = useClock();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SpendData | null | 'error'>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    fetchSpend(days).then((d) => live && setData(d ?? 'error'));
    return () => {
      live = false;
    };
  }, [days]);

  const view = useMemo(() => (data === null || data === 'error' ? data : spendView(data.days, clock.today, data.recent)), [data, clock.today]);
  const periods = useMemo(() => PERIODS.map((p) => ({ ...p, on: p.key === days })), [days]);
  const onPeriod = useCallback((d: number) => setDays(d), []);

  return <SpendScreen periods={periods} view={view} insets={insets} onBack={back} onPeriod={onPeriod} />;
}
