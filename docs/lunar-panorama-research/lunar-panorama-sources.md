# Lunar surface panoramas for the Moon demo

Research target: candidate panoramic imagery that the interactive Moon demo (`frontend/src/features/demos/scenes/moon`)
can offer once a viewer has selected a place — i.e. imagery that can be opened as a browsable panorama from a
landing site or feature.

Researched by the DSH agent on 2026-02-13, with four parallel source-hunting subagents. Every URL below was probed
through this machine's proxy (`http://127.0.0.1:7890`); where dimensions are marked *downloaded*, the file was
fetched and its header parsed, or the image was opened and looked at.

## Network facts discovered first — these decide what is reachable

### The proxy trap that invalidates naive probes

**Node 24's global `fetch` does NOT honour `HTTP_PROXY` / `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is also
set.** Without it, every request goes **direct**, which produces a different and confusing set of results:

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NODE_USE_ENV_PROXY = "1"     # <-- without this the two lines above do nothing
```

Proof, and the reason this section exists: `node .agents/proxy-audit.mjs`, and the control in
`.agents/scheme-test.mjs`, which re-runs the same requests against a **closed proxy port**. Without
`NODE_USE_ENV_PROXY=1`, requests still succeed against the closed port — they were never proxied. With it, they
fail with `ECONNREFUSED`, so the setting is genuinely in effect.

An early version of this report claimed `https://images-assets.nasa.gov` returns 403 and that switching to
`http://` was the fix. **That was wrong.** Those two observations came from two different network paths: the
`https` probe ran without the flag (direct, and the direct route really does 403), while the `http` probe ran
through the proxy. Through the proxy, **both schemes return 206** for the same file. The lesson to keep is the
`NODE_USE_ENV_PROXY=1` requirement, not a scheme rewrite.

### Reachability, measured through the proxy

| Host | Result through the proxy | Consequence |
| --- | --- | --- |
| `https://images-assets.nasa.gov/...` | **206, real JPEG** | The NASA Image and Video Library is fully downloadable at original resolution — no scheme tricks needed |
| `https://images-api.nasa.gov/search`, `/asset/<id>` | 200, JSON | Search and asset manifests work normally |
| `https://svs.gsfc.nasa.gov/...` | 206, real TIFF | NASA SVS products (the CGI Moon Kit already used by the demo) are reachable |
| `https://www.lpi.usra.edu/...` | 403 | LPI's Apollo panorama index is genuinely blocked *by the site*; do not plan around it |
| `https://commons.wikimedia.org/`, `https://upload.wikimedia.org/...` | 429 | **Reachable, but rate-limited.** Wikimedia is usable with pacing and a descriptive User-Agent; it is not dead |
| `https://www.hq.nasa.gov/alsj/...` | 429 | The Apollo Lunar Surface Journal is rate-limited, not dead — retry slowly |
| `https://wms.im-ldi.com/` (LROC Lunaserv) | 200, WMS capabilities | The LROC service the demo already uses is fine |
| `https://astrogeology.usgs.gov/` | 200, but its search endpoint returns an unrelated CKAN JSON feed | USGS Astropedia needs direct product URLs, not its search UI |
| `https://iauarchive.eso.org/...` | 200, real JPEG | Carries the openly licensed Chang'e 4 panorama (see `change-panoramas.md`) |
| `https://www.lroc.asu.edu/`, `https://ode.rsl.wustl.edu/moon/`, `https://pdsimage2.wr.usgs.gov/` | 200 | Orbital archive access is available |

Node is the reliable HTTP client here (`NODE_USE_ENV_PROXY=1` + `HTTP(S)_PROXY` + global `fetch`); `curl.exe`
fails on HTTPS with a schannel credential error, and `undici` is not importable from this repo.

## The headline finding: NASA's own Apollo surface panoramas

NASA's Image and Video Library holds a set of **large, continuous, stitched Apollo surface panoramas** — the
"Panorama view of …" family and the older "Panoramas of Apollo sites" family. They are:

- **public domain** (NASA, built by JSC imagery specialists) with a credit requirement;
- **genuinely huge**, up to 30000 x 3600, and up to 5001 px tall;
- **continuous stitches, not mosaics** — I checked visually, and they show the Hasselblad reseau crosses and no
  seams;
- **sky-masked already**: NASA retouched them by "blacking out the sky to the lunar horizon", which is exactly what
  a panorama viewer wants, because the black can be keyed out and the demo's own starfield can show through.

They are **not full 360°**. I tested this properly rather than trusting the frame counts: cropping the left and
right 3000 px of the Apollo 17 Station 2 panorama and placing them side by side shows two completely different
pieces of terrain, so the ends do not wrap — the mechanical wrap test scores it **1.49** of the column spread,
i.e. the ends are as different as any two random columns. Assume a **partial cylindrical sweep** (roughly
90-200° depending on the entry) and constrain the viewer's azimuth accordingly. The Chang'e 4 panorama behaves
differently (see below), which is why the two need different viewer settings.

Counts by landing site, all verified to exist and resolve:

| Site | Entries | Widest | Tallest |
| --- | --- | --- | --- |
| Apollo 11 | 2 | 30000 x 2309 (Tranquility Base) | 15634 x 4460 |
| Apollo 12 | 2 | 25481 x 3000 | 10000 x 3276 |
| Apollo 14 | 1 | 30000 x 3600 | 30000 x 3600 |
| Apollo 15 | 3 | 10000 x 3893 | 10000 x 3893 |
| Apollo 16 | 4 (+1 orbital, excluded) | 30000 x 3112 | 10000 x 3379 |
| Apollo 17 | 5 | 29524 x 3000 | 26968 x 5001 |

Full per-panorama detail — NASA's own title and description text, source frame numbers, verified dimensions,
direct download URL and my visual assessment — is in `apollo-surface-panoramas.json`.

### Caveats found in the archive itself

- **`jsc2011e118358` is mis-titled.** Its NASA title says "Apollo 15 lunar panorama"; its description and frame
  numbers (`AS12-46-6777…6780`) are Apollo 12. Trust the description, not the title.
- **`jsc2012e052597` (18326 x 8537) is not a surface panorama.** It is a view through the Apollo 16 LM window from
  orbit. It is large enough to look like a prize, so it is called out explicitly to stop it being filed under a
  landing site.
- A few entries are wide but shallow (`jsc2011e118361` 10000 x 1030, `jsc2011e118362` 10000 x 956,
  `jsc2004e20304` 9000 x 1066) — a viewer can pan but barely tilt. Prefer the tall ones.
- `jsc2012e052598` and `jsc2012e052599` are two alternate stitches of the same 16 frames; ship one.
- All the "blacked out sky" retouching means the horizon is a hard, artificial edge. A viewer should fade the
  image out at its own horizon rather than showing a black wall above it.

## Downloaded samples

`research/samples/` holds the evidence used above — two originals and their derived previews:

| File | What it is |
| --- | --- |
| `apollo11-pan-orig.jpg` | jsc2008e040725, 15634 x 4460, 8.75 MB |
| `apollo17-pan-orig.jpg` | jsc2004e52777, 28316 x 3000, 17.75 MB |
| `apollo11-preview.jpg`, `apollo17-preview.jpg` | downscaled to 1400 px wide for inspection |
| `ap17-panel1..4.jpg` | the Apollo 17 panorama in four quadrants, used to judge coverage |
| `ap17-wrap-test.jpg`, `ap11-wrap-test.jpg` | left-edge vs right-edge side by side; the negative wrap test |
| `change4-iau1901a.jpg` | the Chang'e 4 IAU panorama, 10000 x 1229, 3.19 MB — **the recommended hero asset** |
| `ce4-preview.jpg` | that panorama downscaled to 1400 px |
| `ce4-wrap-test.jpg` | left-eighth vs right-eighth side by side; the positive wrap test |
| `ce4-apoint-cyl.jpg` | the GRAS copy of the same scene, 10000 x 1229, 1.89 MB |
| `ce4-s1-cyl.jpg` | the unique S1 ring panorama, 10000 x 833, 6.23 MB |
| `ce4-apoint-azi.jpg` | A-point azimuthal projection, 5000 x 4915 |
| `corner-apoint-cyl.jpg`, `corner-s1-cyl.jpg`, `corner-iau.jpg` | top-right corners at full resolution — the watermark evidence |
| `apollo17-station5-jsc2004e20304.jpg` | the likely full-rotation Apollo 17 Station 5 panorama, 9000 x 1066, 1.93 MB |
| `ap17-st5-wrap.jpg` | its left vs right edge — the matching terrain that makes it the best 360° candidate |

## Research provenance, so nothing here is taken on trust

Five parallel research passes fed this report, and **all five failed at the end** (context or process limits)
rather than returning cleanly. Their files survived; their closing claims did not all survive my checks:

- **Corrected by me:** the "https is 403, use http" finding (a proxy-flag artifact); the claim that
  `images-assets.nasa.gov`, `commons.wikimedia.org` and `lpi.usra.edu` are all blocked (only `lpi` is);
  the GRAS S1 panorama's size (10000x833, not 10000x1229); the Artemis II image's dimensions
  (3819x5092 / 15 MB, not 5568x3712 / 1 MB); and the suggestion that the CE-3 panorama's CC BY-NC-ND licence was
  established — **I could not find that licence on the page**, which shows only a credit line. The NC/ND
  conclusion still holds on other grounds (ND blocks reprojection), but the evidence for the specific licence
  string is weaker than reported.
- **Rebuilt by me:** `other-mission-panoramas.md` / `.json`, which that subagent never wrote.
- **Confirmed by me:** the GRAS gallery endpoint and its watermarking; the CE-6 800x421 master and the
  1.280x upscale; the CE-5 file's CNSA provenance; the Zenodo CC BY 4.0 licence (via both the Zenodo API and
  DataCite/SPDX); the IAU CC BY 4.0 licence wording; the Surveyor 7 and Artemis II URLs; Mitchell's
  "All rights reserved" line.
- **Left as subagent-reported, explicitly flagged:** the Lunokhod frame counts and geometry, the Surveyor 7
  azimuth ranges, the Zenodo raster's internal dimensions, the LROC TIFF dimensions, and every GRAS PDS label
  arithmetic detail.

## Chang'e 3 / 4 / 5 — the IAU panorama, plus a watermarked GRAS gallery

Full detail in `change-panoramas.md`. I re-verified every claim below myself rather than inheriting it.

### The hero asset — Chang'e 4 A-point, IAU copy, CC BY 4.0

```
200 | jpeg 10000x1229 | 3346126 B (3.19 MB)
https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg
```

- **Licence: CC BY 4.0**, proven from the Wikimedia raw wikitext, which reads `{{IAU-source|iau1901a}}` and
  `{{cc-by-4.0|CNSA}}`, author CNSA, released 2019-02-15. Credit "CNSA/CLEP, via IAU, CC BY 4.0".
- **Same scene as the GRAS "A点三圈镶嵌图（圆柱投影）", and a better copy of it.** I measured both at
  exactly 10000 x 1229; the IAU file is 3,346,126 B against GRAS's 1,894,270 B. **Decisive difference: I cropped
  the top-right corner of each at full resolution and looked — the GRAS copy carries a baked-in 「中国探月 CLEP」
  and 「地面应用系统 GRAS」 logo, and the IAU copy has no watermark at all.** Use the IAU file.
- **It presents as a 360° ring shot, but the seam is not pixel-exact — verify before trusting it.** I cropped
  its left and right eighths and placed them side by side (`samples/ce4-wrap-test.jpg`): **both ends show the
  lander's hardware** — the solar panel and its gold foil appear at the left *and* at the right — which is what
  a ring shot taken around the lander looks like. But the mechanical wrap test
  (`python .agents/wrap-test.py`, terrain band only) scores it **0.41 of the column spread**, far from the ≤0.15
  a seamless wrap would give, and compares to **1.49** for the Apollo 17 panorama. My reading: the ends show the
  same subject from adjacent angles, i.e. a genuine near-complete sweep, but the stitch is not closed to the
  pixel, and the black sky band sits at slightly different levels at each end. Treat it as a cylinder that needs
  its seam finessed (cross-fade a few hundred pixels), not as a seamless equirectangular wrap.
- **Its geometry is an 8.14:1 cylindrical strip**, and the sky is black, not transparent. It must be padded
  vertically or mapped to a cylinder; a naive 2:1 equirectangular stretch will look wrong.

### The GRAS image gallery is open, but the images are watermarked

The NSSDC record 1240 link resolves to a GRAS endpoint that is **unauthenticated and serves ordinary JPEGs** —
confirmed: `GET https://moon.bao.ac.cn/moon-admin/client/education/educationList?task=7&load=372` returns
`{"total":32,"rows":[...]}` with no credentials, and the `image` paths under `https://moon.bao.ac.cn/img-api/`
download directly. I enumerated **all 48 CE-4 gallery images** (32 PCAM, 10 TCAM, 6 LCAM) and measured each one.
Filenames contain Chinese text and full-width parentheses, so they **must be percent-encoded**.

The stitched panoramas and mosaics in that set:

| Title | Measured | Notes |
| --- | --- | --- |
| A点三圈镶嵌图（圆柱投影） | 10000 x 1229 | The IAU file is the same scene without the watermark |
| A点三圈镶嵌图（方位投影） | 5000 x 4915 | Disc-shaped azimuthal projection |
| D点三圈镶嵌图（方位投影） | 5000 x 4879 | |
| D点三圈镶嵌图（圆柱投影） | 5000 x 687 | Very shallow strip |
| S1环拍图（方位投影） / S1环拍图（圆柱投影） | 10000 x 833, 6,228,953 B | **The two listed entries are byte-identical** (same sha256) — there is only one S1 panorama, and the gallery's titles and filenames contradict each other, so trust measured geometry over the label |
| A点拍着陆器 / D点拍着陆器 / S1点拍着陆器 | 5638 x 3113 / 5691 x 3179 / 5397 x 3157 | Lander mosaics from the rover; the best unwatermarked-quality material if the logos can be tolerated |

Two cautions I found by looking at the files, not from the catalogue:

- **Everything in the gallery carries the CLEP/GRAS watermark** in the top-right. I checked both the A-point and
  S1 cylindrical strips at full resolution. CC BY 4.0 does not permit stripping a watermark, so if you use these,
  the logo stays on screen.
- **The unique S1 panorama has visible mosaic artefacts.** Its terrain shows repeated bright vertical streaks
  and its sky/terrain boundary steps in a hard staircase where tiles were butted. It is a genuinely unique view
  (the lander from the rover's own position, panels deployed, rover shadow and wheel tracks visible), but it is
  not a clean plate.

**Everything else Chinese is either low-resolution or not openly licensed:**

| Asset | Size | Verdict |
| --- | --- | --- |
| CE-4 TCAM cylindrical (chinanews, 2019-01-11) | 960 x 3713, stored rotated 90° | All rights reserved — reference only |
| CE-4 TCAM azimuthal (chinanews) | 800 x 786 | All rights reserved — reference only |
| CE-6 official stitched PCAM panorama (People's Daily/CNSA, 2024-06-04) | 1024 x 539 | All rights reserved — reference only |
| GRAS raw PCAM frames (`moon.bao.ac.cn` PUBDATA) | CE-3/5/6 at 2352 x 1728, CE-4 binned to 1176 x 864 | **Risky** — see below |
| Chang'e 3 published panorama | — | **Not found at usable resolution** (explicit negative) |
| Chang'e 5 published stitched panorama | — | **None verified.** A 7500 x 4053 file was measured but its source URL is unresolved, so it must not be used |

**The GRAS licence conflict needs a decision from you.** The GRAS copyright notice forbids redistribution without
written permission, while the National Space Science Data Center registry (VSSO) lists the same datasets as
**CC BY 4.0 with DOIs** (CE-3 PCAM 2B `10.12176/03.03.005`, CE-4 PCAM 2B `10.12176/03.04.004`, CE-4 panorama
gallery `10.12176/03.88.00007`). The CC BY grant is therefore **not unopposed**. My recommendation: ship the
unwatermarked IAU file under CC BY 4.0, and treat the watermarked GRAS gallery and the raw PDS frames as out of
scope unless you want to seek written permission — the raw files also need decode, de-Bayer and calibration
before they look like photographs, and the catalogue's `dataSize` field is unreliable (trust the PDS label and
HTTP `Content-Range`).

## Other sources

- **Luna / Lunokhod, Surveyor, Chandrayaan-3, SLIM, CLPS landers** — see `other-mission-panoramas.md`
- **Orbital and whole-Moon wide-field products** — see `orbital-lunar-panoramas.md`
- **Apollo per-asset deep verification** (29 assets, contact sheets inspected, wrap ratios) — see
  `verify-apollo.md` and `verify-apollo.json`

## The verdict, per site

Nothing outside Apollo and Chang'e 4 clears the bar. This table is the answer to "what can the demo actually
offer when a place is selected":

| Demo site id | Best asset | Size | Licence | Shippable? |
| --- | --- | --- | --- | --- |
| `apollo-11` | `jsc2007e045375` + `jsc2008e040725` | 30000x2309, 15634x4460 | NASA public domain | **Yes** |
| `apollo-12` | `jsc2007e045376` | 25481x3000 | NASA public domain | **Yes** |
| `apollo-14` | `jsc2007e045377` | 30000x3600 | NASA public domain | **Yes** |
| `apollo-15` | `jsc2011e118359` | 10000x3465 | NASA public domain | **Yes** |
| `apollo-16` | `jsc2012e052598` (or `599`) | 30000x3112 | NASA public domain | **Yes** |
| `apollo-17` | `jsc2004e52775`, `jsc2004e20304`, `jsc2004e52777` | up to 26968x5001 | NASA public domain | **Yes** — `jsc2004e20304` is the only one whose ends look like they close (see the caveat below) |
| `change-4` | IAU `iau1901a` | 10000x1229 | **CC BY 4.0**, unwatermarked | **Yes** — the only non-NASA one |
| `change-4` (2nd angle) | GRAS `S1环拍图` | 10000x833 | CC BY 4.0 claimed + GRAS all-rights-reserved conflict, watermarked | Only with your sign-off |
| `change-3` | Planetary Society stitch | 15743x3505 | claimed CC BY-NC-ND 3.0 — **I could not confirm that licence on the page**, which showed only a credit line and no Creative Commons link | **No** — ND blocks the reprojection a viewer needs, and NC blocks monetised use |
| `change-5` | CNSA official ring panorama | 7500x4053 | all rights reserved, watermarked, fan-shaped not equirectangular | **No** — reference only |
| `change-6` | CNSA master *(no `change-6` site id exists yet)* | 800x421 | all rights reserved | **No** — the widely mirrored 1024x539 version is an upscale of it (`1024/800 = 1.280`, aspect matches to 4 decimal places) |
| `luna-21` | Mitchell's Lunokhod pans | up to 4314x600 | **"All rights reserved"** (quoted from the page) | **No** — link out with credit |
| — (bonus) | Surveyor 7 printout scans | 3790x1954 | NASA public domain | Yes, labelled as historic scans, not panoramas |

## Two things outside the panorama question that you should know

- **The demo's forward-looking Artemis content is out of date.** The current date in this environment is
  2026-09-12: Artemis II has already flown its crewed free-return flyby, and Artemis III has been restructured so
  that it **will not land** — the first crewed landing has moved to Artemis IV. Any "Artemis will land" copy, or an
  Artemis surface-panorama placeholder, is now factually wrong. Sources:
  [NASA delays Moon landing as Artemis III shifts to orbit mission](https://minutemirror.com.pk/nasa-delays-moon-landing-as-artemis-iii-shifts-to-orbit-mission-557322/),
  [Artemis II astronauts return to Earth](https://www.hurriyetdailynews.com/amp/artemis-ii-astronauts-return-to-earth-220891).
  There is also **no real Artemis surface panorama** — an API search for "Artemis panorama" returns only Mars
  hits, and "lunar surface panorama" returns only Apollo 1972.
- **Do not use Wikimedia Commons `Chang-e-5-Lander-Flag.png`** as a surface photograph: it is a CGI impression.

## How this would fit the demo

The demo already has the pieces this needs:

- a feature list with stable ids (`scenes/moon/hotspots.ts`, `MOON_FEATURES`, including `apollo-11`, `apollo-17`,
  `change-3/4/5`, `luna-21`);
- an `orbit | cinematic | surface` phase model (`features/demos/types.ts`), so a panorama is a third rendering
  mode rather than a new demo;
- `surfaceOverlay` in `DemoDefinition` (`registry.ts`) as the precedent for a full-screen overlay handed the
  `surface` phase — the meteor shower demo uses it, the Moon demo does not yet;
- Three.js 0.186 already installed.

A workable shape, in the demo's own idiom:

1. **Data**: a `moonPanoramas.ts` beside `hotspots.ts`, keyed by feature id, listing each panorama with its
   download URL, true pixel size, its **azimuth range and centre heading** on the lunar surface, its vertical
   field of view, its credit line and its licence. Multiple panoramas per site (Apollo 17 has five) become a
   small chooser inside the viewer.
2. **Assets**: fetch through the existing `tools/moon-textures` pattern (which already supports `--proxy`), but use
   the bundled Python at
   `C:\Users\ENDLESS\AppData\Local\Programs\Python\Python312\python.exe` — the `python` on PATH has neither numpy
   nor Pillow. Split each 30000 px source into tiles at the demo's usual scale and encode WebP; a 30000 x 3600
   source is far too large to ship as one texture.
3. **Projection**: the sources are cylindrical, so they need mapping onto the inside of a cylinder or a partial
   sphere. The demo's convention is `u = (lon + 180) / 360`, `v = (90 - lat) / 180` (`selenography.ts`), so a
   panorama placed at a site should be oriented by its own source-frame azimuth — the first frame's heading, which
   is published per frame in the Apollo Image Atlas. Until that heading is recovered, ship the panorama with a
   neutral heading and a note.
4. **Phase**: add a `panorama` phase (or reuse `surface` with a `surfaceOverlay`), so pressing "browse panorama"
   from the site panel fades the globe out and the cylinder in, with drag-to-look, bounded azimuth, and a
   return-to-globe control. The scene's Sun azimuth can even match the panorama's own Sun.
5. **Attribution**: extend `frontend/public/demos/moon/ATTRIBUTION.md` with a panorama table mirroring the
   existing texture table, naming NASA/JSC and the asset id per image.

## Suggested first cut

Ship the tallest, widest, continuous stitches — one per Apollo site plus a second for Apollo 17, plus the one
openly licensed Chang'e entry:

- `apollo-11`: `jsc2007e045375` (30000 x 2309) and `jsc2008e040725` (15634 x 4460)
- `apollo-12`: `jsc2007e045376` (25481 x 3000)
- `apollo-14`: `jsc2007e045377` (30000 x 3600)
- `apollo-15`: `jsc2011e118359` (10000 x 3465)
- `apollo-16`: `jsc2012e052598` (30000 x 3112)
- `apollo-17`: `jsc2004e52775` (26968 x 5001, tallest) and `jsc2004e52777` (28316 x 3000, verified visually)
- `change-4`: IAU `iau1901a` (10000 x 1229, CC BY 4.0, no watermark) as the hero; optionally add the GRAS
  `S1环拍图` (10000 x 833) as a second, rover's-eye angle — accepting that it keeps the CLEP/GRAS logo and has
  mosaic artefacts

`change-3`, `change-5` and `luna-21` should show "no panorama available" rather than a low-resolution or
non-redistributable stand-in — unless you decide to pursue GRAS permission for the raw frames.

## The wrap test, and the one likely full rotation

`jsc2004e20304` (Apollo 17 Station 5, 9000x1066) is the only Apollo entry whose ends actually close. I
downloaded it and ran the test: ratio **0.410**, and the mirrored comparison is **0.200**, the lowest of any
Apollo file — and the side-by-side (`samples/ap17-st5-wrap.jpg`) shows matching terrain: a large hill silhouette
and a similar boulder field at both ends. The peaks are not in quite the same place at each end, so this is a
**likely closing sweep, not a certified seamless wrap**; ship it with unlimited azimuth and a short cross-fade,
and expect the seam to be the only place it can betray itself. Everything else in the Apollo set is a partial
sweep and must clamp its azimuth.

## The wrap tests: no strip closes, and three earlier claims were wrong

Every shipped panorama was checked by placing its left and right ends side by side. **None of them joins.** The
measured left-edge/right-edge similarity (a ratio of the difference to the column spread; low would mean the
ends match) and the visual check agree:

| Panorama | ratio (terrain) | what the ends show |
| --- | --- | --- |
| `apollo-17-station-5` | 0.25 | left: a dark receding ridge; right: the massif peak and a sloping flank — different terrain, different horizon height |
| `apollo-14-fra-mauro` | 0.40 | left: flat bright ground with the astronaut's shadow; right: rocky ground with a higher, stepped horizon |
| `change-4-farside-lander` | 0.44 | lander hardware at both ends, but not the same view and not a clean join |
| `apollo-12-surveyor-crater` | 0.52 | unrelated terrain |
| `apollo-15-hadley-rille` | 1.09 | unrelated |
| `apollo-16-station-1` | 1.45 | unrelated |
| `apollo-11-armstrong-crater` | 2.05 | unrelated |
| `apollo-11-tranquility-base` | 2.41 | unrelated |
| `apollo-17-station-2` | 1.22 | unrelated |

**Correction to this repository's own earlier notes.** Three entries were marked as closing a full circle:
Apollo 17 Station 5, Apollo 14 and Chang'e 4. All three were wrong, and the first was asserted with some
confidence on the strength of the 0.25 ratio alone. Looking at the actual edges - see
`.agents/shots/wrap-apollo-17-station-5.jpg` and `wrap-apollo-14-fra-mauro.jpg` - shows plainly different
terrain. The low ratios come from lunar terrain being self-similar, not from the ends meeting.

**Consequence, now applied:** every panorama is a partial sweep, so `closes` is false throughout, the viewer
stops at the edge of the photograph, and the note that says so is shown on all of them. The spans are also
`modelled` - see the heading section below for why they cannot be verified.

## The per-frame headings: investigated, and not available

Every portrait here needed each panorama's **centre azimuth on the lunar surface** before it could be placed
at its true bearing. The earlier note in this file assumed the Apollo Image Atlas publishes that per frame. I
checked, and **it does not, for any frame we use.** The heading therefore stays at its documented neutral
value, and the viewer says the orientation is approximate.

What was actually verified, on 2026-09-12:

**The Apollo Image Atlas (`lpi.usra.edu`) does carry a `Camera Azimuth` row — but only on a small minority of
frames.** One annotated example: `AS17-139-21277` reads `Camera Azimuth: 298` with
`Latitude / Longitude: 20.4° N / 31.6° E`. A sweep of its own magazine shows how sparse that is:

| Check | Result |
| --- | --- |
| 17 frames sampled across all eight panorama magazines | **1** carries an azimuth (`AS17-139-21277`, 298°) |
| Apollo 17 magazine 139, frames 21270-21292 | **2 of 23** carry one (21277 = 298°, 21278 = 301°) |
| Catalogue pages for the eight magazines the panoramas come from | **none** has an azimuth column |
| Frames we actually stitched: `AS11-40-5881…5891`, `…5954…5961`, `AS12-47-6982…7006`, `AS14-66-9271…9293`, `AS15-85-11448…11453`, `AS16-114-18416…18431`, `AS17-138-21053…21073`, `AS17-145-22159…22181` | **0** carry an azimuth |

So the annotation exists but does not overlap the material we ship; per-frame headings cannot be read off it.

**The Apollo Lunar Surface Journal** (now at `apollojournals.org`; the old `hq.nasa.gov/alsj` paths redirect to
the modern NASA site) does discuss directions, but not as a per-frame table. Its Apollo 11 image library gives
the EVA's *solar* azimuth (88.1°) and bearings to named landmarks (the north rim of West Crater at ~92.4°, the
south rim at ~112.4°), which would support a shadow-based photogrammetric solve. The journal also publishes
its own warning about exactly that kind of figure:

> "Because the graphical method by which these data have been obtained is fairly crude, azimuths shown for
> individual frames may have errors of 3° or more. Positions of most of the camera stati[ons ...]"

**Conclusion: no source publishes a per-frame heading for these panoramas at an accuracy worth encoding.** A
3°-or-worse figure is not obviously better than the honest "approximate" note the viewer already shows, and a
derived shadow-azimuth solve would be this project inventing numbers for historically documented photographs —
which is the one thing these assets should not do. `headingDeg` stays 0, and the interface continues to say so.

If someone later wants to close this, the route is photogrammetry against the LROC NAC mosaics: project the
known landmarks in each frame (the LM, its footpads, named craters) onto the surface and solve for camera
yaw. That is a research task in its own right, not a lookup.
