"""
Decide whether a panorama is a true 360° wrap or only a partial arc, mechanically.

Usage:
  python docs/lunar-panorama-research/tools/wrap-test.py <image> [<out.jpg>] [--fraction 0.125]

Method: crop the left and right `fraction` of the image, place them side by side, and also
compute how well the left edge predicts the right edge. A full-360 panorama that is stored
without overlap should have two visually continuous ends; a partial sweep will not.

The numeric part compares the outermost columns' brightness profiles. It is a hint, not a
verdict: look at the output image before deciding, because lunar terrain is self-similar and
a low error can also mean "two equally flat patches of regolith".
"""
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith("--")]
fraction = 0.125
if "--fraction" in sys.argv:
    fraction = float(sys.argv[sys.argv.index("--fraction") + 1])

src = args[0]
dst = args[1] if len(args) > 1 else None

im = Image.open(src).convert("L")
w, h = im.size
a = np.asarray(im, dtype=np.float32)

# Mean luminance per column, smoothed, so single-pixel noise does not dominate.
col = a.mean(axis=0)
k = max(1, w // 400)
col = np.convolve(col, np.ones(k) / k, mode="same")

band = max(4, int(w * 0.01))
left = col[:band]
right = col[-band:]

# Compare the left edge against a mirrored and an unmirrored right edge.
direct = float(np.mean(np.abs(left - right)))
mirrored = float(np.mean(np.abs(left - right[::-1])))
spread = float(col.std()) or 1.0

print(f"image            : {src} {w}x{h}")
print(f"column std       : {spread:.2f} grey levels")
print(f"|left - right|   : {direct:.2f}  ({direct / spread:.3f} of the column spread)")
print(f"|left - mirror|  : {mirrored:.2f}  ({mirrored / spread:.3f} of the column spread)")
print()
print("Interpretation, calibrated on the two panoramas this was written for:")
print("  Apollo 17 Station 2 (partial sweep, ends are unrelated terrain) -> 1.49")
print("  Chang'e 4 IAU strip  (ring shot, ends show the same lander)    -> 0.41")
print("So anything well below 1.0 has *some* relationship between the ends, but this number")
print("cannot certify a seamless wrap: even the Chang'e 4 strip only reaches 0.41. USE IT AS A")
print("SCREEN, NOT A VERDICT, and always confirm by looking at the side-by-side image. Note also")
print("that a black sky band inflates the ratio; when the sky is masked, pass --fraction and judge")
print("the terrain band by eye instead.")

if dst:
    strip = int(w * fraction)
    canvas = Image.new("RGB", (strip * 2 + 40, h), (255, 0, 0))
    canvas.paste(Image.open(src).convert("RGB").crop((0, 0, strip, h)), (0, 0))
    canvas.paste(Image.open(src).convert("RGB").crop((w - strip, 0, w, h)), (strip + 40, 0))
    canvas.save(dst, quality=88)
    print(f"wrote            : {dst} ({canvas.size[0]}x{canvas.size[1]})")
