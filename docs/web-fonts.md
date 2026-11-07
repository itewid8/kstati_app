# Шрифты веб-версии

Geist и Geist Mono в WOFF2 — только латиница, кириллица и знаки препинания (~19 КБ на начертание вместо ~95 КБ TTF).
Подключаются в `src/ui/fonts.web.ts`, заранее загружаются из `public/index.html`.

Пересобрать (нужен Python: `pip install fonttools brotli`), из папки `mobile-prod`:

```
for f in node_modules/@expo-google-fonts/geist/{400Regular,500Medium,600SemiBold,700Bold}/*.ttf node_modules/@expo-google-fonts/geist-mono/{400Regular,500Medium,600SemiBold}/*.ttf; do
  pyftsubset "$f" --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2000-206F,U+20AC,U+20BD,U+2116,U+2122,U+2190-2199,U+2212,U+2215,U+2713,U+2715,U+25A0-25FF,U+2610-2612" \
    --layout-features='*' --flavor=woff2 --output-file="public/fonts/$(basename "$f" .ttf).woff2"
done
```
