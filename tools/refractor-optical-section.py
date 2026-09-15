"""Section profile along the refractor's optical axis, plus objective/eyepiece-end detail.

Produces a 2D meridian section (radius vs. axial position) of the whole model in the
measured optical frame, and a per-fragment summary of where each fragment sits
relative to that axis. This is the evidence used to decide what is a lens seat, a
retainer, an aperture stop, a baffle, or a solid disk.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
OUT.mkdir(parents=True, exist_ok=True)
lines = []


def say(s=''):
    print(s)
    lines.append(s)


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
axis = np.array(of['axis'])
up = np.array(of['up'])
right = np.array(of['right'])
O = np.array(of['point'])


def toFrame(p):
    d = np.atleast_2d(p) - O
    return np.c_[d @ axis, d @ up, d @ right]


say('=' * 96)
say('OPTICAL FRAME (measured)')
say(f'  axis  (objective -> eyepiece) = {np.round(axis, 6).tolist()}')
say(f'  up                            = {np.round(up, 6).tolist()}')
say(f'  right                         = {np.round(right, 6).tolist()}')
say(f'  origin (tube mid, on axis)    = {np.round(O, 6).tolist()}')

allTri = np.concatenate([frags[t] for t in frags])
fp = toFrame(allTri.reshape(-1, 3))
say(f'  model s range   = {fp[:,0].min()*1000:+.1f} .. {fp[:,0].max()*1000:+.1f} mm')
say(f'  model rad max   = {np.linalg.norm(fp[:,1:], axis=1).max()*1000:.1f} mm')

say()
say('PER-FRAGMENT POSITION IN THE OPTICAL FRAME (mm)')
say(f'  {"tag":20s} {"faces":>6s} {"s range":>19s} {"radial range":>16s} {"rmin":>7s} {"rmax":>7s} {"offaxis":>8s}')
rows = []
for tag in sorted(frags, key=lambda t: -len(frags[t])):
    p = toFrame(frags[tag].reshape(-1, 3))
    s = p[:, 0]
    r = np.linalg.norm(p[:, 1:], axis=1)
    c = toFrame(frags[tag].reshape(-1, 3).mean(axis=0))[0]
    rows.append({'tag': tag, 'faces': int(len(frags[tag])), 'sMin': float(s.min()), 'sMax': float(s.max()),
                 'rMin': float(r.min()), 'rMax': float(r.max()),
                 'offaxis': float(np.hypot(c[1], c[2]))})
    say(f'  {tag:20s} {len(frags[tag]):6d} {s.min()*1000:+8.1f}..{s.max()*1000:+7.1f} '
        f'{r.min()*1000:7.1f}..{r.max()*1000:7.1f} {r.min()*1000:7.2f} {r.max()*1000:7.2f} '
        f'{np.hypot(c[1], c[2])*1000:8.1f}')

# ---- meridian section image: radius vs axial position ----
W, H = 1600, 700
img = Image.new('RGB', (W, H), '#0b1118')
d = ImageDraw.Draw(img)
smin, smax = fp[:, 0].min(), fp[:, 0].max()
rmax = np.linalg.norm(fp[:, 1:], axis=1).max()
pad = 40


def X(s):
    return pad + (s - smin) / (smax - smin) * (W - 2 * pad)


def Y(r):
    return H - pad - r / rmax * (H - 2 * pad)


d.line([(X(0), pad), (X(0), H - pad)], fill='#2a3a4a')
for r in np.linspace(0, rmax, 6):
    d.line([(pad, Y(r)), (W - pad, Y(r))], fill='#17222c')
    d.text((4, Y(r) - 6), f'{r*1000:5.0f}', fill='#5c7488')
for s in np.linspace(smin, smax, 17):
    d.line([(X(s), pad), (X(s), H - pad)], fill='#131c24')
    d.text((X(s) - 14, H - pad + 6), f'{s*1000:+.0f}', fill='#5c7488')
for tag, tri in frags.items():
    pts = toFrame(tri.reshape(-1, 3))
    r = np.linalg.norm(pts[:, 1:], axis=1)
    order = np.argsort(pts[:, 0])
    poly = [(X(pts[i, 0]), Y(r[i])) for i in order]
    d.point(poly, fill='#7fc8ff')
    poly2 = [(X(pts[i, 0]), Y(-r[i])) for i in order]
    d.point(poly2, fill='#7fc8ff')
img.save(OUT / 'optical-section.png')
say()
say('WROTE ' + str(OUT / 'optical-section.png'))

# ---- objective-end detail: everything with s < -150 mm ----
say()
say('OBJECTIVE-END DETAIL (fragments reaching s < -150 mm), sorted by sMin')
for r in sorted([r for r in rows if r['sMin'] < -.15], key=lambda r: r['sMin']):
    say(f'  {r["tag"]:20s} faces={r["faces"]:6d} s={r["sMin"]*1000:+8.1f}..{r["sMax"]*1000:+7.1f} '
        f'radius={r["rMin"]*1000:6.2f}..{r["rMax"]*1000:6.2f} offaxis={r["offaxis"]*1000:6.2f}')

say()
say('EYEPIECE-END DETAIL (fragments reaching s > +150 mm)')
for r in sorted([r for r in rows if r['sMax'] > .15], key=lambda r: -r['sMax']):
    say(f'  {r["tag"]:20s} faces={r["faces"]:6d} s={r["sMin"]*1000:+8.1f}..{r["sMax"]*1000:+7.1f} '
        f'radius={r["rMin"]*1000:6.2f}..{r["rMax"]*1000:6.2f} offaxis={r["offaxis"]*1000:6.2f}')

json.dump({'opticalFrame': of, 'fragments': rows}, open(OUT / 'optical-frame-fragments.json', 'w'), indent=2)
(OUT / 'optical-section-report.txt').write_text('\n'.join(lines), encoding='utf-8')
say()
say('WROTE ' + str(OUT / 'optical-section-report.txt'))
