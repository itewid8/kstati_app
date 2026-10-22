# src/ui — дизайн-система «Инструмент»

Источник правды — макеты `design/mockups/C-*.dc.html`. Квадратные углы, рамки 1.5px, Geist + Geist Mono.

## Токены (`tokens.ts`)

- `palettes.light / .dark` — bg, panel, alt, border, hair, hairStrong, faint, text, muted, red, warn, glow, scrim, tintAlpha.
  В тёмной теме hair в макетах разный (#222 / #1E1E1E / #242424), у нас один — `#222222`.
- Цвет человека берётся из его профиля (`User.color`: blue, pink, green, yellow… или свой `#hex`) и одинаков во всех группах:
  `personColor(color, scheme)`, `personInk(color, scheme)` (текст поверх), `tint(hex, a)`. В макетах s = blue, k = pink, g/o = green, y = yellow.
- `size` — сетка экрана: панель top 20 / h 40, кнопки 40×40, иконки 18 (16 в List/EditDate), заголовок top 70,
  вкладки top 120 / h 32, контент от 162 до bottom 98, шапка секции 22, строка 44, «сделано» 35, навигация bottom 18 / h 72, REC 104.
- `fonts` — имена начертаний expo-google-fonts (`Geist_700Bold`…). `fontWeight` не задаём: у каждого веса своё семейство.
  Загрузка: `useFonts(uiFonts)` из `fonts.ts`.
- `type` — готовые стили текста; `letterSpacing` уже в px (em × размер).

## Тема

`useTheme()` → `{ scheme, dark, c, person(color), personInk(color) }`, по `useColorScheme()`.

## Компоненты

`Icon` (back, forward, plus, bell, list, chevronUp/Down/Right, close, check, link, filter, dots, people), `IconButton`,
`TopBar` (lead: caption / group / back + actions), `ScreenTitle`, `Tabs` (tabs — равные колонки 32px; view — 28px по ширине),
`SectionBox` (inverted / muted, счётчик, сворачивание, scrollable), `ListRow` + `RowLinkButton`, `DoneRow`, `Checkbox`,
`PersonTag`, `BottomNav` (+ REC; режим «удерживать» — `RecButtonContext`), `BottomSheet`, `InputSheet` (ввод текста: ОТМЕНА / СОХРАНИТЬ),
`Marquee` — однострочный текст вместо `<Text numberOfLines={1}>`: не влезает — через 1 с бегущая строка по кругу (UI-поток),
при «уменьшить движение» — многоточие; `ellipsis={false}` — в покое обрезка краем. Блоки событий в колонках Недели/Дня — без него. Импорт: `import { ListRow, useTheme } from '@/ui'`.

## Правила

- Компоненты только рисуют: данные — пропсами, действия — колбэками. Без стора, сети и навигации внутри.
- Цвета, размеры, шрифты — только из токенов. Никаких поясняющих подписей в интерфейсе.
- Экраны раскладываются как в макете: абсолютные отступы из `size` + safe area (`insets`), длинные списки прокручиваются внутри секции.
- Без `numberOfLines` у заголовков с отрицательным letterSpacing: обрезка срезает хвост последней буквы.
- Новый экран сначала проходит сверку с макетом (≤ 2% в обеих темах, и обязательно посмотреть `compare.png`).

## Сверка с макетом

```sh
# из корня репозитория; экраны с данными-моками — в mobile-prod/design-registry.tsx
node design/harness/run.mjs mobile-prod/design-registry.tsx C-Wishes
node design/harness/run.mjs mobile-prod/design-registry.tsx C-Wishes --crop 0,120   # отдельная полоса
```

Результат: `design/out/C-Wishes.<тема>.compare.png` (эталон | рендер | дифф). Подробности — `design/README.md`.
