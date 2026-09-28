import { router } from 'expo-router';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { startRecording } from '@/lib/voice';

/** Deep link kstati://record — кнопка микрофона на виджете открывает приложение сразу в записи */
export default function Record() {
  useEffect(() => {
    if (!useStore.getState().me) {
      router.replace('/login');
      return;
    }
    router.replace('/tasks');
    setTimeout(startRecording, 300);
  }, []);
  return null;
}
