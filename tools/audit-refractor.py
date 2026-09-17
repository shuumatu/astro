"""Inspect the refractor GLB with full parent transforms; render numbered geometry atlases.

This tool never writes to the source GLB. It reads the file, bakes every parent
translation/rotation/scale, welds triangle vertices, runs connected-component
analysis per primitive, and prints a geometric descriptor for every fragment so the
classification is based on measured shape rather than on node names.

Run with the repository's helper venv:
    .cache/venv-tools/Scripts/python.exe tools/audit-refractor.py
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend/public/models/telescope_refractor.glb'
OUT = ROOT / '.cache/refractor-audit'


def load(path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from('<III', raw, 0)
    if magic != 0x46546C67:
        raise SystemExit('not a GLB')
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]
    return doc, binary


doc, binary = load(SOURCE)


def accessor(i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1', 5122: '<i2'}[a['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    return np.ndarray((a['count'], width), dtype=dtype, buffer=binary,
                      offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', np.dtype(dtype).itemsize * width),
                               np.dtype(dtype).itemsize)).copy()


parents = {c: i for i, n in enumerate(doc['nodes']) for c in n.get('children', [])}


def local_matrix(i):
    n = doc['nodes'][i]
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=float).reshape(4, 4, order='F')
    m = np.eye(4)
    t = n.get('translation', [0, 0, 0])
    s = n.get('scale', [1, 1, 1])
    q = n.get('rotation', [0, 0, 0, 1])  # x,y,z,w
    x, y, z, w = q
    r = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m[:3, :3] = r @ np.diag(s)
    m[:3, 3] = t
    return m


def matrix(i):
    m = local_matrix(i)
    return matrix(parents[i]) @ m if i in parents else m


def components(triangles, return_ids=False):
    """Weld vertices, then union-find over shared vertices -> connected fragments."""
    span = np.ptp(triangles.reshape(-1, 3), axis=0).max()
    tolerance = max(span, 1e-9) * 1e-6
    _, inverse = np.unique(np.round(triangles.reshape(-1, 3) / tolerance).astype(np.int64),
                           axis=0, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    parent = list(range(int(inverse.max()) + 1))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in faces:
        r = find(a)
        parent[find(b)] = r
        parent[find(c)] = r
    groups = {}
    for i, face in enumerate(faces):
        groups.setdefault(find(face[0]), []).append(i)
    ids = sorted(groups.values(), key=len, reverse=True)
    return ids if return_ids else [triangles[i] for i in ids]


def draw_mesh(canvas, triangles, box, view=(1, .6, 1), color=(140, 190, 220), fit_triangles=None):
    z = np.array(view, float)
    z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z)
    if np.linalg.norm(x) < 1e-9:
        x = np.cross([1, 0, 0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    basis = np.array([x, y, z]).T
    t = triangles @ basis
    fit = t if fit_triangles is None else fit_triangles @ basis
    lo, hi = fit.min(axis=(0, 1)), fit.max(axis=(0, 1))
    scale = min((box[2] - box[0] - 24) / max(hi[0] - lo[0], 1e-12),
                (box[3] - box[1] - 32) / max(hi[1] - lo[1], 1e-12))
    t[:, :, 0] = (t[:, :, 0] - (hi[0] + lo[0]) / 2) * scale + (box[0] + box[2]) / 2
    t[:, :, 1] = -(t[:, :, 1] - (hi[1] + lo[1]) / 2) * scale + (box[1] + box[3]) / 2
    normal = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-18)
    brightness = .25 + .75 * np.abs(normal @ z)
    draw = ImageDraw.Draw(canvas)
    for idx in np.argsort(t[:, :, 2].mean(axis=1)):
        b = brightness[idx]
        draw.polygon([tuple(p[:2]) for p in t[idx]],
                     fill=tuple(int(channel * b) for channel in color))


def describe(tri):
    """Geometric descriptor: shape, orientation, symmetry, curvature proxies."""
    pts = tri.reshape(-1, 3)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    size = hi - lo
    center = (lo + hi) / 2
    centroid = tri.mean(axis=(0, 1))
    normal = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    area = np.linalg.norm(normal, axis=1) / 2
    normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-18)
    signed = (tri.mean(axis=1) - centroid) @ np.array([0., 0., 1.])
    axis_areas = {}
    for k, name in enumerate('xyz'):
        axis_areas[name] = float(area[np.abs(normal[:, k]) > .9].sum() / max(area.sum(), 1e-18))
    return {
        'faces': int(len(tri)), 'lo': lo, 'hi': hi, 'size': size, 'center': center,
        'centroid': centroid, 'area': float(area.sum()),
        'flatAreaFrac': axis_areas,
        'elongation': float(size.max() / max(np.sort(size)[1], 1e-9)),
    }


print('=' * 100)
print('GLB', SOURCE.name, SOURCE.stat().st_size, 'bytes')
print('generator:', doc.get('asset', {}).get('generator'), 'version:', doc.get('asset', {}).get('version'))
print('nodes:', len(doc['nodes']), 'meshes:', len(doc['meshes']),
      'materials:', len(doc.get('materials', [])), 'scene roots:', doc['scenes'][doc.get('scene', 0)]['nodes'])
print('extensions:', doc.get('extensionsUsed'))

print('\n--- NODE HIERARCHY (local transform + baked world translation) ---')
for i, n in enumerate(doc['nodes']):
    depth = 0
    p = parents.get(i)
    chain = []
    while p is not None:
        chain.append(p)
        p = parents.get(p)
    depth = len(chain)
    m = matrix(i)
    t = n.get('translation')
    extra = ''
    if 'matrix' in n:
        extra = 'matrix'
    elif t or n.get('rotation') or n.get('scale'):
        extra = f'T={t} R={n.get("rotation")} S={n.get("scale")}'
    print(f'{"  " * depth}[{i}] {n.get("name")!r} mesh={n.get("mesh")} '
          f'worldT={np.round(m[:3, 3], 5).tolist()} {extra} '
          f'children={n.get("children")}')

print('\n--- MATERIALS ---')
for i, m in enumerate(doc.get('materials', [])):
    pbr = m.get('pbrMetallicRoughness', {})
    print(f'[{i}] {m.get("name")!r} base={pbr.get("baseColorFactor")} '
          f'metal={pbr.get("metallicFactor")} rough={pbr.get("roughnessFactor")} '
          f'doubleSided={m.get("doubleSided")} alphaMode={m.get("alphaMode")}')

instances = []
print('\n--- MESH PRIMITIVES (baked world space, mm) ---')
for i, n in enumerate(doc['nodes']):
    if 'mesh' not in n:
        continue
    m = matrix(i)
    for pi, primitive in enumerate(doc['meshes'][n['mesh']]['primitives']):
        p = accessor(primitive['attributes']['POSITION'])
        world = (np.c_[p, np.ones(len(p))] @ m.T)[:, :3]
        ids = accessor(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(p))
        tri = world[ids.reshape(-1, 3)]
        instances.append({'node': i, 'mesh': n['mesh'], 'prim': pi, 'tri': tri,
                          'world': world, 'matrix': m, 'ids': ids,
                          'material': primitive.get('material')})
        d = describe(tri)
        print(f'node[{i}] {n.get("name")!r} mesh[{n["mesh"]}] {doc["meshes"][n["mesh"]].get("name")!r} '
              f'prim[{pi}] tris={d["faces"]} mat={primitive.get("material")} '
              f'localMin={np.round(p.min(axis=0), 5).tolist()} localMax={np.round(p.max(axis=0), 5).tolist()}')
        print(f'    worldMin={np.round(d["lo"], 4).tolist()} worldMax={np.round(d["hi"], 4).tolist()} '
              f'size={np.round(d["size"], 4).tolist()} area={d["area"]:.3f} '
              f'flatFrac(x,y,z)=({d["flatAreaFrac"]["x"]:.2f},{d["flatAreaFrac"]["y"]:.2f},{d["flatAreaFrac"]["z"]:.2f})')

OUT.mkdir(parents=True, exist_ok=True)

# ---- Atlas 1: every mesh instance in the raw model, one tile each ----
cols = 5
rows = int(np.ceil(len(instances) / cols))
atlas = Image.new('RGB', (cols * 320, rows * 300), '#101820')
for k, inst in enumerate(instances):
    x, y = (k % cols) * 320, (k // cols) * 300
    draw_mesh(atlas, inst['tri'], (x, y + 24, x + 320, y + 300))
    ImageDraw.Draw(atlas).text((x + 8, y + 8),
                               f'n{inst["node"]}/m{inst["mesh"]}/p{inst["prim"]} '
                               f'{len(inst["tri"])}f mat{inst["material"]}', fill='white')
atlas.save(OUT / 'mesh-atlas.png')

# ---- Atlas 2: whole assembly, front / side / rear ----
assembly = Image.new('RGB', (1800, 700), '#101820')
all_t = np.concatenate([i['tri'] for i in instances])
for k, view in enumerate([(1, .25, .2), (0, 0, 1), (-1, .25, .2)]):
    draw_mesh(assembly, all_t, (k * 600, 20, k * 600 + 600, 700), view)
assembly.save(OUT / 'assembly.png')

# ---- Per-primitive connected components ----
fragment_report = []
for inst in instances:
    groups = components(inst['tri'], return_ids=True)
    tag = f'n{inst["node"]}-m{inst["mesh"]}-p{inst["prim"]}'
    print(f'\nCOMPONENTS {tag}: {len(groups)}')
    sheet = Image.new('RGB', (cols * 320, int(np.ceil(len(groups) / cols)) * 280), '#101820')
    for cid, faces in enumerate(groups):
        t = inst['tri'][faces]
        d = describe(t)
        print(f'  {tag}:c{cid} faces={d["faces"]} area={d["area"]:.3f} '
              f'center={np.round(d["centroid"], 4).tolist()} '
              f'min={np.round(d["lo"], 4).tolist()} max={np.round(d["hi"], 4).tolist()} '
              f'size={np.round(d["size"], 4).tolist()} '
              f'flat=({d["flatAreaFrac"]["x"]:.2f},{d["flatAreaFrac"]["y"]:.2f},{d["flatAreaFrac"]["z"]:.2f})')
        x, y = (cid % cols) * 320, (cid // cols) * 280
        draw_mesh(sheet, t, (x, y + 24, x + 320, y + 280))
        ImageDraw.Draw(sheet).text((x + 8, y + 8), f'{tag}:c{cid} ({len(faces)}f)', fill='white')
        fragment_report.append({
            'node': inst['node'], 'mesh': inst['mesh'], 'prim': inst['prim'], 'component': cid,
            'faces': d['faces'], 'area': d['area'],
            'min': d['lo'].tolist(), 'max': d['hi'].tolist(), 'center': d['centroid'].tolist(),
            'size': d['size'].tolist(), 'flatFrac': d['flatAreaFrac'],
        })
    sheet.save(OUT / f'components-{tag}.png')

(OUT / 'fragments.json').write_text(json.dumps(fragment_report, indent=2))
print('\nWROTE', OUT)
