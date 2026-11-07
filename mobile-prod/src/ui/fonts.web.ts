/**
 * Веб: те же начертания, что в fonts.ts, но WOFF2 только с латиницей и кириллицей (public/fonts, ~19 КБ каждый
 * вместо ~95 КБ TTF). Подгружаются заранее из index.html (preload). Ключи совпадают с fontFamily в tokens.ts.
 * Пересобрать после смены шрифтов: pyftsubset (fonttools) по TTF из @expo-google-fonts, см. public/fonts/README.md
 */
const font = (name: string) => `/fonts/${name}.woff2`;

export const uiFonts = {
  Geist_400Regular: font('Geist_400Regular'),
  Geist_500Medium: font('Geist_500Medium'),
  Geist_600SemiBold: font('Geist_600SemiBold'),
  Geist_700Bold: font('Geist_700Bold'),
  GeistMono_400Regular: font('GeistMono_400Regular'),
  GeistMono_500Medium: font('GeistMono_500Medium'),
  GeistMono_600SemiBold: font('GeistMono_600SemiBold'),
};
