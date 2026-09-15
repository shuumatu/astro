"""Deep shape analysis for the refractor GLB: cylindrical/spherical axis fits and labeled renders.

Consumes the same source GLB as audit-refractor.py and writes:
  - axis-summary.txt : per fragment cylinder/sphere axis fit residuals
  - big-fragments.png: the largest fragments, individually labeled
  - views/*.png      : labeled orthographic and isometric assembly views
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
doc = audit['doc']
instances = audit['instances']
components = audit['components']
draw_mesh = audit['draw_mesh']

lines = []


def principle_axes(points):
    c = points.mean(axis=0)
    cov = np.cov((points - c).T)
    vals, vecs = np.linalg.eigh(cov)
    order = np.argsort(vals)[::-1]
    return c, vals[order], vecs[:, order]


def cylinder_fit(tri, axis):
    """Residual of (r, angle) about the best centre on a candidate axis."""
    pts = tri.reshape(-1, 3)
    c, _, _ = principle_axes(pts)
    best = None
    for basis in range(2):
        # project onto plane normal to axis, then solve for the circle centre by least squares
        u = np.array([1., 0, 0]) if abs(axis[1]) > .9 else np.array([0., 1, 0])
        u = u - axis * u.dot(axis)
        u /= np.linalg.norm(u)
        v = np.cross(axis, u)
        p = np.c_[pts @ u, pts @ v]
        A = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
        b = (p ** 2).sum(axis=1)
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
        cx, cy, k = sol
        r = np.sqrt(np.maximum(k + cx * cx + cy * cy, 0))
        resid = np.std(np.linalg.norm(p - [cx, cy], axis=1))
        frac = float(resid / max(r, 1e-12))
        if best is None or frac < best[0]:
            best = (frac, r, [cx, cy])
    return best


def sphere_fit(tri):
    pts = tri.reshape(-1, 3)
    A = np.c_[2 * pts, np.ones(len(pts))]
    b = (pts ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    centre = sol[:3]
    r = np.sqrt(max(sol[3] + (centre ** 2).sum(), 0))
    resid = np.std(np.linalg.norm(pts - centre, axis=1))
    return float(resid / max(r, 1e-12)), float(r), centre


rows = []
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        tri = inst['tri'][faces]
        pts = tri.reshape(-1, 3)
        c, vals, vecs = principle_axes(pts)
        size = pts.max(axis=0) - pts.min(axis=0)
        row = {'tag': f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}',
               'faces': int(len(tri)), 'center': c.tolist(), 'size': size.tolist(),
               'eig': vals.tolist(), 'evals': vecs.tolist()}
        # cylinder axis candidates: the three principal axes plus global X/Y/Z
        cands = [vecs[:, i] for i in range(3)] + [np.array(v) for v in ([1., 0, 0], [0., 1, 0], [0., 0, 1.])]
        bestc = None
        for ax in cands:
            ax = ax / np.linalg.norm(ax)
            frac, r, ctr = cylinder_fit(tri, ax)
            if bestc is None or frac < bestc[0]:
                bestc = (frac, r, ax, ctr)
        row['cyl'] = {'residFrac': bestc[0], 'radius': bestc[1], 'axis': bestc[2].tolist(), 'center': bestc[3]}
        sfrac, sr, sc = sphere_fit(tri)
        row['sph'] = {'residFrac': sfrac, 'radius': sr, 'center': sc.tolist()}
        rows.append(row)

rows.sort(key=lambda r: -r['faces'])
lines.append(f'{"tag":28s} {"faces":>6s} {"size(mm)":28s} {"cylResid":>9s} {"cylR":>7s} {"cylAxis":22s} {"sphResid":>9s} {"sphR":>7s}')
for r in rows:
    ax = np.array(r['cyl']['axis'])
    lines.append(f'{r["tag"]:28s} {r["faces"]:6d} {np.round(r["size"],4).tolist()!s:28s} '
                 f'{r["cyl"]["residFrac"]:9.4f} {r["cyl"]["radius"]:7.4f} {np.round(ax,2).tolist()!s:22s} '
                 f'{r["sph"]["residFrac"]:9.4f} {r["sph"]["radius"]:7.4f}')

# Materialise every fragment as its own entry with global geometry, biggest first.
flat = []
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    for cid, faces in enumerate(groups):
        tri = inst['tri'][faces]
        lo, hi = tri.reshape(-1, 3).min(axis=0), tri.reshape(-1, 3).max(axis=0)
        flat.append({'tag': f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}',
                     'tri': tri, 'lo': lo, 'hi': hi, 'faces': len(tri),
                     'node': inst['node'], 'mesh': inst['mesh'], 'prim': inst['prim']})
flat.sort(key=lambda f: -f['faces'])

n = len(flat)
cols = 6
tile = 300
sheet = Image.new('RGB', (cols * tile, int(np.ceil(n / cols)) * tile), '#0d141c')
for k, f in enumerate(flat):
    x, y = (k % cols) * tile, (k // cols) * tile
    draw_mesh(sheet, f['tri'], (x + 6, y + 30, x + tile - 6, y + tile - 6))
    ImageDraw.Draw(sheet).text((x + 8, y + 6), f'#{k} {f["tag"]}', fill='#9fe8ff')
    ImageDraw.Draw(sheet).text((x + 8, y + 18), f'{f["faces"]}f  d={np.round(f["hi"]-f["lo"],3).tolist()}',
                               fill='#c8d4e0')
sheet.save(OUT / 'all-fragments.png')

views = {
    'front': (0, 0, 1),
    'back': (0, 0, -1),
    'side_x': (1, 0, 0),
    'side_z': (0, 0, 1),
    'top': (0, -1, .001),
    'bottom': (0, 1, .001),
    'iso': (1, .35, 1),
    'iso_hi': (1, .8, 1),
}
for name, view in views.items():
    canvas = Image.new('RGB', (1500, 1500), '#0d141c')
    all_t = np.concatenate([f['tri'] for f in flat])
    draw_mesh(canvas, all_t, (20, 20, 1480, 1480), view)
    canvas.save(OUT / f'view-{name}.png')

(OUT / 'axis-summary.txt').write_text('\n'.join(lines), encoding='utf-8')
(OUT / 'fragments-detailed.json').write_text(json.dumps(
    [{'tag': f['tag'], 'faces': f['faces'], 'node': f['node'], 'mesh': f['mesh'], 'prim': f['prim'],
      'lo': f['lo'].tolist(), 'hi': f['hi'].tolist(), 'size': (f['hi'] - f['lo']).tolist()} for f in flat], indent=2))
print('\n'.join(lines[:70]))
print('\nWROTE', OUT)
