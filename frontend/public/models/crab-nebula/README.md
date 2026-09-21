# Crab Nebula model

`nasa-crab.glb` is the unmodified GLB provided by NASA Science:
https://science.nasa.gov/3d-resources/crab-nebula/

Credit: NASA / Francis J. Summers; NASA / Robert L. Hurt.
Downloaded 2026-09-21. The source represents the inner X-ray structure inferred
from Chandra observations, including pulsar, rings and jets. It is not the entire
optical filament system and is not a direct volumetric scan.

The application normalizes position/scale and replaces the printable material
with a translucent blue emission-style shader. The outer layers are original
procedural teaching reconstructions informed by NASA's multiwavelength account:
https://science.nasa.gov/missions/hubble/nasas-great-observatories-help-astronomers-build-a-3d-visualization-of-an-exploded-star/

NASA media usage guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/
No NASA endorsement is implied.

`draco/` contains the glTF WASM decoder distributed with Three.js, from Google
Draco (Apache-2.0). These assets are served locally so model loading does not
depend on an external CDN. See `draco/LICENSE`.
