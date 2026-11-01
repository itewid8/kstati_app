# Структурное ревью дизайна

Карта всех экранов без скриншотов: геометрия, цвета и тексты из рендера react-native-web + граф переходов из кода.

1. Бандл (на Mac): `cd mobile-prod && KIT_NODE_MODULES=$PWD/node_modules node ../design/harness/bundle.mjs design-registry.review.tsx ../design/review/bundle.js`
   Экраны — реестры `design-registry.*.tsx`; недостающие окна — `design-registry.extra.tsx`.
2. Дамп (нужен Playwright + Chromium): `python3 dump.py bundle.js out` → `out/<Экран>.<тема>.json`
3. `graph.py` — узлы и переходы (обновлять при новых экранах), `checks.py` → findings.json,
   `export.py` → data.json, `page.py` + `template.html` → HTML-карта.
