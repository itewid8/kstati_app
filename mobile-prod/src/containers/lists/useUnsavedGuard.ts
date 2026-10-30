/**
 * Уход с экрана с несохранёнными правками (назад, жест, системная кнопка, вкладка): вопрос
 * «Сохранить изменения?» — СОХРАНИТЬ / НЕ СОХРАНЯТЬ (ОТМЕНА — остаться). Правки заметки сохраняются только по ГОТОВО.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { openMenu } from '@/components/ActionMenu';

export function useUnsavedGuard(dirty: () => boolean, save: () => void, discard: () => void) {
  const navigation = useNavigation();
  const latest = useRef({ dirty, save, discard });
  latest.current = { dirty, save, discard };
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!latest.current.dirty()) return;
        e.preventDefault();
        Keyboard.dismiss();
        const go = () => navigation.dispatch(e.data.action);
        openMenu({
          title: 'Сохранить изменения?',
          actions: [
            {
              label: 'Сохранить',
              onPress: () => {
                latest.current.save();
                go();
              },
            },
            {
              label: 'Не сохранять',
              danger: true,
              onPress: () => {
                latest.current.discard();
                go();
              },
            },
          ],
        });
      }),
    [navigation],
  );
}
