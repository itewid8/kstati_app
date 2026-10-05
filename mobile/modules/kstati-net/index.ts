/**
 * Сеть телефона (модуль modules/kstati-net). Сейчас — только «включён ли VPN» на Android.
 * На iOS и в вебе модуля нет: считаем, что VPN не включён.
 */
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const native = requireOptionalNativeModule<{ isVpnActive(): boolean }>('KstatiNet');

export function isVpnActive(): boolean {
  try {
    return native?.isVpnActive() ?? false;
  } catch {
    return false;
  }
}

/** Включён ли VPN сейчас: проверяем при возврате в приложение и раз в 5 секунд, пока оно открыто */
export function useVpnActive(): boolean {
  const [on, setOn] = useState(isVpnActive);
  useEffect(() => {
    const check = () => setOn(isVpnActive());
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, 5000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return on;
}
