import { useLocalSearchParams } from 'expo-router';
import { EditFieldContainer } from '@/containers/account/EditFieldContainer';
import { PasswordContainer } from '@/containers/account/PasswordContainer';
import { param, type ProfileField } from '@/containers/common/nav';

const FIELDS: readonly ProfileField[] = ['name', 'nick', 'gender', 'password'];
const fieldOf = (v: string | undefined): ProfileField => FIELDS.find((f) => f === v) ?? 'name';

/** Поле профиля ?field= (имя, ник, пол) или смена пароля — страница с ОТМЕНА / СОХРАНИТЬ */
export default function ProfileEditRoute() {
  const field = fieldOf(param(useLocalSearchParams().field));
  return field === 'password' ? <PasswordContainer /> : <EditFieldContainer field={field} />;
}
