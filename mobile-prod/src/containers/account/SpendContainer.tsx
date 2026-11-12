import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { spendView } from '@/adapters/account/spend';
import { fetchSpend, rateCommand, type SpendData } from '@/lib/api';
import { InputSheet } from '@/ui/InputSheet';
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

  // Оценка команды из списка: 👍 сразу, 👎 — после поля «что хотели»
  const [asking, setAsking] = useState<string | null>(null);
  const mark = useCallback((id: string, rating: 'up' | 'down') => {
    setData((d) => (d && d !== 'error' ? { ...d, recent: d.recent.map((c) => (c.id === id ? { ...c, rating } : c)) } : d));
  }, []);
  const onRate = useCallback(
    (id: string, good: boolean) => {
      if (!good) return setAsking(id);
      mark(id, 'up');
      void rateCommand(id, true);
    },
    [mark],
  );
  const onWish = useCallback(
    (wish: string) => {
      const id = asking;
      setAsking(null);
      if (!id) return;
      mark(id, 'down');
      void rateCommand(id, false, wish);
    },
    [asking, mark],
  );
  const closeWish = useCallback(() => setAsking(null), []);

  return (
    <>
      <SpendScreen periods={periods} view={view} insets={insets} onBack={back} onPeriod={onPeriod} onRate={onRate} />
      <InputSheet
        visible={!!asking}
        value=""
        multiline
        maxLength={500}
        title="ЧТО ДОЛЖНО БЫЛО ПОЛУЧИТЬСЯ"
        submitLabel="ОТПРАВИТЬ"
        bottomInset={insets.bottom}
        onSubmit={onWish}
        onClose={closeWish}
      />
    </>
  );
}
