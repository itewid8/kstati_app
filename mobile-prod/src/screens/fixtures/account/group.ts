/** Данные макета C-Group (design/mockups/C-Group.dc.html). Обе темы — одно состояние */
import type { GroupScreenProps } from '../../account/GroupScreen';

export function groupFixture(): GroupScreenProps {
  return {
    name: 'Мы с Кариной',
    category: 'couple',
    inviteCode: 'K7P2QX',
    myRole: 'owner',
    members: [
      { id: 'u-sasha', name: 'Саня', nick: 'sasha', color: 'blue', role: 'owner', isMe: true },
      { id: 'u-karina', name: 'Карина', nick: 'karina', color: 'pink', role: 'admin' },
    ],
    share: { selectOnly: false, visible: 40, hidden: 2 },
    lists: [
      { key: 'tasks', count: 12 },
      { key: 'wishes', count: 4 },
      { key: 'watch', count: 7 },
      { key: 'ideas', count: 9 },
    ],
  };
}
