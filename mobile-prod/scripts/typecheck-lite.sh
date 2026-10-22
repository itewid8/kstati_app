#!/usr/bin/env bash
# Проверка типов без npm (tsc из офлайн-набора и шимы scripts/shims/*.d.ts вместо react-native и нативных модулей):
#   1) src/adapters, чистые модули src/lib, src/screens, src/ui — как в приложении (strict);
#   2) дополнительно noUncheckedIndexedAccess — ошибки только в src/adapters и src/lib/personColors.ts.
# Контейнеры (src/containers) и маршруты (app/) зависят от expo-router и хранилища — их проверяет `npm run typecheck` на Mac.
#   bash mobile-prod/scripts/typecheck-lite.sh
set -euo pipefail
. "$(dirname "$0")/lite.sh"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

PURE="types recur span dates remind plans dupes personColors"
LIB="$(for m in $PURE; do printf '"%s/src/lib/%s.ts",' "$ROOT" "$m"; done)"
INCLUDE='"'"$ROOT"'/src/adapters/**/*.ts", "'"$ROOT"'/src/screens/**/*.ts", "'"$ROOT"'/src/screens/**/*.tsx", "'"$ROOT"'/src/ui/**/*.ts", "'"$ROOT"'/src/ui/**/*.tsx", "'"$ROOT"'/src/lib/calendarLayout/*.ts", "'"$ROOT"'/src/lib/*.test.ts"'

config() {
  cat > "$OUT/$1.json" <<JSON
{
  "compilerOptions": {
$(lite_options ',
    "module": "esnext",
    "noEmit": true'"$2")
  },
  "files": [$(shim_files), ${LIB%,}],
  "include": [$INCLUDE]
}
JSON
}

config base ''
config strict ',
    "noUncheckedIndexedAccess": true'

status=0
echo "== strict"
node "$TSC" -p "$OUT/base.json" || status=1
echo "== noUncheckedIndexedAccess (src/adapters, src/lib/personColors.ts)"
if node "$TSC" -p "$OUT/strict.json" > "$OUT/strict.log"; then :; fi
# tsc пишет пути относительно папки tsconfig — ищем по хвосту пути
if grep -E "(^|/)src/(adapters/|lib/personColors\.ts)" "$OUT/strict.log"; then status=1; fi
[ $status -eq 0 ] && echo "0 ошибок"
exit $status
