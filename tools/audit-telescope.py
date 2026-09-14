"""Inspect GLB triangles with full parent transforms; render a numbered geometry atlas."""
import json
import struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / 'frontend/public/models/telescope_newtonian_reflector.glb').read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + length])
binary = raw[28 + length:]

def accessor(i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC2': 2, 'VEC4': 4}[a['type']]
    return np.ndarray((a['count'], width), dtype=dtype, buffer=binary,
                      offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', np.dtype(dtype).itemsize * width), np.dtype(dtype).itemsize)).copy()

parents = {c: i for i, n in enumerate(doc['nodes']) for c in n.get('children', [])}
def matrix(i):
    n = doc['nodes'][i]
    m = np.array(n.get('matrix', np.eye(4).flatten(order='F')), dtype=float).reshape(4, 4, order='F')
    return matrix(parents[i]) @ m if i in parents else m

instances = []
for i, n in enumerate(doc['nodes']):
    if 'mesh' not in n:
        continue
    triangles = []
    for primitive in doc['meshes'][n['mesh']]['primitives']:
        p = accessor(primitive['attributes']['POSITION'])
        p = np.c_[p, np.ones(len(p))] @ matrix(i).T
        ids = accessor(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(p))
        triangles.append(p[ids.reshape(-1, 3), :3])
    t = np.concatenate(triangles)
    instances.append((i, n['mesh'], t))
    print(i, n['mesh'], 'center', np.round(t.mean(axis=(0, 1)) * 1000, 4),
          'min', np.round(t.min(axis=(0, 1)) * 1000, 4), 'max', np.round(t.max(axis=(0, 1)) * 1000, 4))

def draw_mesh(canvas, triangles, box, view=(1, .6, 1)):
    z = np.array(view, float); z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z); x /= np.linalg.norm(x)
    y = np.cross(z, x)
    t = triangles @ np.array([x, y, z]).T
    lo, hi = t.min(axis=(0, 1)), t.max(axis=(0, 1))
    scale = min((box[2] - box[0] - 24) / max(hi[0] - lo[0], 1e-12), (box[3] - box[1] - 32) / max(hi[1] - lo[1], 1e-12))
    t[:, :, 0] = (t[:, :, 0] - (hi[0]+lo[0])/2) * scale + (box[0]+box[2])/2
    t[:, :, 1] = -(t[:, :, 1] - (hi[1]+lo[1])/2) * scale + (box[1]+box[3])/2
    normal = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-18)
    brightness = .25 + .75 * np.abs(normal @ z)
    draw = ImageDraw.Draw(canvas)
    for idx in np.argsort(t[:, :, 2].mean(axis=1)):
        b = brightness[idx]
        draw.polygon([tuple(p[:2]) for p in t[idx]], fill=(int(140*b), int(190*b), int(220*b)))

out = ROOT / '.cache/telescope-audit'
out.mkdir(parents=True, exist_ok=True)
atlas = Image.new('RGB', (1600, 1200), '#101820')
for mid in range(len(doc['meshes'])):
    candidates = [t for _, mesh, t in instances if mesh == mid]
    if not candidates:
        continue
    x, y = (mid % 5) * 320, (mid // 5) * 400
    draw_mesh(atlas, candidates[0], (x, y+24, x+320, y+400))
    ImageDraw.Draw(atlas).text((x+12,y+8), f'mesh {mid} / {len(candidates)} instances', fill='white')
atlas.save(out / 'mesh-atlas.png')
assembly = Image.new('RGB', (1600, 1000), '#101820')
all_t = np.concatenate([t for _, _, t in instances])
draw_mesh(assembly, all_t, (0, 0, 800, 1000), (1, .2, 1))
draw_mesh(assembly, all_t, (800, 0, 1600, 1000), (-1, .2, 1))
assembly.save(out / 'assembly.png')

def components(triangles, return_ids=False):
    tolerance = np.ptp(triangles.reshape(-1, 3), axis=0).max() * 1e-6
    _, inverse = np.unique(np.round(triangles.reshape(-1, 3) / tolerance).astype(np.int64), axis=0, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    parent = list(range(inverse.max()+1))
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

for mid in [0, 1]:
    triangles = next(t for _, m, t in instances if m == mid)
    groups = components(triangles)
    print('COMPONENTS', mid, len(groups))
    sheet = Image.new('RGB', (1600, int(np.ceil(len(groups)/5))*260), '#101820')
    for cid, t in enumerate(groups):
        x,y = (cid%5)*320, (cid//5)*260
        draw_mesh(sheet,t,(x,y+24,x+320,y+260))
        ImageDraw.Draw(sheet).text((x+8,y+8), f'{mid}:{cid} ({len(t)} faces)',fill='white')
        print(mid,cid,len(t),'min',np.round(t.min(axis=(0,1))*1000,4),'max',np.round(t.max(axis=(0,1))*1000,4))
    sheet.save(out / f'components-{mid}.png')

fragments = []
for pi, primitive in enumerate(doc['meshes'][1]['primitives']):
    p = accessor(primitive['attributes']['POSITION'])
    p = np.c_[p, np.ones(len(p))] @ matrix(2).T
    ids = accessor(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(p))
    for ci,t in enumerate(components(p[ids.reshape(-1,3),:3])):
        fragments.append((pi, ci, t))
sheet = Image.new('RGB',(1600,int(np.ceil(len(fragments)/5))*230),'#101820')
for k,(pi,ci,t) in enumerate(fragments):
    x,y=(k%5)*320,(k//5)*230
    draw_mesh(sheet,t,(x,y+24,x+320,y+230))
    ImageDraw.Draw(sheet).text((x+8,y+8),f'p{pi}:c{ci} {len(t)} faces',fill='white')
    print('FRAGMENT',pi,ci,len(t),'center',np.round(t.mean(axis=(0,1))*1000,4))
sheet.save(out/'fragments-1.png')
for pi,ci,t in fragments:
    if pi not in [5,6]:
        continue
    p = np.c_[t.reshape(-1,3), np.ones(t.size//3)] @ np.linalg.inv(matrix(2)).T
    print('LOCAL',pi,ci,'min',np.round(p[:,:3].min(axis=0),5),'max',np.round(p[:,:3].max(axis=0),5))
