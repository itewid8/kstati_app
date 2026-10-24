# Общие настройки scripts/test.sh и scripts/typecheck-lite.sh (подключается через `.`):
# tsc из офлайн-набора, шимы нативных модулей, пути @/* → src/*, react → @types/react из набора.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Офлайн-набор в облачном контейнере; на Mac после npm install — node_modules самого приложения
if [ -n "${KIT_NODE_MODULES:-}" ]; then KIT="$KIT_NODE_MODULES"
elif [ -d /home/claude/webkit/node_modules ]; then KIT=/home/claude/webkit/node_modules
else KIT="$ROOT/node_modules"; fi
TSC="${TSC:-$KIT/typescript/bin/tsc}"
SHIMS="$ROOT/scripts/shims"
[ -f "$TSC" ] || { echo "Нет tsc: $TSC (задайте TSC=… или KIT_NODE_MODULES=…)" >&2; exit 2; }

# JSON-список файлов шимов
shim_files() {
  local first=1
  for f in "$SHIMS"/*.d.ts; do
    [ $first -eq 1 ] && first=0 || printf ','
    printf '"%s"' "$f"
  done
}

# compilerOptions без include/files: $1 — дополнительные опции (строка JSON, с запятой в начале или пустая)
lite_options() {
  cat <<JSON
    "strict": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": [],
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["$ROOT/src/*"],
      "react": ["$KIT/@types/react/index.d.ts"],
      "react/*": ["$KIT/@types/react/*"]
    }$1
JSON
}
