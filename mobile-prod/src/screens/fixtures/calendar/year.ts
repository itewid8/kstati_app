/**
 * Данные макета C-Year (design/mockups/C-Year.dc.html): 2026 год, сегодня 5 октября.
 * Занятость дней — тот же псевдослучайный генератор, что в renderVals() макета (seed 7, вызов на каждую из 42
 * клеток месяца, включая чужие дни), чтобы квадраты совпали один в один.
 */
import type { YearDay, YearScreenProps } from '../../calendar/YearScreen';
import { KARINA, SANYA, TODAY, chrome } from './people';

function generate(year: number): { days: Record<string, YearDay>; monthCounts: number[] } {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const days: Record<string, YearDay> = {};
  const monthCounts: number[] = [];
  for (let m = 0; m < 12; m++) {
    const first = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7;
    const len = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    let count = 0;
    for (let i = 0; i < 42; i++) {
      const d = i - first + 1;
      const r = rnd();
      if (d < 1 || d > len) continue;
      const future = m > 9 || (m === 9 && d > 11);
      if (!(future ? r > 0.82 : r > 0.45)) continue;
      count++;
      const people = r > 0.85 ? ['s', 'k'] : r > 0.66 ? ['k'] : ['s'];
      days[`${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = { people, level: 0.35 + (r % 0.13) * 5 };
    }
    monthCounts.push(count);
  }
  return { days, monthCounts };
}

export function yearFixture(): YearScreenProps {
  const { days, monthCounts } = generate(2026);
  return {
    ...chrome,
    people: [SANYA, KARINA],
    year: 2026,
    today: TODAY,
    total: 214,
    days,
    monthCounts,
  };
}
