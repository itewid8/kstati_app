import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { useStore, type Menu } from '@/lib/store';
import { ActionSheet } from '@/screens/sheets';
import { Sheet } from './Sheet';

/** Меню действий (долгое нажатие, «⋯», выбор «этот раз / вся серия»); одно действие — окно подтверждения */
export function ActionMenu() {
  const menu = useStore((s) => s.menu);
  const setMenu = useStore((s) => s.setMenu);
  // Держим последнее меню, чтобы окно не «пустело» во время закрытия
  const [shown, setShown] = useState<Menu | null>(menu);
  useEffect(() => {
    if (menu) setShown(menu);
  }, [menu]);

  const close = useCallback(() => setMenu(null), [setMenu]);
  const run = useCallback(
    (index: number) => {
      const action = shown?.actions[index];
      setMenu(null);
      action?.onPress();
    },
    [setMenu, shown],
  );

  return (
    <Sheet visible={!!menu} onClose={close} inset>
      {shown ? <ActionSheet title={shown.title} actions={shown.actions} onAction={run} onClose={close} /> : null}
    </Sheet>
  );
}

/** Открыть меню с лёгкой вибрацией */
export function openMenu(menu: Menu) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  useStore.getState().setMenu(menu);
}

/**
 * Подтверждение вместо системного Alert: карточка с вопросом и «ОТМЕНА» + действие (danger — красная рамка).
 * Для экранов, где раньше был Alert.alert(…, [{ text: 'Отмена' }, { text: 'Удалить', style: 'destructive' }])
 */
export function openConfirm({ title, action, danger = true, onConfirm }: { title: string; action: string; danger?: boolean; onConfirm: () => void }) {
  openMenu({ title, actions: [{ label: action, danger, onPress: onConfirm }] });
}
