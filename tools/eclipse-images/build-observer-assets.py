"""Build lightweight observer-view textures from the credited NASA source images."""

from pathlib import Path
import math
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "frontend/public/demos/eclipse"
MOON = ROOT / "frontend/public/demos/moon/moon-color-4k.webp"


def moon_disc() -> None:
    atlas = Image.open(MOON).convert("RGB")
    width, height = atlas.size
    source = atlas.load()
    size = 768
    result = Image.new("RGBA", (size, size))
    target = result.load()
    for row in range(size):
        y = (row + .5 - size / 2) / (size / 2 - 2)
        for col in range(size):
            x = (col + .5 - size / 2) / (size / 2 - 2)
            radius2 = x * x + y * y
            if radius2 >= 1:
                continue
            z = math.sqrt(1 - radius2)
            longitude = math.atan2(x, z)
            latitude = math.asin(-y)
            u = round((longitude / (2 * math.pi) + .5) * width) % width
            v = min(height - 1, max(0, round((.5 - latitude / math.pi) * height)))
            alpha = round(min(1, (1 - math.sqrt(radius2)) * size / 2) * 255)
            target[col, row] = (*source[u, v], alpha)
    result.save(DEST / "moon-nearside.webp", quality=88, method=6)


def corona(source: Path) -> None:
    image = Image.open(source).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    source_pixels = image.load()
    result = Image.new("RGBA", image.size)
    target = result.load()
    # The source's eclipsed lunar disc is about 623/2709 of the frame radius.
    # Remove it, keeping the surrounding photographed corona as a separate layer.
    for row in range(1024):
        for col in range(1024):
            radius = math.hypot(col - 511.5, row - 511.5)
            if radius <= 232:
                continue
            rgb = source_pixels[col, row]
            rim = min(1, (radius - 232) / 8)
            alpha = round(255 * min(1, max(0, (max(rgb) - 4) / 45)) * rim)
            target[col, row] = (*rgb, alpha)
    result.save(DEST / "corona-2024.webp", quality=88, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python build-observer-assets.py NASA-photo.jpg")
    moon_disc()
    corona(Path(sys.argv[1]))
