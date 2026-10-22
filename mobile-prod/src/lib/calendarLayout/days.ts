/** Номера дней без часовых поясов (как dayNo / isoOf в lib/recur.ts) */
import type { IsoDate } from './types';

const MS_DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** «YYYY-MM-DD» → номер дня от 1970-01-01 */
export const dayNo = (iso: IsoDate) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
};

/** Номер дня → «YYYY-MM-DD» */
export const isoOf = (n: number): IsoDate => {
  const d = new Date(n * MS_DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
