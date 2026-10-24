import { useLocalSearchParams } from 'expo-router';
import { AvatarContainer } from '@/containers/account/AvatarContainer';
import { colorParam } from '@/containers/account/routes';
import { param } from '@/containers/common/nav';

/** «Иконка»: цвет и символ; ?color= — цвет, нажатый в профиле */
export default function AvatarRoute() {
  const color = colorParam(param(useLocalSearchParams().color));
  return <AvatarContainer color={color} />;
}
