/** Люди на экранах: один цвет человека во всех группах, буква на кнопке, вкладки и метки людей */
import { memberColors } from '@/lib/personColors';
import type { Activity, ID, PersonColor, User, Wish } from '@/lib/types';
import type { CalendarPerson } from '@/screens/calendar/types';
import type { EditorPersonRef } from '@/screens/editors/TaskEditorScreen';
import type { VoicePerson } from '@/screens/voice/types';
import type { Snapshot } from '../snapshot';
import { upper } from './ru';

/** Цвет каждого человека — один и тот же во всех группах */
export type ColorMap = ReadonlyMap<ID, PersonColor>;

/** Цвет человека не из моих групп */
export const STRANGER_COLOR: PersonColor = '#8B8B8B';

/** Я и все люди моих групп по порядку групп и вступления — без повторов */
export function peopleIds(s: Pick<Snapshot, 'me' | 'groups'>): ID[] {
  return [...new Set([s.me.id, ...s.groups.flatMap((g) => g.memberIds)])];
}

/** Люди по id: я — всегда (даже если меня ещё нет в users) */
function usersOf(s: Pick<Snapshot, 'me' | 'users'>): User[] {
  return [s.me, ...s.users.filter((u) => u.id !== s.me.id)];
}

/**
 * Цвета людей: свой цвет из профиля, если его не занял раньше стоящий, иначе первый свободный из палитры
 * (memberColors). Порядок — я, затем участники групп по порядку групп: у всех телефонов он одинаковый
 */
export function colorMap(s: Pick<Snapshot, 'me' | 'users' | 'groups'>): ColorMap {
  return memberColors(peopleIds(s), usersOf(s));
}

export const colorOf = (colors: ColorMap, id: ID): PersonColor => colors.get(id) ?? STRANGER_COLOR;

/** Буква на иконке: свой символ или первая буква имени, заглавная */
export function letterOf(user: Pick<User, 'name' | 'avatar'>): string {
  const own = user.avatar?.trim();
  if (own) return upper(own);
  const [first = '?'] = Array.from(user.name.trim());
  return upper(first);
}

/** Кнопка профиля в верхней панели */
export function meBadge(s: Pick<Snapshot, 'me'>, colors: ColorMap): { letter: string; color: PersonColor } {
  return { letter: letterOf(s.me), color: colorOf(colors, s.me.id) };
}

export const userOf = (s: Pick<Snapshot, 'me' | 'users'>, id: ID): User | undefined =>
  id === s.me.id ? s.me : s.users.find((u) => u.id === id);

/** Вкладки людей группы (календарь): я первым с подписью «Я», остальные — по порядку вступления, имя заглавными */
export function groupPeople(s: Pick<Snapshot, 'me' | 'users' | 'groups'>, colors: ColorMap, groupId: ID | null): CalendarPerson[] {
  const group = groupId ? s.groups.find((g) => g.id === groupId) : undefined;
  const ids = [s.me.id, ...(group?.memberIds ?? []).filter((id) => id !== s.me.id)];
  return ids.flatMap((id) => {
    const u = userOf(s, id);
    if (!u) return [];
    return [{ id, name: u.name, tabLabel: id === s.me.id ? 'Я' : upper(u.name), color: colorOf(colors, id) }];
  });
}

/** Человек с квадратом цвета и именем заглавными; неизвестный — null */
function personRef(s: Pick<Snapshot, 'me' | 'users'>, colors: ColorMap, id: ID): { id: ID; name: string; color: PersonColor } | null {
  const u = userOf(s, id);
  return u ? { id, name: upper(u.name), color: colorOf(colors, id) } : null;
}

/** «САНЯ» в голосовом окне */
export const voicePerson = (s: Pick<Snapshot, 'me' | 'users'>, colors: ColorMap, id: ID): VoicePerson | null => personRef(s, colors, id);

/** «КАРИНА» в строке «КТО» окна дела */
export const editorPerson = (s: Pick<Snapshot, 'me' | 'users'>, colors: ColorMap, id: ID): EditorPersonRef | null => personRef(s, colors, id);

/**
 * Чья хотелка в событии ленты wish.*. С API 2 автор подарка — даритель, а владелец — в scope «u:<id>»;
 * нет scope — ищем хотелку по id, иначе автор события
 */
export function wishOwnerOf(e: Pick<Activity, 'scope' | 'actor' | 'itemId'>, wishes: readonly Pick<Wish, 'id' | 'ownerId'>[]): ID {
  if (e.scope.startsWith('u:') && e.scope.length > 2) return e.scope.slice(2);
  const found = e.itemId ? wishes.find((w) => w.id === e.itemId) : undefined;
  return found?.ownerId ?? e.actor;
}
