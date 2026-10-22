"""Local @font-face rules for Geist / Geist Mono (offline, from the @expo-google-fonts kit).

Each TTF is declared twice:
  - family 'Geist' / 'Geist Mono' + font-weight  (CSS mockups, RN `fontFamily: 'Geist', fontWeight: '600'`)
  - family 'Geist_600SemiBold' / 'GeistMono_400Regular' (expo-google-fonts names used by mobile/src/theme.ts)
"""
from pathlib import Path

KIT = Path('/home/claude/webkit/node_modules/@expo-google-fonts')
NAMES = {400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold'}
FAMILIES = {'Geist': ('geist', 'Geist', (400, 500, 600, 700)),
            'Geist Mono': ('geist-mono', 'GeistMono', (400, 500, 600))}


def font_face_css() -> str:
    rules = []
    for family, (pkg, prefix, weights) in FAMILIES.items():
        for w in weights:
            stem = f'{prefix}_{w}{NAMES[w]}'
            ttf = KIT / pkg / f'{w}{NAMES[w]}' / f'{stem}.ttf'
            if not ttf.exists():
                raise FileNotFoundError(ttf)
            src = f"src:url('{ttf.as_uri()}') format('truetype');font-style:normal;font-display:block;"
            rules.append(f"@font-face{{font-family:'{family}';font-weight:{w};{src}}}")
            rules.append(f"@font-face{{font-family:'{stem}';{src}}}")
    return '\n'.join(rules)


if __name__ == '__main__':
    print(font_face_css())
