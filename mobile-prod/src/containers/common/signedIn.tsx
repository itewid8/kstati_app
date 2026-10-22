import type { ComponentType, ReactElement } from 'react';
import { DEMO, useStore } from '@/lib/store';
import type { StoreState } from './useSnapshot';

/**
 * Вошёл ли человек: есть me, есть токен (в демо токена нет) и сервер не выкинул по 401 (authLost).
 * Одно правило для корневого макета (Stack.Protected), вкладок и контейнеров
 */
export const isSignedIn = (s: StoreState): boolean => !!s.me && !s.authLost && (DEMO || !!s.session);

export const useSignedIn = (): boolean => useStore(isSignedIn);

/**
 * Контейнер рисуется только после входа: при выходе экран ещё раз отрисовался бы с пустым человеком (NO_ME).
 * Внутренний компонент размонтируется раньше, чем увидит хранилище без me
 */
export function signedInOnly<P extends object>(Inner: ComponentType<P>): (props: P) => ReactElement | null {
  function SignedIn(props: P) {
    return useSignedIn() ? <Inner {...props} /> : null;
  }
  SignedIn.displayName = `SignedIn(${Inner.displayName ?? Inner.name ?? 'Container'})`;
  return SignedIn;
}
