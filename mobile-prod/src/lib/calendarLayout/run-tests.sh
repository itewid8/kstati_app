#!/usr/bin/env sh
# Тесты раскладки календаря без npm: tsc проверяет типы и переводит в CommonJS, `node --test` запускает.
#   TSC=/path/to/typescript/bin/tsc sh run-tests.sh
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
TSC="${TSC:-/home/claude/webkit/node_modules/typescript/bin/tsc}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

# Минимальные типы node:test / node:assert — модули не зависят от @types/node
cat > "$OUT/node-shim.d.ts" <<'EOF'
declare module 'node:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void): void;
}
declare module 'node:assert/strict' {
  function assert(value: unknown, message?: string): asserts value;
  namespace assert {
    function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    function deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    function ok(value: unknown, message?: string): asserts value;
    function match(value: string, re: RegExp, message?: string): void;
  }
  export default assert;
}
EOF

cat > "$OUT/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": false,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "bundler",
    "types": [],
    "esModuleInterop": true,
    "rootDir": "$DIR",
    "outDir": "$OUT/js"
  },
  "include": ["$DIR/*.ts", "$OUT/node-shim.d.ts"]
}
EOF

node "$TSC" -p "$OUT/tsconfig.json"
node --test "$OUT"/js/*.test.js
