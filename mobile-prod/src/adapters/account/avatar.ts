/** Страница «Иконка»: каким будет цвет «АВТО» и есть ли что сохранить */
import type { PersonColor } from '@/lib/types';
import { colorMap, colorOf } from '../common/people';
import type { Snapshot } from '../snapshot';

export type LookDraft = {
  /** null — «АВТО» */
  color: PersonColor | null;
  symbol: string;
};

/** Цвет «АВТО»: первый свободный по группам, если своего цвета нет */
export function autoColor(s: Pick<Snapshot, 'me' | 'users' | 'groups'>): PersonColor {
  const me = { ...s.me, color: undefined };
  return colorOf(colorMap({ me, users: s.users.map((u) => (u.id === me.id ? me : u)), groups: s.groups }), me.id);
}

/** Черновик из профиля */
export const lookOf = (me: Snapshot['me']): LookDraft => ({ color: me.color ?? null, symbol: me.avatar ?? '' });

/** Что поменялось: только изменённые поля (пустой символ — первая буква имени) */
export function lookPatch(draft: LookDraft, me: Snapshot['me']): { color?: PersonColor | null; avatar?: string | null } {
  const patch: { color?: PersonColor | null; avatar?: string | null } = {};
  if (draft.color !== (me.color ?? null)) patch.color = draft.color;
  const symbol = draft.symbol.trim();
  if (symbol !== (me.avatar ?? '')) patch.avatar = symbol || null;
  return patch;
}
