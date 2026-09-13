"""
Flatten what the panorama viewer would show, by tracing one ray per screen pixel onto the surface the
viewer uses and sampling the shipped texture.

This is the diagnostic for "the panorama looks stretched": it reproduces the viewer's mapping without a
GPU, so the result can be compared against the source photograph pixel for pixel. If the flattened view
is a normal-looking rectilinear photograph, the mapping is sound and any distortion is a rendering
artefact; if it is smeared, the mapping itself is wrong and the numbers below say where.

**This is a historical diagnostic, kept because it is how the fault was found - not a live check.**
Read the following before trusting a number out of it:

  * It mirrors the *sphere* mapping the viewer originally used. That mapping was the bug: a sphere
    fixes the vertical scale by geometry rather than by the photograph, which stretched the terrain by
    roughly two to one. The viewer now uses a cylinder whose height is the perspective-correct
    `tan(vFov/2)`; see `panoramaView.ts` and `ATTRIBUTION.md`. Pointing this at today's viewer would
    not tell you anything about today's viewer.
  * The table below is the five-panorama pre-correction set, and its `span` for Apollo 17 Station 5 and
    Chang'e 4 is 360 - which the wrap tests later disproved. Both ship as 300 degree partial sweeps.
  * Its value was finding the vertical extent. Flattening each strip at several candidate extents and
    comparing against the source is where the 1.75 calibration factor came from; that factor is
    recorded in `tools/moon-textures/moon_panoramas.py`.

Usage:
  python docs/lunar-panorama-research/tools/flatten-view.py <panorama-id> <out.jpg> [--fov 62] [--pitch 0] [--yaw 0] [--width 1160] [--height 551]

Run it from the repository root.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image

# The repo root, from this file's location: docs/lunar-panorama-research/tools/flatten-view.py, so
# three levels up. This was two levels up when the script lived in .agents/ at the repo root, and the
# move silently broke the texture path - the count is tied to where the script is kept.
REPO = Path(__file__).resolve().parents[3]
TEXTURE_DIR = REPO / "frontend" / "public" / "demos" / "moon" / "panoramas"

# Mirrors the generated catalogue. Kept here rather than imported because this script exists to
# check that catalogue's numbers against the pixels.
PANORAMAS = {
    "apollo-11-tranquility-base": dict(span=160.0, heading=0.0, file="apollo-11-tranquility-base.webp"),
    "apollo-11-armstrong-crater": dict(span=130.0, heading=0.0, file="apollo-11-armstrong-crater.webp"),
    "apollo-17-station-2": dict(span=240.0, heading=0.0, file="apollo-17-station-2.webp"),
    "apollo-17-station-5": dict(span=360.0, heading=0.0, file="apollo-17-station-5.webp"),
    "change-4-farside-lander": dict(span=360.0, heading=0.0, file="change-4-farside-lander.webp"),
}


def texture_uv_for_direction(
    dx: float,
    dy: float,
    dz: float,
    span_deg: float,
    yaw_rad: float,
    vertical_span_deg: float,
) -> tuple[float, float]:
    """Inverse of the sphere sampling: which (u, v) of the geometry a view ray lands on.

    Mirrors three.js `SphereGeometry` (u from phi, v from theta) plus the mesh rotation the
    viewer applies, and then the viewer's own screen convention: yaw 0 looks along -Z.

    `vertical_span_deg` is how many degrees of elevation the texture's full height represents;
    the caller varies it to find the value that makes the photograph read naturally.
    """
    # Undo the mesh rotation about Y.
    cos_y, sin_y = math.cos(-yaw_rad), math.sin(-yaw_rad)
    rx = dx * cos_y + dz * sin_y
    rz = -dx * sin_y + dz * cos_y
    ry = dy
    # three's parametrisation: x = -cos(phi) sin(theta), y = cos(theta), z = sin(phi) sin(theta).
    theta = math.acos(max(-1.0, min(1.0, ry)))
    sin_theta = math.sin(theta)
    if abs(sin_theta) < 1e-9:
        phi = 0.0
    else:
        phi = math.atan2(rz, -rx)
    phi = phi % (2 * math.pi)
    u = phi / (2 * math.pi)
    # The viewer maps theta linearly onto v, which is the same as mapping elevation linearly, so
    # the ray's own elevation is what selects the texture row.
    elevation_deg = 90.0 - math.degrees(theta)
    v = 0.5 - elevation_deg / vertical_span_deg
    return u, v


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("panorama")
    parser.add_argument("out")
    parser.add_argument("--fov", type=float, default=62.0)
    parser.add_argument("--pitch", type=float, default=0.0)
    parser.add_argument("--yaw", type=float, default=0.0)
    parser.add_argument("--width", type=int, default=1160)
    parser.add_argument("--height", type=int, default=551)
    parser.add_argument(
        "--vertical-scale",
        type=float,
        default=1.0,
        help="multiply the texture's vertical extent by this, to search for the natural framing",
    )
    args = parser.parse_args()

    entry = PANORAMAS[args.panorama]
    texture = Image.open(TEXTURE_DIR / entry["file"]).convert("RGB")
    tex = np.asarray(texture, dtype=np.uint8)
    tex_h, tex_w = tex.shape[:2]
    vertical_span = entry["span"] * tex_h / tex_w * args.vertical_scale
    print(f"texture {tex_w}x{tex_h}  span {entry['span']}°  -> vertical span {vertical_span:.2f}°")

    span = entry["span"]
    yaw = math.radians(-(entry["heading"] + 180.0))

    # Camera basis: forward, right, up. yaw 0 looks along -Z; pitch tilts about the camera's X.
    yaw_cam = math.radians(args.yaw)
    pitch = math.radians(args.pitch)
    forward = np.array([
        -math.sin(yaw_cam) * math.cos(pitch),
        math.sin(pitch),
        -math.cos(yaw_cam) * math.cos(pitch),
    ])
    right = np.array([math.cos(yaw_cam), 0.0, -math.sin(yaw_cam)])
    up = np.cross(right, forward)

    aspect = args.width / args.height
    tan_half_v = math.tan(math.radians(args.fov) / 2)
    tan_half_h = tan_half_v * aspect

    out = np.zeros((args.height, args.width, 3), dtype=np.uint8)
    misses = 0
    # Which longitudes the rays land on, so the spread can be reported.
    longitudes = []
    for row in range(args.height):
        ndc_y = 1.0 - 2.0 * (row + 0.5) / args.height
        for col in range(args.width):
            ndc_x = 2.0 * (col + 0.5) / args.width - 1.0
            direction = forward + right * (ndc_x * tan_half_h) + up * (ndc_y * tan_half_v)
            direction = direction / np.linalg.norm(direction)
            u, v = texture_uv_for_direction(
                direction[0], direction[1], direction[2], span, yaw, vertical_span,
            )
            # The geometry covers `span` of the sphere at u = 0.5; outside it there is no texture.
            covered = min(span, 360.0) / 360.0
            if abs(u - 0.5) > covered / 2 or v < 0.0 or v > 1.0:
                misses += 1
                continue
            px = int(np.clip(u * (tex_w - 1), 0, tex_w - 1))
            py = int(np.clip(v * (tex_h - 1), 0, tex_h - 1))
            out[row, col] = tex[py, px]
            longitudes.append(u * 360 - 180)

    if longitudes:
        print(f"visible longitude span {max(longitudes) - min(longitudes):.1f}°, "
              f"{misses} of {args.width * args.height} pixels fall outside the strip")
    Image.fromarray(out).save(args.out, quality=92)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
