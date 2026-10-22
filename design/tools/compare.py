#!/usr/bin/env python3
"""Compare harness renders (design/out) with mockup references (design/reference).

    python3 design/tools/compare.py C-Wishes [C-List ...] [--crop y0,y1] [--tol 8] [--theme light|dark]
    python3 design/tools/compare.py --all
    --json  print rows as JSON lines instead of a table

A pixel mismatches when any RGB channel differs by more than --tol (default 8).
Writes design/out/<Screen>.<theme>.compare.png: reference | render | diff (mismatches in red,
the --crop band framed in cyan). Exit code 1 if a pair is missing or sizes differ.
"""
import json
import sys
from pathlib import Path

import os

import numpy as np
from PIL import Image, ImageDraw

DESIGN = Path(__file__).resolve().parent.parent
REFERENCE = DESIGN / 'reference'
OUT = Path(os.environ['KSTATI_HARNESS_OUT']).resolve() if os.environ.get('KSTATI_HARNESS_OUT') else DESIGN / 'out'
THEMES = ('light', 'dark')
GAP, HEADER = 12, 22


def mismatch_mask(ref: np.ndarray, got: np.ndarray, tol: int) -> np.ndarray:
    return (np.abs(ref.astype(np.int16) - got.astype(np.int16)) > tol).any(axis=2)


def pct(mask: np.ndarray) -> float:
    return 100.0 * mask.sum() / mask.size if mask.size else 0.0


def compare_image(ref: np.ndarray, got: np.ndarray, mask: np.ndarray, crop, label: str) -> Image.Image:
    h, w, _ = ref.shape
    gray = ref.mean(axis=2, keepdims=True)
    diff = np.repeat(255 - (255 - gray) * 0.3, 3, axis=2)  # faded reference as backdrop
    diff[mask] = (230, 0, 0)
    canvas = Image.new('RGB', (w * 3 + GAP * 2, h + HEADER), (40, 40, 40))
    for i, arr in enumerate((ref, got, diff.astype(np.uint8))):
        canvas.paste(Image.fromarray(arr), (i * (w + GAP), HEADER))
    draw = ImageDraw.Draw(canvas)
    for i, text in enumerate(('reference', 'render', label)):
        draw.text((i * (w + GAP) + 4, 5), text, fill=(255, 255, 255))
    if crop:
        x0 = 2 * (w + GAP)
        draw.rectangle((x0, HEADER + crop[0], x0 + w - 1, HEADER + crop[1] - 1), outline=(0, 200, 255))
    return canvas


def compare(screen: str, theme: str, tol: int, crop) -> dict:
    ref_p, got_p = REFERENCE / f'{screen}.{theme}.png', OUT / f'{screen}.{theme}.png'
    row = {'screen': screen, 'theme': theme}
    if not ref_p.exists() or not got_p.exists():
        return {**row, 'error': f'missing {ref_p.name if not ref_p.exists() else got_p.relative_to(DESIGN)}'}
    ref = np.asarray(Image.open(ref_p).convert('RGB'))
    got = np.asarray(Image.open(got_p).convert('RGB'))
    if ref.shape != got.shape:
        return {**row, 'error': f'size {got.shape[1]}x{got.shape[0]} != {ref.shape[1]}x{ref.shape[0]}'}
    mask = mismatch_mask(ref, got, tol)
    row['full'] = round(pct(mask), 2)
    label = f'diff {row["full"]:.2f}%'
    if crop:
        row['band'] = round(pct(mask[crop[0]:crop[1]]), 2)
        label += f' | band {crop[0]}-{crop[1]}: {row["band"]:.2f}%'
    out = OUT / f'{screen}.{theme}.compare.png'
    compare_image(ref, got, mask, crop, label).save(out)
    row['compare'] = str(out.relative_to(DESIGN.parent)) if out.is_relative_to(DESIGN.parent) else str(out)
    return row


def print_table(rows: list[dict], crop) -> None:
    band = f'{crop[0]}-{crop[1]}' if crop else None
    head = f'{"screen":<16} {"theme":<6} {"mismatch":>9}' + (f' {"band " + band:>14}' if band else '') + '  compare image'
    print(head)
    print('-' * len(head))
    for r in rows:
        if 'error' in r:
            print(f'{r["screen"]:<16} {r["theme"]:<6} ERROR: {r["error"]}')
            continue
        line = f'{r["screen"]:<16} {r["theme"]:<6} {r["full"]:>8.2f}%'
        if band:
            line += f' {r["band"]:>13.2f}%'
        print(line + '  ' + r['compare'])


def parse(argv: list[str]):
    opts = {'tol': 8, 'crop': None, 'themes': THEMES, 'json': False, 'all': False}
    names, it = [], iter(argv)
    for a in it:
        if a == '--tol':
            opts['tol'] = int(next(it))
        elif a == '--crop':
            y0, y1 = (int(v) for v in next(it).split(','))
            opts['crop'] = (y0, y1)
        elif a == '--theme':
            opts['themes'] = (next(it),)
        elif a == '--json':
            opts['json'] = True
        elif a == '--all':
            opts['all'] = True
        else:
            names.append(a)
    if opts['all']:
        names = sorted({p.name.split('.')[0] for p in OUT.glob('*.png') if not p.name.endswith('.compare.png')})
    return names, opts


def main(argv: list[str]) -> int:
    names, opts = parse(argv)
    if not names:
        print(__doc__)
        return 2
    rows = [compare(n, t, opts['tol'], opts['crop']) for n in names for t in opts['themes']]
    if opts['json']:
        for r in rows:
            print(json.dumps(r))
    else:
        print_table(rows, opts['crop'])
    return 1 if any('error' in r for r in rows) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
