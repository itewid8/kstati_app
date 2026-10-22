import { router } from 'expo-router';
import { useEffect } from 'react';
import { isSignedIn } from '@/containers/common/signedIn';
import { useStore } from '@/lib/store';
import { armRecording } from '@/lib/voice';

/**
 * Deep link kstatiapp://record — кнопка микрофона на виджете открывает приложение сразу в записи.
 * Приложение уже открыто: ссылка кладёт этот экран поверх вкладок — dismissTo возвращает к ним (а не второй (tabs));
 * холодный старт: вкладок нет — dismissTo заменяет этот экран ими
 */
export default function Record() {
  useEffect(() => {
    if (!isSignedIn(useStore.getState())) {
      router.replace('/login');
      return;
    }
    router.dismissTo('/tasks');
    setTimeout(armRecording, 300);
  }, []);
  return null;
}
