/**
 * Правка поля профиля: имя, никнейм или пол — по странице на поле, снизу ОТМЕНА / СОХРАНИТЬ.
 * Презентационный экран: черновик, проверка ника и ошибка — пропсами, сохранение — у вызывающего.
 */
import { memo, useCallback } from 'react';
import type { Gender } from '@/lib/types';
import { SectionBox } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { ErrorLine } from './components/ErrorLine';
import { Field } from './components/Field';
import { OptionGrid, type Option } from './components/OptionGrid';

export type EditableField = 'name' | 'nick' | 'gender';

/** same — не менялся; empty — стёрт (ник уберётся) */
export type NickState = 'same' | 'empty' | 'checking' | 'free' | 'taken' | 'invalid';

export type EditFieldScreenProps = {
  field: EditableField;
  name: string;
  /** Без «@» */
  nick: string;
  gender: Gender | null;
  nickState?: NickState;
  /** Почему не сохранилось или почему ник не подходит */
  error?: string | null;
  /** Есть изменения и их можно сохранить */
  canSave: boolean;
  busy?: boolean;
  insets?: PageInsets;

  onBack?: () => void;
  onChangeName?: (name: string) => void;
  onChangeNick?: (nick: string) => void;
  onChangeGender?: (gender: Gender | null) => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

const TITLE: Record<EditableField, string> = { name: 'Имя', nick: 'Никнейм', gender: 'Пол' };

const NICK_STATE: Record<NickState, string | undefined> = {
  same: undefined,
  empty: undefined,
  checking: 'ПРОВЕРКА…',
  free: 'СВОБОДЕН',
  taken: 'ЗАНЯТ',
  invalid: 'НЕ ПОДХОДИТ',
};

type GenderKey = Gender | 'none';

const GENDERS: Option<GenderKey>[] = [
  { key: 'm', label: 'МУЖСКОЙ' },
  { key: 'f', label: 'ЖЕНСКИЙ' },
  { key: 'none', label: 'НЕ УКАЗАН' },
];

export const EditFieldScreen = memo(function EditFieldScreen(props: EditFieldScreenProps) {
  const {
    field,
    name,
    nick,
    gender,
    nickState = 'same',
    error,
    canSave,
    busy = false,
    insets = NO_INSETS,
    onBack,
    onChangeName,
    onChangeNick,
    onChangeGender,
    onCancel,
    onSave,
  } = props;
  const submit = canSave && !busy ? onSave : undefined;
  const pickGender = useCallback((key: GenderKey) => onChangeGender?.(key === 'none' ? null : key), [onChangeGender]);

  return (
    <AccountPage
      caption="ПРОФИЛЬ"
      title={TITLE[field]}
      insets={insets}
      onBack={onBack}
      save={{ canSave, busy, onCancel, onSave }}
    >
      {field === 'name' ? (
        <SectionBox title="ИМЯ">
          <Field
            framed={false}
            value={name}
            onChangeText={onChangeName}
            placeholder="Имя"
            autoComplete="name"
            textContentType="givenName"
            maxLength={40}
            autoFocus
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </SectionBox>
      ) : null}

      {field === 'nick' ? (
        <SectionBox title="НИКНЕЙМ" count={NICK_STATE[nickState]}>
          <Field
            framed={false}
            value={nick}
            onChangeText={onChangeNick}
            prefix="@"
            placeholder="Никнейм"
            accessibilityLabel="Никнейм"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="nickname"
            maxLength={20}
            autoFocus
            editable={!busy}
            invalid={nickState === 'taken' || nickState === 'invalid'}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </SectionBox>
      ) : null}

      {field === 'gender' ? (
        <SectionBox title="ПОЛ">
          <OptionGrid options={GENDERS} value={gender ?? 'none'} onChange={busy ? undefined : pickGender} />
        </SectionBox>
      ) : null}

      <ErrorLine text={error} />
    </AccountPage>
  );
});
