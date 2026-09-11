# Moon demo textures

The textures in this directory are derived from NASA lunar data. NASA content is generally
not subject to copyright in the United States and may be used for educational and
informational purposes, provided NASA is acknowledged as the source and no NASA endorsement
is implied. See <https://www.nasa.gov/nasa-brand-center/images-and-media/>.

| File | Source | Derived from |
| --- | --- | --- |
| `moon-color-8k.webp` | NASA SVS [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) (2019 colour map) | LROC WAC Hapke-normalised colour mosaic, 8192x4096 |
| `moon-color-4k.webp` | Same | Same mosaic downsampled to 4096x2048 |
| `moon-height-4k.webp` | Same | `ldem_16_uint.tif` (LOLA gridded elevation, 16 pixels per degree), rescaled to 8-bit |
| `sites/<feature>.webp` | NASA Moon Trek, `LRO_WAC_Mosaic_Global_303ppd_v02` image service | One crop per hotspot, about 100-300 m per pixel, deshaded to albedo |
| `sites/{tycho,clavius,change-3,change-4,change-5}-wide.webp` | The global CGI Moon Kit colour atlas above | Atlas-matched regional hand-off texture; local LOLA relief is applied at runtime |
| `bump/<feature>.webp` | NASA Moon Trek, `LRO_LOLA_DEM_Global_256ppd_v06` image service | The LOLA DEM over the same box, as a lossless 8-bit displacement/height map |
| `sites/<feature>-nac.webp` | NASA / ASU LROC Lunaserv WMS | LROC NAC mosaic over the landing sites, roughly 1-4 m per pixel |
| `sites/<feature>-nac-close.webp` | Same | The same mosaic at the pixel scale it was published at, 0.5-1.4 m per pixel |

Credits: NASA's Scientific Visualization Studio (Ernie Wright) for the map products;
NASA / GSFC / Arizona State University for LRO LROC imagery; NASA / GSFC for the LOLA laser
altimeter. Imagery is centred on 0 degrees longitude with north at the top, matching the
equirectangular convention the demo's selenographic maths assumes.

The 8K map is about 1.33 km per pixel, which is what sets how far the demo lets you zoom: past
roughly three screen pixels per texel the surface stops reading as terrain, so the camera stops
there, about 480 km above the surface. Both resolutions are committed so a GPU that cannot hold
8K can fall back to 4K without a network round trip.

Bigger atlases were considered and rejected. A 16384x8192 map is four times the pixels and
would need roughly half a gigabyte of graphics memory as an RGBA texture, which no browser can
reliably allocate; and a 16K source exists on the SVS page if the ceiling ever moves.

## Hotspot crops

Flying to a feature swaps in local crops of the same WAC mosaic at far higher resolution, which
is what makes drilling down worthwhile. Every feature has a fine crop at roughly 0.1-0.3 km per
pixel, and most also have a wide crop at roughly 0.8 km per pixel that carries the view from a
regional altitude before the fine crop can cover the screen; the runtime fades between the two.
They come from Moon Trek's ArcGIS image service, which takes an exact bounding box, so every
crop is georeferenced by construction — the runtime only has to place the same box back on the
sphere. A correlation check against the atlas over a 90x75 degree window gave r = 0.81 with no
longitude offset, which is as good as two different renderings of the same terrain can agree.

```text
https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_Global_303ppd_v02/ImageServer/exportImage
  ?bbox=<west>,<south>,<east>,<north>&size=1536,1536&format=png&f=image
```

Each fine crop is framed at three times its diameter (120 km minimum, 1500 km maximum); wide
crops cover about 1200 km. Two adjustments are applied before committing a crop:

- Its mean is shifted onto the atlas mean over the same box. The mosaic is a shaded product and
  the atlas is albedo, so the crops arrive roughly half as bright; shifting the mean keeps their
  relief detail but makes them blend. The remaining colour difference is stored per site as a
  small multiplier in `frontend/src/features/demos/scenes/moon/sites.ts`.
- Shackleton sits inside four degrees of the pole, so its box is a full ring of longitude with a
  narrow band of latitude rather than a square, exported with enough rows to keep the latitude
  resolution at the mosaic's own limit.
- Chang'e 4 sits close to the antimeridian, and the service returns a blank strip for any box
  that reaches within about 0.2 degrees of +180, so its box stops at 179.7 E. The feature then
  sits 0.4 degrees off the centre of its crop, which the framing absorbs.

Mounting a crop is bounded by its own texels: the camera may come down to the altitude where one
crop texel spans eight screen pixels. That is a looser limit than the atlas gets (three pixels),
because a crop starts out about ten times finer, so it still resolves more at the end of the
zoom than the atlas does at its own limit. In practice a drill-down spans roughly a three-fold
change in altitude before it stops. The patch fades out again on the way back up, so no sharp
rectangle is ever left sitting on the globe.

### Relighting the crops

The crops used to be used as they came, which meant a photograph with its own Sun baked in,
drawn over a globe that is albedo lit by the scene's Sun. At full moon the globe goes flat while
the crop keeps its shadows, and at first quarter the globe's shading swings round while the
crop's stays where it was. The difference is large: over the same box, a crop's local contrast is
about 2.4 times the atlas's, and the two are correlated at only r = 0.13 even though their means
agree to within 1% and their best geometric alignment is exactly zero offset.

So each crop is now deshaded, and the scene relights it:

- A LOLA DEM is fetched over the same box at the crop's pixel size
  (`LRO_LOLA_DEM_Global_256ppd_v06`, about 118 m per pixel) and turned into a hillshade.
- The Sun that shaped the mosaic is fitted per crop by correlating that hillshade with the
  crop's high-passed brightness: on the fine crops it lands at r = 0.64-0.90, which is as well as
  a Lambertian model can do on real terrain.
- Dividing that (low-passed) hillshade out leaves albedo. The correction is band-limited, around
  6 km on the ground, and capped at +-40%: a laser altimeter knows the big slopes and nothing
  finer, so taking the full-resolution hillshade out would flatten the craters the photograph
  gets right and leave only DEM noise behind. The crop's linear mean is preserved, which is what
  keeps its stored `tint` valid.
- The DEM is also stored as `bump/<feature>.webp`, and the scene gives the patch that bump map
  so its relief comes from the same Sun as everything around it. The map is stretched over its
  own local height range rather than the Moon's, so the runtime scales it by
  `rangeKm / 19` — the numbers live in the generated `siteBumps.ts`.

Two groups generally keep their baked shading, because nothing explains their lighting well
enough to divide it out: the LROC NAC tiers (metre-scale photographs of landing sites, with no
DEM that resolves them, and at that depth the atlas is nowhere on screen) and most wide crops.
The wide crops are stitched from images taken in different years: a 1200 km box can span several
Sun positions, and no single azimuth and elevation fits it (r < 0.05 even when the box is split
into 3x3 tiles and each is fitted separately).

Tycho, Clavius and the Chang'e 3/4/5 landing sites are exceptions because their wide photographs
changed character particularly strongly against both the atlas and their fine crops. Their wide
colour is sampled from the global albedo atlas over the exact same geographic boxes, then paired
with a higher-resolution local LOLA bump map. The colour therefore has precisely the atlas's
projection, camera character and baked-lighting state, while the scene's own Sun supplies the
regional relief. This is better than stretching the fine crop: a fine crop covers only a fraction
of the wide box, so stretching it would put the wrong crater under most coordinates. It also
makes atlas -> wide visually continuous; only the later wide -> fine hand-off introduces
genuinely finer imagery.

### True terrain and close camera

NASA's CGI Moon Kit describes LOLA values as kilometres relative to the 1737.4 km lunar
reference sphere and explicitly publishes them as displacement maps, not merely shaded
textures. The runtime now uses that physical meaning:

- the 4K global map displaces a 512x256 sphere and also acts as a bump map for detail finer than
  the vertex grid;
- every one of the 43 wide, fine and NAC colour tiers has a matching lossless LOLA height map;
- `siteRelief.ts` records each crop's absolute minimum, range and centre elevation, so overlapping
  tiers occupy the same radial surface and the camera orbits the actual local ground;
- the geometry is drawn at 2x vertical exaggeration. This makes relief readable on a screen while
  preserving the measured ordering and relative height of terrain. The underlying metadata stays
  in physical kilometres, so the exaggeration can be changed without rebuilding assets;
- only crops reliably converted to approximate albedo use the height texture again as a strong
  micro-bump. Baked-light WAC/NAC photographs get broad displaced shape without a second embossed
  lighting term.

The focused camera follows the interaction model used by terrain globes: its up axis becomes the
selected site's local surface normal, orbit tilt is bounded above the horizon, and a collision
clamp uses the site's LOLA centre height. Rotation slows toward the ground, wheel delta is
normalised across pixel/line/page devices, and touch pinch remains available when OrbitControls'
centre-dolly is disabled. Arrow keys make small local azimuth/tilt changes and +/- zoom. This is
consistent with Three.js OrbitControls' polar/azimuth constraints and Cesium's documented terrain
collision and bounded-input controls:

- <https://threejs.org/docs/#examples/en/controls/OrbitControls>
- <https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html>

## Polar caps

Runtime correction (2026-09-12): `polar-north.webp` and `polar-south.webp` are 6144-square
exports over projected bounds ±1,126,000 metres. `polarSurface.ts` samples these native images
directly in the globe material, using a Moon radius of 1,737,400 metres and the north/south
stereographic central-meridian orientations. TextureLoader's vertical flip is accounted for.
There are no separate floating cap meshes or distance-based visibility switches. Colour blends
from the global map between 68° and 78° absolute latitude and stays registered at every zoom.
The underlying globe still uses LOLA displacement. Duplicate pole vertices converge to one
mean elevation over the final 1.5°, and the singular equirectangular bump term fades between
85° and 89°. The source WAC mosaics retain photographed shadows: full-bright scene lighting
does not recover terrain hidden in those source shadows. The historical atlas preprocessing
below describes the fallback global colour asset; it is not the runtime polar projection.

The 8K colour map stitches its caps in from polar mosaics, and south of about 65 S the result is
visibly smoother and flatter than the terrain around it: the terrain's contrast drops from a
standard deviation of 15 grey levels to 5, and the seam where the polar insert meets the
equatorial mosaic is smeared into streaks. Zoomed out far enough that no hotspot crop is in play,
that reads as a pale blank bar along the southern limb.

There is no Hapke-normalised polar product to drop in, so the caps borrow their texture from the
dedicated LRO WAC pole-centred orthographic mosaics. The service publishes them as native
Moon2000 polar-stereographic MapServer layers:

```text
https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_90S000E_100m/MapServer/export
  ?bbox=<native-polar-stereographic-tile>&size=2048,2048&format=png32&f=image
```

The source is 100 m per pixel in south polar stereographic; the north cap is the matching
`LRO_WAC_Mosaic_90N000E_100m` layer. The builder fetches a 3x3 tile mosaic through the configured
proxy and reprojects it into the atlas's equirectangular rows. What is transferred is the
mosaic's *detail*, not its brightness:

- Each row is normalised to its own median first. A polar mosaic is one to two stops darker or
  brighter than the atlas depending on latitude - the Sun barely clears the horizon - and a map
  that steps brighter in one ring and darker in the next would be worse than the smooth cap.
- The detail is then high-passed at 40 atlas pixels (about 10 km on the ground at 70 S), capped
  at +-60%, and multiplied into the atlas in linear light. Each row's mean is clamped back to 1
  afterwards, so no latitude band shifts level.
- The blend reaches full strength by 76 S and fades out by 62 S, which hides the seam inside the
  region that was already ambiguous.

The caps still have no albedo of their own: this restores terrain, not colour. It also costs
size, because the texture is high-frequency - the 8K map goes from 2.0 MB to about 2.5 MB at the
same encoder quality.

## LROC NAC close-ups

Five landing sites carry two more tiers below their WAC crop: a LROC Narrow Angle Camera mosaic
over a few to twenty kilometres, and the same mosaic framed at the scale it was published at,
which is what makes the landers, the rovers and (at Apollo 17 and Lunokhod 2) the wheel tracks
legible. Both tiers come from NASA's LROC Lunaserv WMS, which reprojects its products on the fly
into the same equirectangular frame the WAC crops use, so a bounding box is all the runtime
needs:

```text
https://wms.im-ldi.com/?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=<layer>
  &STYLES=&SRS=EPSG:4326&BBOX=<west>,<south>,<east>,<north>&WIDTH=<w>&HEIGHT=<h>&FORMAT=image/png
```

The service is the successor to `wms.lroc.asu.edu`, which now redirects to a web application.
It renders up to 8192 pixels square in one request, and returns white where a box reaches past
the edge of a product's footprint - which is what the boxes below were chosen to avoid.

| Feature | Layer | Product | Published scale | Crop |
| --- | --- | --- | --- | --- |
| Apollo 11 | `luna_apollo_11_high_resolution_nac_mosaic` | `NAC_ROI_APOLLO11HIB` | 0.4 m | 3.8 km, then 2.0 km |
| Apollo 17 | `luna_apollo_17_roi` / `..._high_resolution_nac_mosaic` | `NAC_ROI_APOLLO17LOA`, `..._HIA` | 1.4 / 0.5 m | 11.5 km, then 2.0 km |
| Chang'e 4 | `luna_pds_rdr` | `NAC_ROI_CHANGE4_LOA` | 1.4 m | 10 km, then 5 km |
| Chang'e 5 | `luna_pds_rdr` | `NAC_ROI_CHANGE5_LOA_E432N3091` | 1.2 m | 4.2 km |
| Luna 21 | `luna_lunokhod_2_low_sun_130cm` | `NAC_ROI_LUNA_21_LOA` | 1.3 m | 16 km, then 5.3 km |

Details worth knowing before rebuilding any of them:

- **Apollo 11 is the awkward one.** Its only NAC products are north-south strips: the sharpest
  one is 4.2 km wide and 28 km long, and the strips at other sun angles are up to 5 km further
  east, so 3.8 km is as wide as a single-illumination crop can be. Compositing the strips was
  tried and rejected: they differ in both brightness and contrast, and the seams are obvious.
- **Chang'e 4 and Chang'e 5 have no dedicated layer.** Lunaserv exposes their ROI products only
  through `luna_pds_rdr`, which paints every overlapping RDR product, so a box that runs into a
  neighbouring mosaic shows a hard brightness step. The Chang'e 5 crop stops 3 km east of the
  lander for that reason, which caps its width at 4.2 km; Chang'e 5 therefore gets a single NAC
  tier, since a second one would only re-sample the same ground at the same pixel scale.
- **Chang'e 3 has nothing usable**: no controlled mosaic and no ROI product, only individual NAC
  frames, so it was left at its WAC crop. Luna 21 / Lunokhod 2 took the fifth slot instead, and
  its hotspot, `luna-21`, was added to `hotspots.ts` for the occasion.
- Each crop is fetched at the product's own pixel scale, never finer: a nominal 0.5 m crop that
  is really 1.2 m only lets the camera over-magnify soft pixels.
- Crops are brightness-matched to what the feature's own WAC crop already renders over the same
  box - the mean of its stored grey times its tint - so the WAC-to-NAC handover has no step. The
  residual colour is stored as the new crop's `tint`, in linear light, and the three `luna-21`
  crops are matched to the atlas the same way.
- A handful of pure-white pixels the service leaves inside a mosaic footprint (a few thousandths
  of a percent) are median-filled afterwards; saturated bright terrain, which is real, is left
  alone.

The zoom floor follows the deepest tier a feature has, which is what makes these tiers reachable
at all: the NAC tiers stop at four screen pixels per texel rather than the WAC crops' eight, so
at Apollo 17's 0.5 m per pixel the camera ends a hundred metres or so above the surface, and at
Chang'e 5's 1.2 m it ends around three hundred metres - close enough to pick the lander out.
Features without NAC imagery keep the wide crop's floor. The deep tiers are only downloaded once
the camera is inside twice their footprint, and every crop of a feature the viewer has left is
released, because a four-tier drill-down costs a few hundred megabytes of texture memory.

## Higher-resolution options investigated

The WAC mosaic used here is the best reachable *global* source at web-serveable size. Three finer
sources exist but each has a blocking trade-off:

- Kaguya (SELENE) Terrain Camera: ~10 m per pixel at the source, but the only readily served
  global product (USGS `moon-kaguya-tc-global-mosaic`) is downsampled to 474 m per pixel, coarser
  than WAC's 100 m.
- Apollo 15/16/17 metric camera mosaics (1024 px per degree, ~30 m per pixel): only Apollo 15's
  image service responded with data in testing; the others returned empty or proxy errors, and
  their coverage is a latitude band with gaps, so they cannot cover all eighteen features.
- LROC Narrow Angle Camera (~0.5-2 m per pixel): the true close-up source. It is served per
  product rather than as one global mosaic, so it is only worth using where LROC has published a
  controlled mosaic or an ROI product - which is what the five landing sites above do; see that
  section for the products and their footprints.

## Rebuilding the textures

Everything above is scripted in `tools/moon-textures/moon_textures.py` (Python with numpy and
Pillow; pass `--proxy` if the network needs one). It caches every download under `--work`, so a
second run only redoes the image work:

```bash
python tools/moon-textures/moon_textures.py sites     # crops: albedo + bump, and siteBumps.ts
python tools/moon-textures/moon_textures.py atlas-wide # problem wide tiers: atlas + LOLA bump
python tools/moon-textures/moon_textures.py relief    # every tier: displacement + siteRelief.ts
python tools/moon-textures/moon_textures.py polar     # atlas: rebuild both polar caps
python tools/moon-textures/moon_textures.py check     # fail on no-data white rows in any crop
```

`check` exists because the WAC image service answers with pure white wherever a requested box
reaches past its footprint, which near the south pole is most of the cap. The affected rows in
`shackleton-wide` and `shackleton` are transparent, and polar site crops are not put over the
exact pole: the orthographic cap in the global atlas remains visible there. Relighting alone
cannot remove no-data, so the texture tool preserves this transparent fallback and `check` guards
against an opaque white band returning in a future rebuild.

The global atlas itself still comes from the SVS products. The downloads are large (the source
TIFFs total roughly 210 MB), so they are not committed. Fetch the originals and rebuild the
colour and height textures:

```bash
curl -O https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif
curl -O https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif
```

Colour is resized with Lanczos and encoded as WebP (quality 72). The
elevation map is converted from unsigned 16-bit half-metres offset by
+20000 into kilometres, linearly remapped over the Moon's -9 km to +10 km range, and stored as
a lossless 8-bit grey WebP. The material samples it once for vertex displacement and again for
sub-grid bump detail.
