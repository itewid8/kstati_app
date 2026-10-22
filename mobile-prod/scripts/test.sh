#!/usr/bin/env bash
# Тесты адаптеров и чистых модулей без npm: tsc (из офлайн-набора) проверяет типы и переводит в CommonJS,
# хук require переписывает «@/…» на собранные файлы, `node --test` запускает. Часовой пояс — Москва.
#   bash mobile-prod/scripts/test.sh                     — все src/adapters/**/*.test.ts, src/lib/*.test.ts и src/ui/**/*.test.ts
#   bash mobile-prod/scripts/test.sh src/adapters/common — только эта папка (или один файл)
# Раскладка календаря проверяется своим src/lib/calendarLayout/run-tests.sh.
set -euo pipefail
. "$(dirname "$0")/lite.sh"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

if [ $# -gt 0 ]; then
  # Путь от текущей папки или от mobile-prod
  if [ -e "$1" ]; then TARGET="$(realpath "$1")"; else TARGET="$(cd "$ROOT" && realpath "$1")"; fi
  if [ -d "$TARGET" ]; then TESTS="$(find "$TARGET" -name '*.test.ts' | sort)"; else TESTS="$TARGET"; fi
else
  TESTS="$( { find "$ROOT/src/adapters" -name '*.test.ts'; find "$ROOT/src/lib" -maxdepth 1 -name '*.test.ts'; find "$ROOT/src/ui" -name '*.test.ts'; } | sort)"
fi
[ -n "$TESTS" ] || { echo "Нет тестов" >&2; exit 1; }

FILES="$(printf '%s\n' $TESTS | sed 's/.*/"&"/' | paste -sd, -)"
cat > "$OUT/tsconfig.json" <<JSON
{
  "compilerOptions": {
$(lite_options ',
    "module": "commonjs",
    "noUnusedLocals": true,
    "noEmitOnError": true,
    "rootDir": "'"$ROOT"'",
    "outDir": "'"$OUT/js"'"')
  },
  "files": [$(shim_files), $FILES]
}
JSON

# «@/x» → собранный src/x
cat > "$OUT/alias.cjs" <<JS
const Module = require('node:module');
const path = require('node:path');
const SRC = path.join(__dirname, 'js', 'src');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(SRC, request.slice(2)) : request, ...rest);
};
JS

node "$TSC" -p "$OUT/tsconfig.json"
JS_TESTS="$(printf '%s\n' $TESTS | sed "s|^$ROOT|$OUT/js|; s|\.ts\$|.js|")"
TZ=Europe/Moscow node --require "$OUT/alias.cjs" --test --test-reporter=spec $JS_TESTS
