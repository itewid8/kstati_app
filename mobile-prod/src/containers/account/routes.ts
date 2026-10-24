/**
 * Адреса страниц аккаунта, которых нет в containers/common/nav.ts (тот — общий файл, его правит владелец):
 * создание группы, вступление по коду, «Иконка» с выбранным цветом.
 */
import type { Href } from 'expo-router';
import { PERSON_COLORS, type PersonColor } from '@/lib/types';

/** Откуда открыта страница группы: с первой группы (после — на вкладки) или из профиля (после — назад) */
export type GroupFrom = 'profile' | 'onboarding';

const fromQuery = (from: GroupFrom) => (from === 'onboarding' ? '?from=onboarding' : '');

export const accountRoutes = {
  createGroup: (from: GroupFrom = 'profile'): Href => `/group/new${fromQuery(from)}`,
  joinGroup: (from: GroupFrom = 'profile'): Href => `/group/join${fromQuery(from)}`,
  /** Мои дела в группе (C-ShareMine); join — сразу после вступления (C-ShareJoin), откуда пришли */
  share: (id: string, join?: GroupFrom): Href => `/group/share?id=${encodeURIComponent(id)}${join ? `&join=${join}` : ''}`,
  /** «Иконка»; color — сразу выбран в черновике (нажали цвет в профиле) */
  avatar: (color?: PersonColor): Href => (color ? `/settings/avatar?color=${encodeURIComponent(color)}` : '/settings/avatar'),
} as const;

export const groupFromParam = (v: string | undefined): GroupFrom => (v === 'onboarding' ? 'onboarding' : 'profile');

/** Цвет из адреса: ключ палитры или «#rrggbb» */
export function colorParam(v: string | undefined): PersonColor | undefined {
  if (!v) return undefined;
  const key = PERSON_COLORS.find((k) => k === v);
  if (key) return key;
  return /^#[0-9a-f]{6}$/i.test(v) ? `#${v.slice(1)}` : undefined;
}
