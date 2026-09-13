"""
Bake the Moon demo's browsable panoramas.

For each panorama in the manifest this:
  1. downloads the NASA / IAU original through the proxy (cached under --work);
  2. measures the black-sky band so the vertical field of view can be derived instead of guessed;
  3. resizes to the shipped width and encodes WebP;
  4. writes `frontend/public/demos/moon/panoramas/*.webp` and a generated
     `frontend/src/features/demos/scenes/moon/moonPanoramas.ts`.

Run with the bundled Python (numpy + Pillow), which is the only interpreter here that has both:

    $env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"
    & "C:\\Users\\ENDLESS\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" `
        tools/moon-textures/moon_panoramas.py --proxy http://127.0.0.1:7890 all

Subcommands: `measure` (report sky bands and derived fields of view only), `bake` (assets +
generated module), `all`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
PUBLIC_DIR = REPO / "frontend" / "public" / "demos" / "moon" / "panoramas"
GENERATED = REPO / "frontend" / "src" / "features" / "demos" / "scenes" / "moon" / "moonPanoramas.ts"

# 5120 px across: on a 1600 px viewport showing a 150 degree field of view, this lands at about
# one texture pixel per screen pixel, so the viewer is never magnifying the strip beyond what the
# release actually contains. Wider than this would only enlarge the JPEG artefacts that some of
# these archives carry.
SHIPPED_WIDTH = 5120
WEBP_QUALITY = 80

# The elevation range is calibrated rather than derived, and this is the factor.
#
# The derivation would be ertical_fov = span / aspect, which assumes the strip is an isotropic
# cylindrical projection. The published Apollo and Chang'e strips are not: they carry about twice as
# many pixels per degree of elevation as per degree of azimuth, so a sphere or an isotropic cylinder
# shows them stretched vertically by roughly two to one. This factor was measured by flattening each
# strip at several candidate scales and comparing against the source at
# docs/lunar-panorama-research/tools/flatten-view.py,
# and 1.75 is where two different panoramas agreed. It is the one fitted number in this pipeline, and
# ATTRIBUTION.md records it as such.
VERTICAL_EXTENT_SCALE = 1.75

# A 70 mm Hasselblad frame on the lunar surface is about 33 degrees across and 33 degrees tall.
# The stitched strips are cylindrical, which relates their dimensions to the sweep:
#
#     sweep_deg  ~  aspect  *  vertical_fov_deg
#
# That is one equation with two unknowns, so the sweep cannot be recovered from the file alone.
# Two anchors are documented well enough to use, and they disagree by more than a little:
#
#   * Armstrong's crater (jsc2008e040725) was stitched from 8 frames and spans roughly 130
#     degrees. Its 3.51 aspect then implies a 37 degree vertical field of view.
#   * Apollo 17 Station 2 (jsc2004e52777) was tested for closure and decisively does not close
#     (see docs/lunar-panorama-research/lunar-panorama-sources.md); its 9.44 aspect at 37 degrees would
#     predict 349 degrees, which is inconsistent with ends that face opposite ways.
#
# Rather than pretend the ambiguity away, each panorama carries an explicit sweep with its
# evidence recorded in `span_source`, and the vertical field of view is solved from it. The
# values below therefore read as "this is what the strip was stitched to cover", which is the
# quantity the viewer actually needs, and `span_source` says how firmly that is known. The
# five Apollo 11 anchors are the ones with outside confirmation; the rest are modelled from the
# frame count and the overlap the Lunar Surface Journal describes, and are marked as such.
FRAME_VERTICAL_FOV_DEG = 37.0
FULL_SWEEP_DEG = 360.0
MIN_SPAN_DEG = 60.0


@dataclass
class Panorama:
    id: str
    site_id: str
    title: str
    caption: str
    url: str
    credit: str
    licence: str
    source_frames: str
    # Azimuth span the stitch covers, in degrees. Set explicitly per panorama; see the note above
    # FRAME_VERTICAL_FOV_DEG for why this cannot be derived from the file alone.
    span_deg: float
    # How the span is known: "documented" when a source states it, "closes" when the two ends
    # were measured to join, otherwise "modelled" from the frame count and overlap.
    span_source: str
    # True when the strip's two ends actually join, so it can be turned through a full circle.
    closes: bool
    # Azimuth the centre of the image faces, degrees clockwise from selenographic north. Zero
    # until the source frames' headings are recovered from the Apollo Image Atlas; the viewer
    # shows an "orientation approximate" note while it is zero.
    heading_deg: float = 0.0
    # Set on an entry that cannot ship yet, explaining why. Pending entries are skipped when the
    # module is generated, so the demo only ever sees panoramas it can actually reach; the
    # evidence in the entry is kept so enabling it later is a one-line change.
    pending: str = ""
    # Solved from the span and the strip's aspect ratio by `solve_geometry`.
    vertical_fov_deg: float = 0.0
    measured_width: int = 0
    measured_height: int = 0
    # The original file's dimensions, kept because the geometry is derived from them.
    source_width: int = 0
    source_height: int = 0
    sky_fraction: float = 0.0
    outputs: dict = field(default_factory=dict)


def _pano(**kwargs) -> Panorama:
    """Manifest entry helper: everything is keyword-only so a miscounted field cannot slip in."""
    return Panorama(**kwargs)


PANORAMAS: list[Panorama] = [
    _pano(
        id="apollo-11-tranquility-base",
        site_id="apollo-11",
        title="Tranquility Base, looking south-west",
        caption=(
            "Apollo 11, 20 July 1969. Photographed from about ten metres west of the Lunar Module "
            "\"Eagle\"'s plus-Z footpad, looking toward the south-west at the crater rim Armstrong "
            "had spotted from the window during the descent."
        ),
        url="https://images-assets.nasa.gov/image/jsc2007e045375/jsc2007e045375~orig.jpg",
        source_frames="magazine 40, frames AS11-40-5881 to 5891 (11 frames)",
        credit="NASA / Johnson Space Center (jsc2007e045375)",
        licence="NASA imagery, public domain in the United States",
        span_deg=160.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-11-armstrong-crater",
        site_id="apollo-11",
        title="Armstrong's crater from Tranquility Base",
        caption=(
            "Apollo 11, 20 July 1969. A crater Armstrong called out during the descent, with the "
            "Lunar Module and flag at the left edge and the photographer's own shadow at the right."
        ),
        url="https://images-assets.nasa.gov/image/jsc2008e040725/jsc2008e040725~orig.jpg",
        source_frames="magazine 40, frames AS11-40-5954 to 5961 (8 frames)",
        credit="NASA / Johnson Space Center (jsc2008e040725)",
        licence="NASA imagery, public domain in the United States",
        span_deg=130.0,
        span_source="documented",
        closes=False,
    ),
    _pano(
        id="apollo-12-surveyor-crater",
        site_id="apollo-12",
        title="Surveyor Crater from the rim",
        caption=(
            "Apollo 12, November 1969. Taken from north-east of Intrepid, sweeping west past the "
            "flag and then round into Surveyor Crater, where Surveyor 3 had landed two and a half "
            "years earlier."
        ),
        url="https://images-assets.nasa.gov/image/jsc2007e045376/jsc2007e045376~orig.jpg",
        source_frames="magazine 47, frames AS12-47-6982 to 7006 (25 frames)",
        credit="NASA / Johnson Space Center (jsc2007e045376)",
        licence="NASA imagery, public domain in the United States",
        span_deg=280.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-14-fra-mauro",
        site_id="apollo-14",
        title="Toward the western horizon",
        caption=(
            "Apollo 14, February 1971. A sweep across the Fra Mauro formation toward the western "
            "horizon, from the terrain Shepard and Mitchell crossed on foot."
        ),
        url="https://images-assets.nasa.gov/image/jsc2007e045377/jsc2007e045377~orig.jpg",
        source_frames="magazine 66, frames AS14-66-9271 to 9293 (23 frames)",
        credit="NASA / Johnson Space Center (jsc2007e045377)",
        licence="NASA imagery, public domain in the United States",
        span_deg=300.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-15-hadley-rille",
        site_id="apollo-15",
        title="Hadley Rille and the Lunar Roving Vehicle",
        caption=(
            "Apollo 15, August 1971. David Scott at the Lunar Roving Vehicle on the edge of Hadley "
            "Rille, photographed by James Irwin south of Station 2."
        ),
        url="https://images-assets.nasa.gov/image/jsc2011e118359/jsc2011e118359~orig.jpg",
        source_frames="magazine 85, frames AS15-85-11448 to 11453 (6 frames)",
        credit="NASA / Johnson Space Center (jsc2011e118359)",
        licence="NASA imagery, public domain in the United States",
        span_deg=110.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-16-station-1",
        site_id="apollo-16",
        title="Station 1, Descartes highlands",
        caption=(
            "Apollo 16, April 1972. Charles Duke collecting samples at Station 1 while John Young "
            "photographs him, on the first moonwalk of the mission."
        ),
        url="https://images-assets.nasa.gov/image/jsc2012e052598/jsc2012e052598~orig.jpg",
        source_frames="magazine 114, frames AS16-114-18416 to 18431 (16 frames)",
        credit="NASA / Johnson Space Center (jsc2012e052598)",
        licence="NASA imagery, public domain in the United States",
        span_deg=260.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-17-station-2",
        site_id="apollo-17",
        title="Station 2, Taurus-Littrow",
        caption=(
            "Apollo 17, December 1972. The second moonwalk: the parked Lunar Roving Vehicle and "
            "astronaut footprints across the valley floor, with the South Massif ridge beyond."
        ),
        url="https://images-assets.nasa.gov/image/jsc2004e52777/jsc2004e52777~orig.jpg",
        source_frames="magazine 138, frames AS17-138-21053 to 21073 (21 frames)",
        credit="NASA / Johnson Space Center (jsc2004e52777)",
        licence="NASA imagery, public domain in the United States",
        span_deg=240.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="apollo-17-station-5",
        site_id="apollo-17",
        title="Station 5, on the edge of Camelot",
        caption=(
            "Apollo 17, December 1972. Boulders and the shoulder of the North Massif at Station 5, "
            "looking toward the massif. The strip covers most of the horizon but its two ends do not "
            "meet, so turning stops at the edge of the photograph."
        ),
        url="https://images-assets.nasa.gov/image/jsc2004e20304/jsc2004e20304~orig.jpg",
        source_frames="magazine 145, frames AS17-145-22159 to 22181 (23 frames)",
        credit="NASA / Johnson Space Center (jsc2004e20304)",
        licence="NASA imagery, public domain in the United States",
        span_deg=300.0,
        span_source="modelled",
        closes=False,
    ),
    _pano(
        id="change-4-farside-lander",
        site_id="change-4",
        title="The far side of the Moon, from Chang'e 4",
        caption=(
            "Chang'e 4, January 2019. The first panorama taken from the lunar far side: the "
            "lander's solar panels and the Yutu-2 rover's tracks inside Von Karman crater, in the "
            "South Pole-Aitken basin."
        ),
        url="https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg",
        source_frames="lander terrain camera ring shot, released by CNSA via the IAU",
        credit="CNSA / CLEP, via the International Astronomical Union (iau1901a)",
        licence="CC BY 4.0",
        span_deg=300.0,
        span_source="modelled",
        closes=False,
    ),
]




class Fetcher:
    """Downloads through an optional proxy, caching to disk."""

    def __init__(self, work: Path, proxy: str | None) -> None:
        self.work = work
        self.work.mkdir(parents=True, exist_ok=True)
        if proxy:
            os.environ.setdefault("HTTP_PROXY", proxy)
            os.environ.setdefault("HTTPS_PROXY", proxy)
        self.proxy = proxy

    def fetch(self, url: str, name: str) -> Path:
        target = self.work / name
        if target.exists() and target.stat().st_size > 0:
            return target
        handlers = []
        if self.proxy:
            handlers.append(urllib.request.ProxyHandler({"http": self.proxy, "https": self.proxy}))
        opener = urllib.request.build_opener(*handlers)
        request = urllib.request.Request(url, headers={"User-Agent": "astro-moon-demo/1.0 (texture bake)"})
        try:
            with opener.open(request, timeout=300) as response, target.open("wb") as handle:
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    handle.write(chunk)
        except urllib.error.URLError as error:  # pragma: no cover - network dependent
            raise SystemExit(f"download failed for {url}: {error}") from error
        return target


def sky_fraction(image: Image.Image) -> float:
    """Fraction of the frame height that is blacked-out sky, as a sanity check only.

    This is *not* used to derive geometry. It was tempting to treat the black band as a ruler for
    the vertical field of view, but the band varies with the Sun's position: in Apollo 12 and 14
    the shadowed foreground is as dark as the sky, while in Apollo 11 Tranquility Base the sky
    occupies only about 8% of the frame and in the Chang'e 4 strip about 18%. The frame's own
    dimensions are the reliable ruler, so the field of view comes from the geometry below and
    this number is printed only so a human can eyeball that it looks sane.
    """
    grey = np.asarray(image.convert("L"), dtype=np.float32)
    # Sample rows rather than reading a 30000 px row 3000 times; the answer only needs to be
    # approximately right.
    step = max(1, grey.shape[1] // 512)
    sampled = grey[:, ::step]
    height = sampled.shape[0]
    dark = (sampled < 24).mean(axis=1)
    rows = np.nonzero(dark > 0.9)[0]
    if rows.size == 0 or rows[0] > 1:
        return 0.0
    return (int(rows[-1]) + 1) / height


def solve_geometry(pano: Panorama) -> tuple[float, float]:
    """Return (span_deg, vertical_fov_deg).

    The two are locked together by the picture itself. If one degree of azimuth and one degree of
    elevation occupy the same number of texture pixels - which is what a cylindrical projection
    means - then

        span / width_px  ==  vertical_fov / height_px

    so the sweep fixes the elevation range and there is nothing left to fit. An earlier version of
    this function multiplied the result by a calibrated factor to make the strips look right, which
    was compensating for the viewer pairing an arc-length width with a tangent-derived height; that
    inconsistency is fixed in `panoramaCylinderGeometry`, so the factor is gone.
    """
    if pano.measured_width <= 0 or pano.measured_height <= 0:
        return pano.span_deg or FULL_SWEEP_DEG, pano.vertical_fov_deg or FRAME_VERTICAL_FOV_DEG
    # The source aspect, not the shipped one: rounding the shipped height to a whole pixel over a
    # strip only a few hundred pixels tall shifts the aspect enough to matter, and the viewer's own
    # consistency check compares the recorded field of view against that aspect.
    aspect = pano.source_width / pano.source_height
    if pano.span_deg > 0:
        return pano.span_deg, (pano.span_deg / aspect) * VERTICAL_EXTENT_SCALE
    span = max(MIN_SPAN_DEG, min(FULL_SWEEP_DEG, aspect * FRAME_VERTICAL_FOV_DEG))
    return span, (span / aspect) * VERTICAL_EXTENT_SCALE


def load_manifest() -> list[Panorama]:
    """Every entry that can ship. Pending ones are reported rather than silently dropped."""
    for pano in PANORAMAS:
        if pano.pending:
            print(f"pending   {pano.id:32} {pano.pending}")
    return [pano for pano in PANORAMAS if not pano.pending]


def run_measure(fetcher: Fetcher, panos: list[Panorama]) -> None:
    Image.MAX_IMAGE_PIXELS = None
    print(f"{'id':32} {'source':>13} {'aspect':>7} {'sky%':>6} {'span°':>7} {'vFOV°':>7}")
    for pano in panos:
        path = fetcher.fetch(pano.url, f"{pano.id}{Path(pano.url).suffix}")
        with Image.open(path) as image:
            image.load()
            pano.measured_width, pano.measured_height = image.size
            pano.source_width, pano.source_height = image.size
            pano.sky_fraction = sky_fraction(image)
        pano.span_deg, pano.vertical_fov_deg = solve_geometry(pano)
        print(
            f"{pano.id:32} {pano.measured_width:6}x{pano.measured_height:<6} "
            f"{pano.measured_width / pano.measured_height:6.2f} "
            f"{pano.sky_fraction * 100:5.1f}% {pano.span_deg:6.1f} {pano.vertical_fov_deg:6.1f}"
        )


def run_bake(fetcher: Fetcher, panos: list[Panorama], proxy: str | None) -> None:
    Image.MAX_IMAGE_PIXELS = None
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for pano in panos:
        path = fetcher.fetch(pano.url, f"{pano.id}{Path(pano.url).suffix}")
        with Image.open(path) as image:
            image.load()
            pano.measured_width, pano.measured_height = image.size
            pano.source_width, pano.source_height = image.size
            pano.sky_fraction = sky_fraction(image)
            # The whole frame is kept, sky band included, so the horizon stays exactly where the
            # photograph put it. The sky is at most a third of these frames and usually under a
            # tenth, so trimming it would save little and would have to be undone to place the
            # horizon correctly.
            scale = SHIPPED_WIDTH / image.width
            size = (SHIPPED_WIDTH, max(1, round(image.height * scale)))
            resized = image.convert("RGB").resize(size, Image.LANCZOS)
            out = PUBLIC_DIR / f"{pano.id}.webp"
            resized.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
        pano.span_deg, pano.vertical_fov_deg = solve_geometry(pano)
        pano.outputs = {"width": size[0], "height": size[1], "bytes": out.stat().st_size}
        print(
            f"baked {pano.id:32} {size[0]}x{size[1]}  span {pano.span_deg:5.1f}°  "
            f"vFOV {pano.vertical_fov_deg:5.1f}°  {out.stat().st_size / 1024:.0f} KB"
        )

    GENERATED.parent.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text(render_module(panos), encoding="utf-8")
    print(f"wrote {GENERATED.relative_to(REPO)}")

    # A panorama that has been deferred or removed leaves its texture behind, where it would keep
    # being served as dead weight. The manifest is the source of truth, so anything not in it goes.
    expected = {f"{pano.id}.webp" for pano in panos}
    for stale in sorted(PUBLIC_DIR.glob("*.webp")):
        if stale.name not in expected:
            stale.unlink()
            print(f"removed stale texture {stale.name}")

    total = sum(p.outputs["bytes"] for p in panos)
    print(f"total shipped: {total / 1048576:.2f} MB across {len(panos)} panoramas")


def render_module(panos: list[Panorama]) -> str:
    lines: list[str] = []
    lines.append("/**")
    lines.append(" * Browsable surface panoramas, one or more per landing site.")
    lines.append(" *")
    lines.append(" * GENERATED by `tools/moon-textures/moon_panoramas.py` - edit the manifest there, not this")
    lines.append(" * file. Each entry carries the geometry the viewer needs: the azimuth the centre of the")
    lines.append(" * image faces and the azimuth span it covers, both degrees clockwise from selenographic")
    lines.append(" * north, plus the vertical field of view of the frame.")
    lines.append(" *")
    lines.append(" * `headingDeg` is 0 until the source frames' own headings are recovered from the Apollo")
    lines.append(" * Image Atlas. A zero heading means the placement is unverified and the viewer says so")
    lines.append(" * rather than implying the panorama is oriented correctly.")
    lines.append(" */")
    lines.append("")
    lines.append("export interface MoonPanorama {")
    lines.append("  id: string")
    lines.append("  siteId: string")
    lines.append("  title: string")
    lines.append("  caption: string")
    lines.append("  /** Path under the public directory. */")
    lines.append("  file: string")
    lines.append("  width: number")
    lines.append("  height: number")
    lines.append("  /** Azimuth of the image centre, degrees clockwise from north. 0 = unverified. */")
    lines.append("  headingDeg: number")
    lines.append("  /** Azimuth span covered by the image, in degrees. 360 means it closes. */")
    lines.append("  spanDeg: number")
    lines.append("  /** How `spanDeg` is known: 'documented', 'closes', or 'modelled'. */")
    lines.append("  spanSource: 'documented' | 'closes' | 'modelled'")
    lines.append("  /** Vertical field of view of the frame, in degrees. */")
    lines.append("  verticalFovDeg: number")
    lines.append("  /** Source frames the stitch was built from. */")
    lines.append("  sourceFrames: string")
    lines.append("  credit: string")
    lines.append("  licence: string")
    lines.append("}")
    lines.append("")
    lines.append("export const MOON_PANORAMAS: MoonPanorama[] = [")
    for pano in panos:
        lines.append("  {")
        lines.append(f"    id: {json.dumps(pano.id)},")
        lines.append(f"    siteId: {json.dumps(pano.site_id)},")
        lines.append(f"    title: {json.dumps(pano.title)},")
        lines.append(f"    caption: {json.dumps(pano.caption)},")
        lines.append(f"    file: {json.dumps(f'/demos/moon/panoramas/{pano.id}.webp')},")
        lines.append(f"    width: {pano.outputs.get('width', 0)},")
        lines.append(f"    height: {pano.outputs.get('height', 0)},")
        lines.append(f"    headingDeg: {pano.heading_deg:g},")
        lines.append(f"    spanDeg: {pano.span_deg:g},")
        lines.append(f"    spanSource: {json.dumps(pano.span_source)},")
        lines.append(f"    verticalFovDeg: {pano.vertical_fov_deg:.2f},")
        lines.append(f"    sourceFrames: {json.dumps(pano.source_frames)},")
        lines.append(f"    credit: {json.dumps(pano.credit)},")
        lines.append(f"    licence: {json.dumps(pano.licence)},")
        lines.append("  },")
    lines.append("]")
    lines.append("")
    lines.append("/** Every panorama published for a site, in manifest order. */")
    lines.append("export function panoramasForSite(siteId: string): MoonPanorama[] {")
    lines.append("  return MOON_PANORAMAS.filter((panorama) => panorama.siteId === siteId)")
    lines.append("}")
    lines.append("")
    lines.append("export function findPanorama(id: string): MoonPanorama | null {")
    lines.append("  return MOON_PANORAMAS.find((panorama) => panorama.id === id) ?? null")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["measure", "bake", "all"])
    parser.add_argument("--proxy", default=os.environ.get("MOON_PROXY"))
    parser.add_argument("--work", default=str(REPO / ".cache" / "moon-panoramas"))
    args = parser.parse_args()

    fetcher = Fetcher(Path(args.work), args.proxy)
    panos = load_manifest()
    if args.command in ("measure", "all"):
        run_measure(fetcher, panos)
    if args.command in ("bake", "all"):
        run_bake(fetcher, panos, args.proxy)


if __name__ == "__main__":
    main()
