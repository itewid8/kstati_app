#!/usr/bin/env bash
# Коммит и пуш в main одной командой.
#   bash push.sh "Сообщение коммита"      — проверки, коммит, пуш
#   bash push.sh -n "Сообщение"           — без проверок (тесты и типы не запускать)
# Перед коммитом: тесты и типы приложения и сервера, поиск секретов среди файлов коммита.
# Пуш изменений в server/ запускает деплой сервера (GitHub Actions).
set -euo pipefail
cd "$(dirname "$0")"

checks=1
if [[ "${1:-}" == "-n" ]]; then checks=0; shift; fi
msg="${1:-}"
if [[ -z "$msg" ]]; then
  read -r -p "Сообщение коммита: " msg
fi
[[ -z "$msg" ]] && { echo "✗ Пустое сообщение — отмена"; exit 1; }

branch="$(git rev-parse --abbrev-ref HEAD)"
echo "▸ Ветка: $branch"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "✓ Изменений нет — коммитить нечего"
  exit 0
fi

if (( checks )); then
  echo "▸ Тесты приложения…"
  bash mobile-prod/scripts/test.sh > /tmp/kstati-test.log 2>&1 || true
  if grep -qE "^ℹ fail [1-9]|error TS" /tmp/kstati-test.log; then
    grep -E "^ℹ (pass|fail)|error TS|✖" /tmp/kstati-test.log | head -20
    echo "✗ Тесты приложения не прошли (лог: /tmp/kstati-test.log)"; exit 1
  fi
  grep -E "^ℹ (pass|fail)" /tmp/kstati-test.log || true

  echo "▸ Типы приложения…"
  (cd mobile-prod && node node_modules/typescript/bin/tsc --noEmit -p .) || { echo "✗ Ошибки типов в приложении"; exit 1; }

  echo "▸ Сервер: типы и тесты…"
  bash server-test.sh > /tmp/kstati-server.log 2>&1 || { tail -30 /tmp/kstati-server.log; echo "✗ Тесты сервера не прошли (лог: /tmp/kstati-server.log)"; exit 1; }
  grep -E "^✓" /tmp/kstati-server.log || true
fi

git add -A

# Секреты не должны попасть в git ни при каких настройках .gitignore
bad="$(git diff --cached --name-only | grep -E '(^|/)\.env($|\.)|\.pem$|\.p8$|\.p12$|\.key$|\.keystore$|\.jks$|deploy\.env$|(^|/)\.data/|\.jsonl$|(^|/)inspect\.txt$' | grep -v '\.env\.example$' || true)"
if [[ -n "$bad" ]]; then
  git reset -q
  echo "✗ Похоже на секреты или личные данные — коммит отменён:"
  echo "$bad"
  exit 1
fi

echo "▸ В коммит войдёт:"
git diff --cached --stat | tail -25
read -r -p "Коммитить и пушить? [Y/n] " yn
if [[ "${yn:-y}" =~ ^[Nn] ]]; then
  git reset -q
  echo "Отмена — файлы сняты с индекса, изменения на месте"
  exit 0
fi

server_changed=0
git diff --cached --name-only | grep -q '^server/' && server_changed=1

git commit -q -m "$msg"
echo "✓ Коммит $(git rev-parse --short HEAD)"

git pull --rebase -q origin "$branch"
git push origin "$branch"
echo "✓ Отправлено в origin/$branch"

if (( server_changed )); then
  echo "▸ Изменён server/ — деплой запустится в GitHub Actions"
  command -v gh >/dev/null && echo "  Следить: gh run watch" || true
fi
