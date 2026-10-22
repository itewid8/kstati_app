/** Русские подписи экранов: заглавные, падежи имён, «занят(а)», «вчера / 3 дня назад» */
import { dayNo, type IsoDate } from '@/lib/calendarLayout';
import { plural } from '@/lib/plans';
import type { Gender, User } from '@/lib/types';
import { dayMonthShort } from './when';

export { plural };

/** Заглавными по-русски: «Мы с Кариной» → «МЫ С КАРИНОЙ» */
export const upper = (s: string) => s.toLocaleUpperCase('ru-RU');

const CYRILLIC = /[а-яё]$/i;
/** После этих букв в родительном «и», а не «ы»: Ольга → Ольги, Саша → Саши */
const SOFT_HUSH = /[гкхжшщч]$/i;
/** Беглая гласная и прочие неправильные: Павел → Павла */
const IRREGULAR: Record<string, string> = { павел: 'павла', лев: 'льва', пётр: 'петра', петр: 'петра' };

/** Родительный падеж одного слова (строчными) */
function genitiveWord(word: string, gender?: Gender | null): string {
  const w = word.toLocaleLowerCase('ru-RU');
  const irregular = IRREGULAR[w];
  if (irregular) return irregular;
  if (!CYRILLIC.test(w)) return w;
  const stem = w.slice(0, -1);
  const last = w.slice(-1);
  if (last === 'а') return stem + (SOFT_HUSH.test(stem) ? 'и' : 'ы');
  if (last === 'я') return stem + 'и';
  if (last === 'й') return stem + 'я';
  if (last === 'ь') return stem + (gender === 'f' ? 'и' : 'я');
  // Гласные на конце (Тео, Мари) и женские имена на согласную (Ирен) не склоняются
  if ('оеиуюэы'.includes(last) || gender === 'f') return w;
  return w + 'а';
}

/**
 * Имя в родительном падеже заглавными — «ОТ КАРИНЫ», «ОТ ОЛЕГА».
 * Склоняется первое слово (имя); остальное — как есть. Латиница не склоняется.
 */
export function genitive(name: string, gender?: Gender | null): string {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return upper([genitiveWord(first, gender), ...rest].join(' '));
}

/** «КАРИНА ЗАНЯТА», «САНЯ ЗАНЯТ»; пол не указан — «ЗАНЯТ(А)» */
export function busyLabel(user: Pick<User, 'name' | 'gender'>): string {
  const word = user.gender === 'f' ? 'ЗАНЯТА' : user.gender === 'm' ? 'ЗАНЯТ' : 'ЗАНЯТ(А)';
  return `${upper(user.name.trim())} ${word}`;
}

/**
 * Насколько давно: «СЕГОДНЯ», «ВЧЕРА», «3 ДНЯ НАЗАД», «НЕДЕЛЮ НАЗАД» (7–13 дней), раньше и в будущем — «28 СЕН».
 * iso и today — даты «YYYY-MM-DD» (момент времени перевести в местную дату — dateOfStamp из when.ts)
 */
export function relativeDay(iso: IsoDate, today: IsoDate): string {
  const diff = dayNo(today) - dayNo(iso);
  if (diff === 0) return 'СЕГОДНЯ';
  if (diff === 1) return 'ВЧЕРА';
  if (diff >= 2 && diff <= 6) return `${diff} ${plural(diff, 'ДЕНЬ', 'ДНЯ', 'ДНЕЙ')} НАЗАД`;
  if (diff >= 7 && diff <= 13) return 'НЕДЕЛЮ НАЗАД';
  return dayMonthShort(iso);
}
