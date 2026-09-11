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
