"""Render whole-mesh instances of the refractor GLB with numbered fragments highlighted.

Usage: python tools/render-refractor-mesh.py <meshId> <view>
Views: iso front side top back iso2
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit/meshviews'
OUT.mkdir(parents=True, exist_ok=True)

import runpy
audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
instances = audit['instances']
components = audit['components']
draw_mesh = audit['draw_mesh']

VIEWS = {'front': (0, 0, 1), 'back': (0, 0, -1), 'side': (1, 0, 0), 'top': (0, -1, .001),
         'iso': (1, .35, 1), 'iso2': (1, .8, 1), 'iso3': (-1, .6, -1), 'iso4': (.6, .9, -1)}

meshId = int(sys.argv[1])
viewName = sys.argv[2] if len(sys.argv) > 2 else 'iso'
view = VIEWS[viewName]
inst = next(i for i in instances if i['mesh'] == meshId)
groups = components(inst['tri'], return_ids=True)

S = 1400
sheet = Image.new('RGB', (S * 2, S + 40), '#0b1118')
draw_mesh(sheet, inst['tri'], (10, 40, S - 10, S + 30), view)
draw_mesh(sheet, inst['tri'], (S + 10, 40, 2 * S - 10, S + 30), view)
d = ImageDraw.Draw(sheet)
d.text((12, 12), f'mesh {meshId} node {inst["node"]}  {len(inst["tri"])} faces  '
                 f'{len(groups)} components  view={viewName}', fill='#ffd479')


def basis(view):
    z = np.array(view, float); z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.array([x, y, z])


B = basis(view)
tri = inst['tri']
t = tri @ B.T
lo, hi = t.min(axis=(0, 1)), t.max(axis=(0, 1))


def toScreen(p):
    q = p @ B.T
    return (10 + (q[0] - lo[0]) / max(hi[0] - lo[0], 1e-9) * (S - 20),
            (S + 30) - (q[1] - lo[1]) / max(hi[1] - lo[1], 1e-9) * (S - 20))


for cid, faces in enumerate(groups):
    c = tri[faces].reshape(-1, 3).mean(axis=0)
    for dx in (0, S):
        px, py = toScreen(c)
        px += dx
        d.ellipse([px - 12, py - 12, px + 12, py + 12], outline='#ff5f5f', width=2)
        d.text((px + 14, py - 8), f'c{cid}', fill='#ffd479')
sheet.save(OUT / f'mesh{meshId}-{viewName}.png')
print('WROTE', OUT / f'mesh{meshId}-{viewName}.png', len(groups), 'components')
