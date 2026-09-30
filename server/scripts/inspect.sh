#!/bin/bash
# Запуск scripts/inspect.ts с ключами базы из Lockbox (на экран они не выводятся).
#   bash scripts/inspect.sh почта@пример.ру
set -e
cd "$(dirname "$0")/.."
set -a
source deploy.env
set +a
eval "$(yc lockbox payload get --id "$LOCKBOX_ID" --format json | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const e of JSON.parse(s).entries)
      if (["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].includes(e.key))
        console.log(`export ${e.key}=${JSON.stringify(e.text_value)}`);
  });')"
npx tsx scripts/inspect.ts "$@"
