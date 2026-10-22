/** Минимальные типы node:test / node:assert для тестов адаптеров (без @types/node) */
declare module 'node:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
}
declare module 'node:assert/strict' {
  function assert(value: unknown, message?: string): asserts value;
  namespace assert {
    function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    function notEqual(actual: unknown, expected: unknown, message?: string): void;
    function deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    function ok(value: unknown, message?: string): asserts value;
    function match(value: string, re: RegExp, message?: string): void;
    function throws(fn: () => unknown, message?: string): void;
  }
  export default assert;
}
