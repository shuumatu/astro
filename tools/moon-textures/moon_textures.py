#!/usr/bin/env python3
"""Rebuild the Moon demo's surface textures.

Two jobs, both driven from the service URLs recorded in
``frontend/public/demos/moon/ATTRIBUTION.md``:

``sites``
    Turn every hotspot crop into an *albedo* image plus a matching DEM bump map. The crops that
    ship today are LROC WAC shaded relief: a fixed Sun is baked into the pixels, so a crop can
    never agree with the atlas, which is normalised albedo and is lit by the scene. Dividing the
    baked shading out with a LOLA hillshade leaves the albedo, and handing the scene the same
    DEM as a bump map gives the drill-down back the relief - this time with the Sun the demo
    actually simulates, so it changes with the phase like the rest of the globe.

``polar``
    Replace the smooth polar bands of the global atlas. The SVS colour map stitches its caps in
    from polar mosaics that are blurred and flatter than the terrain around them, which reads as
    a blank bright bar along the limb. The WAC polar mosaics carry the real texture; this command
    transfers their detail onto the atlas's existing brightness and colours.

``atlas-wide``
    Rebuild selected regional ``-wide`` tiers directly from the global albedo atlas and give
    them a local LOLA bump map. This is useful where the stitched WAC wide photograph has a
    visibly different viewing/illumination character from both the atlas and the fine tier.

Run with the bundled Python (numpy + Pillow) and a proxy if the network needs one::

    python moon_textures.py --proxy http://127.0.0.1:7890 sites
    python moon_textures.py --proxy http://127.0.0.1:7890 atlas-wide
    python moon_textures.py --proxy http://127.0.0.1:7890 polar

Every download is cached under ``--work`` (default: the system temp directory), so re-running
after a change only redoes the image work.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "frontend" / "public" / "demos" / "moon"
SITES_DIR = PUBLIC / "sites"
SITES_TS = REPO / "frontend" / "src" / "features" / "demos" / "scenes" / "moon" / "sites.ts"

MOON_RADIUS_M = 1_737_400.0

# Moon Trek image services (ArcGIS REST), all requested with bboxSR=imageSR=4326.
TREK = "https://trek.nasa.gov/moon/trekarcgis/rest/services"
DEM_SERVICE = f"{TREK}/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer/exportImage"
SOUTH_POLAR_WAC = f"{TREK}/LRO_WAC_Mosaic_SPole60_100m_v02/ImageServer/exportImage"
NORTH_POLAR_WAC = f"{TREK}/LRO_WAC_Mosaic_NPole60_100m_v02/ImageServer/exportImage"
# These are the dedicated 100 m/pixel pole-centred orthographic mosaics. Unlike the 4326 export
# above, their native polar-stereographic grid does not duplicate a longitude row at the pole.
SOUTH_POLAR_ORTHO = f"{TREK}/LRO_WAC_Mosaic_90S000E_100m/MapServer/export"
NORTH_POLAR_ORTHO = f"{TREK}/LRO_WAC_Mosaic_90N000E_100m/MapServer/export"

WAC_GLOBAL = f"{TREK}/LRO_WAC_Mosaic_Global_303ppd_v02/ImageServer/exportImage"
# The global atlas stores height linearly over the Moon's -9 km .. +10 km range as an 8-bit grey
# image; a patch bump map has to use the same convention for `bumpScale` to mean the same thing.
ATLAS_HEIGHT_RANGE_KM = 19.0
ATLAS_HEIGHT_MIN_KM = -9.0


# --------------------------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------------------------


def log(message: str) -> None:
    print(message, flush=True)


class Fetcher:
    """Downloads through an optional proxy, caching to disk and retrying once."""

    def __init__(self, work: Path, proxy: str | None) -> None:
        self.work = work
        self.work.mkdir(parents=True, exist_ok=True)
        if proxy:
            os.environ.setdefault("HTTP_PROXY", proxy)
            os.environ.setdefault("HTTPS_PROXY", proxy)
        handler = urllib.request.ProxyHandler({"http": proxy, "https": proxy}) if proxy else None
        self.opener = urllib.request.build_opener(*([handler] if handler else []))

    def get(self, url: str, name: str, *, refresh: bool = False) -> Path:
        suffix = Path(urllib.parse.urlparse(url).path).suffix or ".bin"
        target = self.work / f"{name}{suffix}"
        if target.exists() and not refresh and target.stat().st_size > 0:
            log(f"  cached {target.name} ({target.stat().st_size / 1e6:.1f} MB)")
            return target
        request = urllib.request.Request(url, headers={"User-Agent": "astro-moon-textures/1.0"})
        last: Exception | None = None
        for attempt in range(3):
            try:
                log(f"  fetching {name}{suffix} ...")
                with self.opener.open(request, timeout=600) as response:
                    data = response.read()
                if not data:
                    raise RuntimeError("empty response")
                target.write_bytes(data)
                log(f"  got {target.name} ({len(data) / 1e6:.1f} MB)")
                return target
            except Exception as error:  # noqa: BLE001 - network flakiness is expected here
                last = error
                time.sleep(2 + 3 * attempt)
        raise RuntimeError(f"could not fetch {url}: {last}")


def arcgis_url(service: str, bbox, size, *, fmt: str, pixel_type: str) -> str:
    west, south, east, north = bbox
    width, height = size
    query = urllib.parse.urlencode({
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326",
        "imageSR": "4326",
        "size": f"{width},{height}",
        "format": fmt,
        "pixelType": pixel_type,
        "interpolation": "RSP_BilinearInterpolation",
        # Without this the service stretches the box to the requested aspect ratio, which would
        # silently re-georeference every crop whose box is not the shape of its image.
        "adjustAspectRatio": "false",
        "f": "image",
    })
    return f"{service}?{query}"


def polar_ortho_url(service: str, bbox, width: int, height: int) -> str:
    """Request the native pole-centred image in its polar stereographic projection."""
    west, south, east, north = bbox
    query = urllib.parse.urlencode({
        "bbox": f"{west},{south},{east},{north}",
        "size": f"{width},{height}",
        "format": "png32",
        "f": "image",
    })
    # MapServer derives the projection from the map itself; bboxSR/imageSR are intentionally not
    # supplied because ArcGIS rejects the service's custom Moon2000 WKID when exporting a map.
    return f"{service}?{query}"


def load_polar_orthographic(fetcher: Fetcher, hemisphere: str) -> Image.Image:
    """Fetch a 3x3 native polar mosaic, bypassing MapServer's 2048 px export ceiling."""
    service = SOUTH_POLAR_ORTHO if hemisphere == "south" else NORTH_POLAR_ORTHO
    extent = 1_126_000.0
    grid, tile_size = 3, 2048
    step = (2.0 * extent) / grid
    output = Image.new("L", (grid * tile_size, grid * tile_size))
    for row in range(grid):
        north = extent - row * step
        south = north - step
        for column in range(grid):
            west = -extent + column * step
            east = west + step
            path = fetcher.get(
                polar_ortho_url(service, (west, south, east, north), tile_size, tile_size),
                f"polar-ortho-{hemisphere}-{row}-{column}",
            )
            with Image.open(path) as tile:
                output.paste(tile.convert("L"), (column * tile_size, row * tile_size))
    return output


def box_blur(array: np.ndarray, radius: int) -> np.ndarray:
    """Separable box blur, reflect-padded; cheap and enough for a high-pass split."""
    if radius <= 0:
        return array.copy()
    rows, columns = array.shape
    radius = min(radius, min(rows, columns) // 2 - 1)
    if radius < 1:
        return array.copy()
    padded = np.pad(array, ((radius, radius), (radius, radius)), mode="reflect")
    summed = np.cumsum(padded, axis=0)
    summed = np.vstack([np.zeros((1, summed.shape[1]), summed.dtype), summed])
    horizontal = (summed[2 * radius + 1:] - summed[:-(2 * radius + 1)]) / (2 * radius + 1)
    summed = np.cumsum(horizontal, axis=1)
    summed = np.hstack([np.zeros((summed.shape[0], 1), summed.dtype), summed])
    return (summed[:, 2 * radius + 1:] - summed[:, :-(2 * radius + 1)]) / (2 * radius + 1)


def resample(array: np.ndarray, width: int, height: int) -> np.ndarray:
    image = Image.fromarray(array.astype(np.float32), mode="F")
    return np.array(image.resize((width, height), Image.BILINEAR), dtype=np.float32)


def resample_field(field: np.ndarray, width: int, height: int) -> np.ndarray:
    """Resample a per-pixel vector field, one component at a time."""
    return np.stack([resample(field[:, :, index], width, height) for index in range(3)], axis=2)


def srgb_to_linear(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, 0.0, 1.0)
    return np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, 0.0, 1.0)
    return np.where(values <= 0.0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - 0.055)


def to_grey8(values: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(values * 255.0 + 0.5, 0, 255).astype(np.uint8), mode="L")


# --------------------------------------------------------------------------------------------
# surface geometry
# --------------------------------------------------------------------------------------------


def surface_normals(dem_m: np.ndarray, bbox) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Unit normals (east, north, up) for a DEM patch, in the equirectangular frame of `bbox`."""
    west, south, east, north = bbox
    rows, columns = dem_m.shape
    latitude = north - (np.arange(rows) + 0.5) * (north - south) / rows
    metres_per_row = MOON_RADIUS_M * math.radians(abs(north - south) / rows)
    metres_per_column = (
        MOON_RADIUS_M * math.radians(abs(east - west) / columns)
        * np.maximum(np.cos(np.radians(latitude)), 1e-6)
    )[:, None]
    dz_drow, dz_dcolumn = np.gradient(dem_m)
    east_slope = dz_dcolumn / metres_per_column
    north_slope = dz_drow / metres_per_row
    nx, ny, nz = -east_slope, north_slope, np.ones_like(dem_m)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / length, ny / length, nz / length


def shade(normals, azimuth_deg: float, elevation_deg: float) -> np.ndarray:
    nx, ny, nz = normals
    azimuth, elevation = math.radians(azimuth_deg), math.radians(elevation_deg)
    return np.clip(
        nx * math.cos(elevation) * math.sin(azimuth)
        + ny * math.cos(elevation) * math.cos(azimuth)
        + nz * math.sin(elevation),
        1e-3,
        None,
    )


def fit_sun(
    normals,
    brightness: np.ndarray,
    *,
    detail_radius: int,
    azimuth_step: float = 10.0,
    elevation_step: float = 5.0,
    refine: bool = True,
) -> tuple[float, float, float]:
    """Least-squares search for the (azimuth, elevation) that shaped a shaded mosaic.

    The fit runs on high-passed detail only: a mosaic's large-scale brightness is albedo, which
    would otherwise dominate the correlation and drag the angles around.
    """
    high_pass = brightness - box_blur(brightness, detail_radius)
    high_pass = high_pass - high_pass.mean()

    def score(azimuth: float, elevation: float) -> float:
        model = shade(normals, azimuth, elevation)
        model = model - box_blur(model, detail_radius)
        model = model - model.mean()
        denominator = math.sqrt(float((model * model).sum()) * float((high_pass * high_pass).sum()))
        if denominator == 0:
            return -1.0
        return float((model * high_pass).sum()) / denominator

    def sweep(azimuths, elevations) -> tuple[float, float, float]:
        best = (-1.0, 0.0, 0.0)
        for azimuth in azimuths:
            for elevation in elevations:
                value = score(azimuth % 360, elevation)
                if value > best[0]:
                    best = (value, azimuth % 360, elevation)
        return best

    coarse = sweep(np.arange(0, 360, azimuth_step), np.arange(5, 65, elevation_step))
    if not refine:
        return coarse[1], coarse[2], coarse[0]
    refined = sweep(
        np.arange(coarse[1] - azimuth_step, coarse[1] + azimuth_step + 1e-6, 2.0),
        np.arange(max(3.0, coarse[2] - elevation_step), coarse[2] + elevation_step + 1e-6, 1.0),
    )
    return refined[1], refined[2], refined[0]


def fit_sun_field(
    normals,
    brightness: np.ndarray,
    *,
    detail_radius: int,
    grid: int,
    overlap: float,
) -> tuple[np.ndarray, float]:
    """Per-tile solar direction, blended into a sun-vector field.

    The global WAC mosaic is stitched from years of images, so its illumination is only locally
    constant: a 1200 km wide crop can span several Sun positions and no single (azimuth,
    elevation) explains it. Fitting each tile separately and blending the *vectors* (rather than
    the angles, which wrap) recovers the shading the mosaic actually has.
    """
    rows, columns = brightness.shape
    sun = np.zeros((rows, columns, 3), dtype=np.float32)
    weight = np.zeros((rows, columns), dtype=np.float32)
    step_row, step_column = rows / grid, columns / grid
    span_row = int(step_row * (1 + overlap))
    span_column = int(step_column * (1 + overlap))
    scores: list[float] = []
    vector_sum = np.zeros(3, dtype=np.float64)
    weight_sum = 0.0
    for index_row in range(grid):
        for index_column in range(grid):
            row0 = min(max(int((index_row + 0.5) * step_row - span_row / 2), 0), rows - span_row)
            column0 = min(max(int((index_column + 0.5) * step_column - span_column / 2), 0),
                          columns - span_column)
            row1, column1 = row0 + span_row, column0 + span_column
            tile_normals = tuple(axis[row0:row1, column0:column1] for axis in normals)
            tile = brightness[row0:row1, column0:column1]
            azimuth, elevation, score = fit_sun(
                tile_normals, tile, detail_radius=max(2, detail_radius // 2),
            )
            scores.append(score)
            if score <= 0.05:
                continue
            rows_offset = np.arange(row0, row1) - (index_row + 0.5) * step_row
            columns_offset = np.arange(column0, column1) - (index_column + 0.5) * step_column
            kernel = (
                np.clip(1 - np.abs(rows_offset) / (span_row / 2), 0, None)[:, None]
                * np.clip(1 - np.abs(columns_offset) / (span_column / 2), 0, None)[None, :]
            ).astype(np.float32)
            azimuth_rad, elevation_rad = math.radians(azimuth), math.radians(elevation)
            vector = np.array([
                math.cos(elevation_rad) * math.sin(azimuth_rad),
                math.cos(elevation_rad) * math.cos(azimuth_rad),
                math.sin(elevation_rad),
            ], dtype=np.float32)
            sun[row0:row1, column0:column1] += vector[None, None, :] * kernel[:, :, None]
            weight[row0:row1, column0:column1] += kernel
            vector_sum += vector * float(kernel.sum())
            weight_sum += float(kernel.sum())
    if weight_sum == 0:
        return np.zeros_like(sun) + np.array([0.0, -1.0, 0.1], dtype=np.float32), 0.0
    fallback = vector_sum / weight_sum
    fallback /= max(float(np.linalg.norm(fallback)), 1e-6)
    empty = weight <= 0
    sun[empty] = fallback
    weight[empty] = 1.0
    sun /= np.maximum(weight, 1e-6)[:, :, None]
    length = np.linalg.norm(sun, axis=2, keepdims=True)
    sun /= np.maximum(length, 1e-6)
    return sun, float(np.mean(scores))


def shade_field(normals, sun: np.ndarray) -> np.ndarray:
    nx, ny, nz = normals
    return np.clip(
        nx * sun[:, :, 0] + ny * sun[:, :, 1] + nz * sun[:, :, 2], 1e-3, None,
    )


# --------------------------------------------------------------------------------------------
# sites: shaded crop -> albedo + bump
# --------------------------------------------------------------------------------------------


def parse_sites() -> list[dict]:
    text = SITES_TS.read_text(encoding="utf-8")
    entries = []
    pattern = re.compile(
        r"id: '([^']+)',\s*"
        r"bbox: \[([^\]]+)\],\s*"
        r"width: (\d+),\s*"
        r"height: (\d+),",
    )
    for match in pattern.finditer(text):
        site_id = match.group(1)
        bbox = [float(part) for part in match.group(2).split(",")]
        if len(bbox) != 4:
            continue
        entries.append({
            "id": site_id,
            "bbox": bbox,
            "width": int(match.group(3)),
            "height": int(match.group(4)),
        })
    return entries


def load_grey(path: Path, width: int, height: int) -> np.ndarray:
    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (width, height):
            grey = grey.resize((width, height), Image.LANCZOS)
    return np.array(grey, dtype=np.float32) / 255.0


def load_nodata_alpha(path: Path, width: int, height: int) -> np.ndarray:
    """Return an alpha mask that hides long, bright no-data bands from the image service.

    Moon Trek encodes an out-of-coverage row as opaque white instead of transparent pixels.  A
    brightness test is safe here because real lunar highlights are not an entire row; requiring
    a run of rows also keeps bright photographic seams intact.  The short ramp makes the fallback
    to the atlas invisible even when the service's last valid row is dark.
    """
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        if rgba.size != (width, height):
            rgba = rgba.resize((width, height), Image.LANCZOS)
        pixels = np.array(rgba, dtype=np.uint8)
    alpha = pixels[:, :, 3].astype(np.float32) / 255.0
    white = pixels[:, :, :3].mean(axis=2) >= 250.0
    rows = white.mean(axis=1) > 0.5
    # Only treat a contiguous run as no-data.  This avoids making a single bright row in a real
    # image transparent, while still catching the service's solid polar bands.
    invalid = np.zeros(height, dtype=bool)
    start = None
    for index, value in enumerate(np.r_[rows, False]):
        if value and start is None:
            start = index
        elif not value and start is not None:
            if index - start >= 8:
                invalid[start:index] = True
            start = None
    alpha[invalid] = 0.0
    # Fade into the atlas over a few pixels before each invalid run.
    starts = np.flatnonzero(invalid & ~np.r_[False, invalid[:-1]])
    for start in starts:
        for ramp in range(1, 25):
            previous = start - ramp
            if previous < 0 or invalid[previous]:
                break
            alpha[previous] = np.minimum(alpha[previous], ramp / 24.0)
    return np.clip(alpha, 0.0, 1.0)


def save_site_image(path: Path, image: Image.Image, alpha: np.ndarray) -> None:
    """Write a crop while retaining transparency for any no-data rows."""
    rgb = np.array(image.convert("RGB"), dtype=np.uint8)
    rgba = np.dstack([rgb, np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)])
    # Lossless keeps the transparent boundary truly transparent; lossy WebP can turn zero-alpha
    # edge pixels into a faint opaque white fringe after decoding.
    Image.fromarray(rgba, mode="RGBA").save(path, format="WEBP", lossless=True, method=6)


def load_dem(path: Path, width: int, height: int) -> np.ndarray:
    with Image.open(path) as image:
        values = np.array(image, dtype=np.float32)
    if values.shape != (height, width):
        values = resample(values, width, height)
    return values


def stabilise_polar_dem(dem: np.ndarray, bbox) -> np.ndarray:
    """Make the one physical pole vertex have one physical elevation.

    An equirectangular request returns a complete row of samples at +/-90 degrees, although all
    those longitudes are the same point. SphereGeometry correctly collapses that row to one
    vertex; leaving different heights in it would split the collapsed vertex into a radial fan
    of spikes. Blend only the last few rows towards their longitude mean, reaching one exact
    value at the pole. Away from the singularity the LOLA samples are untouched.
    """
    west, south, east, north = bbox
    if south > -89.999 and north < 89.999:
        return dem
    stable = dem.copy()
    rows = min(8, stable.shape[0])
    indexes = range(stable.shape[0] - rows, stable.shape[0]) if south <= -89.999 else range(rows)
    indexes = list(indexes)
    for step, index in enumerate(indexes):
        proximity = (step + 1) / rows if south <= -89.999 else (rows - step) / rows
        weight = proximity * proximity
        mean = float(stable[index].mean())
        stable[index] = stable[index] * (1.0 - weight) + mean * weight
    return stable


def shaded_source(fetcher: Fetcher, site: dict) -> Path:
    """The WAC mosaic crop the demo shipped, kept as the pipeline's input.

    The first run copies the shipped crop into the cache; later runs keep using that copy even
    though the shipped file has become the albedo version. A cold cache re-downloads it.
    """
    cache = fetcher.work / "shaded"
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f"{site['id']}.webp"
    if target.exists():
        return target
    shipped = SITES_DIR / f"{site['id']}.webp"
    if shipped.exists():
        target.write_bytes(shipped.read_bytes())
        return target
    fetched = fetcher.get(
        arcgis_url(
            WAC_GLOBAL, site["bbox"], (site["width"], site["height"]),
            fmt="png", pixel_type="U8",
        ),
        f"wac-{site['id']}",
    )
    with Image.open(fetched) as image:
        image.convert("L").save(target, format="WEBP", quality=95, method=6)
    return target


def process_site(
    fetcher: Fetcher,
    site: dict,
    *,
    bump_scale: float,
    shade_blur: float,
    gain_limit: float,
    out_sites: Path,
    out_bump: Path,
    tile_threshold: float = 0.5,
    keep_threshold: float = 0.45,
    tile_grid: int = 3,
) -> dict:
    site_id, bbox = site["id"], site["bbox"]
    width, height = site["width"], site["height"]
    crop_path = SITES_DIR / f"{site_id}.webp"
    if not crop_path.exists():
        raise FileNotFoundError(crop_path)

    log(f"{site_id}: {width}x{height} {'x'.join(f'{v:.2f}' for v in bbox)}")
    shaded_path = shaded_source(fetcher, site)
    alpha = load_nodata_alpha(shaded_path, width, height)
    dem_path = fetcher.get(
        arcgis_url(DEM_SERVICE, bbox, (width, height), fmt="tiff", pixel_type="F32"),
        f"dem-{site_id}",
    )
    dem = load_dem(dem_path, width, height)
    low_km, high_km = float(dem.min()) / 1000.0, float(dem.max()) / 1000.0
    center_km = float(dem[height // 2, width // 2]) / 1000.0
    encoded = (dem / 1000.0 - low_km) / max(high_km - low_km, 1e-6)
    bump = to_grey8(encoded)
    out_bump.mkdir(parents=True, exist_ok=True)
    # Even a crop whose photograph keeps its original shadows still needs absolute geometry.
    # The runtime only applies the extra bump term to reliably de-shaded imagery, but it uses
    # this same height texture to keep every overlay on the displaced lunar surface.
    bump.save(out_bump / f"{site_id}.webp", format="WEBP", lossless=True, method=6)
    relief = {
        "heightMinKm": round(low_km, 6),
        "heightRangeKm": round(high_km - low_km, 6),
        "centerHeightKm": round(center_km, 6),
    }
    normals = surface_normals(dem, bbox)

    crop_linear = srgb_to_linear(load_grey(shaded_path, width, height))
    # Fit on a coarse grid: the same illumination shapes every crop of one mosaic, and at full
    # resolution the fit chases DEM noise in the steepest slopes instead.
    coarse_rows = min(768, height)
    coarse_columns = max(64, int(round(width * coarse_rows / height)))
    coarse = int(max(2, round(width / coarse_columns)))
    brightness = resample(crop_linear, coarse_columns, coarse_rows)
    fine_normals = tuple(resample(axis, coarse_columns, coarse_rows) for axis in normals)
    azimuth, elevation, fit_score = fit_sun(
        fine_normals, brightness, detail_radius=max(2, coarse * 2),
    )
    tiled = False
    if fit_score < tile_threshold:
        field, tiled_score = fit_sun_field(
            fine_normals,
            brightness,
            detail_radius=max(2, coarse * 2),
            grid=tile_grid,
            overlap=0.3,
        )
        if tiled_score > fit_score:
            lighting = shade_field(normals, resample_field(field, width, height))
            fit_score, tiled = tiled_score, True
        else:
            lighting = shade(normals, azimuth, elevation)
    else:
        lighting = shade(normals, azimuth, elevation)
    if fit_score < keep_threshold:
        # Nothing explains this crop's lighting well enough to divide it out; leaving the baked
        # photo in place beats replacing it with a guess.
        out_sites.mkdir(parents=True, exist_ok=True)
        with Image.open(shaded_path) as source_image:
            save_site_image(out_sites / f"{site_id}.webp", source_image, alpha)
        return {
            "id": site_id,
            "keptShaded": True,
            "fit": round(float(fit_score), 3),
            "azimuthDeg": round(float(azimuth), 1),
            "elevationDeg": round(float(elevation), 1),
            **relief,
        }
    # A laser altimeter DEM is smooth: it knows the big slopes and nothing finer. Dividing the
    # full-resolution hillshade out would therefore flatten the craters the crop gets right and
    # only leave the DEM's noise behind, so the correction is band-limited - the low-frequency
    # illumination goes (that is the part that fights the scene's Sun), the shaded texture stays.
    radius = int(round(shade_blur))
    if radius > 0:
        correction = box_blur(lighting, radius) / max(float(box_blur(lighting, radius).mean()), 1e-6)
    else:
        correction = lighting / max(float(lighting.mean()), 1e-6)
    correction = np.clip(correction, 1.0 / gain_limit, gain_limit)
    albedo = crop_linear / correction
    # Preserve the crop's linear mean: the stored `tint` was matched against it, and the patch
    # has to keep standing in for the same atlas colour it did before.
    albedo *= float(crop_linear.mean()) / max(float(albedo.mean()), 1e-6)

    out_sites.mkdir(parents=True, exist_ok=True)
    save_site_image(out_sites / f"{site_id}.webp", to_grey8(linear_to_srgb(albedo)), alpha)

    return {
        "id": site_id,
        "azimuthDeg": round(float(azimuth), 1),
        "elevationDeg": round(float(elevation), 1),
        "fit": round(float(fit_score), 3),
        "bumpRangeKm": round(high_km - low_km, 3),
        "bumpScale": round((high_km - low_km) / ATLAS_HEIGHT_RANGE_KM * bump_scale, 5),
        "albedo": round(float(albedo.mean()), 5),
        "shadeBlurPx": radius,
        "gainLimit": gain_limit,
        **relief,
    }


def command_sites(args) -> int:
    fetcher = Fetcher(args.work, args.proxy)
    sites = parse_sites()
    # The NAC tiers are metre-scale photographs of landing sites. No DEM that reaches them
    # exists, their own relief is what makes the landers legible, and at that depth the atlas is
    # nowhere on screen - so they stay as they are.
    if not args.include_nac:
        sites = [site for site in sites
                 if not site["id"].endswith(("-nac", "-nac-close"))]
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        sites = [site for site in sites if site["id"] in wanted]
    log(f"sites: {len(sites)} crop(s)")
    report = []
    out_sites = Path(args.out_sites) if args.out_sites else SITES_DIR
    out_bump = Path(args.out_bump) if args.out_bump else PUBLIC / "bump"
    for site in sites:
        try:
            report.append(process_site(
                fetcher,
                site,
                bump_scale=args.bump_scale,
                shade_blur=args.shade_blur,
                gain_limit=args.gain_limit,
                out_sites=out_sites,
                out_bump=out_bump,
                tile_threshold=args.tile_threshold,
                keep_threshold=args.keep_threshold,
            ))
        except Exception as error:  # noqa: BLE001 - keep going, report at the end
            log(f"  FAILED {site['id']}: {error}")
            report.append({"id": site["id"], "error": str(error)})
    out = args.work / "sites-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    log(f"wrote {out}")
    if not args.out_sites and not args.out_bump:
        emit_bump_module(report)
        emit_relief_module(report)
    for entry in report:
        if "bumpScale" in entry:
            log(
                f"  {entry['id']:<24} az {entry['azimuthDeg']:>5}  el {entry['elevationDeg']:>4}"
                f"  r {entry['fit']:>6}  bump {entry['bumpScale']:>7}  range {entry['bumpRangeKm']:>7} km"
            )
        elif "fit" in entry:
            log(f"  {entry['id']:<24} r {entry['fit']:>6}  kept its baked shading")
    return 0


def atlas_crop(image: Image.Image, bbox, width: int, height: int) -> Image.Image:
    """Sample a selenographic lon/lat box from the global equirectangular atlas."""
    west, south, east, north = bbox
    atlas_width, atlas_height = image.size
    left = (west + 180.0) / 360.0 * atlas_width
    right = (east + 180.0) / 360.0 * atlas_width
    top = (90.0 - north) / 180.0 * atlas_height
    bottom = (90.0 - south) / 180.0 * atlas_height
    return image.crop((left, top, right, bottom)).resize((width, height), Image.LANCZOS)


def process_atlas_wide(fetcher: Fetcher, site: dict, *, bump_scale: float) -> dict:
    """Build one wide tier from the exact atlas underneath it plus higher-resolution relief."""
    site_id, bbox = site["id"], site["bbox"]
    width, height = site["width"], site["height"]
    atlas_path = PUBLIC / "moon-color-8k.webp"
    if not atlas_path.exists():
        raise FileNotFoundError(atlas_path)
    log(f"{site_id}: atlas colour + LOLA relief")
    with Image.open(atlas_path) as atlas:
        colour = atlas_crop(atlas.convert("RGB"), bbox, width, height)
    colour.save(SITES_DIR / f"{site_id}.webp", format="WEBP", quality=90, method=6)

    dem_path = fetcher.get(
        arcgis_url(DEM_SERVICE, bbox, (width, height), fmt="tiff", pixel_type="F32"),
        f"dem-{site_id}",
    )
    dem = load_dem(dem_path, width, height)
    low_km, high_km = float(dem.min()) / 1000.0, float(dem.max()) / 1000.0
    encoded = (dem / 1000.0 - low_km) / max(high_km - low_km, 1e-6)
    bump_dir = PUBLIC / "bump"
    bump_dir.mkdir(parents=True, exist_ok=True)
    to_grey8(encoded).save(
        bump_dir / f"{site_id}.webp", format="WEBP", lossless=True, method=6,
    )
    return {
        "id": site_id,
        "atlasWide": True,
        "bumpRangeKm": round(high_km - low_km, 3),
        "bumpScale": round((high_km - low_km) / ATLAS_HEIGHT_RANGE_KM * bump_scale, 5),
        "heightMinKm": round(low_km, 6),
        "heightRangeKm": round(high_km - low_km, 6),
        "centerHeightKm": round(float(dem[height // 2, width // 2]) / 1000.0, 6),
    }


def command_atlas_wide(args) -> int:
    """Replace problem wide photographs with atlas-matched colour and local LOLA relief."""
    wanted = {name.strip() for name in args.only.split(",") if name.strip()}
    sites = [site for site in parse_sites() if site["id"] in wanted]
    missing = wanted - {site["id"] for site in sites}
    if missing:
        raise ValueError(f"unknown site id(s): {', '.join(sorted(missing))}")
    if any(not site["id"].endswith("-wide") for site in sites):
        raise ValueError("atlas-wide only accepts -wide tiers")
    fetcher = Fetcher(args.work, args.proxy)
    report = [process_atlas_wide(fetcher, site, bump_scale=args.bump_scale) for site in sites]
    emit_bump_module(report, merge=True)
    emit_relief_module(report, merge=True)
    out = args.work / "atlas-wide-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for entry in report:
        log(
            f"  {entry['id']:<24} bump {entry['bumpScale']:>7}"
            f"  range {entry['bumpRangeKm']:>7} km"
        )
    return 0


def process_relief(fetcher: Fetcher, site: dict, *, max_size: int) -> dict:
    """Export absolute LOLA elevation for displacement without touching the colour crop."""
    site_id, bbox = site["id"], site["bbox"]
    width, height = site["width"], site["height"]
    cached = fetcher.work / f"dem-{site_id}.bin"
    if cached.exists():
        dem_path = cached
        with Image.open(dem_path) as image:
            dem = np.array(image, dtype=np.float32)
    else:
        factor = min(1.0, max_size / max(width, height))
        dem_width = max(64, int(round(width * factor)))
        dem_height = max(64, int(round(height * factor)))
        dem_path = fetcher.get(
            arcgis_url(DEM_SERVICE, bbox, (dem_width, dem_height), fmt="tiff", pixel_type="F32"),
            f"dem-{site_id}",
        )
        dem = load_dem(dem_path, dem_width, dem_height)
    dem = stabilise_polar_dem(dem, bbox)
    low_km, high_km = float(dem.min()) / 1000.0, float(dem.max()) / 1000.0
    rows, columns = dem.shape
    encoded = (dem / 1000.0 - low_km) / max(high_km - low_km, 1e-6)
    bump_dir = PUBLIC / "bump"
    bump_dir.mkdir(parents=True, exist_ok=True)
    to_grey8(encoded).save(
        bump_dir / f"{site_id}.webp", format="WEBP", lossless=True, method=6,
    )
    return {
        "id": site_id,
        "heightMinKm": round(low_km, 6),
        "heightRangeKm": round(high_km - low_km, 6),
        "centerHeightKm": round(float(dem[rows // 2, columns // 2]) / 1000.0, 6),
    }


def command_relief(args) -> int:
    """Give every colour tier a displacement texture, including the small NAC tiers."""
    fetcher = Fetcher(args.work, args.proxy)
    sites = parse_sites()
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        sites = [site for site in sites if site["id"] in wanted]
    report = []
    for site in sites:
        log(f"{site['id']}: LOLA displacement")
        report.append(process_relief(fetcher, site, max_size=args.max_size))
    emit_relief_module(report, merge=bool(args.only))
    out = args.work / "relief-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    log(f"wrote {out}")
    return 0


# --------------------------------------------------------------------------------------------
# generated source
# --------------------------------------------------------------------------------------------


BUMP_MODULE_HEADER = '''/**
 * Bump strength for every hotspot crop, generated by `tools/moon-textures/moon_textures.py`.
 *
 * The scene lights the globe with the LOLA height map as a bump map: an 8-bit grey image whose
 * values run linearly over the Moon's -9 km .. +10 km range, with a bump scale of 1.2. A crop's
 * bump map uses the same convention but stretches its own local height range over the full 8-bit
 * scale, because a hundred kilometres of terrain would otherwise occupy a handful of levels. The
 * numbers below are a multiple of the globe's own scale, sized so a patch gets the same relief
 * strength as the ground it covers; the tool derives them from each crop's DEM.
 *
 * Features with no entry keep their baked shading: the LROC NAC tiers are metre-scale photographs
 * of landing sites, and no DEM that resolves them exists to relight them with.
 */
'''


def emit_bump_module(report: list[dict], *, merge: bool = False) -> None:
    scales = {entry["id"]: entry["bumpScale"] for entry in report if "bumpScale" in entry}
    target = REPO / "frontend" / "src" / "features" / "demos" / "scenes" / "moon" / "siteBumps.ts"
    if merge and target.exists():
        for site_id, value in re.findall(r"'([^']+)': ([0-9.]+),", target.read_text(encoding="utf-8")):
            scales.setdefault(site_id, float(value))
    entries = sorted(scales.items())
    lines = [BUMP_MODULE_HEADER, "export const SITE_BUMP_SCALE: Record<string, number> = {\n"]
    for site_id, scale in entries:
        lines.append(f"  '{site_id}': {scale},\n")
    lines.append("}\n")
    target.write_text("".join(lines), encoding="utf-8")
    log(f"wrote {target.relative_to(REPO)} ({len(entries)} entries)")


RELIEF_MODULE_HEADER = '''/**
 * Absolute LOLA elevation metadata for hotspot meshes, generated by
 * `tools/moon-textures/moon_textures.py relief`.
 *
 * Each lossless height texture spans `minKm .. minKm + rangeKm`, relative to the IAU lunar
 * reference sphere of radius 1737.4 km. `centerKm` lets the focused camera orbit the actual
 * ground instead of the mathematical sphere.
 */
export interface SiteRelief {
  minKm: number
  rangeKm: number
  centerKm: number
}

'''


def emit_relief_module(report: list[dict], *, merge: bool = False) -> None:
    relief = {
        entry["id"]: (
            entry["heightMinKm"], entry["heightRangeKm"], entry["centerHeightKm"],
        )
        for entry in report
        if all(key in entry for key in ("heightMinKm", "heightRangeKm", "centerHeightKm"))
    }
    target = REPO / "frontend" / "src" / "features" / "demos" / "scenes" / "moon" / "siteRelief.ts"
    if merge and target.exists():
        pattern = re.compile(
            r"'([^']+)': \{ minKm: (-?[0-9.]+), rangeKm: ([0-9.]+), centerKm: (-?[0-9.]+) \},"
        )
        for site_id, low, span, center in pattern.findall(target.read_text(encoding="utf-8")):
            relief.setdefault(site_id, (float(low), float(span), float(center)))
    lines = [RELIEF_MODULE_HEADER, "export const SITE_RELIEF: Record<string, SiteRelief> = {\n"]
    for site_id, (low, span, center) in sorted(relief.items()):
        lines.append(
            f"  '{site_id}': {{ minKm: {low}, rangeKm: {span}, centerKm: {center} }},\n"
        )
    lines.append("}\n")
    target.write_text("".join(lines), encoding="utf-8")
    log(f"wrote {target.relative_to(REPO)} ({len(relief)} entries)")


def command_check(args) -> int:
    """Fail on the no-data white bands that the WAC crops arrive with near the south pole."""
    failures = 0
    for path in sorted(SITES_DIR.glob("*.webp")):
        with Image.open(path) as image:
            rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
        # A short transparent ramp is intentional: only inspect pixels that are effectively
        # opaque, otherwise the ramp itself would be reported as a white band.
        visible = rgba[:, :, 3] > 240
        grey = rgba[:, :, :3].mean(axis=2)
        blank = ((grey >= 250) & visible).mean(axis=1) > 0.5
        if blank.any():
            rows = np.flatnonzero(blank)
            log(f"{path.name}: {len(rows)} blank row(s), {rows[0]}..{rows[-1]}")
            failures += 1
    if failures:
        log(f"{failures} crop(s) carry no-data rows")
        return 1
    log("no blank bands found")
    return 0


# --------------------------------------------------------------------------------------------
# polar caps: give the atlas its terrain back
# --------------------------------------------------------------------------------------------

# The atlas is 8192x4096, so a band from latitude -58 to the pole is 728 rows of the same grid.
POLAR_TOP_LAT = 58.0
POLAR_WIDTH = 8192
POLAR_HEIGHT = int(round(POLAR_WIDTH * (90.0 - POLAR_TOP_LAT) / 360.0))


def polar_bbox(hemisphere: str):
    if hemisphere == "south":
        return (-180.0, -90.0, 180.0, -POLAR_TOP_LAT)
    return (-180.0, POLAR_TOP_LAT, 180.0, 90.0)


def polar_orthographic_to_equirectangular(
    image: Image.Image,
    hemisphere: str,
    *,
    width: int,
    height: int,
) -> np.ndarray:
    """Reproject a native Moon2000 polar-stereographic image into an atlas cap.

    The source map is a square centred on the pole. Its projection follows the spherical
    polar-stereographic form used by the LROC service: rho = 2R tan((90-|lat|)/2). Sampling is
    bilinear and keeps a conservative validity mask so the rectangular atlas never receives the
    white outside-the-disc background from the map export.
    """
    source = np.array(image.convert("L"), dtype=np.float32) / 255.0
    source_size = source.shape[0]
    # `load_polar_orthographic` mosaics 3x3 MapServer tiles into the same physical extent; the
    # larger pixel array only improves sampling, it does not enlarge the projected Moon.
    source_extent_m = 1_126_000.0
    moon_radius_m = MOON_RADIUS_M
    rows = np.arange(height, dtype=np.float32)
    lats = POLAR_TOP_LAT + (rows + 0.5) * (90.0 - POLAR_TOP_LAT) / height
    if hemisphere == "south":
        lats = -lats
    lons = (-180.0 + (np.arange(width, dtype=np.float32) + 0.5) * 360.0 / width)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    rho = 2.0 * moon_radius_m * np.tan(np.radians((90.0 - np.abs(lat_grid)) / 2.0))
    lon = np.radians(lon_grid)
    x = rho * np.sin(lon)
    # NASA's north projection has negative map Y on lon=0; the south has positive Y.
    # Pixel rows point down, so sy below performs the separate map-to-image vertical flip.
    y = rho * np.cos(lon) * (1.0 if hemisphere == "south" else -1.0)
    sx = (x + source_extent_m) / (2.0 * source_extent_m) * (source_size - 1)
    sy = (source_extent_m - y) / (2.0 * source_extent_m) * (source_size - 1)
    valid = (sx >= 0) & (sx < source_size - 1) & (sy >= 0) & (sy < source_size - 1)
    x0 = np.clip(np.floor(sx).astype(np.int32), 0, source_size - 1)
    y0 = np.clip(np.floor(sy).astype(np.int32), 0, source_size - 1)
    x1 = np.minimum(x0 + 1, source_size - 1)
    y1 = np.minimum(y0 + 1, source_size - 1)
    fx = sx - x0
    fy = sy - y0
    result = (
        source[y0, x0] * (1.0 - fx) * (1.0 - fy)
        + source[y0, x1] * fx * (1.0 - fy)
        + source[y1, x0] * (1.0 - fx) * fy
        + source[y1, x1] * fx * fy
    )
    # The map export has an off-disc white background. A neutral value means the caller's
    # atlas remains unchanged wherever the polar product does not cover the requested row.
    result[~valid] = 1.0
    return result


def process_polar(
    fetcher: Fetcher,
    hemisphere: str,
    *,
    detail_radius: int,
    strength: float,
    clamp: float,
    deshade: bool,
) -> dict:
    bbox = polar_bbox(hemisphere)
    size = (POLAR_WIDTH, POLAR_HEIGHT)
    service = SOUTH_POLAR_WAC if hemisphere == "south" else NORTH_POLAR_WAC
    log(f"{hemisphere}: WAC polar mosaic {POLAR_WIDTH}x{POLAR_HEIGHT}")
    ortho_path = fetcher.work / f"polar-ortho-{hemisphere}-mosaic.png"
    if not ortho_path.exists():
        load_polar_orthographic(fetcher, hemisphere).save(ortho_path, format="PNG")
    dem_path = fetcher.get(
        arcgis_url(DEM_SERVICE, bbox, size, fmt="tiff", pixel_type="F32"),
        f"polar-dem-{hemisphere}",
    )

    with Image.open(ortho_path) as image:
        # The WAC service's native product is a 100 m/pixel, pole-centred orthographic image.
        # Reproject it here into the atlas's equirectangular rows; feeding its 4326 export into a
        # rectangular sphere would stretch the pole and recreate the same white/angle artefacts.
        mosaic = polar_orthographic_to_equirectangular(
            image,
            hemisphere,
            width=POLAR_WIDTH,
            height=POLAR_HEIGHT,
        )
    dem = load_dem(dem_path, POLAR_WIDTH, POLAR_HEIGHT)
    normals = surface_normals(dem, bbox)

    coarse = 4
    coarse_size = (POLAR_WIDTH // coarse, POLAR_HEIGHT // coarse)
    azimuth, elevation, fit_score = fit_sun(
        tuple(resample(axis, *coarse_size) for axis in normals),
        resample(mosaic, *coarse_size),
        detail_radius=6,
    )
    log(f"  illumination: azimuth {azimuth:.0f}°, elevation {elevation:.0f}°, r {fit_score:.3f}")

    mosaic_linear = srgb_to_linear(mosaic)
    # The polar mosaic is a photo taken with the Sun a few degrees above the horizon, so its
    # brightness is mostly illumination. Dividing the fitted hillshade out (`deshade`) would be
    # the physical fix, but a Lambertian model has little to say at grazing incidence - it leaves
    # a strong radial gradient behind. High-passing the mosaic instead keeps the terrain it shows
    # and drops the gradient, which is what the atlas's smooth cap is missing.
    source = mosaic_linear / shade(normals, azimuth, elevation) if deshade else mosaic_linear
    source = np.maximum(source, 1e-4)
    # A polar mosaic darkens steadily towards the pole (the Sun is grazing there and the atlas
    # has already decided how bright this band is), so take that latitude profile out first.
    profile = np.median(source, axis=1, keepdims=True)
    source = source / np.maximum(profile, 1e-6)
    # Everything here happens in log space: a grazing-incidence hillshade divides by very small
    # numbers, and exponentiating those ratios straight away overflows into NaN.
    detail = source / np.maximum(box_blur(source, detail_radius), 1e-6)
    # Shadowed crater floors run several stops below their surroundings in a grazing-Sun mosaic;
    # left alone they would saturate the amplitude clamp and erase the terrain in between.
    detail = np.clip(detail, 0.5, 2.0)
    log_correction = strength * np.log(detail)

    latitude = np.array([[bbox[3] - (row + 0.5) * (bbox[3] - bbox[1]) / POLAR_HEIGHT]
                         for row in range(POLAR_HEIGHT)], dtype=np.float32)
    # Feather the whole way from 62° to 76° of latitude: the polar mosaics are the better source
    # only deeper than that, and the seam has to be invisible in between.
    distance_from_pole = 90.0 - np.abs(latitude)
    weight = np.clip((28.0 - distance_from_pole) / 14.0, 0.0, 1.0)
    weight = weight * weight * (3 - 2 * weight)
    # The mosaic is a photo, not an albedo map, so its detail carries as much illumination as
    # terrain. Re-centre it (a brightness step at the seam would be worse than the smooth cap)
    # and hold it to a modest amplitude, which is what keeps the cap reading as the same map.
    # Each row keeps its own level: a polar mosaic is a stop or two darker or brighter than the
    # atlas depending on latitude, and a map that steps brighter in one ring and darker in the
    # next would be worse than the smooth cap this replaces.
    log_correction -= log_correction.mean(axis=1, keepdims=True)
    log_correction = np.clip(log_correction, math.log(0.4), math.log(2.5))
    correction = np.exp(log_correction)
    correction = np.clip(correction, 1.0 - clamp, 1.0 + clamp)
    blend = 1.0 + (correction - 1.0) * weight

    return {
        "hemisphere": hemisphere,
        "azimuthDeg": round(float(azimuth), 1),
        "elevationDeg": round(float(elevation), 1),
        "fit": round(float(fit_score), 3),
        "detailStrength": strength,
        "detailRadiusPx": detail_radius,
        "detailClamp": clamp,
        "deshade": deshade,
        "correctionMean": round(float(blend.mean()), 4),
    }, blend


def apply_polar_blend(image: Image.Image, blend: np.ndarray, hemisphere: str) -> Image.Image:
    """Multiply one hemisphere's detail field into an atlas image, in linear light."""
    width, height = image.size
    rows = int(round(height * (90.0 - POLAR_TOP_LAT) / 360.0))
    blend_small = resample(blend, width, rows)
    encoded = np.array(image.convert("RGB"), dtype=np.float32) / 255.0
    array = srgb_to_linear(encoded)
    if hemisphere == "south":
        band = slice(height - rows, height)
    else:
        band = slice(0, rows)
    array[band] = array[band] * np.clip(blend_small, 0.25, 4.0)[:, :, None]
    # Detail is multiplicative, so the band's linear mean is what has to hold. The *encoded* mean
    # still dips, because a transfer function that bends downwards spreads unevenly, and that dip
    # is what would read as a step against the rest of the map; nudge until it is gone.
    target = float(encoded[band].mean())
    for _ in range(3):
        current = float(linear_to_srgb(array[band]).mean())
        if current <= 1e-6:
            break
        array[band] *= min(max(target / current, 0.8), 1.25)
    out = linear_to_srgb(array)
    return Image.fromarray(np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), mode="RGB")


def command_polar(args) -> int:
    fetcher = Fetcher(args.work, args.proxy)
    hemispheres = ["south", "north"] if args.hemisphere == "both" else [args.hemisphere]
    report = []
    for hemisphere in hemispheres:
        entry, blend = process_polar(
            fetcher,
            hemisphere,
            detail_radius=args.detail_radius,
            strength=args.detail_strength,
            clamp=args.detail_clamp,
            deshade=args.deshade,
        )
        report.append(entry)
        for name in ("moon-color-8k.webp", "moon-color-4k.webp"):
            path = PUBLIC / name
            if not path.exists():
                continue
            if args.dry_run:
                log(f"  would rewrite {name}")
                continue
            with Image.open(path) as image:
                rebuilt = apply_polar_blend(image, blend, hemisphere)
                # 80 keeps the rebuilt map within a few hundred kilobytes of what it replaced:
                # the polar texture is high-frequency and compresses worse than the smooth cap.
                rebuilt.save(path, format="WEBP", quality=80, method=6)
            log(f"  rewrote {name} ({path.stat().st_size / 1e6:.1f} MB)")
    out = args.work / "polar-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    log(f"wrote {out}")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--proxy", default=os.environ.get("MOON_PROXY"), help="HTTP proxy URL")
    parser.add_argument(
        "--work",
        type=Path,
        default=Path(os.environ.get("TEMP", "/tmp")) / "moon-work",
        help="download cache directory",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    sites = subparsers.add_parser("sites", help="rebuild hotspot crops as albedo + bump")
    sites.add_argument("--only", help="comma-separated site ids")
    sites.add_argument(
        "--bump-scale",
        type=float,
        default=1.0,
        help="multiplier on the derived bump strength (1 = as strong as the globe's relief)",
    )
    sites.add_argument(
        "--shade-blur",
        type=float,
        default=12.0,
        help="radius, in output pixels, of the low-pass used to keep only the large-scale shading",
    )
    sites.add_argument(
        "--gain-limit",
        type=float,
        default=1.6,
        help="largest brightness correction the deshading may apply",
    )
    sites.add_argument(
        "--tile-threshold",
        type=float,
        default=0.5,
        help="fit quality below which the illumination is fitted per tile instead of per crop",
    )
    sites.add_argument(
        "--keep-threshold",
        type=float,
        default=0.45,
        help="fit quality below which a crop keeps its baked shading instead of being deshaded",
    )
    sites.add_argument("--out-sites", help="write the albedo crops here instead of the demo folder")
    sites.add_argument("--out-bump", help="write the bump maps here instead of the demo folder")
    sites.add_argument(
        "--include-nac",
        action="store_true",
        help="also rebuild the LROC NAC landing-site tiers (not recommended: no matching DEM)",
    )
    sites.set_defaults(func=command_sites)

    atlas_wide = subparsers.add_parser(
        "atlas-wide",
        help="rebuild selected wide tiers from the global atlas + local LOLA relief",
    )
    atlas_wide.add_argument(
        "--only",
        default="tycho-wide,clavius-wide,change-3-wide,change-4-wide,change-5-wide",
        help="comma-separated -wide site ids",
    )
    atlas_wide.add_argument(
        "--bump-scale",
        type=float,
        default=3.0,
        help="multiplier on the derived bump strength",
    )
    atlas_wide.set_defaults(func=command_atlas_wide)

    relief = subparsers.add_parser(
        "relief",
        help="export absolute LOLA displacement for every colour tier without changing imagery",
    )
    relief.add_argument("--only", help="comma-separated site ids")
    relief.add_argument(
        "--max-size",
        type=int,
        default=1024,
        help="largest DEM side downloaded when a full-resolution site DEM is not cached",
    )
    relief.set_defaults(func=command_relief)

    check = subparsers.add_parser("check", help="scan crops for no-data white bands")
    check.set_defaults(func=command_check)

    polar = subparsers.add_parser("polar", help="rebuild the atlas polar caps from WAC polar mosaics")
    polar.add_argument("--hemisphere", choices=["south", "north", "both"], default="both")
    polar.add_argument(
        "--detail-radius",
        type=int,
        default=40,
        help="detail scale in atlas pixels (8192 wide); 40 px is about 10 km at 70° S",
    )
    polar.add_argument(
        "--detail-strength",
        type=float,
        default=1.0,
        help="how much of the polar mosaic's detail to transfer onto the atlas",
    )
    polar.add_argument(
        "--detail-clamp",
        type=float,
        default=0.28,
        help="largest brightness modulation the detail may apply, as a fraction",
    )
    polar.add_argument("--dry-run", action="store_true", help="fetch and report without rewriting")
    polar.add_argument(
        "--deshade",
        action="store_true",
        help="divide the fitted hillshade out of the polar mosaic before taking its detail",
    )
    polar.set_defaults(func=command_polar)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
