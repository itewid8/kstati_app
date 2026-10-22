/** C-Profile: мой профиль и мои группы */
import type { ProfileScreenProps } from '@/screens/account/ProfileScreen';
import { colorOf, type ColorMap } from '../common/people';
import type { DataOf, Snapshot } from '../snapshot';

export function profileProps(s: Pick<Snapshot, 'me' | 'groups'>, colors: ColorMap): DataOf<ProfileScreenProps> {
  const { me } = s;
  return {
    me: {
      name: me.name,
      nick: me.nick ?? null,
      email: me.email ?? '',
      gender: me.gender ?? null,
      color: colorOf(colors, me.id),
      avatar: me.avatar ?? null,
    },
    groups: s.groups.map((g) => ({ id: g.id, name: g.name, category: g.category, memberCount: g.memberIds.length })),
  };
}
