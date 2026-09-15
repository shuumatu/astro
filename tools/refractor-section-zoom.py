"""Zoomed meridian sections of the refractor in its measured optical frame.

Writes:
  section-tube.png      r = 0..80 mm over the whole tube  (objective cell, baffles, focuser)
  section-objective.png r = 0..70 mm over the objective end only
  section-eyepiece.png  r = 0..70 mm over the eyepiece end only
  section-rings.png     r = 0..70 mm with the two tube rings highlighted
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
OUT.mkdir(parents=True, exist_ok=True)

import runpy
audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
instances = audit['instances']
components = audit['components']

frags = {}
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        frags[f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}'] = inst['tri'][faces]

meas = json.loads((OUT / 'axis-and-topology.json').read_text())
of = meas['opticalFrame']
axis = np.array(of['axis']); up = np.array(of['up']); right = np.array(of['right'])
O = np.array(of['point'])


def toFrame(p):
    d = np.atleast_2d(p) - O
    return np.c_[d @ axis, d @ up, d @ right]


def section(name, sLo, sHi, rMax, highlight=(), W=1800, H=620):
    img = Image.new('RGB', (W, H), '#0b1118')
    d = ImageDraw.Draw(img)
    padL, padR, padT, padB = 70, 30, 30, 40

    def X(s):
        return padL + (s - sLo) / (sHi - sLo) * (W - padL - padR)

    def Y(r):
        return H - padB - r / rMax * (H - padT - padB)

    for r in np.linspace(0, rMax, 9):
        d.line([(padL, Y(r)), (W - padR, Y(r))], fill='#182430')
        d.text((6, Y(r) - 6), f'{r*1000:4.0f}', fill='#5c7488')
    nS = 24
    for s in np.linspace(sLo, sHi, nS):
        d.line([(X(s), padT), (X(s), H - padB)], fill='#131c24')
        d.text((X(s) - 16, H - padB + 6), f'{s*1000:+.0f}', fill='#5c7488')
    d.text((padL, 8), f'{name}   axial position s (mm) vs radius (mm)   r scale 0..{rMax*1000:.0f}',
           fill='#ffd479')

    for tag, tri in frags.items():
        pts = toFrame(tri.reshape(-1, 3))
        r = np.linalg.norm(pts[:, 1:], axis=1)
        m = (pts[:, 0] >= sLo) & (pts[:, 0] <= sHi) & (r <= rMax)
        if not m.any():
            continue
        col = '#ff9b6b' if tag in highlight else '#7fc8ff'
        for sgn in (1, -1):
            d.point([(X(a), Y(sgn * b)) for a, b in zip(pts[m, 0], r[m])], fill=col)
        if tag in highlight:
            d.text((X(pts[m, 0].mean()), Y(r[m].max()) - 12), tag, fill='#ff9b6b')
    img.save(OUT / name)
    print('WROTE', OUT / name)


tube = frags['n4-m2-p0:c1']
tp = toFrame(tube.reshape(-1, 3))
tr = np.linalg.norm(tp[:, 1:], axis=1)
print('tube inner-radius profile (min radius present in each axial slice):')
for i in range(20):
    lo = tp[:, 0].min() + (tp[:, 0].max() - tp[:, 0].min()) * i / 20
    hi = tp[:, 0].min() + (tp[:, 0].max() - tp[:, 0].min()) * (i + 1) / 20
    m = (tp[:, 0] >= lo) & (tp[:, 0] < hi)
    if m.sum() < 5:
        continue
    hist, edges = np.histogram(tr[m], bins=24, range=(0, .08))
    modes = [f'{edges[j]*1000:.0f}' for j in np.argsort(hist)[-3:] if hist[j] > 20]
    print(f'  s={lo*1000:+7.1f}..{hi*1000:+7.1f}  rmin={tr[m].min()*1000:5.1f} rmax={tr[m].max()*1000:5.1f} '
          f' r-modes(mm)={modes}  n={int(m.sum())}')

section('section-tube.png', -.345, .315, .085,
        highlight=('n12-m6-p0:c0', 'n12-m6-p0:c1'))
section('section-objective.png', -.345, -.240, .075,
        highlight=('n4-m2-p0:c0', 'n4-m2-p0:c16', 'n4-m2-p0:c18', 'n4-m2-p0:c22'))
section('section-eyepiece.png', .120, .320, .075,
        highlight=('n14-m7-p0:c3', 'n14-m7-p0:c7', 'n14-m7-p0:c22', 'n4-m2-p0:c17'))
section('section-focuser.png', -.140, .130, .085,
        highlight=('n4-m2-p0:c6', 'n4-m2-p0:c7', 'n4-m2-p0:c8', 'n4-m2-p0:c3', 'n4-m2-p0:c4'))
