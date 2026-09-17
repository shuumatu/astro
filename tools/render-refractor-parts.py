"""Render classification candidates for the refractor: each part highlighted over dim context.

Usage: python tools/render-refractor-parts.py [mapping.json]
Without an argument it renders the reviewed ``part-of.json`` written by
``tools/refractor-classify.py``. Both tag-to-part and part-to-tags JSON shapes are accepted.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit/parts'
OUT.mkdir(parents=True, exist_ok=True)

import runpy
audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
instances = audit['instances']
components = audit['components']
draw_mesh = audit['draw_mesh']

frags = []
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        tri = inst['tri'][faces]
        frags.append({'tag': f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}',
                      'node': inst['node'], 'component': cid, 'tri': tri,
                      'lo': tri.reshape(-1, 3).min(axis=0), 'hi': tri.reshape(-1, 3).max(axis=0)})
byTag = {f['tag']: f for f in frags}
print(len(frags), 'fragments')

mappingPath = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.cache/refractor-audit/part-of.json'
rawMapping = json.loads(mappingPath.read_text())
if rawMapping and all(isinstance(value, str) for value in rawMapping.values()):
    mapping = {}
    for tag, part in rawMapping.items():
        mapping.setdefault(part, []).append(tag)
else:
    mapping = rawMapping
allTri = np.concatenate([f['tri'] for f in frags])


def render(name, tags, views):
    sel = [byTag[t] for t in tags]
    cols = len(views)
    sheet = Image.new('RGB', (cols * 460, 960), '#0b1118')
    for k, view in enumerate(views):
        draw_mesh(sheet, allTri, (k * 460 + 6, 30, k * 460 + 454, 474), view,
                  color=(45, 59, 72))
    for k, view in enumerate(views):
        for f in sel:
            draw_mesh(sheet, f['tri'], (k * 460 + 6, 30, k * 460 + 454, 474), view,
                      color=(255, 190, 72), fit_triangles=allTri)
    # isolated views: the candidate fragments alone, fitted to their own box
    selTri = np.concatenate([f['tri'] for f in sel])
    for k, view in enumerate(views):
        draw_mesh(sheet, selTri, (k * 460 + 6, 496, k * 460 + 454, 950), view,
                  color=(255, 190, 72))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), f'{name}  ({len(tags)} fragments, {selTri.shape[0]} faces)  top=context bottom=isolated',
           fill='#ffd479')
    sheet.save(OUT / f'{name}.png')


views = [(1, .35, 1), (-1, .35, 1)]
for name, tags in mapping.items():
    missing = [t for t in tags if t not in byTag]
    if missing:
        print('MISSING', name, missing)
    render(name, [t for t in tags if t in byTag], views)
print('WROTE', OUT)
