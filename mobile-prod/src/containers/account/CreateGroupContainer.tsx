import { useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import type { GroupCategory } from '@/lib/types';
import { CreateGroupScreen } from '@/screens/account/CreateGroupScreen';
import { resetTo, signedInOnly, useInsets } from '../common';
import { backToProfile } from './back';
import type { GroupFrom } from './routes';

/**
 * Новая группа: название и категория. Создаётся сразу на телефоне (код приглашения придёт с сервера) и становится
 * текущей. С первой группы — на вкладки с чистого стека, из профиля — назад
 */
export const CreateGroupContainer = signedInOnly(function CreateGroup({ from }: { from: GroupFrom }) {
  const insets = useInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GroupCategory>('other');

  const onCreate = useCallback(() => {
    const v = name.trim();
    if (!v) return;
    useStore.getState().createGroup(v, category);
    if (from === 'onboarding') resetTo('/tasks');
    else backToProfile();
  }, [name, category, from]);

  return (
    <CreateGroupScreen
      name={name}
      category={category}
      caption={from === 'onboarding' ? 'ПЕРВАЯ ГРУППА' : 'ГРУППЫ'}
      insets={insets}
      onBack={backToProfile}
      onChangeName={setName}
      onChangeCategory={setCategory}
      onCancel={backToProfile}
      onCreate={onCreate}
    />
  );
});
