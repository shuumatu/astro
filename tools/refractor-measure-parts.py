"""Re-derive the fragment mapping from measurements on the built model itself.

Reads the classified GLB (whose node names are the builder's, not the source's) purely to recover
each fragment's geometry, then measures it about the published optical frame. The mapping rules act
on those measurements only. Writing the mapping to JSON keeps the builder and this derivation from
drifting apart.
"""
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
raw = (ROOT / 'frontend/public/models/telescope_refractor_classified.glb').read_bytes()
L = int.from_bytes(raw[12:16], 'little')
doc = json.loads(raw[20:20 + L])
binary = raw[28 + L:]


def acc(i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    dt = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    w = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    return np.ndarray((a['count'], w), dtype=dt, buffer=binary,
                      offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', np.dtype(dt).itemsize * w),
                               np.dtype(dt).itemsize)).copy()


f = np.array(doc['scenes'][0]['extras']['opticalFrame']).reshape(4, 4, order='F')
axis, O = f[:3, 0].astype(float), f[:3, 3].astype(float)

m = []
for n in doc['nodes']:
    if 'mesh' not in n:
        continue
    src = n['extras'].get('sourceNode')
    if src is None:
        continue                        # a teaching addition, not a source fragment
    p = acc(doc['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION'])
    k = (p.shape[0] // 3) * 3
    pts = p[:k].reshape(-1, 3).astype(float)
    d = pts - O
    s = d @ axis
    r = np.linalg.norm(d - np.outer(s, axis), axis=1)
    c = pts.mean(axis=0) - O
    m.append({
        'tag': f'n{src}-m{n["extras"]["sourceMesh"]}-p{n["extras"]["sourcePrimitive"]}'
               f':c{n["extras"]["sourceComponent"]}',
        'node': n['name'], 'faces': k // 3,
        'sMid': float((s.min() + s.max()) / 2), 'sMin': float(s.min()), 'sMax': float(s.max()),
        'rMin': float(r.min()), 'rMax': float(r.max()), 'height': float(pts[:, 1].mean()),
        'off': float(np.linalg.norm(c - axis * (c @ axis))),
    })

print(f'{len(m)} source fragments measured')
print(f'{"tag":20s}{"faces":>6s}{"sMid":>9s}{"rMid":>8s}{"off":>8s}{"height":>8s}')
for x in sorted(m, key=lambda x: -x['off']):
    if x['off'] > 0.04:
        print(f'{x["tag"]:20s}{x["faces"]:6d}{x["sMid"] * 1000:9.1f}'
              f'{(x["rMin"] + x["rMax"]) / 2 * 1000:8.1f}{x["off"] * 1000:8.1f}{x["height"]:8.3f}')
json.dump(m, open(OUT / 'fragments-measured.json', 'w'), indent=2)
print('WROTE', OUT / 'fragments-measured.json')
