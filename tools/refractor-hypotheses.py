"""Test specific geometric hypotheses about the refractor GLB.

H1: fragments c8/c9/c10/c15 (mesh 2) + c0/c1 (mesh 3) form one collinear cylindrical
    assembly (a finder scope) offset from the main tube axis.
H2: the rings c0/c1 of mesh 6 are coaxial with the main tube and have an inner radius
    equal to the tube's outer radius (tube rings / bands), not lens parts.
H3: the drawtube c7 of mesh 7 is coaxial with the main tube.
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

# main tube axis (ground truth) as a line
tube = frags['n4-m2-p0:c1']
tp = tube.reshape(-1, 3)


def toFrame(p):
    d = np.atleast_2d(p) - O
    return np.c_[d @ axis, d @ up, d @ right]


def cyl_fit(points, axisGuess=None):
    """Least-squares cylinder: direction from normal covariance, then centre+radius."""
    fn = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    fn = fn / np.maximum(np.linalg.norm(fn, axis=1)[:, None], 1e-18)
    a = np.linalg.norm(np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0]), axis=1) / 2
    cov = (fn * a[:, None]).T @ fn / a.sum()
    vals, vecs = np.linalg.eigh(cov)
    ax = vecs[:, 0]
    m = np.abs(fn @ ax) < .3
    p = points[m].reshape(-1, 3) if m.sum() else points.reshape(-1, 3)
    c = p.mean(axis=0)
    d = p - c
    t = d @ ax
    u = np.array([1., 0, 0]) if abs(ax[0]) < .9 else np.array([0., 1, 0])
    u = u - ax * u.dot(ax); u /= np.linalg.norm(u)
    v = np.cross(ax, u)
    q = np.c_[d @ u, d @ v]
    A = np.c_[2 * q[:, 0], 2 * q[:, 1], np.ones(len(q))]
    b = (q ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy, k = sol
    r = float(np.sqrt(max(k + cx * cx + cy * cy, 0)))
    resid = np.linalg.norm(q - [cx, cy], axis=1)
    return {'axis': ax, 'point': c + u * cx + v * cy, 'radius': r,
            'resid': float(resid.std() / max(r, 1e-9)), 'wallFrac': float(a[m].sum() / a.sum())}


def line_dist(p, point, direction):
    d = p - point
    return np.linalg.norm(d - np.outer(d @ direction, direction), axis=1)


say('=' * 96)
say('H1: finder scope collinearity test (candidate fragments vs. their common axis)')
cand = ['n4-m2-p0:c8', 'n4-m2-p0:c9', 'n4-m2-p0:c10', 'n4-m2-p0:c15',
        'n2-m1-p0:c0', 'n6-m3-p0:c0', 'n6-m3-p0:c1']
fits = {}
for tag in cand:
    f = cyl_fit(frags[tag])
    fits[tag] = f
    say(f'   {tag:16s} R={f["radius"]*1000:7.2f} mm resid={f["resid"]*100:5.2f}% wall={f["wallFrac"]*100:5.1f}% '
        f'axis={np.round(f["axis"],3).tolist()}')
ref = fits['n4-m2-p0:c8']
say()
say('   distance of each fragment centre from the c8 axis line:')
for tag in cand:
    c = frags[tag].reshape(-1, 3).mean(axis=0)
    dist = float(line_dist(c[None, :], ref['point'], ref['axis'])[0])
    say(f'   {tag:16s} {dist*1000:8.2f} mm from the c8 axis')

# choose the best common axis by combining the wall faces of all candidates
allp = np.concatenate([frags[t] for t in cand])
best = None
for tag in cand:
    a0 = fits[tag]['axis']
    for s in (a0, -a0):
        # refine using combined points assigned to this axis
        ax = s.copy()
        for _ in range(6):
            fn = np.cross(allp[:, 1] - allp[:, 0], allp[:, 2] - allp[:, 0])
            fn = fn / np.maximum(np.linalg.norm(fn, axis=1)[:, None], 1e-18)
            m = np.abs(fn @ ax) < .3
            p = allp[m].reshape(-1, 3)
            c = p.mean(axis=0)
            d = p - c
            u = np.array([1., 0, 0]) if abs(ax[0]) < .9 else np.array([0., 1, 0])
            u = u - ax * u.dot(ax); u /= np.linalg.norm(u)
            v = np.cross(ax, u)
            q = np.c_[d @ u, d @ v]
            A = np.c_[2 * q[:, 0], 2 * q[:, 1], np.ones(len(q))]
            b = (q ** 2).sum(axis=1)
            sol, *_ = np.linalg.lstsq(A, b, rcond=None)
            cx, cy, k = sol
            r = float(np.sqrt(max(k + cx * cx + cy * cy, 0)))
            resid = np.linalg.norm(q - [cx, cy], axis=1)
            score = float(resid.std() / max(r, 1e-9))
            if best is None or score < best[0]:
                best = (score, r, ax.copy(), (c + u * cx + v * cy), int(m.sum()))
            # re-estimate the axis from this point set
            fnm = fn[m]
            cov = (fnm * np.ones(len(fnm))[:, None]).T @ fnm
            vals, vecs = np.linalg.eigh(cov)
            ax = vecs[:, 0]
score, rFind, axFind, ptFind, nw = best
say()
say(f'   best common axis : {np.round(axFind,4).tolist()}')
say(f'   common radius    : {rFind*1000:.2f} mm  (residual {score*100:.2f}%, {nw} wall faces)')
say(f'   angle to tube axis: {np.degrees(np.arccos(abs(float(axFind @ axis)))):.2f} deg')
say(f'   finder axis point: {np.round(toFrame(ptFind)[0], 5).tolist()} (optical frame)')
sep = toFrame(ptFind)[0]
say(f'   separation from main axis: {np.hypot(sep[1], sep[2])*1000:.1f} mm')
say('   per-fragment offset from the common finder axis:')
for tag in cand:
    p = frags[tag].reshape(-1, 3)
    dist = line_dist(p, ptFind, axFind)
    say(f'     {tag:16s} radial {dist.min()*1000:7.2f}..{dist.max()*1000:7.2f} mm  '
        f'(offaxis mean {dist.mean()*1000:7.2f})')

say()
say('H2: mesh 6 rings vs. main tube axis')
for tag in ['n12-m6-p0:c0', 'n12-m6-p0:c1']:
    p = frags[tag].reshape(-1, 3)
    d = line_dist(p, O, axis)
    say(f'   {tag:16s} inner radius about the TUBE axis = {d.min()*1000:.2f} mm, '
        f'outer = {d.max()*1000:.2f} mm  (tube wall 48.1 mm, tube outer 60.0 mm)')

say()
say('H3: mesh 7 drawtube / eyepiece holder vs. main tube axis')
for tag in ['n14-m7-p0:c7', 'n4-m2-p0:c17', 'n14-m7-p0:c3', 'n14-m7-p0:c4', 'n14-m7-p0:c5',
            'n14-m7-p0:c22', 'n14-m7-p0:c6']:
    p = frags[tag].reshape(-1, 3)
    d = line_dist(p, O, axis)
    fp = toFrame(p)
    say(f'   {tag:16s} radial about tube axis {d.min()*1000:7.2f}..{d.max()*1000:7.2f} mm   '
        f's {fp[:,0].min()*1000:+7.1f}..{fp[:,0].max()*1000:+7.1f} mm')

say()
say('H4: tube rings / bands vs. main tube axis')
for tag in ['n4-m2-p0:c6', 'n4-m2-p0:c7', 'n4-m2-p0:c4', 'n4-m2-p0:c3', 'n4-m2-p0:c8',
            'n4-m2-p0:c0', 'n4-m2-p0:c16']:
    p = frags[tag].reshape(-1, 3)
    d = line_dist(p, O, axis)
    fp = toFrame(p)
    f = cyl_fit(frags[tag])
    say(f'   {tag:16s} radial {d.min()*1000:7.2f}..{d.max()*1000:7.2f}  '
        f's {fp[:,0].min()*1000:+7.1f}..{fp[:,0].max()*1000:+7.1f}  '
        f'own R={f["radius"]*1000:7.2f}  angle to tube axis={np.degrees(np.arccos(min(1,abs(float(f["axis"]@axis))))):5.1f} deg')

(OUT / 'hypotheses.txt').write_text('\n'.join(lines), encoding='utf-8')
say()
say('WROTE ' + str(OUT / 'hypotheses.txt'))
