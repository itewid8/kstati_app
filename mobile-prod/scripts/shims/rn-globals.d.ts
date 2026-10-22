/** Глобальные функции среды React Native (без lib DOM и @types/node) — для scripts/typecheck-lite.sh и test.sh */
declare function setTimeout(callback: (...args: never[]) => unknown, ms?: number, ...args: unknown[]): number;
declare function clearTimeout(id: number | undefined | null): void;
declare function setInterval(callback: (...args: never[]) => unknown, ms?: number, ...args: unknown[]): number;
declare function clearInterval(id: number | undefined | null): void;
declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(id: number): void;
declare const console: {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
