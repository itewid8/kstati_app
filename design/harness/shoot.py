#!/usr/bin/env python3
"""Screenshot screens from a harness bundle (made by bundle.mjs) with Chromium.

    python3 design/harness/shoot.py <bundle.js> <out_dir> [--theme light|dark] [Screen ...]

No screen names -> every screen in the registry. Writes <out_dir>/<Screen>.<theme>.png (390x844).
Prints one JSON line per shot: {"screen", "theme", "png"} or {"screen", "theme", "error"}.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
from fonts import font_face_css  # noqa: E402

W, H = 390, 844
BASE_CSS = f'html,body{{margin:0;padding:0;background:#fff}}#root{{width:{W}px;height:{H}px;display:flex;flex-direction:column;overflow:hidden;position:relative}}'


def write_page(bundle: Path) -> Path:
    page = bundle.with_name('index.html')
    page.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{font_face_css()}\n{BASE_CSS}</style></head>'
                    f'<body><div id="root"></div><script src="{bundle.name}"></script></body></html>', encoding='utf-8')
    return page


def open_page(browser, theme: str):
    ctx = browser.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, color_scheme=theme, locale='ru-RU')
    page = ctx.new_page()
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:')) else r.abort())
    console = []
    page.on('console', lambda m: m.type == 'error' and console.append(m.text))
    page.on('pageerror', lambda e: console.append(str(e)))
    return ctx, page, console


def load(page, url: str) -> dict:
    page.goto(url)
    page.wait_for_function('window.__harness && (window.__harness.ready || window.__harness.error)', timeout=20000)
    return page.evaluate('window.__harness')


def main(argv: list[str]) -> int:
    args = [a for a in argv]
    themes = ['light', 'dark']
    if '--theme' in args:
        i = args.index('--theme')
        themes = [args[i + 1]]
        del args[i:i + 2]
    bundle, out_dir, names = Path(args[0]).resolve(), Path(args[1]), args[2:]
    out_dir.mkdir(parents=True, exist_ok=True)
    url = write_page(bundle).as_uri()
    failed = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        if not names:
            ctx, page, console = open_page(browser, 'light')
            status = load(page, url)
            if status['error']:
                print(json.dumps({'screen': '*', 'theme': '-', 'error': status['error']}), flush=True)
                return 1
            names = status['screens']
            ctx.close()
        for name in names:
            for theme in themes:
                ctx, page, console = open_page(browser, theme)
                status = load(page, f'{url}?screen={name}&theme={theme}')
                if status['error']:
                    failed += 1
                    print(json.dumps({'screen': name, 'theme': theme, 'error': status['error'], 'console': console}), flush=True)
                else:
                    png = out_dir / f'{name}.{theme}.png'
                    page.screenshot(path=str(png), clip={'x': 0, 'y': 0, 'width': W, 'height': H})
                    print(json.dumps({'screen': name, 'theme': theme, 'png': str(png), 'console': console}), flush=True)
                ctx.close()
        browser.close()
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
