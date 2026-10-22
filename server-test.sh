#!/usr/bin/env bash
# Тесты сервера без tsx (в контейнере нет нативного esbuild): компилируем tsc и запускаем node
set -e
cd "$(dirname "$0")/server"
OUT=/tmp/tsout
rm -rf $OUT && mkdir -p $OUT
npx tsc -p tsconfig.json --outDir $OUT --noEmit false --declaration false --sourceMap false --rootDir . >/dev/null || { echo "tsc failed"; npx tsc -p tsconfig.json --noEmit; exit 1; }
ln -sfn "$PWD/node_modules" $OUT/node_modules
echo '{"type":"module"}' > $OUT/package.json
for t in repeat ideas duration v2 e2e compat-v1; do echo "== $t"; node $OUT/test/$t.js; done
