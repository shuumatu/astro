"""Build both atlas LODs and native polar LODs from one colour-matched master.

Inputs are immutable: the original SVS atlas and cached NASA polar mosaics.
Never use the previously baked public atlas as input (detail would accumulate).
No network is needed when the Moon Trek downloads have already been cached.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RADIUS = 1_737_400.0
EXTENT = 1_126_000.0


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def linear(x):
    return np.where(x <= .04045, x / 12.92, ((x + .055) / 1.055) ** 2.4)


def encoded(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= .0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - .055)


def rgb_image(x):
    return Image.fromarray(np.uint8(np.clip(x * 255 + .5, 0, 255)))


def sample(a, u, v, wrap=False):
    """Pixel-centred bilinear sampler; u/v have the same convention as image rows."""
    h, w = a.shape[:2]
    x, y = u * w - .5, np.clip(v * h - .5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    x1, y1 = x0 + 1, np.minimum(y0 + 1, h - 1)
    if wrap:
        x0, x1 = x0 % w, x1 % w
    else:
        x0, x1 = np.clip(x0, 0, w - 1), np.clip(x1, 0, w - 1)
    return ((a[y0, x0] * (1-fx) + a[y0, x1] * fx) * (1-fy)
            + (a[y1, x0] * (1-fx) + a[y1, x1] * fx) * fy)


def native_lonlat(size, hemisphere, rows):
    x = ((np.arange(size, dtype=np.float32) + .5) / size * 2 - 1) * EXTENT
    y = (1 - (rows[:, None] + .5) / size * 2) * EXTENT
    rho = np.hypot(x, y)
    lat = 90 - np.degrees(2 * np.arctan(rho / (2 * RADIUS)))
    lon = np.arctan2(x, -y if hemisphere == 'north' else y)
    return lon, lat if hemisphere == 'north' else -lat


def polar_uv(lon, lat):
    rho = 2 * RADIUS * np.tan(np.radians(90 - np.abs(lat)) / 2)
    x = rho * np.sin(lon)
    y = rho * np.cos(lon) * np.where(lat >= 0, -1, 1)
    return .5 + x / (2 * EXTENT), .5 - y / (2 * EXTENT)


def make_master(atlas, source, hemisphere):
    # Compute only smooth colour/illumination fields at low resolution in the
    # native Cartesian projection, never along converging longitude rows.
    small = 512
    lon, lat = native_lonlat(small, hemisphere, np.arange(small))
    target = sample(atlas, (lon / (2*np.pi) + .5) % 1, (90-lat)/180, True)
    target_low = np.asarray(rgb_image(target).filter(ImageFilter.GaussianBlur(14)), np.float32) / 255
    src_low = np.asarray(source.convert('RGB').resize((small, small), Image.Resampling.LANCZOS)
                         .filter(ImageFilter.GaussianBlur(14)), np.float32) / 255
    size = source.width
    original = np.asarray(source.convert('L'), np.float32) / 255
    output = np.empty((size, size, 3), np.uint8)
    for start in range(0, size, 128):
        rows = np.arange(start, min(start+128, size))
        lon, lat = native_lonlat(size, hemisphere, rows)
        u = np.broadcast_to((np.arange(size)+.5)/size, lon.shape)
        v = np.broadcast_to((rows[:, None]+.5)/size, lon.shape)
        target_field = linear(sample(target_low, u, v))
        source_field = linear(sample(src_low, u, v))[..., :1]
        signal = linear(original[rows, :, None])
        # Multiplicative, bounded low-frequency exposure matching preserves rim
        # positions and avoids the additive grey veil of the old shader curve.
        detail = np.clip(np.log((signal + .015)/(source_field + .015)), -1.8, 1.0)
        matched = target_field * np.exp(detail * .50)
        base = linear(sample(atlas, (lon/(2*np.pi)+.5)%1, (90-lat)/180, True))
        weight = smoothstep(60, 74, np.abs(lat))[..., None]
        output[rows] = np.uint8(np.clip(encoded(base*(1-weight) + matched*weight)*255+.5, 0, 255))
    return Image.fromarray(output)


def bake_atlas(base, masters):
    output = np.array(base.convert('RGB'))
    h, w = output.shape[:2]
    lon = (-np.pi + (np.arange(w)+.5) * 2*np.pi/w)[None, :]
    for hemisphere, master in masters.items():
        source = np.asarray(master, np.float32)/255
        for start in range(0, h, 64):
            rows = np.arange(start, min(start+64, h))
            lat = 90 - (rows[:, None]+.5)*180/h
            valid_rows = (lat[:, 0] > 60) if hemisphere == 'north' else (lat[:, 0] < -60)
            rows, lat = rows[valid_rows], lat[valid_rows]
            if not len(rows):
                continue
            u, v = polar_uv(lon, lat)
            output[rows] = np.uint8(np.clip(sample(source, u, v)*255+.5, 0, 255))
    return Image.fromarray(output)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--atlas', type=Path, required=True)
    p.add_argument('--sources', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    base = Image.open(args.atlas).convert('RGB')
    atlas = np.asarray(base, np.float32)/255
    masters = {}
    report = {'atlasSource': str(args.atlas), 'inputs': {}, 'method': 'native Cartesian exposure match; shared master; 60-74 degree bake; 180 degree atlas height'}
    for hemi in ('north', 'south'):
        path = args.sources / f'polar-ortho-{hemi}-mosaic.png'
        print(f'{hemi}: matching native master', flush=True)
        source = Image.open(path)
        master = make_master(atlas, source, hemi)
        dest = args.out / f'polar-{hemi}-matched.webp'
        master.save(dest, quality=90, method=6)
        # Bake the decoded delivered texture, not an uncompressed approximation.
        masters[hemi] = Image.open(dest).convert('RGB')
        report['inputs'][hemi] = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'size': source.size}
    print('baking registered atlas', flush=True)
    baked = bake_atlas(base, masters)
    baked.save(args.out/'moon-color-8k.webp', quality=90, method=6)
    baked.resize((4096, 2048), Image.Resampling.LANCZOS).save(args.out/'moon-color-4k.webp', quality=90, method=6)
    (args.out/'registered-poles.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('done', flush=True)


if __name__ == '__main__':
    main()
