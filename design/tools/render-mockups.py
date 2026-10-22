#!/usr/bin/env python3
"""Render HTML mockups (mockups/C-*.dc.html) to reference PNGs.

    python3 design/tools/render-mockups.py            # all C-* mockups
    python3 design/tools/render-mockups.py C-Wishes   # selected ones
    --keep-frame  keep the rounded corners/outline of the phone frame

Output: design/reference/<Name>.light.png and <Name>.dark.png, 390x844 each.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from fonts import font_face_css  # noqa: E402

DESIGN = Path(__file__).resolve().parent.parent
MOCKUPS = DESIGN / 'mockups'
REFERENCE = DESIGN / 'reference'
EXPAND = DESIGN / 'tools' / 'expand.js'
PHONE_W, PHONE_H = 390, 844
THEMES = ('light', 'dark')

# The phone frame (radius 20 + outline) is presentation of the canvas, not the
# app screen: an RN screen fills the whole display, so we flatten it by default.
FLATTEN_FRAME = 'body > div > div { border-radius: 0 !important; outline: none !important; }'

WAIT_FONTS = """async () => {
  const faces = [...document.fonts];
  await Promise.all(faces.map(f => f.load().catch(() => null)));
  await document.fonts.ready;
  return faces.filter(f => f.status !== 'loaded').map(f => f.family + ' ' + f.weight);
}"""


def expand(src: Path, dst: Path) -> None:
    subprocess.run(['node', str(EXPAND), str(src), str(dst)], check=True)


def inject(html_path: Path, css: str) -> None:
    html = html_path.read_text(encoding='utf-8')
    html_path.write_text(html.replace('</head>', f'<style>{css}</style></head>', 1), encoding='utf-8')


def render(page, mockup: Path, tmp: Path, css: str) -> None:
    name = mockup.name.removesuffix('.dc.html')
    out_html = tmp / f'{name}.html'
    expand(mockup, out_html)
    inject(out_html, css)
    page.goto(out_html.as_uri())
    broken = page.evaluate(WAIT_FONTS)
    if broken:
        raise RuntimeError(f'{name}: fonts not loaded: {broken}')
    phones = page.query_selector_all('body > div > div')
    if len(phones) != 2:
        raise RuntimeError(f'{name}: expected 2 phones, got {len(phones)}')
    for theme, phone in zip(THEMES, phones):
        box = phone.bounding_box()
        if round(box['width']) != PHONE_W or round(box['height']) != PHONE_H:
            raise RuntimeError(f'{name}: phone {theme} is {box["width"]}x{box["height"]}')
        dst = REFERENCE / f'{name}.{theme}.png'
        page.screenshot(path=str(dst), clip={'x': round(box['x']), 'y': round(box['y']),
                                             'width': PHONE_W, 'height': PHONE_H})
    print(f'{name}: ok')


def main(argv: list[str]) -> int:
    keep_frame = '--keep-frame' in argv
    names = [a for a in argv if not a.startswith('--')]
    mockups = [MOCKUPS / f'{n}.dc.html' for n in names] or sorted(MOCKUPS.glob('C-*.dc.html'))
    css = font_face_css() + ('' if keep_frame else FLATTEN_FRAME)
    REFERENCE.mkdir(exist_ok=True)
    failed = 0
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 820, 'height': 844}, device_scale_factor=1)
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:')) else r.abort())
        for m in mockups:
            try:
                render(page, m, Path(tmp), css)
            except Exception as e:  # keep going, report at the end
                failed += 1
                print(f'{m.name}: FAILED {e}', file=sys.stderr)
        browser.close()
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
