"""Definitive inventory: every fragment with world position, optical-frame position,
cylinder fit and cap topology in one table. This is the table the classification cites.
"""
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'

import runpy
audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
instances = audit['instances']
components = audit['components']

frags = {}
meshOf = {}
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        tag = f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}'
        frags[tag] = inst['tri'][faces]
        meshOf[tag] = inst['mesh']

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


def cyl(tri):
    fn, a = face_normals(tri)
    cov = (fn * a[:, None]).T @ fn / a.sum()
    vals, vecs = np.linalg.eigh(cov)
    ax = vecs[:, 0]
    m = np.abs(fn @ ax) < .3
    if m.sum() < 8:
        return None
    p = tri[m].reshape(-1, 3)
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
    capm = np.abs(fn @ ax) > .95
    boreR = None
    if capm.sum() >= 4:
        cp = tri[capm].reshape(-1, 3)
        dc = cp - c
        rr = np.linalg.norm(dc - np.outer(dc @ ax, ax), axis=1)
        boreR = float(rr.min())
    return {'axis': ax, 'R': r, 'resid': float(resid.std() / max(r, 1e-9)),
            'wallFrac': float(a[m].sum() / a.sum()), 'boreR': boreR,
            'capFrac': float(a[capm].sum() / a.sum())}


def line_dist(p, point, direction):
    d = p - point
    return np.linalg.norm(d - np.outer(d @ direction, direction), axis=1)


rows = []
for tag, tri in frags.items():
    p = tri.reshape(-1, 3)
    fp = toFrame(p)
    r = np.linalg.norm(fp[:, 1:], axis=1)
    f = cyl(tri)
    c = p.mean(axis=0)
    cf = toFrame(c)[0]
    rows.append({
        'tag': tag, 'mesh': meshOf[tag], 'faces': int(len(tri)),
        'worldCenter': [round(v, 5) for v in c.tolist()],
        'worldMin': [round(v, 5) for v in p.min(axis=0).tolist()],
        'worldMax': [round(v, 5) for v in p.max(axis=0).tolist()],
        'sMin': float(fp[:, 0].min()), 'sMax': float(fp[:, 0].max()),
        'rMin': float(r.min()), 'rMax': float(r.max()),
        'offaxis': float(np.hypot(cf[1], cf[2])),
        'size': [round(v, 5) for v in (p.max(axis=0) - p.min(axis=0)).tolist()],
        'cylR': round(f['R'], 5) if f else None,
        'cylResid': round(f['resid'], 4) if f else None,
        'wallFrac': round(f['wallFrac'], 3) if f else None,
        'boreR': round(f['boreR'], 5) if f and f['boreR'] is not None else None,
        'capFrac': round(f['capFrac'], 3) if f else None,
        'angleToAxisDeg': round(float(np.degrees(np.arccos(min(1.0, abs(float(f['axis'] @ axis)))))), 1) if f else None,
        'distFromMainAxisMin': round(float(line_dist(p, O, axis).min()), 5),
    })
rows.sort(key=lambda r: -r['faces'])
(OUT / 'inventory.json').write_text(json.dumps({'opticalFrame': of, 'fragments': rows}, indent=2))

hdr = (f'{"tag":17s}{"m":>2s}{"faces":>6s} {"world center":26s} {"s range":>18s} {"r range":>15s} '
       f'{"size(mm)":26s} {"cylR":>7s}{"res%":>6s}{"wall%":>6s}{"bore":>7s}{"ang":>6s}')
print(hdr)
print('-' * len(hdr))
for r in rows:
    print(f'{r["tag"]:17s}{r["mesh"]:2d}{r["faces"]:6d} {np.round(r["worldCenter"],3).tolist()!s:26s} '
          f'{r["sMin"]*1000:+7.1f}..{r["sMax"]*1000:+7.1f} {r["rMin"]*1000:6.1f}..{r["rMax"]*1000:6.1f} '
          f'{np.round(np.array(r["size"])*1000,1).tolist()!s:26s} '
          f'{(r["cylR"]*1000 if r["cylR"] else float("nan")):7.2f}'
          f'{(r["cylResid"]*100 if r["cylResid"] is not None else float("nan")):6.1f}'
          f'{(r["wallFrac"]*100 if r["wallFrac"] is not None else float("nan")):6.1f}'
          f'{(r["boreR"]*1000 if r["boreR"] else float("nan")):7.2f}'
          f'{(r["angleToAxisDeg"] if r["angleToAxisDeg"] is not None else float("nan")):6.1f}')
print()
print('WROTE', OUT / 'inventory.json')
