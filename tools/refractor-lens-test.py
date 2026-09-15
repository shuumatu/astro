"""Is there a real objective lens in the refractor GLB? Test every fragment near the
objective end for (a) a cylindrical bore that could be a lens seat, (b) a spherical /
aspherical surface that would be an actual lens face, (c) a flat disk (which is not a lens).

Also clusters wall-face radii of the main tube to recover the tube's concentric surfaces
and therefore the clear aperture at each end.
"""
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
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
axis = np.array(of['axis']); up = np.array(of['up']); right = np.array(of['right'])
O = np.array(of['point'])


def toFrame(p):
    d = np.atleast_2d(p) - O
    return np.c_[d @ axis, d @ up, d @ right]


def face_normals(tri):
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    a = np.linalg.norm(fn, axis=1) / 2
    return fn / np.maximum(np.linalg.norm(fn, axis=1)[:, None], 1e-18), a


def sphere_fit(tri):
    p = tri.reshape(-1, 3)
    A = np.c_[2 * p, np.ones(len(p))]
    b = (p ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    c = sol[:3]
    r2 = sol[3] + (c ** 2).sum()
    if r2 <= 0:
        return None
    r = float(np.sqrt(r2))
    d = np.linalg.norm(p - c, axis=1)
    return {'radius': r, 'residFrac': float(d.std() / max(r, 1e-9)), 'center': c.tolist()}


# ------------------------------------------------------------------ tube surfaces
say('=' * 96)
say('A) MAIN TUBE CONCENTRIC SURFACE RADII (wall faces of n4-m2-p0:c1)')
tube = frags['n4-m2-p0:c1']
fn, area = face_normals(tube)
tp = toFrame(tube.reshape(-1, 3))
s = tp[:, 0]
r = np.linalg.norm(tp[:, 1:], axis=1)
wall = np.abs(fn @ axis) < .25
# per-face radius and axial position (mean over the face's three vertices)
faceS = s.reshape(-1, 3).mean(axis=1)
faceR = r.reshape(-1, 3).mean(axis=1)
wallR = faceR[wall]
hist, edges = np.histogram(wallR, bins=60, range=(0, .07))
say('   dominant concentric wall radii:')
for i in range(60):
    if hist[i] < 40:
        continue
    say(f'   r ~ {(edges[i]+edges[i+1])/2*1000:6.2f} mm   wall faces={hist[i]:5d}')
say()
say('   radius vs axial position (wall faces, mm) - shows the stepped tube + dew shield:')
for i in range(20):
    lo = s.min() + (s.max() - s.min()) * i / 20
    hi = s.min() + (s.max() - s.min()) * (i + 1) / 20
    m = wall & (faceS >= lo) & (faceS < hi)
    if m.sum() < 20:
        continue
    rv = faceR[m]
    h2, e2 = np.histogram(rv, bins=40, range=(0, .07))
    peaks = [f'{(e2[j]+e2[j+1])/2*1000:.0f}' for j in np.argsort(h2)[-3:] if h2[j] > 15]
    say(f'     s={lo*1000:+7.1f}..{hi*1000:+7.1f}  r {rv.min()*1000:5.1f}..{rv.max()*1000:5.1f}  '
        f'peaks(mm)={sorted(peaks, key=float)}  n={int(m.sum())}')

# ------------------------------------------------------------------ lens test
say()
say('B) LENS TEST: fragments in the objective region (s < -240 mm) and their surface type')
say(f'   {"tag":20s} {"faces":>6s} {"s range":>18s} {"r range":>15s} {"sphere fit R(mm)":>16s} '
    f'{"res%":>6s} {"flat%":>6s} {"max thickness":>13s}  verdict')
for tag in sorted(frags, key=lambda t: -len(frags[t])):
    tri = frags[tag]
    fp = toFrame(tri.reshape(-1, 3))
    if fp[:, 0].min() > -.24:
        continue
    r = np.linalg.norm(fp[:, 1:], axis=1)
    fn2, area2 = face_normals(tri)
    flat = float(area2[np.abs(fn2 @ axis) > .966].sum() / area2.sum())
    sph = sphere_fit(tri)
    thick = fp[:, 0].max() - fp[:, 0].min()
    if sph is None:
        sphtxt, res = '-', '-'
    else:
        sphtxt = f'{sph["radius"]*1000:.1f}'
        res = f'{sph["residFrac"]*100:.1f}'
    verdict = []
    if flat > .5:
        verdict.append('mostly flat faces')
    if sph and sph['residFrac'] < .02 and sph['radius'] > .05:
        verdict.append('SPHERICAL surface candidate')
    if thick < .004:
        verdict.append('zero/near-zero thickness')
    say(f'   {tag:20s} {len(tri):6d} {fp[:,0].min()*1000:+7.1f}..{fp[:,0].max()*1000:+7.1f} '
        f'{r.min()*1000:6.1f}..{r.max()*1000:6.1f} {sphtxt:>16s} {res:>6s} {flat*100:6.1f} '
        f'{thick*1000:9.2f} mm  {", ".join(verdict) if verdict else "irregular solid"}')

say()
say('C) GLASS TEST: any fragment whose faces form two large parallel/near-parallel curved caps')
say('   (a lens blank must show a front face and a back face joined by an edge wall)')
for tag in sorted(frags, key=lambda t: -len(frags[t])):
    tri = frags[tag]
    fp = toFrame(tri.reshape(-1, 3))
    if fp[:, 0].min() > -.24:
        continue
    fn2, area2 = face_normals(tri)
    nAx = fn2 @ axis
    front = area2[nAx > .9].sum()
    back = area2[nAx < -.9].sum()
    edge = area2[np.abs(nAx) < .25].sum()
    tot = area2.sum()
    say(f'   {tag:20s} front-area {front/tot*100:5.1f}%  back-area {back/tot*100:5.1f}%  '
        f'edge-area {edge/tot*100:5.1f}%   (lens blank needs all three)')

(OUT / 'lens-test.txt').write_text('\n'.join(lines), encoding='utf-8')
say()
say('WROTE ' + str(OUT / 'lens-test.txt'))
