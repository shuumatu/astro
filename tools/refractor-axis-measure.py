"""Axis, radius and cap-topology measurement for the refractor GLB.

The axis of a cylindrical shell is the direction that minimises the squared
projection of its wall-face normals: the eigenvector of the smallest eigenvalue of
the wall-normal covariance. That is exact for a cylinder and needs no search.
"""
import json
from pathlib import Path

import numpy as np

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


def orthobasis(axis):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    ref = np.array([1., 0, 0]) if abs(axis[0]) < .9 else np.array([0., 1, 0])
    u = ref - axis * ref.dot(axis)
    u /= np.linalg.norm(u)
    return axis, u, np.cross(axis, u)


def face_normals(tri):
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    a = np.linalg.norm(fn, axis=1) / 2
    return fn / np.maximum(np.linalg.norm(fn, axis=1)[:, None], 1e-18), a


def line_axis(tri, iters=4, cutoff=.35):
    """Axis from wall normals; iteratively drop cap faces, then refine the line in 3D."""
    fn, area = face_normals(tri)
    m = np.ones(len(tri), bool)
    axis = None
    for _ in range(iters):
        n = fn[m]
        w = area[m]
        cov = (n * w[:, None]).T @ n / w.sum()
        vals, vecs = np.linalg.eigh(cov)
        axis = vecs[:, 0]
        m = np.abs(fn @ axis) < cutoff
    p = tri[m].reshape(-1, 3)
    w = np.repeat(area[m], 3)
    c = (p * w[:, None]).sum(axis=0) / w.sum()
    # refine: minimise perpendicular distance of wall points to the line (direction fixed)
    d = p - c
    t = d @ axis
    # solve for the offset in the plane perpendicular to axis that minimises radius spread
    u = np.array([1., 0, 0]) if abs(axis[0]) < .9 else np.array([0., 1, 0])
    u = u - axis * u.dot(axis)
    u /= np.linalg.norm(u)
    v = np.cross(axis, u)
    q = np.c_[d @ u, d @ v]
    A = np.c_[2 * q[:, 0], 2 * q[:, 1], np.ones(len(q))]
    b = (q ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy, k = sol
    r = float(np.sqrt(max(k + cx * cx + cy * cy, 0)))
    resid = np.linalg.norm(q - [cx, cy], axis=1)
    point = c + u * cx + v * cy
    return {'axis': axis, 'u': u, 'v': v, 'radius': r, 'residFrac': float(resid.std() / max(r, 1e-9)),
            'point': point, 'wallFaces': int(m.sum()), 'faces': int(len(tri)),
            'wallFrac': float(area[m].sum() / area.sum()), 'normals': fn, 'area': area, 'm': m}


say('=' * 92)
say('1) MAIN TUBE: axis from wall-face normals')
tube = frags['n4-m2-p0:c1']
fit = line_axis(tube)
axis = fit['axis']
if axis[1] < 0:
    axis = -axis
fit['axis'] = axis
fit['u'] = fit['u'] if axis[1] >= 0 else fit['u']
say(f'   wall faces {fit["wallFaces"]}/{fit["faces"]} (wall area fraction {fit["wallFrac"]*100:.1f}%)')
say(f'   cylinder radius  = {fit["radius"]*1000:.3f} mm   residual = {fit["residFrac"]*100:.3f}%')
say(f'   axis (objective->eyepiece) = {np.round(axis, 6).tolist()}')

# orient axis from the objective end to the eyepiece end using the objective-cell centre
axis, u, v = orthobasis(axis)
cellC = frags['n4-m2-p0:c0'].reshape(-1, 3).mean(axis=0)
pts = tube.reshape(-1, 3)
mid = (pts.min(axis=0) + pts.max(axis=0)) / 2
if (cellC @ axis) > (mid @ axis):
    axis = -axis
    u = -u
    v = -v
point = fit['point']
point = point - axis * ((point - mid) @ axis)
say(f'   axis point (tube mid)      = {np.round(point, 6).tolist()}')
up = np.array([0., 1, 0])
up = up - axis * up.dot(axis)
up /= np.linalg.norm(up)
right = np.cross(axis, up)
say(f'   optical up    = {np.round(up, 6).tolist()}')
say(f'   optical right = {np.round(right, 6).tolist()}')

say()
say('   tube radius profile (mm) along s measured from the axis point:')
d = pts - point
s = d @ axis
rad = np.linalg.norm(d - np.outer(s, axis), axis=1)
for i in range(24):
    lo = s.min() + (s.max() - s.min()) * i / 24
    hi = s.min() + (s.max() - s.min()) * (i + 1) / 24
    m = (s >= lo) & (s < hi)
    if m.sum() < 8:
        continue
    say(f'     s={lo*1000:+8.2f}..{hi*1000:+8.2f}  R={rad[m].min()*1000:6.2f}..{rad[m].max()*1000:6.2f} '
        f'(mean {rad[m].mean()*1000:6.2f})  n={int(m.sum())}')

say()
say('   radial extents of the whole tube in the optical frame (mm):')
along = d @ axis
across = np.c_[d @ u, d @ v]
say(f'     along axis : {along.min()*1000:+.2f} .. {along.max()*1000:+.2f}')
say(f'     u (up)     : {across[:,0].min()*1000:+.2f} .. {across[:,0].max()*1000:+.2f}')
say(f'     v (right)  : {across[:,1].min()*1000:+.2f} .. {across[:,1].max()*1000:+.2f}')

say()
say('2) OTHER CYLINDRICAL PARTS in the optical frame')
say(f'   {"tag":20s} {"faces":>6s} {"axis (3D)":30s} {"R(mm)":>8s} {"res%":>6s} {"wall%":>6s} '
    f'{"centre (mm, opt frame)":30s} {"size(mm)":24s}')
rows = []
for tag in sorted(frags, key=lambda t: -len(frags[t])):
    tri = frags[tag]
    f2 = line_axis(tri)
    ax = f2['axis']
    if ax @ axis < 0:
        ax = -ax
    c = tri.reshape(-1, 3).mean(axis=0)
    dc = c - point
    optpos = np.array([dc @ axis, dc @ u, dc @ v]) * 1000
    size = (tri.reshape(-1, 3).max(axis=0) - tri.reshape(-1, 3).min(axis=0)) * 1000
    rows.append({'tag': tag, 'faces': int(len(tri)), 'axis': ax.tolist(), 'radius': f2['radius'],
                 'residFrac': f2['residFrac'], 'wallFrac': f2['wallFrac'],
                 'optpos': optpos.tolist(), 'size': size.tolist()})
    say(f'   {tag:20s} {len(tri):6d} {np.round(ax,3).tolist()!s:30s} {f2["radius"]*1000:8.3f} '
        f'{f2["residFrac"]*100:6.2f} {f2["wallFrac"]*100:6.1f} {np.round(optpos,1).tolist()!s:30s} '
        f'{np.round(size,1).tolist()!s:24s}')

say()
say('3) CAP TOPOLOGY: face-radius distribution per fragment (bore => capped tube/ring)')
say(f'   {"tag":20s} {"faces":>6s} {"wallFaces":>9s} {"capFaces":>8s} {"capRmin(mm)":>11s} '
    f'{"capRmax(mm)":>11s} {"verdict":26s}')
for r in rows:
    tag = r['tag']
    tri = frags[tag]
    f2 = line_axis(tri)
    fn, area = f2['normals'], f2['area']
    ax = f2['axis']
    if ax @ axis < 0:
        ax = -ax
    capm = np.abs(fn @ ax) > .95
    p = tri[capm].reshape(-1, 3)
    if capm.sum() < 4 or len(p) == 0:
        say(f'   {tag:20s} {len(tri):6d} {f2["wallFaces"]:9d} {int(capm.sum()):8d} '
            f'{"-":>11s} {"-":>11s} no axial cap faces')
        r['verdict'] = 'no axial caps'
        continue
    dc = p - f2['point']
    rad = np.linalg.norm(dc - np.outer(dc @ ax, ax), axis=1)
    rmin, rmax = float(rad.min()), float(rad.max())
    wallFrac = f2['wallFrac']
    if wallFrac > .25 and rmin > .25 * rmax:
        verdict = 'capped ring/tube (bore)'
    elif wallFrac > .25:
        verdict = 'capped solid (disk+wall)'
    elif capm.mean() > .5:
        verdict = 'flat plate/polygon'
    else:
        verdict = 'mixed/solid'
    r['verdict'] = verdict
    r['capRmin'] = rmin
    r['capRmax'] = rmax
    r['capFaces'] = int(capm.sum())
    say(f'   {tag:20s} {len(tri):6d} {f2["wallFaces"]:9d} {int(capm.sum()):8d} '
        f'{rmin*1000:11.2f} {rmax*1000:11.2f} {verdict:26s}')

(OUT / 'axis-and-topology.txt').write_text('\n'.join(lines), encoding='utf-8')
json.dump({'opticalFrame': {'axis': axis.tolist(), 'up': up.tolist(), 'right': right.tolist(),
                            'point': point.tolist(), 'tubeRadius': fit['radius'],
                            'tubeResidFrac': fit['residFrac']},
           'fragments': rows}, open(OUT / 'axis-and-topology.json', 'w'), indent=2)
say()
say('WROTE ' + str(OUT / 'axis-and-topology.txt'))
