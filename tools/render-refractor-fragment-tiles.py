"""Render individual fragments of the refractor GLB as large labeled tiles.

Usage: python tools/render-refractor-fragment-tiles.py <outname> <tag>=<view> ...
Views: front=(0,0,1) side=(1,0,0) top=(0,-1,0.001) iso=(1,.35,1) tube=<axis triplet>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit/tiles'
OUT.mkdir(parents=True, exist_ok=True)

import runpy
audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
instances = audit['instances']
components = audit['components']
draw_mesh = audit['draw_mesh']

frags = {}
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        frags[f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}'] = inst['tri'][faces]

name = sys.argv[1]
specs = [s.split('=') for s in sys.argv[2:]]
views = [(0, 0, 1), (1, 0, 0), (0, -1, .001), (1, .35, 1)]
tile = 460
sheet = Image.new('RGB', (len(views) * tile, len(specs) * tile), '#0b1118')
d = ImageDraw.Draw(sheet)
for row, (tag, note) in enumerate(specs):
    tri = frags[tag]
    for col, view in enumerate(views):
        draw_mesh(sheet, tri, (col * tile + 6, row * tile + 30, col * tile + tile - 6, row * tile + tile - 6), view)
    d.text((8, row * tile + 8), f'{tag}  {note}', fill='#ffd479')
sheet.save(OUT / f'{name}.png')
print('WROTE', OUT / f'{name}.png')
