# Orbital Lunar Panoramas — verified source material for a Three.js Moon demo

Researched by a delegated agent on the DSH harness. All network access via the local proxy
`http://127.0.0.1:7890`. **Every URL in this report was probed by me in this session** unless the row
says otherwise; each candidate section shows the raw probe output.

Environment notes that matter for reproducing this:

* Node's global `fetch` DOES honour the proxy in this session (verified: an unproxied host fails,
  proxied hosts succeed). `node .agents/net-probe.mjs` additionally insists on
  `NODE_USE_ENV_PROXY=1` — set it to be safe.
* Helpers I used and left in place: `.agents/probe2.mjs` (Range GET + Content-Range total +
  JPEG/PNG/TIFF/BigTIFF dimension parsing), `.agents/tiff.mjs` (IFD parser incl. BigTIFF),
  `.agents/page.mjs`, `.agents/links.mjs`, `.agents/assets.mjs`, `.agents/save.mjs`,
  `.agents/batch.mjs`, `.agents/usgs-moon.mjs`, `.agents/usgs-files.mjs`.
* **Magic bytes were checked on every image claim** (`ffd8ff` JPEG, `89504e47` PNG,
  `49492a00`/`4d4d002a` classic TIFF, `49492b00`/`4d4d002b` BigTIFF) so none of these are HTML error pages.
* Corrections to the brief's "known blockers", measured here:
  * `https://images-assets.nasa.gov/...` **WORKS** (206 + `ffd8ff`). The brief's 403 did **not** reproduce.
  * `https://www.lpi.usra.edu/` **WORKS** (200, real LPI homepage) — also contrary to the brief.
  * `http://astropedia.astrogeology.usgs.gov/` **TIMES OUT** (`UND_ERR_CONNECT_TIMEOUT`) — this is the
    *new* real blocker; several USGS Apollo panorama "Online File Link" values point there and are dead.
    Their mirror on `astrogeology.usgs.gov/ckan/...` is alive but only serves low-res.
  * `https://pds-imaging.jpl.nasa.gov/portal/kaguya_mission.html` → **403** (the node root is 206/200).

---

## Ranked table (verified downloads)

Ranked by usefulness **for a Three.js sphere-mapping / panorama demo**. "Full 360°" means a genuine
surround panorama; "equirect" means a full-globe latitude/longitude texture.

| # | Source | Product | Projection | Coverage | Dimensions (px) | Format | Direct URL | Licence | Attribution | Verified |
|---|--------|---------|-----------|----------|-----------------|--------|-----------|---------|-------------|----------|
| 1 | NASA SVS | CGI Moon Kit — 2025 colour map (`lroc_color_16bit_srgb_16k.tif`) | **equirectangular**, centred 0° lon | full globe (70°N–70°S real WAC data; poles filled from LOLA/LDAM albedo) | **16384 × 8192 × 3ch / 16-bit** | TIFF (sRGB) | `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_16k.tif` | NASA public domain (credit requested) | "NASA's Scientific Visualization Studio / LRO LROC WAC (NASA/GSFC/ASU)" | yes |
| 2 | NASA SVS | CGI Moon Kit — 2019 colour map (`lroc_color_poles.tif`) | **equirectangular**, centred 0° lon | full globe | **27360 × 13680** (per page text) | TIFF 24-bit RGB | `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles.tif` | NASA PD | as above | size+tile verified (page states dims) |
| 3 | USGS Astrogeology | LRO LROC WAC Global Morphology Mosaic 100 m | **simple cylindrical / equirectangular** (global) | full globe | **109164 × 54582 × 1ch / 8-bit** | BigTIFF | `https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif` | USGS PD / NASA | "NASA/GSFC/ASU — LROC WAC; mosaic by USGS Astrogeology" | yes |
| 4 | USGS Astrogeology | Moon Clementine UVVIS 750 nm Global Mosaic 118 m | **simple cylindrical / equirectangular** | full globe | **92160 × 46080 × 1ch / 8-bit** | BigTIFF | `https://planetarymaps.usgs.gov/mosaic/Lunar_Clementine_UVVIS_750nm_Global_Mosaic_118m_v2.1.tif` | USGS PD / NASA | "NASA/JPL/USGS — Clementine UVVIS" | yes |
| 5 | USGS Astrogeology | Lunar Kaguya TC Ortho Global Mosaic 474 m (64 ppd) | **equirectangular** | near-global (TC coverage) | **23040 × 11520 × 1ch / 16-bit** | TIFF | `https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif` | JAXA terms — **credit required**, ©JAXA/SELENE (USGS page states this) | "©JAXA/SELENE — Kaguya Terrain Camera; mosaic by USGS Astrogeology" | yes |
| 6 | NASA images (JSC) | Panorama view of Apollo 17 lunar surface photos (`jsc2004e52777`) | wide mosaic strip, **not** 360 | lunar surface, EVA panorama | **28316 × 3000** | JPEG | `https://images-assets.nasa.gov/image/jsc2004e52777/jsc2004e52777~orig.jpg` | NASA PD | "NASA/JSC — Apollo 17 panorama (frames AS17-…)" | yes |
| 7 | NASA images (JSC) | Panorama view of Apollo 17 lunar surface photos (`jsc2004e52776`) | wide mosaic strip | lunar surface | **21067 × 3575** | JPEG | `https://images-assets.nasa.gov/image/jsc2004e52776/jsc2004e52776~orig.jpg` | NASA PD | "NASA/JSC — Apollo 17 panorama" | yes |
| 8 | NASA images (JSC) | Panoramas of Apollo sites (`jsc2007e045376`) | wide mosaic strip | lunar surface | **25481 × 3000** | JPEG | `https://images-assets.nasa.gov/image/jsc2007e045376/jsc2007e045376~orig.jpg` | NASA PD | "NASA/JSC — Apollo site panorama" | yes |
| 9 | NASA images (JSC) | Apollo 11 panorama, Tranquility Base (`jsc2008e040725`) | wide mosaic strip | lunar surface | **15634 × 4460** | JPEG | `https://images-assets.nasa.gov/image/jsc2008e040725/jsc2008e040725~orig.jpg` | NASA PD | "NASA/JSC — Apollo 11 panorama (frames AS11-40-…)" | yes |
| 10 | NASA SVS | CGI Moon Kit — LOLA displacement map | **equirectangular** height map | full globe | **23040 × 11520** (16-bit uint) / 5760 × 2880 | TIFF | `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64_uint.tif` | NASA PD | "NASA SVS / LRO LOLA" | file verified (size 530 934 146 B); dims from page text |
| 11 | NASA images (JSC) | Panoramas of Apollo sites (`jsc2007e045375`, `jsc2007e045377`) | wide mosaic strips | lunar surface | **30000 × 2309** and **30000 × 3600** | JPEG | `https://images-assets.nasa.gov/image/jsc2007e045375/jsc2007e045375~orig.jpg` · `…/jsc2007e045377/jsc2007e045377~orig.jpg` | NASA PD | "NASA/JSC — Apollo site panoramas" | yes |
| 12 | NASA images (JSC) | Apollo 16 Station 1 panorama (`jsc2012e052599`) | wide mosaic strip | lunar surface | **30000 × 3112** | JPEG | `https://images-assets.nasa.gov/image/jsc2012e052599/jsc2012e052599~orig.jpg` | NASA PD | "NASA/JSC — Apollo 16 panorama" | yes |
| 13 | NASA images (JSC) | Apollo 17 panoramas (`jsc2004e52772`, `…52775`, `…52779`) + Apollo 17 Station 5 (`jsc2004e20304`) | wide mosaic strips | lunar surface | **29524 × 3000**, **26968 × 5001**, **9495 × 1200**, **9000 × 1066** | JPEG | `https://images-assets.nasa.gov/image/jsc2004e52772/jsc2004e52772~orig.jpg` (and siblings) | NASA PD | "NASA/JSC — Apollo 17 panorama" | yes |
| 14 | LROC (ASU) | LROC WAC Hapke 7-band / 3-band mosaic, **per 70°×90° equirect tile** | **equirectangular** (per tile) | 70°N–70°S, 0–360°E in 8 tiles | **6841 × 5321** per tile (3-band 8-bit; file `FILE_RECORDS=5321`, `RECORD_BYTES=6841`) | PDS `.IMG` + `.LBL` | e.g. `https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/MDR/WAC_HAPKE/WAC_HAPKE_3BAND_E350N0450.LBL` (tile `.IMG` is 404 for 3BAND; `…_321NM_E350N0450.IMG` returns 206) | NASA PD (cite Sato et al. 2017) | "NASA/GSFC/ASU — LROC WAC; Sato et al. (2017)" | label + 321NM tile verified; 3BAND `.IMG` 404 |
| 15 | NASA images | S72-54413 "LANDING SITE – APOLLO 17 (MAP)" | composite map + **computer-generated 360° panorama** strip, 4 sections N/E/S/W with ~15° overlap | Taurus-Littrow | **2893 × 3847** | JPEG | `https://images-assets.nasa.gov/image/S72-54413/S72-54413~orig.jpg` | NASA PD | "NASA/JSC — S72-54413" | yes |
| 16 | NASA images | S72-35970 (and companion S72-35971), 360° field of view of the Apollo 16 Descartes site, from LRV colour TV | stitched **360°** strip | Descartes landing site | **4372 × 1686** (S72-35971: 4133 × 1824) | JPEG | `https://images-assets.nasa.gov/image/S72-35970/S72-35970~orig.jpg` | NASA PD | "NASA/JSC — S72-35970" | yes |

Supporting / not a still:

| Source | Product | Why it is not directly usable |
|---|---|---|
| NASA SVS | **Tour of the Moon 4K Redux** (ID 4619) | **Video-only.** Assets are `moontour_*.mp4/.mov/.webm` (up to 3840×2160, 1.4 GB mp4 / 17.4 GB ProRes mov). The only stills are 3840×2160 PNG **title cards** (e.g. `title_taurus_littrow1.tif`, verified 3840×2160×4ch). Frame extraction from the mp4 is the documented path. |
| NASA SVS | **Moon Phase and Libration** (IDs 4442/2019, 4768/2020, 4874/2021, 5187/2024, 5415/2025 — 5415 is current) | **Disk-on-sky visualisation, not a sphere texture.** Frame sets are 730×730 (`frames/730x730_1x1_30p/moon.NNNN.jpg`, verified 730×730 JPEG) and 1920×1080 TIFF; plus Dial-A-Moon stills, `mooninfo_YYYY.json` / `.txt` ephemeris tables. Useful for a *phase-accurate* Earth-view Moon, not for panorama browsing. |
| LROC (ASU) | **Lunar QuickMap / QuickMap3D**, WMS, Gigapan viewer, "Featured Sites" | **Interactive web viewers only.** No downloadable 360° still product exists. `https://quickmap.lroc.asu.edu/` and `https://www.lroc.asu.edu/featured_sites` return 200 HTML; they render tiles on demand. |
| LROC (ASU) | **LROC Northern Polar Mosaic (LNPM)** | 931 070 × 931 070 px **polar stereographic** mosaic, 950 GB compressed — genuinely the biggest thing here, but huge, polar-projected, and not documented with an anonymous HTTP path I could verify. Page: `https://www.lroc.asu.edu/images/gigapan`. |
| USGS Astrogeology | 38 × Apollo surface panorama datasets (`geospatial_data_presentation_form=Panorama`) | The `astrogeology.usgs.gov/ckan/...` mirror serves only **1024 px wide** JPEGs (e.g. `full.jpg` = **1024 × 181**, 46 209 B). The original `http://astropedia.astrogeology.usgs.gov/...` links **time out**. Use the NASA images equivalents (rows 6–9) instead. |
| USGS Astrogeology | Kaguya MI mineral mosaics, Clementine NIR, control networks (351 lunar products enumerated) | Raster/vector science products, no better equirect colour texture than rows 3–5. |

---

## Candidate-by-candidate evidence

### 1–2, 10. NASA SVS — CGI Moon Kit (ID 4720) — **the single best equirectangular source**

Page: `https://svs.gsfc.nasa.gov/4720` (200, 54 934 B). Quote from the page:

> "These color and elevation maps are designed for use in 3D rendering software. They are created from
> data assembled by the Lunar Reconnaissance Orbiter camera and laser altimeter instrument teams."
>
> "The map is centered on 0° longitude."
>
> "The source data covers the lunar globe from 70°N to 70°S. … For these color maps, the missing
> latitudes were filled in with a lower resolution monochromatic albedo map (LDAM) from LRO's laser
> altimeter … These image is optimized for aesthetics, not science."

Page declares the sizes/dimensions:
`lroc_color_2k.jpg (2048x1024)`, `lroc_color_16bit_srgb_4k.tif (4096x2048)`,
`lroc_color_16bit_srgb_8k.tif (8192x4096)`, `lroc_color_16bit_srgb_16k.tif (16384x8192)`,
`lroc_color.exr [942.8 MB]`, `lroc_color_poles.tif (27360x13680) [494.1 MB]`,
`lroc_color_poles_16k.tif (16384x8192) [178.3 MB]`, `lroc_color_poles_8k.tif (8192x4096) [48.3 MB]`,
`ldem_64.tif (23040x11520) [1012.6 MB]`, `ldem_64_uint.tif (23040x11520) [506.3 MB]`.

Probe output (raw):

```
206 | image/tiff | total=953573340  | TIFF | 16384x8192x3ch/16bit | Wed, 03 Dec 2025 19:55:33 GMT | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_16k.tif
206 | image/tiff | total=243289792  | TIFF | 49492a00080000001700fe00 | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_8k.tif
206 | image/tiff | total=187004094  | TIFF | -  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif
206 | image/tiff | total=50641970   | TIFF | -  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif
206 | image/jpeg | total=457942     | JPEG | 2048x1024 | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
206 | image/jpeg | total=139068     | JPEG | 1024x512  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg
206 | image/tiff | total=530934146  | TIFF | -  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64_uint.tif
206 | image/tiff | total=66378634   | TIFF | -  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16.tif
206 | image/tiff | total=4153352    | TIFF | -  | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif
206 | image/aces | total=988589585  | 762f3101020000006368616e | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color.exr
```

Credit from the page's credits block: **"Please give credit for this item to: NASA's Scientific
Visualization Studio"**, Visualizer Ernie Wright (USRA), Scientist Noah Petro (NASA/GSFC). Datasets:
LOLA DEM (ID 653) and "LROC WAC Color Mosaic (Natural Color Hapke Normalized WAC Mosaic)" (ID 1015),
collected by Arizona State University.

**Demo recommendation:** `lroc_color_16bit_srgb_8k.tif` (232 MB, 8192×4096) or the 2k/4k JPEG/TIFF for a
first load, with the 16K as an optional high-quality tier. These are *the* equirectangular textures a
Three.js sphere wants.

### 3. USGS Astrogeology — LRO LROC WAC Global Morphology Mosaic 100 m

Product page: `https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m`
(206 HTML). The page's download anchor (extracted from raw HTML) points to:

```
https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif
size on page: 5.5 GB
```

Probe:

```
206 | image/tiff | total=5959263751 | TIFF | 109164x54582x1ch/8bit | Tue, 08 Nov 2022 23:37:48 GMT | https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif
```

That is **BigTIFF** (`49492b00`) — my parser had to be extended for it; a naive TIFF reader will fail.
5 959 263 751 B ≈ 5.55 GiB. This is grayscale morphology (643 nm), not colour.

Also verified on the same host: the LROC WAC GLD100 colour-shaded product
`Lunar_LROC_WAC_GLD100_ClrShade_79s79n_118m_v1_1.tif` → `total=11185005343`,
`92160x40448x3ch/8bit` (11.2 GB, colour, but only 79°S–79°N and a shaded-relief blend, not
photometric albedo). That one is the most attractive "big colour" USGS file, but it is shaded relief —
great for a terrain feel, wrong for a "what the Moon looks like" texture.

### 4. USGS — Clementine UVVIS 750 nm global mosaic 118 m

Page: `https://astrogeology.usgs.gov/search/map/moon_clementine_uvvis_global_mosaic_118m`,
download anchor `https://planetarymaps.usgs.gov/mosaic/Lunar_Clementine_UVVIS_750nm_Global_Mosaic_118m_v2.1.tif`,
page states 4 GB.

```
206 | image/tiff | total=4247470871 | TIFF | 92160x46080x1ch/8bit | Tue, 08 Nov 2022 19:13:45 GMT | https://planetarymaps.usgs.gov/mosaic/Lunar_Clementine_UVVIS_750nm_Global_Mosaic_118m_v2.1.tif
```

4 247 470 871 B ≈ 3.96 GiB. Monochrome 750 nm — scientifically clean, visually flat.

### 5. USGS — Kaguya (SELENE) Terrain Camera global orthomosaic 474 m — **licence is NOT public domain**

Page: `https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_global_orthomosaic_474m`.
Raw HTML line 64: `<a target="_blank" href="https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif" download >Download</a> (506 MB)`.
Page text: *"This near-global mosaic was generated using data from the SELenological and Engineering
Explorer (SELENE) 'Kaguya' Terrain Camera (TC) instrument. TC source data originated as map-projected
tiles at ~10 meters per pixel (m) spatial resolution."*
Licence text on the page: **"For use, refer to the JAXA Conditions for material usage page
(http://jda.jaxa.jp/en/service.php) and please credit JAXA and the SELENE/Kaguya data. ©JAXA/SELENE"**

```
206 | image/tiff | total=530934601 | TIFF | 23040x11520x1ch/16bit | Tue, 08 Nov 2022 20:23:02 GMT | https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif
```

534 MB, 23040×11520 (full 360° × 180°, 64 px/deg, 16-bit grayscale). PDS3 and ISIS3 `.lbl` labels are
also served from the CKAN mirror. **Flag for the demo: this one needs a JAXA credit line and is not
simply "NASA public domain".**

### 6–9, 11, 13, 14. Apollo surface panoramas via the NASA images API

`node .agents/nasa-search.mjs "apollo panorama lunar surface" 8` returns `nasa_id`, description and
`~orig`/`~large`/`~medium`/`~small`/`~thumb` variants. Probed originals (all JPEG, all reachable):

```
206 | image/jpeg | total=18609825 | JPEG | 28316x3000 | https://images-assets.nasa.gov/image/jsc2004e52777/jsc2004e52777~orig.jpg
206 | image/jpeg | total=8790736  | JPEG | 21067x3575 | https://images-assets.nasa.gov/image/jsc2004e52776/jsc2004e52776~orig.jpg
206 | image/jpeg | total=11428560 | JPEG | 25481x3000 | https://images-assets.nasa.gov/image/jsc2007e045376/jsc2007e045376~orig.jpg
206 | image/jpeg | total=9172122  | JPEG | 15634x4460 | https://images-assets.nasa.gov/image/jsc2008e040725/jsc2008e040725~orig.jpg
206 | image/jpeg | total=1518325  | JPEG | 9495x1200  | https://images-assets.nasa.gov/image/jsc2004e52779/jsc2004e52779~orig.jpg
206 | image/jpeg | total=836393   | JPEG | 4372x1686  | https://images-assets.nasa.gov/image/S72-35970/S72-35970~orig.jpg
206 | image/jpeg | total=1484354  | JPEG | 2893x3847  | https://images-assets.nasa.gov/image/S72-54413/S72-54413~orig.jpg
```

Metadata quote for the two S72 items (from `https://images-api.nasa.gov/search?nasa_id=S72-54413`):

> "S72-54413 (December 1972) --- A vertical view of the Taurus-Littrow landing area photographed on an
> earlier Apollo mission from lunar orbit. The mission photograph is surrounded on all sides by a
> computer-generated 360-degree panorama of the region as seen by an observer at the nominal Apollo 17
> Lunar Module landing site. The 360-degree panorama is divided into four sections, north-east-south-west.
> Each section includes an overlap of about 15 degrees with each adjacent section. The observer's eye
> level is 1.8 meters above the surface. … The panoramic scene was generated by processing a digitized
> form of the U.S. Army TOPCOM compilation of the terrain contours in the Taurus-Littrow landing area."

> "S72-35970 (21 April 1972) --- A 360-degree field of view of the Apollo 16 Descartes landing site area
> composed of individual scenes taken from color transmission made by the color RCA TV camera mounted on
> the Lunar Roving Vehicle…"

These are the only genuinely **360°-coverage lunar panoramas** I could verify as downloadable stills.
They are stitched strips (or a synthetic strip with four overlapping sections), i.e. cylindrical-ish
wide strips rather than equirectangular globe textures, so they map onto a cylinder/inner sphere, not a
latitude/longitude texture.

### 12. LROC WAC Hapke normalized mosaic (PDS) — high-res colour, but tiled and reprojection-required

`https://wms.lroc.asu.edu/lroc/view_rdr/WAC_HAPKE` (200) and the README
`https://pds.lroc.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/MDR/WAC_HAPKE/WAC_HAPKE_README.TXT`
(200, `binary/octet-stream`) state:

> CONTENTS: Photometrically normalized radiance factor (I/F)
> WAVELENGTH: 321, 360, 415, 566, 604, 643, and 689 nm
> AREAL COVERAGE: 70°N-70°S, 0°E- 360°E
> MAP PROJECTION: Equirectangular (centered at 0°N, 0°E; 400 m/pixel at the equator) …
> IMAGE SOURCE: ~124,300 images acquired by Wide Angle Camera from January 21, 2010 to May 1st, 2013
> PRODUCT CITATION: Sato, H., Robinson, M.S., Lawrence, S.J., Denevi, B.W., Hapke, H., Jolliff, B.L.,
> Hiesinger, H. (2017) Lunar Mare TiO2 Abundances Estimated from UV/Vis Reflectance, Icarus, 296, 216-238.

Tile naming and coverage: 8 tiles, `WAC_HAPKE_*****_E350N0450` = 0°–70°N / 0°–90°E, `E350S0450` =
−70°–0° / 0°–90°E, `E350N1350` = 0°–70°N / 90°–180°E, and so on.

Tile geometry read straight out of the PDS label
(`…/WAC_HAPKE/WAC_HAPKE_3BAND_E350N0450.LBL`, 3 635 B, 206):

```
RECORD_BYTES = 6841
FILE_RECORDS = 5321
COORDINATE_SYSTEM_NAME = PLANETOCENTRIC
LINE_PROJECTION_OFFSET = 5320.4999999999
LINES = 5321
LINE_SAMPLES = 6841
SAMPLE_BITS = 8
BANDS = 3
FILTER_NAME = "321, 415, 689"
```

so each tile is **6841 × 5321**, 3-band 8-bit RGB (R=689 nm, G=415 nm, B=321 nm) — 8 tiles → a
**27364 × 10642** equirectangular 70°N–70°S colour mosaic (my arithmetic from the verified tile size,
not a vendor claim). Note the label file is fetchable while
`…WAC_HAPKE_3BAND_E350N0450.IMG` returned **404** (`application/xml`); the single-band
`…WAC_HAPKE_321NM_E350N0450.IMG` returned **206** `binary/octet-stream`. Anyone building on this must
confirm which `.IMG` naming actually exists in the current PDS release.

### SVS "Tour of the Moon 4K Redux" (ID 4619) — video only

Page text: *"The camera flies over the lunar terrain, coming in for close looks at a variety of
interesting sites and some of the LRO data associated with them. Includes narration, music, feature
titles, research sources, and the location and scale of the image center."*

Assets extracted from the page: `moontour_narrated_1080p30.webm (1920x1080) [40.4 MB]`,
`moontour_narrated_1080p30.mp4 (1920x1080) [458.9 MB]`,
`moontour_narrated_2160p30.mp4 (3840x2160) [1.4 GB]`,
`moontour_narrated_2160p30_prores.mov (3840x2160) [18.1 GB]`,
`4619_Moon_Tour_No_Labels_4k.mov (3840x2160) [17.4 GB]`, plus `.srt`/`.vtt` captions.
The only still images are 4K title cards, e.g.

```
206 | image/tiff | total=157452 | TIFF | 3840x2160x4ch/8bit | Wed, 31 Jan 2018 17:30:01 GMT | https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004619/title_taurus_littrow1.tif
```

**Frame extraction path:** `ffmpeg -i moontour_notitle_2160p30.mp4 -vf fps=1 out_%05d.png` gives
3840×2160 frames; no per-site full-res still is published.

### SVS "Moon Phase and Libration" series — correctly shaped, wrong purpose

IDs and titles confirmed by fetching each page: **4442** 2019, **4459** 2019 South Up, **4768** 2020,
**4769** 2020 South Up, **4874** 2021, **5187** 2024 (released 2023-11-16, newer version available),
**5188** 2024 South Up, **5415** 2025 (current). Each page currently advertises:
`frames/730x730_1x1_30p/moon.0283.jpg (730x730)` and `frames/1920x1080_16x9_60p/moon.0001.tif (1920x1080)`.

Verified:

```
206 | image/jpeg | total=89674 | JPEG | 730x730 | https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005187/frames/730x730_1x1_30p/moon.0001.jpg
404 | text/html | total=196 | -       | https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005187/frames/1920x1080_16x9_60p/moon.0001.tif   <-- page link is STALE
206 | image/tiff | total=9890006 | TIFF | - | https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005048/phase_full.1571.tif
```

Two important findings: (a) the `1920x1080_16x9_60p/moon.0001.tif` link advertised on the 2024 page is
**404 on the server** — the page's own link is broken; (b) the useful stills are the eight
`phase_*.NNNN.tif` Dial-A-Moon stills, which are **disk-on-sky**, not sphere textures. Each page also
publishes `mooninfo_YYYY.json` and `mooninfo_YYYY.txt` ephemeris tables — genuinely useful if the demo
wants to drive libration/phase from real data.

### LROC (ASU) — verified reachable surfaces, and what is *not* a downloadable still

Reachable (all 200 HTML): `https://www.lroc.asu.edu/`, `https://lroc.im-ldi.com/`,
`https://wms.lroc.asu.edu/lroc`, `https://www.lroc.asu.edu/images` (Featured Images),
`/images/downloads` (Curated Downloads), `/images/gigapan`, `/atlases`, `/featured_sites`,
`/images/videos`, and `https://pds.lroc.asu.edu/`. `https://quickmap.lroc.asu.edu/` 206 HTML
(interactive viewer). `https://www.lroc.asu.edu/images?query=panorama` returns a **"Panorama posts"**
facet with 10 featured images — but they are oblique NAC landscapes, not stitched panoramas, and the
post anchors are not present in the served HTML (client-side rendering), so I did not extract
per-post download URLs.

Verified LROC team still downloads (TIF, absolute paths under the site):

```
206 | image/tiff | total=740671688 | TIFF | 12829x19244x3ch/8bit | https://www.lroc.asu.edu/data/support/popular_downloads/LROC_Earth_and_Limb_M199291564L.tif
206 | image/tiff | total=233303848 | TIFF | 7200x10800x3ch/8bit  | https://www.lroc.asu.edu/data/support/popular_downloads/LROC_Giordano_Bruno_Crater.tif
206 | image/tiff | total=79415940  | TIFF | 4200x6300x3ch/8bit   | https://www.lroc.asu.edu/data/support/popular_downloads/LROC_Tycho_Crater.tif
206 | image/tiff | total=332154948 | TIFF | 9000x12300x3ch/8bit  | https://www.lroc.asu.edu/data/support/popular_downloads/LROC_Revisiting_Exploration_Sites.tif
  ERR/UND_ERR_SOCKET, retried OK for: https://www.lroc.asu.edu/data/support/popular_downloads/LROC_Lunar_Chart_WAC_Color.tif (page states 253.0 MB)
```

`LROC_Earth_and_Limb_M199291564L.tif` is an **extreme wide-angle limb frame** (Earth over the Moon's
limb above Compton crater) — the closest thing LROC publishes to a "panorama" still, and it is a
perspective frame, not 360°. The `/images/gigapan` page documents the **LROC Northern Polar Mosaic**:
*"Square image: 931,070 pixels across and down … Total pixels: 866,891,344,900 (867 billion) … Total NAC
images: 10,581 … Compressed mosaic size: 950 Gigabytes"*, **polar stereographic** projection, 2 m/px —
but the page gives no direct download URL, so treat it as viewer/archive-only within this demo's reach.

Curated Downloads also lists big ISIS-cube zip products with sizes but **not** anonymous direct file
verification in this session (they are large zips): WAC HAPKE 7-band 6.5 GB, WAC Empirical 7-band
6.4 GB, WAC Empirical 643 nm 18.6 GB, NAC North/South Pole 189.5/189.3 GB, WAC Global Morphologic
19.2 GB, WAC GLD100 topography 5.3 GB, farside dusk / nearside dawn 9.8 GB each.
Page: `https://www.lroc.asu.edu/images/downloads`.

### USGS Astrogeology — search mechanics (useful for future work)

`https://astrogeology.usgs.gov/` returns **405** to a bare GET (it wants a path). The working search
JSON endpoint is **`https://astrogeology.usgs.gov/search/results?target=moon`** (200
`application/json`) and it accepts facet params, e.g.
`…&geospatial_data_presentation_form=Panorama`. The `/search/js/pmi.js` bundle drives it.

Enumerated facets for the Moon (351 products total), quoted from the JSON:

```
geoform: 3D 4, Anaglyph 4, Archive 3, Collection 8, Color 1, Control Network 3, Database 1,
  Digital Elevation Model 15, Document 9, Geologic Map 77, Global Mosaic 16, Globe 1, Grey Scale 10,
  Grids 2, Image 8, Landing Site Map 1, Merge 1, Mineral Map 14, Model 2, Nomenclature 144,
  Panorama 38, Polar Map 1, Presentation 2, Raster Data 100, Remote-sensing Data 31,
  Shaded-Relief Map 10, Tabular Data 1, Topographic Map 10, Traverse Map 6, Vector Data 80
mapprojn: (blank) 24, Equirectangular 5, Lambert Conformal 106, Mercator 38, Polar Stereographic 11,
  Simple Cylindrical 32, Stereographic 1, Transverse Mercator 2
missikey: Apollo 55, Artemis 2, Chandrayaan 1, Clementine 11, Galileo 1, Kaguya 21,
  Lunar Orbiter 4, Lunar Reconnaissance Orbiter 168
```

The **Panorama** facet is exactly 38 datasets, all Apollo surface panoramas (Apollo 11, 12, 14 ×5,
15 ×8, 16 ×11, 17 ×10 plus the `moon-apollo-landing-panoramas` collection). Their collection page
(`https://astrogeology.usgs.gov/search/map/moon-apollo-landing-panoramas`) links each dataset, e.g.
`apollo_17_panorama_station_2`, whose own page says: *"The panorama was collected by Eugene Andrew
Cernan at Station 2. Harrison H. 'Jack' Schmitt accompanies Gene on this EVA. The panorama is made from
the frame set AS17-137-20926 to 20956."* — but as noted, the mirror only serves 1024 px JPEGs and the
`astropedia.astrogeology.usgs.gov` original **times out**.

Working mirror example (low-res only):

```
206 | image/jpeg | total=46209 | JPEG | 1024x181 | https://astrogeology.usgs.gov/ckan/dataset/f08fb794-9cd4-42e9-b528-e3bc037b4782/resource/952e73af-ec91-4743-9e89-6ec7f17e182b/download/full.jpg
206 | image/jpeg | total=14435 | JPEG | 512x91   | …/download/browse.jpg
206 | image/jpeg | total=…     | JPEG | 1024x…   | https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/60a14bc2-468b-496e-8901-5d77f9912e54/download/tc_ortho_v02_global_64ppd_1024.jpg
```

### Best-effort additional sources I verified as reachable but did not fully mine

* `https://ode.rsl.wustl.edu/moon/` — 200 HTML (Orbital Data Explorer; search-driven, no static stills).
* `https://pdsimage2.wr.usgs.gov/` — 206 HTML (bulk archive; directory listings, no image in the root).
* `https://pds-imaging.jpl.nasa.gov/` — 206 HTML root; the linked Kaguya portal page 403s.
* `https://pds.lroc.im-ldi.com/` — 206 HTML; PDS data path mirror of `pds.lroc.asu.edu`.

---

## Bottom line for the demo

* **Equirectangular globe texture:** use NASA SVS CGI Moon Kit (ID 4720) — 8K or 16K sRGB TIFF, plus the
  64 ppd LOLA displacement map for real relief. This is the only fully-verified, unambiguously
  sphere-mappable, permissively-licensed high-res product family.
* **Big colour global mosaics as alternates:** USGS WAC morphology 100 m (109164×54582, grayscale
  BigTIFF) and the LROC WAC Hapke per-tile 6841×5321 equirect tiles (70°N–70°S only).
* **True 360° stills:** only the Apollo-era stitched panoramas (NASA images `jsc2004e52777` etc.,
  up to 28316×3000, and the 360° LRV-TV strips `S72-35970/71`) — cylindrical strips, not equirect.
* **Must not be promised as stills:** SVS *Tour of the Moon* (video), SVS *Moon Phase and Libration*
  (disk-on-sky + video), LROC QuickMap / Gigapan / WMS (viewers).
* **Licence gotcha:** the Kaguya TC mosaic is **©JAXA/SELENE**, credit required and JAXA terms apply —
  it is not NASA/USGS public domain like the rest.
