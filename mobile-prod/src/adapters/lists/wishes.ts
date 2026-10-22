/**
 * C-Wishes: вишлисты — я и люди всех моих групп. Сюрприз (API 2): владелец не видит, что его хотелку подарили,
 * пока сам не отметит «получил» — своя хотелка в «Хочу», пока нет receivedAt, что бы ни лежало в giftedBy.
 */
import type { ID, Wish } from '@/lib/types';
import type { ALL_PEOPLE as SCREEN_ALL, GiftedRow, WishPerson, WishRow, WishesScreenProps } from '@/screens/WishesScreen';
import { colorOf, meBadge, peopleIds, userOf, type ColorMap } from '../common/people';
import { genitive, plural, upper } from '../common/ru';
import type { DataOf, Snapshot } from '../snapshot';

/** Вкладка «ВСЕ» — то же значение, что ALL_PEOPLE экрана (из экрана адаптеру можно брать только типы) */
export const ALL_PEOPLE: typeof SCREEN_ALL = 'all';

/** Состояние экрана из хранилища: выбранный человек (null — я) и свёрнутые разделы */
export type WishesUi = { personId: ID | null; collapsed: readonly string[] };

export const WISH_SECTIONS = { wishes: 'wishes.list', gifted: 'wishes.gifted' } as const;

/** id строки: хотелки разных людей могут совпасть по id */
export const wishKey = (w: Pick<Wish, 'ownerId' | 'id'>) => `${w.ownerId}/${w.id}`;

export function parseWishKey(key: string): { ownerId: ID; id: ID } | null {
  const at = key.indexOf('/');
  return at > 0 && at < key.length - 1 ? { ownerId: key.slice(0, at), id: key.slice(at + 1) } : null;
}

/** Ещё не подарена: своя — пока я не отметил «получил»; чужая — пока никто не подарил и владелец не получил */
export const isOpenWish = (w: Pick<Wish, 'ownerId' | 'receivedAt' | 'giftedBy'>, meId: ID) =>
  w.ownerId === meId ? !w.receivedAt : !w.receivedAt && !w.giftedBy;

/**
 * Ссылка, которую можно открыть: только http и https (чужая хотелка не должна открывать tel:, intent: и т. п.).
 * Адрес без схемы («ozon.ru/…») — как https. Иначе null
 */
export function safeLink(raw: string | null | undefined): string | null {
  const link = raw?.trim() ?? '';
  if (!link || /[\s\u0000-\u001f\u007f]/.test(link)) return null;
  if (/^https?:\/\/[^/?#]+/i.test(link)) return link;
  // Есть схема, но не http(s) — не открываем
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return null;
  return /^[^/?#.]+\.[^/?#]+/.test(link) ? `https://${link}` : null;
}

/** «OZON.RU» из «https://www.ozon.ru/product/…» */
export function linkDomain(link: string): string {
  const host = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i.exec(link)?.[1] ?? '';
  return upper(host.replace(/^www\./i, ''));
}

/** «ОТ КАРИНЫ», «ОТ МЕНЯ»; получено без дарителя — «ПОЛУЧЕНО» */
function giftedFrom(w: Wish, s: Pick<Snapshot, 'me' | 'users'>): string {
  if (!w.giftedBy) return 'ПОЛУЧЕНО';
  if (w.giftedBy === s.me.id) return 'ОТ МЕНЯ';
  const giver = userOf(s, w.giftedBy);
  return giver ? `ОТ ${genitive(giver.name, giver.gender)}` : 'ПОДАРЕНО';
}

/** Когда подарено: отметка владельца или дарителя */
const giftedAt = (w: Wish) => w.receivedAt ?? w.giftedAt ?? '';

export type WishesSnapshot = Pick<Snapshot, 'me' | 'users' | 'groups' | 'wishes' | 'activity' | 'activitySeen'>;

export function wishesProps(s: WishesSnapshot, colors: ColorMap, ui: WishesUi): DataOf<WishesScreenProps> {
  const meId = s.me.id;
  const ids = peopleIds(s);
  const people: WishPerson[] = ids.flatMap((id) => {
    const u = userOf(s, id);
    return u ? [{ id, label: id === meId ? 'Я' : upper(u.name), color: colorOf(colors, id) }] : [];
  });
  const known = new Set(people.map((p) => p.id));
  const picked = ui.personId;
  const selectedPersonId: ID = picked !== null && (picked === ALL_PEOPLE || known.has(picked)) ? picked : meId;

  // Порядок: по людям (как во вкладках), внутри — как в хранилище
  const rank = new Map(people.map((p, i) => [p.id, i]));
  const mine = s.wishes
    .filter((w) => (selectedPersonId === ALL_PEOPLE ? known.has(w.ownerId) : w.ownerId === selectedPersonId))
    .map((w, i) => ({ w, i }))
    .sort((a, b) => (rank.get(a.w.ownerId) ?? 0) - (rank.get(b.w.ownerId) ?? 0) || a.i - b.i)
    .map(({ w }) => w);

  const wishes: WishRow[] = mine
    .filter((w) => isOpenWish(w, meId))
    .map((w) => {
      const link = safeLink(w.link);
      return {
        id: wishKey(w),
        title: w.title,
        note: [upper(w.note.trim()), link ? linkDomain(link) : ''].filter(Boolean).join(' · '),
        link,
        ownerColor: colorOf(colors, w.ownerId),
      };
    });

  const gifted: GiftedRow[] = mine
    .filter((w) => !isOpenWish(w, meId))
    .sort((a, b) => giftedAt(b).localeCompare(giftedAt(a)))
    .map((w) => ({ id: wishKey(w), title: w.title, from: giftedFrom(w, s) }));

  const n = people.length;
  return {
    caption: `ВИШЛИСТЫ · ${n} ${plural(n, 'ЧЕЛОВЕК', 'ЧЕЛОВЕКА', 'ЧЕЛОВЕК')}`,
    me: meBadge(s, colors),
    hasNews: (s.activity[0]?.id ?? '') > s.activitySeen,
    people,
    selectedPersonId,
    wishes,
    gifted,
    wishesOpen: !ui.collapsed.includes(WISH_SECTIONS.wishes),
    giftedOpen: !ui.collapsed.includes(WISH_SECTIONS.gifted),
  };
}
