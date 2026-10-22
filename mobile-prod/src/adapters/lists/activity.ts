/**
 * C-Activity: что сделали другие во всех группах за 30 дней, по дням (новые сверху).
 * «Новое» — свежее того, что было просмотрено на момент открытия ленты (seenBefore).
 */
import { dayNo } from '@/lib/calendarLayout';
import { activityText } from '@/lib/activity';
import type { Activity, ID } from '@/lib/types';
import { weekday } from '@/screens/calendar/format';
import type { ActivityScreenProps, FeedDay, FeedEvent, FeedPerson } from '@/screens/lists/ActivityScreen';
import { STRANGER_COLOR, colorOf, letterOf, userOf, wishOwnerOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayShort, timeOfStamp } from '../common/when';
import type { Clock, DataOf, Snapshot } from '../snapshot';

const WEEKDAY_FULL = ['ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА', 'ВОСКРЕСЕНЬЕ'] as const;

/** «СЕГОДНЯ», «ВЧЕРА», раньше — день недели целиком: «СУББОТА» */
export function feedDayLabel(iso: string, today: string): string {
  const diff = dayNo(today) - dayNo(iso);
  if (diff === 0) return 'СЕГОДНЯ';
  if (diff === 1) return 'ВЧЕРА';
  return WEEKDAY_FULL[weekday(iso)] ?? '';
}

/** Где это было: группа заглавными; у хотелок группы нет — «ХОЧУ» */
function placeOf(e: Activity, s: Pick<Snapshot, 'groups'>): string {
  const group = e.groupId ? s.groups.find((g) => g.id === e.groupId) : undefined;
  if (group) return upper(group.name);
  return e.kind.startsWith('wish.') ? 'ХОЧУ' : '';
}

function personOf(s: Pick<Snapshot, 'me' | 'users'>, colors: ColorMap, id: ID): FeedPerson {
  const u = userOf(s, id);
  return u ? { name: u.name, letter: letterOf(u), color: colorOf(colors, id) } : { name: 'Кто-то', letter: '?', color: STRANGER_COLOR };
}

export function activityProps(s: Snapshot, colors: ColorMap, clock: Pick<Clock, 'today'>, seenBefore: string): DataOf<ActivityScreenProps> {
  const days: FeedDay[] = [];
  for (const e of s.activity) {
    // Свои действия в ленте не показываем
    if (e.actor === s.me.id) continue;
    // Сюрприз: подарок моей хотелки сервер мне не присылает — и если пришлёт, не показываем
    if (e.kind === 'wish.done' && wishOwnerOf(e, s.wishes) === s.me.id) continue;
    const iso = dateOfStamp(e.at);
    const event: FeedEvent = {
      id: e.id,
      person: personOf(s, colors, e.actor),
      text: activityText(e, userOf(s, e.actor), s.users),
      time: timeOfStamp(e.at),
      group: placeOf(e, s),
      fresh: e.id > seenBefore,
    };
    const last = days[days.length - 1];
    if (last && last.id === iso) last.events.push(event);
    else days.push({ id: iso, label: feedDayLabel(iso, clock.today), date: dayShort(iso), events: [event] });
  }
  return { caption: 'ВСЕ ГРУППЫ · 30 ДНЕЙ', days };
}
