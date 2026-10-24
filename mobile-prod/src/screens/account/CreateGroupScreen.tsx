/**
 * Новая группа: название и категория, снизу ОТМЕНА / СОЗДАТЬ. Презентационный экран.
 */
import { memo } from 'react';
import { CATEGORIES, type GroupCategory } from '@/lib/types';
import { SectionBox } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { CATEGORY_SHORT } from './components/categories';
import { Field } from './components/Field';
import { OptionGrid, type Option } from './components/OptionGrid';

export type CreateGroupScreenProps = {
  name: string;
  category: GroupCategory;
  /** Подпись рядом с «Назад»: «ГРУППЫ» / «ПЕРВАЯ ГРУППА» */
  caption?: string;
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  onChangeName?: (name: string) => void;
  onChangeCategory?: (category: GroupCategory) => void;
  onCancel?: () => void;
  onCreate?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

const OPTIONS: Option<GroupCategory>[] = CATEGORIES.map((key) => ({ key, label: CATEGORY_SHORT[key] }));

export const CreateGroupScreen = memo(function CreateGroupScreen(props: CreateGroupScreenProps) {
  const { name, category, caption = 'ГРУППЫ', insets = NO_INSETS, onBack, onChangeName, onChangeCategory, onCancel, onCreate } = props;
  const ready = name.trim().length > 0;
  return (
    <AccountPage
      caption={caption}
      title="Новая группа"
      insets={insets}
      onBack={onBack}
      save={{ canSave: ready, label: 'СОЗДАТЬ', onCancel, onSave: onCreate }}
    >
      <SectionBox title="НАЗВАНИЕ">
        <Field
          framed={false}
          value={name}
          onChangeText={onChangeName}
          placeholder="Название"
          maxLength={40}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={ready ? onCreate : undefined}
        />
      </SectionBox>
      <SectionBox title="КАТЕГОРИЯ">
        <OptionGrid options={OPTIONS} value={category} onChange={onChangeCategory} />
      </SectionBox>
    </AccountPage>
  );
});
