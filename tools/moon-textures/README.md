# Moon texture tooling

Rebuilds the imagery under `frontend/public/demos/moon/`. The recipe, the sources and the
reasoning live in that directory's `ATTRIBUTION.md`; this tool is that recipe in executable form.

```bash
python tools/moon-textures/moon_textures.py sites                 # albedo + bump for every crop
python tools/moon-textures/moon_textures.py atlas-wide            # atlas-matched problem wide tiers
python tools/moon-textures/moon_textures.py relief                # displacement for every tier
python tools/moon-textures/moon_textures.py polar --hemisphere south
python tools/moon-textures/moon_textures.py check                 # no-data white rows
```

Requires Python 3 with numpy and Pillow. Downloads go through `--proxy` when given, are cached in
`--work` (default: the system temp directory) and are large — the per-site LOLA DEMs are about
9 MB each, so a full `sites` run pulls roughly 300 MB.

`sites` rewrites

* `public/demos/moon/sites/<id>.webp` — the crop, deshaded to albedo; opaque no-data bands from
  the image service are stored as transparent pixels so the global atlas shows through,
* `public/demos/moon/bump/<id>.webp` — the matching LOLA height map,
* `src/features/demos/scenes/moon/siteBumps.ts` — the micro-bump strength per relit crop, generated,
* `src/features/demos/scenes/moon/siteRelief.ts` — absolute LOLA range used for vertex displacement.

`relief` leaves every colour texture untouched. It makes sure all WAC and NAC tiers have a LOLA
height texture and writes `siteRelief.ts` with the absolute minimum, range and centre elevation.
The NAC photograph is far sharper than LOLA, so its LOLA texture is used for broad vertex shape
only; the photograph continues to supply its metre-scale visual detail.

`atlas-wide` rebuilds the Tycho, Clavius and Chang'e 3/4/5 regional tiers from
`moon-color-8k.webp` instead of their multi-illumination WAC photographs, then adds the
cached/downloaded LOLA DEM as dynamic relief. This keeps the atlas-to-wide hand-off identical
without geographically stretching the much smaller fine crop. Pass
`--proxy http://127.0.0.1:7890` if its DEM cache is cold.

Check the result with `yarn test:run` (the crop tests assert that every colour tier has a height
map, while only relit albedo tiers get strong micro-bump) and by flying the demo to a feature.
Lowering the light-elevation slider should reveal long terrain shadows; full-bright should remove
the terminator without removing the displaced horizon.

## Panoramas

The browsable surface panoramas are built by a second script in this directory:

```bash
python tools/moon-textures/moon_panoramas.py measure    # report sizes, sky bands, spans, fields of view
python tools/moon-textures/moon_panoramas.py bake       # write the WebP assets and moonPanoramas.ts
python tools/moon-textures/moon_panoramas.py all        # both
```

Its manifest is the source of truth for the catalogue: `id`, site, download URL, credit, licence and
the azimuth span, with a `pending` note on any entry that cannot ship yet. Editing the manifest and
re-running `bake` regenerates `moonPanoramas.ts`, which is generated and must not be hand-edited.

Three things about the geometry are worth knowing before changing anything:

* **The viewer draws a cylinder, not a sphere.** These are cylindrical projections, so a cylinder shows them
  without distortion; on a sphere the vertical scale came from the geometry rather than from the photograph and
  stretched the terrain by about a factor of two.
* **The elevation range is measured, not derived.** A true cylindrical projection relates sweep and elevation by
  `sweep ~ aspect * vertical_fov`, but these releases carry more vertical content per pixel than that allows, so
  the strips are calibrated against flattened comparisons and `VERTICAL_EXTENT_SCALE` records the factor. It is
  the one fitted number in the pipeline.
* **A strip's own sweep cannot be recovered from the file.** Each entry states its sweep in the manifest and says
  how it is known through `spanSource` (`documented`, `closes`, or `modelled`), and the viewer confines a partial
  strip to its own arc. A strip's `headingDeg` is 0 until the source frames' headings are recovered from the
  Apollo Image Atlas; the viewer treats 0 as unverified and says so.

`docs/lunar-panorama-research/tools/flatten-view.py` reproduces the viewer's mapping on the CPU, so a
candidate framing can be checked against the source pixels without a browser:

```bash
python docs/lunar-panorama-research/tools/flatten-view.py apollo-17-station-5 out.jpg --fov 62 --vertical-scale 1.75
```

`measure` without `bake` is the safe way to check a new entry: it downloads, reports, and writes
nothing.

### Checking the viewer's drag mapping

The viewer's pitch sign cannot be reasoned about reliably - it was got wrong twice - so it is settled by
measurement. With the dev server and a headless Chrome on a debugging port running:

```bash
node docs/lunar-panorama-research/tools/measure-drag.mjs 9222 http://localhost:5199/demos/moon apollo-11 m11
```

It opens the viewer, drags in each axis, screenshots before and after, and reports which way the picture
moved. The shipping signs give "drag down -> picture down, drag right -> picture right", which is the
convention every map and panorama viewer uses. Re-run it after touching `turnByPixels` in
`DemoPanoramaOverlay.vue`.

### `sites --only` and `--seed`

Two behaviours of the crop builder that are easy to trip over:

* `--only` builds just the named crops, and the generated `siteBumps.ts` / `siteRelief.ts` are
  merged rather than replaced. Without that merge a narrow run silently empties every other crop's
  entry; the bump module did exactly that until it was fixed.
* A brand-new site has no shipped crop to use as the pipeline's input, so `sites` refuses to build
  it unless `--seed` is passed, which fetches the WAC mosaic crop for that box first.
