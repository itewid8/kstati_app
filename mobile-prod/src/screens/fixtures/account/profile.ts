/** Данные макета C-Profile (design/mockups/C-Profile.dc.html). Обе темы — одно состояние */
import type { ProfileGroup, ProfileScreenProps, ProfileUser } from '../../account/ProfileScreen';

export const profileMe: ProfileUser = {
  name: 'Саня',
  nick: 'sasha',
  email: 'sasha@yandex.ru',
  gender: 'm',
  color: 'blue',
};

export const profileGroups: ProfileGroup[] = [
  { id: 'g-karina', name: 'Мы с Кариной', category: 'couple', memberCount: 2 },
  { id: 'g-friends', name: 'Друзья', category: 'friends', memberCount: 4 },
  { id: 'g-parents', name: 'Родители', category: 'family', memberCount: 3 },
];

export function profileFixture(): ProfileScreenProps {
  return { me: profileMe, groups: profileGroups };
}
