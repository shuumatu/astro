"""Per-fragment shape metrics for the refractor GLB, plus index-labeled renders.

Classification evidence comes from measurements, not from node names:
  * best-fit cylindrical shell: radius, axis, radial residual, angular coverage, length
  * wall/cap area fractions relative to that axis (shell wall vs. end-face area)
  * planarity, PCA shape ratios, world position
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
draw_mesh = audit['draw_mesh']


def orthobasis(axis):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    ref = np.array([1., 0, 0]) if abs(axis[0]) < .9 else np.array([0., 1, 0])
    u = ref - axis * ref.dot(axis)
    u /= np.linalg.norm(u)
    return axis, u, np.cross(axis, u)


def fit_cylinder(pts, axis):
    axis, u, v = orthobasis(axis)
    p = np.c_[pts @ u, pts @ v]
    A = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
    b = (p ** 2).sum(axis=1)
    try:
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    except np.linalg.LinAlgError:
        return None
    if not np.all(np.isfinite(sol)):
        return None
    cx, cy, k = sol
    rad2 = k + cx * cx + cy * cy
    if not np.isfinite(rad2) or rad2 <= 0:
        return None
    r = float(np.sqrt(rad2))
    d = np.linalg.norm(p - [cx, cy], axis=1)
    return float(d.std() / r), r, np.array([cx, cy]), d


def refine_axis(pts, seed):
    axis, u, v = orthobasis(seed)
    best = None
    for du in np.linspace(-.30, .30, 13):
        for dv in np.linspace(-.30, .30, 13):
            ax = axis + u * du + v * dv
            res = fit_cylinder(pts, ax)
            if res and (best is None or res[0] < best[0]):
                best = (res[0], res[1], ax / np.linalg.norm(ax), res[2], res[3])
    return best


rows = []
groupCache = {}
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    groupCache[inst['node']] = groups
    for cid, faces in enumerate(groups):
        tri = inst['tri'][faces]
        pts = tri.reshape(-1, 3)
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        c = pts.mean(axis=0)
        cov = np.cov((pts - c).T)
        vals, vecs = np.linalg.eigh(cov)
        order = np.argsort(vals)[::-1]
        vals, vecs = vals[order], vecs[:, order]
        fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        area = np.linalg.norm(fn, axis=1) / 2
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1)[:, None], 1e-18)

        seeds = [vecs[:, i] for i in range(3)] + [np.array(v, float) for v in
                                                 ([1, 0, 0], [0, 1, 0], [0, 0, 1])]
        best = None
        for s in seeds:
            res = refine_axis(pts, s)
            if res and (best is None or res[0] < best[0]):
                best = res
        entry = {
            'tag': f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}:c{cid}',
            'node': inst['node'], 'mesh': inst['mesh'], 'prim': inst['prim'], 'component': cid,
            'faces': int(len(tri)), 'area': float(area.sum()),
            'lo': lo.tolist(), 'hi': hi.tolist(), 'size': (hi - lo).tolist(), 'center': c.tolist(),
            'pca': (vals / max(vals[0], 1e-18)).tolist(),
        }
        if best:
            frac, radius, axis, ctr2d, dist = best
            axis, u, v = orthobasis(axis)
            p = np.c_[pts @ u - ctr2d[0], pts @ v - ctr2d[1]]
            ang = np.arctan2(p[:, 1], p[:, 0])
            bins = np.zeros(72, bool)
            bins[((ang + np.pi) / (2 * np.pi) * 72).astype(int) % 72] = True
            axcoord = pts @ axis
            entry['cyl'] = {
                'residFrac': frac, 'radius': radius, 'axis': axis.tolist(),
                'coverage': float(bins.mean()), 'length': float(axcoord.max() - axcoord.min()),
                'axCenter': float((axcoord.max() + axcoord.min()) / 2),
                'center2d': ctr2d.tolist(),
                'concentricity': float(dist.std() / max(radius, 1e-9)),
                'axisPoint': (np.outer([ctr2d[0]], u) + np.outer([ctr2d[1]], v) + axis * (
                    (axcoord.max() + axcoord.min()) / 2))[0].tolist(),
            }
            entry['wallFrac'] = float(area[np.abs(fn @ axis) < .26].sum() / max(area.sum(), 1e-12))
            entry['capFrac'] = float(area[np.abs(fn @ axis) > .966].sum() / max(area.sum(), 1e-12))
        entry['flatFrac'] = float(area[np.abs(fn @ vecs[:, 2]) > .966].sum() / max(area.sum(), 1e-12))
        rows.append(entry)

rows.sort(key=lambda r: -r['faces'])
(OUT / 'metrics.json').write_text(json.dumps(rows, indent=2))

header = (f'{"tag":22s} {"faces":>6s} {"area":>7s} {"size(mm)":30s} {"cylRes":>7s} {"R":>7s} '
          f'{"L":>7s} {"cov":>5s} {"wall%":>5s} {"cap%":>5s} {"flat%":>5s} {"axis":20s} {"center":26s}')
lines = [header]
for r in rows:
    cyl = r.get('cyl')
    if cyl:
        lines.append(
            f'{r["tag"]:22s} {r["faces"]:6d} {r["area"]:7.3f} {np.round(r["size"],3).tolist()!s:30s} '
            f'{cyl["residFrac"]:7.4f} {cyl["radius"]:7.4f} {cyl["length"]:7.4f} '
            f'{cyl["coverage"]:5.2f} {r["wallFrac"]*100:5.1f} {r["capFrac"]*100:5.1f} {r["flatFrac"]*100:5.1f} '
            f'{np.round(cyl["axis"],2).tolist()!s:20s} {np.round(r["center"],3).tolist()!s:26s}')
    else:
        lines.append(f'{r["tag"]:22s} {r["faces"]:6d} {r["area"]:7.3f} no cylinder fit')
(OUT / 'metrics.txt').write_text('\n'.join(lines), encoding='utf-8')
print('\n'.join(lines[:75]))
print(f'\n... {len(rows)} fragments; full table: {OUT / "metrics.txt"}')

# ---- index-labeled contact sheet of the 72 largest fragments ----
top = rows[:72]
cols, tile = 6, 330
sheet = Image.new('RGB', (cols * tile, int(np.ceil(len(top) / cols)) * tile), '#0d141c')
for k, r in enumerate(top):
    inst = next(i for i in instances if i['node'] == r['node'])
    tri = inst['tri'][groupCache[r['node']][r['component']]]
    x, y = (k % cols) * tile, (k // cols) * tile
    draw_mesh(sheet, tri, (x + 6, y + 34, x + tile - 6, y + tile - 6))
    d = ImageDraw.Draw(sheet)
    d.text((x + 8, y + 6), f'#{k} {r["tag"]}', fill='#9fe8ff')
    cyl = r.get('cyl')
    sub = f'{r["faces"]}f ' + (f'R={cyl["radius"]:.3f} cov={cyl["coverage"]:.2f}' if cyl else 'no-cyl')
    d.text((x + 8, y + 18), sub, fill='#c8d4e0')
sheet.save(OUT / 'top72-fragments.png')
print('WROTE', OUT / 'top72-fragments.png')
