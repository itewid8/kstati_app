import { router } from 'expo-router';
import { nav } from '../common';

/** Назад; страница открыта ссылкой и под ней ничего нет — в профиль */
export const backToProfile = () => (router.canGoBack() ? router.back() : router.navigate(nav.profile()));
