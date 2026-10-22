/** Типы react-native-worklets для scripts/typecheck-lite.sh */
declare module 'react-native-worklets' {
  /** Вызвать функцию JS-потока из ворклета */
  export function scheduleOnRN<A extends unknown[]>(fn: (...args: A) => void, ...args: A): void;
  export function scheduleOnUI<A extends unknown[]>(fn: (...args: A) => void, ...args: A): void;
}
