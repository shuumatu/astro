# Kaguya / SELENE (JAXA) lunar imagery — download research

Research date: 2026 (session date per remote `Last-Modified` headers, most 2011–2023).
All network access via local proxy `http://127.0.0.1:7890` with `HTTP_PROXY`/`HTTPS_PROXY`/`NODE_USE_ENV_PROXY=1` and Node 24 global `fetch`.
`undici` is **not** importable (`ERR_MODULE_NOT_FOUND`), confirmed — proxy env vars are the working path.

Every URL below marked **VERIFIED** was fetched in this session; the `total=`, dimensions and magic bytes are copied verbatim from tool output.
Nothing in this document is inferred from a URL's shape.

---

## (a) Ranked table

Ranked by usefulness as a **Three.js Moon globe texture** (equirectangular / full-globe first, video-only and odd projections last).

| # | Product | What it shows | Projection | Coverage | Dimensions | Format | Size (bytes) | Direct URL | Licence | Attribution | Verified? |
|---|---------|---------------|------------|----------|------------|--------|--------------|-----------|---------|-------------|-----------|
| 1 | **Moon SELENE Kaguya TC Global Orthomosaic 474m** (`Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif`) | Near-global day-side albedo mosaic from the Terrain Camera (10 m/pixel stereo camera on SELENE, ~100 km circular orbit, 2007-09→2009-06). "Morn"+"Eve" illuminations merged into one orthomosaic. **Grayscale (1 band)** — needs a colour tint in the demo if you want the familiar grey Moon look (it already *is* grey, so fine). | Simple Cylindrical (= equirectangular), planetocentric | **Full globe, lat −90→+90, lon −180→+180** | **23040 × 11520** | GeoTIFF, 16-bit uint, 1 ch, uncompressed | **530,934,601** (506 MB) | `https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif` | USGS page says "refer to the JAXA Conditions for material usage page … ©JAXA/SELENE". USGS Astrogeology publishes it as open PDS/Astrogeology data, but the page explicitly carries the JAXA credit + JAXA terms link. See §JAXA licence. | `Kaguya Terrain Camera (TC) global orthomosaic; JAXA/SELENE; processed by USGS Astrogeology` | **VERIFIED** |
| 2 | Kaguya TC Morning Global Mosaic 474m (`Lunar_Kaguya_TC_Morning_Global_64ppd_v04.tif`) | Same TC mosaic, **morning (low-sun, right-to-left) illumination only** — maximally dramatic crater relief. Great as a bump/normal-map partner or a shaded-relief variant of #1. | Simple Cylindrical | Full globe 360 × 180 | **23040 × 11520** | GeoTIFF, 16-bit, 1 ch, uncompressed | **530,934,601** | `https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Morning_Global_64ppd_v04.tif` | as #1 (©JAXA/SELENE) | `Kaguya Terrain Camera (TC) Morning mosaic; JAXA/SELENE; processed by USGS Astrogeology` | **VERIFIED** |
| 3 | Kaguya TC Evening Global Mosaic 474m (`Lunar_Kaguya_TC_Evening_Global_64ppd_v04.tif`) | Same TC mosaic, **evening (late, left-to-right) illumination only**. | Simple Cylindrical | Full globe 360 × 180 | **23040 × 11520** | GeoTIFF, 16-bit, 1 ch, uncompressed | **530,934,601** | `https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Evening_Global_64ppd_v04.tif` | as #1 (©JAXA/SELENE) | `Kaguya Terrain Camera (TC) Evening mosaic; JAXA/SELENE; processed by USGS Astrogeology` | **VERIFIED** |
| 4 | 1-Km browsing JPEG of #1 (build-time downsample source) | 1024×512 preview of the TC orthomosaic. **Not a demo texture** — useful only to eyeball the product, or as a placeholder while the 506 MB TIFF downloads. | Simple Cylindrical | Full globe | **1024 × 512** | JPEG | **181,889** | `https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/60a14bc2-468b-496e-8901-5d77f9912e54/download/tc_ortho_v02_global_64ppd_1024.jpg` | as #1 (©JAXA/SELENE) | as #1 | **VERIFIED** |
| 5 | TC Seamless Ortho Map v2.0, **per-3° tiles** (`TCO_MAPs02_*.img`) | The **native 10 m/pixel** TC ortho product, cut into 3°×3° tiles. 120 longitude directories `lon000/`…`lon357/` × ~60 latitude tiles. This is the highest-resolution *downloadable* TC imagery; you would assemble/downsample it yourself. | Simple Cylindrical, `MAP_RESOLUTION = 3600.000000 <pixel/deg>` | 3°×3° per tile; 120 lon dirs → full 360° | **10800 × 10800** per tile (label: `LINES = 10800`, `LINE_SAMPLES = 10800`) | PDS/ISIS `.img` (raw, MSB unsigned 16-bit) + detached `.lbl`, `SCALING_FACTOR = 0.010000` | **~222 MB per tile** (232,783,872 expected; directory listing shows `222M`) | e.g. `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-seamless-v2.0/lon000/data/TCO_MAPs02_N00E000S03E003SC.img` (+ `.lbl`) | JAXA DARTS PDS3 volume, `INSTITUTION_NAME = "JAXA"`, no separate copyright clause found in `voldesc.cat`. USGS republishes derivatives under the ©JAXA/SELENE credit. | `JAXA/SELENE (Kaguya) Terrain Camera ortho map (seamless v2.0), JAXA DARTS` | **VERIFIED** (label + dir listing + 222 M sizes). `.img` binary itself not byte-probed (range GET on the 3.4 KB `.lbl` verified; the `.img` is listed at 222 M by the server). |
| 6 | Kaguya Lunar Multiband Imager 59mpp — Clinopyroxene wt% (`Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S.tif`) | **Not a visual texture** — a derived *mineral abundance* map (clinopyroxene weight %) from MI multispectral reflectance (5 UVVIS bands 415/750/900/950/1001 nm). Scientific colour-ramp product. | Simple Cylindrical | lon −180→+180, **lat +50→−50 only** (deliberate; topographic shading corrections fail at higher latitudes) | **184320 × 51200** (page "Raster Column Count = 184320, Raster Row Count = 51200"; BigTIFF header confirms) | **BigTIFF** (`49492b00`), 32-bit, 1 ch, uncompressed | **37,749,555,925** (41 GB page label) | `https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S.tif` | ©JAXA/SELENE, USGS/Univ. Hawaii derived product | `Kaguya Multiband Imager (MI) clinopyroxene abundance; JAXA/SELENE; Lemelin et al./USGS Astrogeology` | **VERIFIED** |
| 7 | MI multispectral / global reflectance mosaics (237 m, 512 ppd) | MI **reflectance** rather than minerals — the closest thing to a colour-ish MI product. **Caveat: the page's Download link is a directory that returns S3 `NoSuchKey`**, so I could not derive a direct `.tif` filename. Only the 1024×512 JP2/JPEG browse is verified. | Simple Cylindrical, 128 px/deg | Full globe, lat −90→+90, lon 0→360 (page metadata) | page metadata: **46080 × 23040**; browse JPEG **1024 × 512** | GeoTIFF (per page, 32-bit) — **filename unverified**; browse = JPEG | browse **137,002**; page "External File Size" **4,246,799,109** | Directory (dead end): `https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/` → 404 NoSuchKey. Browse: `https://astrogeology.usgs.gov/ckan/dataset/7a115851-a0d4-4736-a63a-5de2524895d3/resource/af24dc68-761a-479b-887e-09f7e53e5a4e/download/kaguya_mi_refl_b2_750nm_global_1024.jpg` (750 nm band) | ©JAXA/SELENE | `Kaguya Multiband Imager (MI) reflectance mosaic; JAXA/SELENE; USGS Astrogeology` | **PARTIAL** — browse JPEG verified; the full GeoTIFF **direct URL NOT VERIFIED** |
| 8 | 8 sibling MI mineral maps (FeO, Olivine, Orthopyroxene, Plagioclase wt%, Plagioclase grain size, OMAT, Submicroscopic metallic Fe, Weighted Criteria) | Same family as #6, all 50N50S / 512 ppd / 59 m. Same geometry. | Simple Cylindrical | lat ±50 | 184320 × 51200 (same family) | BigTIFF 32-bit | ~37.7 GB each (family) | Base pattern (verified for the SMFe one): `https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S.tif` — other filenames **not individually probed** | ©JAXA/SELENE | as #6 | **PARTIAL** — SMFe URL listed on the USGS page; only Clinopyroxene byte-probed |
| 9 | **Kaguya HDTV full-observation panoramic still, wide-angle, 2007-11-07 05:52 UTC** (`sh_20071107T055245_wm4_fp_l.jpg`) | The famous **first HDTV "Earth-rise"** from the wide camera. Confirmed by JAXA press release: "cut out from a moving image (wide shot) taken … at 2:52 p.m. on November 7, 2007 (JST)" = 05:52 UTC. Moon surface near the **North Pole**; Arabian Peninsula + Indian Ocean visible on Earth. **This is a stitched panorama of the whole 1-minute movie, i.e. an extreme wide-angle frame sweep — NOT a 360° sphere and NOT equirectangular.** | Perspective-rectilinear per frame, written as a **linear horizontal strip** (all frames of one movie concatenated sideways) | One HDTV movie (~1 min of orbital motion); wide camera FOV 15.60° H × 8.80° V per frame | **1920 × 3924** | JPEG | **755,631** | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4_fp_l.jpg` | **JAXA/NHK, scientific & educational use only** (see §JAXA licence) | `JAXA/NHK Kaguya (SELENE) HDTV — Earth-rise, 7 Nov 2007. Courtesy JAXA/NHK` | **VERIFIED** |
| 10 | HDTV panoramic still, **tele** camera, 2007-11-07 03:07 UTC (`sh_20071107T030713_tm4_fp_l.jpg`) | The paired **"Earth-set"** event, tele camera. JAXA PR: tele shot "at 12:07 p.m. on November 7, 2007 (JST)" = 03:07 UTC — exact filename match. Moon surface near **South Pole**; Australia + Asia on Earth. Tele FOV 51.23° H × 30.17° V per frame. | Perspective strip (same scheme as #9) | One movie | **1920 × 7722** | JPEG | **1,256,383** | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg` | JAXA/NHK, sci/edu only | `JAXA/NHK Kaguya (SELENE) HDTV — Earth-set, 7 Nov 2007. Courtesy JAXA/NHK` | **VERIFIED** |
| 11 | HDTV panoramic still, **"Full Earth-rise"** tele, 2008-04-06 08:24 UTC (`sh_20080406T082429_tm8_fp_l.jpg`) | The 2008 **Full Earth-Rise** (JAXA PR 2008-10-09: first captured 6 April 2008, second 30 Sept 2008). Longest verified still strip in the set. | Perspective strip | One movie | **1920 × 13083** | JPEG | **3,058,725** | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T082429_tm8_fp_l.jpg` | JAXA/NHK, sci/edu only | `JAXA/NHK Kaguya (SELENE) HDTV — Full Earth-rise, 6 Apr 2008. Courtesy JAXA/NHK` | **VERIFIED** |
| 12 | **Single HDTV frame** (16:10) `sh_20071107T030713_tm4_0000_bl.jpg` | One extracted frame from the Earth-set movie. Frames are numbered `_0000_bl.jpg` … in a per-observation subdirectory. This is the practical source if you want a normal single photo rather than a strip. | Perspective-rectilinear, single frame | One frame of a 1-min movie | **1920 × 1200** | JPEG | **1,130,789** | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4/sh_20071107T030713_tm4_0000_bl.jpg` | JAXA/NHK, sci/edu only | `JAXA/NHK Kaguya (SELENE) HDTV frame, 7 Nov 2007. Courtesy JAXA/NHK` | **VERIFIED** |
| 13 | Small HDTV strip (`_fp_s.jpg`) | 480-px-wide version of #9. Handy thumbnail / atlas preview. | Perspective strip | One movie | **480 × 1931** | JPEG | **125,359** | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/small/200711/sh_20071107T030713_tm4_fp_s.jpg` | JAXA/NHK, sci/edu only | as #12 | **VERIFIED** |
| 14 | JAXA press-release "Earth-rise" still (`20071113_kaguya_01l.jpg`) | The canonical published **Earth-rise** frame (wide shot, 7 Nov 2007 14:52 JST). 16:9. | Perspective-rectilinear | single frame | **1920 × 1080** | JPEG | **238,277** | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_01l.jpg` | **JAXA site policy** (see §JAXA licence) — not the HDTV/JAXA-NHK dataset terms | `(C) JAXA/NHK` | **VERIFIED** |
| 15 | JAXA press-release "Earth-set" still (`20071113_kaguya_02l.jpg`) | The canonical published **Earth-set** frame (tele shot). | Perspective-rectilinear | single frame | **1920 × 1080** | JPEG | **104,009** | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_02l.jpg` | JAXA site policy | `(C) JAXA/NHK` | **VERIFIED** |
| 16 | JAXA press-release 3-frame Earth-set sequence (`20071113_kaguya_03l.jpg`) | Three Earth-setting frames side by side (the PR's "about 70 seconds from left to right"). | 3-up perspective composite | composite | **2880 × 1080** (i.e. 3 × 960×1080) | JPEG | **226,466** | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_03l.jpg` | JAXA site policy | `(C) JAXA/NHK` | **VERIFIED** |
| 17 | JAXA press-release "Full Earth-rise" stills (`20081009_kaguya_01l.jpg`, `_02l.jpg`) | 2008 Full Earth-Rise (tele) and Full Earth-set (wide). | Perspective-rectilinear | single frames | **1920 × 1080** each | JPEG | **125,395** / **136,848** | `https://global.jaxa.jp/press/2008/10/img/20081009_kaguya_01l.jpg`, `…_02l.jpg` | JAXA site policy | `(C) JAXA/NHK` | **VERIFIED** |
| 18 | **CDS HiPS layer** `CDS/P/Moon/Kaguya-Evening-V04-474m` | Pre-rendered **512×512 HEALPix tiles** of the TC Evening mosaic (#3), generated by CDS from the USGS product. Potentially the most Three.js-friendly delivery (fetch tiles on demand, no 506 MB download). `hips_order = 3`, `hips_tile_width = 512`, `hips_pixel_scale = 0.01431`, `moc_sky_fraction = 1` (full sky). | HEALPix (HiPS), **not** equirectangular — requires a HEALPix→UV step or a HiPS-capable renderer | Full globe | tiles **512 × 512** | PNG tiles | one tile **298,390** (`Norder3/Dir0/Npix0.png`); whole survey `hips_estsize = 27532` (KB) | Tile pattern: `https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-Evening-V04-474m/Norder{N}/Dir{D}/Npix{P}.png` — verified instance `…/Norder3/Dir0/Npix0.png` | **`hips_license = ODbL-1.0`**, `hips_copyright = Universite de Strasbourg/CNRS`, **but** `obs_copyright = JAXA` and `obs_ack` repeats the JAXA conditions + "copyright JAXA/SELENE". The ODbL label covers CDS's HiPS packaging; the underlying imagery is JAXA-credited. Treat as **layered/ambiguous** — see §JAXA licence. | `Kaguya (SELENE) TC Evening mosaic — JAXA/SELENE; HiPS by CDS (Université de Strasbourg/CNRS), ODbL-1.0` | **VERIFIED** (properties file + one tile byte-probed) |
| 19 | LRO LOLA – SELENE Kaguya TC **DEM merge** 60N60S 59m (`Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif`) | Blended **topography** (NASA LOLA + JAXA TC stereo). Not a visual texture — a height field (great for displacement/bump on the demo). | Simple Cylindrical, 512 ppd | lon 0→360, **lat 60N→60S** (tile name `60N60S`) | **184320 × 61440** | **BigTIFF** (`49492b00`), 16-bit, 1 ch, uncompressed | **22,650,225,603** | `https://planetarymaps.usgs.gov/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif` | USGS/NASA product merging NASA LOLA (public domain) with JAXA TC — page carries JAXA credit for the TC component | `LRO LOLA + SELENE Kaguya TC DEM merge; NASA/USGS + JAXA/SELENE` | **VERIFIED** |

### Not downloadable stills (flagging per requirement #6)

| Product | Status | Frame-extraction path |
|---|---|---|
| Kaguya HDTV **movies** (`sh_*_wm*.mp4`, `_tm*.mp4`) | **Video only.** 600+ one-minute HDTV movies across all mission phases. The "full-Moon 360-style" / Earthrise motion products exist only as these movies (plus the strips in rows 9–11). | (1) Download the `.mp4` directly from `…/browse/{large,medium}/YYYYMM/sh_*.mp4` (verified listing: `sh_20071107T030713_tm4.mp4` 118 MB, `sh_20080406T082429_tm8.mp4` 639 MB). (2) Or download the `_bl.zip` per-observation still bundle (~1.8–2.9 GB each) which contains pre-extracted JPEG frames **and** avoid all decoding. (3) Or take the FITS stills directly from `…/data/YYYYMM/` (EDR = the movie already split into individual frames; see below). |
| HDTV EDR **FITS frames** (`…/data/YYYYMM/sh_*/`) | Raw, lossless, but FITS RGBCUBE + detached PDS3 labels. | The dataset description (quoted in §Evidence) states: "The EDR contains these FITS images … all the movies are splited into the still images. Each FITS image contains red, green, and blue bands … RGBCUBE … BSQ." So **no video decoding is required** — every frame is already a still. Convert FITS→PNG with `astropy`/`fitsio`. |
| JAXA Digital Archives (JDA) stills & movies | Interactive **web application** (cart + online application form) at `https://jda.jaxa.jp/`. There is **no static download URL**; you build a cart and submit a usage application. | Not a direct-download path. Use DARTS/`planetarymaps.usgs.gov` instead. |
| JAXA "Kaguya HDTV Data Publication System" | Referenced by the DARTS README ("please go to the Kaguya HDTV Data Publication System and follow the terms of use") as the **terms-of-use gate** for the HDTV data. | Read its terms before redistributing the HDTV stills. |
| CDS `CDS/P/Moon/Kaguya-TC-Morning-V04-474m` | **Not found** — `…/CDS_P_Moon_Kaguya-TC-Morning-V04-474m/properties` → 404. | The Evening layer (row 18) is the one that resolves. Morning/Ortho HiPS layers: **NOT VERIFIED**, do not cite a URL. |

---

## (b) Per-candidate raw evidence

### B1. Proxy / network prerequisites (verbatim)

```
$ node -e "import('undici').then(...).catch(...)"
undici FAIL: ERR_MODULE_NOT_FOUND
$ node --version
v24.4.1
```

Working invocation (used for every probe below):

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"; node <script> <url>
```

Without `NODE_USE_ENV_PROXY=1` the probes silently fall back to direct connections; the helper scripts' `undici` `ProxyAgent` fallback is dead (`ERR_MODULE_NOT_FOUND`), so **`NODE_USE_ENV_PROXY=1` is load-bearing**, not optional.

### B2. Kaguya TC Global Orthomosaic 474m — USGS page

Page: `https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_global_orthomosaic_474m` (HTTP 200)

Verbatim page text (excerpt):

> **Abstract**
> **Product Information:** This near-global mosaic was generated using data from the SELenological and Engineering Explorer (SELENE) "Kaguya" Terrain Camera (TC) instrument. TC source data originated as map-projected tiles at ~10 meters per pixel (m) spatial resolution.
> The Japan Aerospace Exploration Agency (JAXA) launched the SELenological and Engineering Explorer (SELENE) Kaguya spacecraft to the Moon in September 2007. The mission concluded June 10, 2009 when the spacecraft was intentionally crashed onto the lunar surface.
> The high-performance optical TC, a 10-meter spatial resolution stereo-camera, was part of the Lunar Imager/Spectrometer (LISM) instrument suite (Kato et al., 2006), along with the Multi-band Imager (MI, 20 m; Ohtake et al., 2008) and Spectral Profiler (SP; Matsunaga et al., 2008).
> … The SELENE team released map-projected near-global coverage of TC data with both Morning ("Morn") and Evening ("Eve") illuminations… The 3x3-degree tiles (7200 nominal count per set) are spatially co-registered to the Kaguya global DTM…
> For use, refer to the JAXA Conditions for material usage page ( http://jda.jaxa.jp/en/service.php ) and please credit JAXA and the SELENE/Kaguya data. **©JAXA/SELENE**

Download links harvested from that page (verbatim):

```
https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif  ||  Download
https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/60a14bc2-468b-496e-8901-5d77f9912e54/download/tc_ortho_v02_global_64ppd_1024.jpg  ||  Sample
https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/6f56ff06-7f1f-42b9-a5cc-cae66df634b9/download/lunar_kaguya_tc_ortho_global_64ppd_v02_pds3.lbl  ||  PDS3 Label
https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/d4fc6439-5f72-4c2e-aa89-4717f7acf2a0/download/lunar_kaguya_tc_ortho_global_64ppd_v02.lbl  ||  ISIS3 Label
```

Geometry pulled from the page's metadata `<dt>/<dd>` pairs (verbatim values):

```
Minimum Latitude           = -90
Maximum Latitude           = 90
Minimum Longitude          = -180
Maximum Longitude          = 180
Raster Row Count (lines)   = 11520
Raster Column Count (samples) = 23040
Bit Type (8, 16, 32)       = 16
Map Projection Name        = Simple Cylindrical
Latitude Type              = Planetocentric
Longitude Domain           = 0 to 360
Pixel Resolution (meters/pixel) = 473.80235037734
Scale (pixels/degree)      = 63.999999999999
Bands                      = 1
Radius A = 1737400 ; Radius C = 1737400
```

Note the page reports **Longitude Domain = 0 to 360** while Min/Max Longitude read **−180 / +180**; the map is the full 360°, the two fields simply use different conventions. 23040 / 64 = 360.0 and 11520 / 64 = 180.0 exactly, consistent with full-globe equirectangular.

**Byte-level probe (verbatim):**

```
$env:PROBE_RANGE="bytes=0-262143"; node .agents/probe2.mjs "https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif" ...
206 | image/tiff | total=530934601 | TIFF | 23040x11520x1ch/16bit | Tue, 08 Nov 2022 20:23:02 GMT | https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif
206 | image/jpeg | total=181889 | JPEG | 1024x512 | Wed, 16 Aug 2023 18:40:41 GMT | https://astrogeology.usgs.gov/ckan/dataset/62b3b6d8-6037-449b-bee6-b4b577299738/resource/60a14bc2-468b-496e-8901-5d77f9912e54/download/tc_ortho_v02_global_64ppd_1024.jpg
```

Magic bytes: `49492a00` = little-endian classic TIFF (per the task's accepted TIFF signatures). Dimensions read from the IFD, not from the filename.

Cross-check with the independent BigTIFF/TIFF header parser written for this task:

```
206 | TIFF | 49492a00 | total=530934601 | image/tiff | 23040x11520 | 16bit | 1ch | uncompressed | https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Ortho_Global_64ppd_v02.tif
```

Sanity check on size: 23040 × 11520 × 2 bytes = **530,841,600** + TIFF/IFD overhead ≈ 530,934,601. ✔ consistent with uncompressed 16-bit.

### B3. TC Morning / Evening (verbatim probes)

```
=== moon_selene_kaguya_tc_morning_global_mosaic_474m
https://astrogeology.usgs.gov/ckan/dataset/1657d6b4-ed2d-4ab5-b2f8-e3b2ede9cea1/resource/eb027a29-bcac-4cc0-99ed-7554a780b702/download/full.jpg  ||  Sample
https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Morning_Global_64ppd_v04.tif  ||  Download
https://astrogeology.usgs.gov/ckan/dataset/1657d6b4-ed2d-4ab5-b2f8-e3b2ede9cea1/resource/bc3b81ed-3d92-4bc3-8e7e-05410b1e3ba2/download/browse.jpg  ||  browse image
https://astrogeology.usgs.gov/ckan/dataset/1657d6b4-ed2d-4ab5-b2f8-e3b2ede9cea1/resource/eb027a29-bcac-4cc0-99ed-7554a780b702/download/full.jpg  ||  full image

=== moon_selene_kaguya_tc_evening_global_mosaic_474m
https://astrogeology.usgs.gov/ckan/dataset/74ff166c-395d-4e59-88e9-31ec66970e61/resource/3c8d37d9-0d9d-4bc2-bda7-dbf404e4705c/download/tc_eve_v02_global_64ppd_1024.jpg  ||  Sample
https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Evening_Global_64ppd_v04.tif  ||  Download
https://astrogeology.usgs.gov/ckan/dataset/74ff166c-395d-4e59-88e9-31ec66970e61/resource/c0adf459-1dd4-4bdc-82a4-ca2a19cf7f73/download/tc_eve_v02_global_64ppd_0512.jpg  ||  browse image
https://astrogeology.usgs.gov/ckan/dataset/74ff166c-395d-4e59-88e9-31ec66970e61/resource/3c8d37d9-0d9d-4bc2-bda7-dbf404e4705c/download/tc_eve_v02_global_64ppd_1024.jpg  ||  full image
```

```
206 | TIFF | 49492a00 | total=530934601 | image/tiff | 23040x11520 | 16bit | 1ch | uncompressed | https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Evening_Global_64ppd_v04.tif
206 | TIFF | 49492a00 | total=530934601 | image/tiff | 23040x11520 | 16bit | 1ch | uncompressed | https://planetarymaps.usgs.gov/mosaic/Lunar_Kaguya_TC_Morning_Global_64ppd_v04.tif
206 | image/jpeg | total=177127 | JPEG | 1024x512 | ... | https://.../tc_eve_v02_global_64ppd_1024.jpg
206 | image/jpeg | total=102071 | JPEG | 1024x512 | ... | https://.../full.jpg   (TC Morning browse)
```

### B4. Complete list of Kaguya/SELENE datasets in the USGS Astrogeology catalogue

Extracted from the JSON embedded in `https://astrogeology.usgs.gov/search/results?target=moon` (that endpoint returned `206 | application/json | total=207461 | magic 7b22636f6c6c656374696f6e`). Titles matching kaguya/selene:

```
Kaguya Lunar Multiband Imager 59mpp
Kaguya Lunar Multiband Imager MI Derived Clinopyroxene Weight Percent 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived FeO Weight Percent 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Olivine Weight Percent 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Optical Maturity OMAT 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Orthopyroxene Weight Percent 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Plagioclase Grain Size 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Plagioclase Weight Percent 50N50S 512ppd 59mpp
Kaguya Lunar Multiband Imager MI Derived Weighted Criteria Value 50N50S 512ppd 59mpp
Lunar Kaguya Multiband Imager Mosaics
Moon Kaguya TC Global Mosaic
Moon LRO LOLA - SELENE Kaguya TC DEM Merge 60N60S 59m
Moon LRO LOLA - SELENE Kaguya TC Shaded Relief Merge 60N60S 59m
Moon SELENE Kaguya MI Central Peak Mosaics 512m
Moon SELENE Kaguya MI Derived Submicroscopic Metallic Iron Mosaic 59m
Moon SELENE Kaguya MI Global Reflectance Mosaic 237m
Moon SELENE Kaguya TC Evening Global Mosaic 474m
Moon SELENE Kaguya TC Global Orthomosaic 474m
Moon SELENE Kaguya TC Morning Global Mosaic 474m
```

**There is no separate Kaguya TC "full colour" product in this catalogue** — TC is a single-band (panchromatic) camera, so every TC visual product is greyscale. Any "colour Moon" you have seen built on Kaguya TC is a tinted or multi-source composite made downstream.

### B5. Kaguya Multiband Imager 59mpp — USGS page geometry

Page: `https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_59mpp` (HTTP 200). Verbatim excerpts:

> This mosaic represents the abundance of the mineral clinopyroxene on the surface of the Moon, expressed as weight percent (wt%).
> The mosaic was created from topographically-corrected MI reflectance data acquired by the JAXA SELENE/Kaguya mission (see Ohtake et al., 2013) from the Kaguya Archive MI MAP processing level version 2 (MI MAP_02) products. The MI collects images of the lunar surface at 5 wavelengths in the ultraviolet-visible (UVVIS; 415, 750, 900, 950, 1001 nm) region … and at 4 wavelengths in the near-infrared region (NIR; 1000, 1050, 1100, 1250 nm).
> **These products only cover the latitudinal range +/-50 degrees due to the difficulty of applying adequate corrections for topographic shading at higher latitudes.**
> The mosaic presented here has been resampled to 512 ppd (59 meters/pixel) from its original resolution of 2048 ppd (15 meters/pixel).
> For usage rights, please refer to the JAXA Conditions for material usage page ( http://jda.jaxa.jp/en/service.php ) and please credit JAXA and the SELENE/Kaguya data. **©JAXA/SELENE**

Verbatim metadata values:

```
External File Size = 41 GB
Online File Link = https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S.tif
Minimum Latitude = -50
Maximum Latitude = 50
Minimum Longitude = -180
Maximum Longitude = 180
Raster Row Count (lines) = 51200
Raster Column Count (samples) = 184320
Bit Type (8, 16, 32) = 32
Map Projection Name = Simple Cylindrical
Latitude Type = Planetocentric
Longitude Direction = Positive East
Longitude Domain = -180 to 180
Pixel Resolution (meters/pixel) = 59.225294
Scale (pixels/degree) = 512
Bands = 1
```

**Byte-level probe (verbatim) — note this is a BigTIFF, so the task's classic-TIFF magic list is insufficient:**

```
206 | image/tiff | total=37749555925 | 49492b000800000010000000 | - | Wed, 09 Nov 2022 00:52:47 GMT | https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S.tif
206 | image/jpeg | total=49884 | JPEG | 1024x284 | ... | .../lunar_kaguya_mimap_mineraldeconv_clinopyroxenepercent_50n50s_1024.jpg
```

The shipped `probe2.mjs` printed `-` for dimensions because its `tiff.mjs` reader assumes classic TIFF (`u16(2) !== 42`). I wrote `.agents/research/tools/bigtiff.mjs` to parse BigTIFF (`magic 43`, 8-byte offsets, 20-byte IFD entries) and it resolves the true size:

```
206 | BigTIFF | 49492b00 | total=37749555925 | image/tiff | 184320x51200 | 32bit | 1ch | uncompressed | https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_ClinopyroxenePercent_50N50S.tif
```

Size sanity check: 184320 × 51200 × 4 bytes = **37,748,736,000** + overhead ≈ 37,749,555,925. ✔

**Mineral-map family download links** (from the individual pages; SMFe one shown verbatim, others same pattern):

```
https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/Lunar_Kaguya_MIMap_MineralDeconv_AbundanceSMFe_50N50S.tif  ||  Download
```
Page: `https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_mi_derived_submicroscopic_metallic_iron_mosaic_59m`

### B6. MI Global Reflectance Mosaic 237m — geometry, and the dead download link

Page: `https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_mi_global_reflectance_mosaic_237m` (HTTP 200). Verbatim metadata values:

```
Minimum Latitude = -90
Maximum Latitude = 90
Minimum Longitude = 0
Maximum Longitude = 360
Raster Row Count (lines) = 23040
Raster Column Count (samples) = 46080
Bit Type (8, 16, 32) = 32
Pixel Resolution (meters/pixel) = 236.90117519
Scale (pixels/degree) = 128
Map Projection Name = Simple Cylindrical
Bands = 1
External File Size = 4246799109
Online File Link = https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/
```

**The `Online File Link` is a bare directory and it is dead (verbatim):**

```
$ node .agents/page.mjs "https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/" 6000
[404 application/xml https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/]
NoSuchKey The specified key does not exist. mosaic/Lunar_MI_multispectral_maps/ 1PGZJWHVFRYJECP1 MOESWnXinwBNRGUvgEYNGw7W3CsKLQYQllMs/VWSXfHDevORuoDQig6CCbL0l4vCN6gWQqZSrv4= 
```

I also tried three plausible direct filenames — **all 404** (do not reuse guesses; the bucket is S3 and `NoSuchKey` on directory listing means there is no index to discover names from):

```
404 | application/xml | ... | https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/Lunar_Kaguya_MIMap_Reflectance_750nm_Global_512ppd.tif
404 | application/xml | ... | https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/Kaguya_MI_refl_b2_750nm_global_512ppd.tif
404 | application/xml | ... | https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/Lunar_Kaguya_MI_Reflectance_750nm_Global_512ppd.tif
```

The same applies to `https://planetarymaps.usgs.gov/mosaic/Lunar_MI_mineral_maps/` (also 404 `NoSuchKey`) — directory listing is disabled on this bucket. **Only the exact filenames printed on the USGS pages work.**

Only the browse JPEG is verified:

```
206 | image/jpeg | total=137002 | JPEG | 1024x512 | ... | https://astrogeology.usgs.gov/ckan/dataset/7a115851-a0d4-4736-a63a-5de2524895d3/resource/af24dc68-761a-479b-887e-09f7e53e5a4e/download/kaguya_mi_refl_b2_750nm_global_1024.jpg
```

### B7. LOLA – Kaguya TC DEM merge (verbatim)

```
=== moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m
https://planetarymaps.usgs.gov/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif  ||  Download

206 | BigTIFF | 49492b00 | total=22650225603 | image/tiff | 184320x61440 | 16bit | 1ch | uncompressed | https://planetarymaps.usgs.gov/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif
```

Size check: 184320 × 61440 × 2 = **22,650,224,640** ≈ 22,650,225,603. ✔

### B8. Kaguya HDTV archive — DARTS structure and event identification

**Discovery path (all HTTP 200):** the DARTS topic page `https://darts.isas.jaxa.jp/en/topics/2016/20160913topic` is titled *"Full-release of the SELENE (KAGUYA) High Definition Television (HDTV) data"* (2016.09) and says, verbatim:

> All the data taken by the high definition television (HDTV) onboard the SELENE (KAGUYA) lunar orbiter are released. The SELENE HDTV was developed in cooperation with JAXA and NHK, and it took full HD images all around the Moon. Originally, operations was planned for one-year, but in the end, the instrument took more than 600 movies over the full 21 month SELENE mission life. Considering high scientific values of the HDTV data, DARTS opens the whole movies and still images that are extracted from the high resolution movies.

That page's only data link is an mp4, which is how the `…/hdtv/pds/sln-l_e-hdtv-2-edr-v1.0/` path was found. **That path on `darts.isas.jaxa.jp` is an application route, not a file listing** — the browsable archive is the Apache index at `data.darts.isas.jaxa.jp`:

```
https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/
  README.html  845 B        browse/  catalog/  data/  index/  voldesc.cat
```

Verbatim `README.html` text:

> This directory contains all still images in the movies taken by SELENE(Kaguya) High Definition Television System, Kaguya HDTV, for educational and scientific purposes. For more details, please go to the Kaguya HDTV Data Publication System and follow the terms of use.

Directory layout (verbatim listings):

```
…/browse/large/    → 200709.rotate180/ 200709/ 200710/ 200711/ … 200906/
…/browse/medium/   → same year-month scheme
…/browse/small/    → same
…/data/            → 200709/ … 200906/
…/catalog/         → catinfo.txt dataset.cat insthost.cat mission.cat person.cat ref.cat
…/index/           → index.lbl index.tab (381K) indxinfo.txt
```

Per-observation pattern inside a month directory (verbatim from `browse/large/200711/`):

```
sh_20071107T030713_tm4.mp4                118M        <- movie
sh_20071107T030713_tm4/                              <- extracted still frames
sh_20071107T030713_tm4_bl.zip             2.1G       <- bundle of frames
sh_20071107T030713_tm4_fp_l.jpg           1.2M       <- full-observation panoramic still
```

Inside a stub directory (verbatim from `…/200711/sh_20071107T030713_tm4/`):

```
sh_20071107T030713_tm4_0000_bl.jpg  1.1M
sh_20071107T030713_tm4_0001_bl.jpg  1.1M
… (sequential frames) …
```

**Camera / FOV facts, verbatim from the JAXA press release** (`https://global.jaxa.jp/press/2007/11/20071113_kaguya_e.html`, HTTP 200):

> Table 1: Major Characteristics of the HDTV
> Sensor: CCD (1920×1080: valid pixels), 3 chips; Three primary colors spectrum by Dichroic Prism
> Fixed lenses (T: tele camera, W: wide camera)
> T: 51.23°(horizontal) 30.17°(vertical)
> W: 15.60°(horizontal) 8.80°(vertical)

**Event ↔ filename correspondence.** The press release timestamps are JST; the archive filenames are UTC. JST−9 = UTC:

| PR text (verbatim) | JST | UTC | Archive file |
|---|---|---|---|
| "wide shot … at 2:52 p.m. on November 7, 2007" (Earth-rise) | 14:52 | 05:52 | `sh_20071107T055245_wm4_*` ✔ |
| "tele shot … at 12:07 p.m. on November 7, 2007" (Earth-set) | 12:07 | 03:07 | `sh_20071107T030713_tm4_*` ✔ |

This is the strongest available evidence for which file is "the" Earthrise still: the HHMM in the filename matches the JST time minus 9 h to the minute.

Also in the 2007-11-07 press release, verbatim: *"In the image, the Moon's surface is near the North Pole, and the Arabian Peninsula and Indian Ocean can be observed on the Earth"* (Earth-rise / wide), and *"In the image, the Moon's surface is near the South Pole, and we can see the Australian Continent (center left) and the Asian Continent (lower right) on the Earth"* (Earth-set / tele).

2008 Full Earth-Rise press release (`https://global.jaxa.jp/press/2008/10/20081009_kaguya_e.html`, HTTP 200), verbatim:

> …successfully captured a movie of the "Full Earth-Rise" … on September 30, 2008 … An "Earth-rise" … was captured for the second time following the first movie shooting on **April 6, 2008**.
> The location on the Moon is around the North Pole on the near side at a north latitude of 74 degrees or higher. You can see Australia on the lower left and the Eurasian to European Continents and the Arabian Peninsula in the center to the left of the Earth image.
> From left to right, it took about 40 seconds for the Earth to fully rise. * The above image was made by cutting out still images from the movie.

**All HDTV still probes (verbatim):**

```
200 | image/jpeg | total=1256383 | JPEG | 1920x7722 | Fri, 16 Mar 2012 11:09:35 GMT | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg
200 | image/jpeg | total=755631  | JPEG | 1920x3924 | Sun, 24 Apr 2011 09:45:52 GMT | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4_fp_l.jpg
200 | image/jpeg | total=1130789 | JPEG | 1920x1200 | Sat, 10 Sep 2016 21:01:49 GMT | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4/sh_20071107T030713_tm4_0000_bl.jpg
200 | image/jpeg | total=125359  | JPEG | 480x1931  | Fri, 16 Mar 2012 11:14:49 GMT | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/small/200711/sh_20071107T030713_tm4_fp_s.jpg
200 | image/jpeg | total=3058725 | JPEG | 1920x13083 | Sun, 24 Apr 2011 09:45:54 GMT | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T082429_tm8_fp_l.jpg
404 | text/html | total=196 | HTML | - | - | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/medium/200711/sh_20071107T030713_tm4_fp_m.jpg
```

The `medium/` tree follows the same naming **without** the `_fp_m.jpg` family — that `404` is recorded so nobody repeats the guess. (`medium/` does contain `_bm.mp4` and `_bm.zip`, e.g. `sh_20071107T030713_tm4_bm.mp4` 10M.)

Two single-frame probes returned `1920x1200`, not `1920x1080` — the archive writes frames 16:10 while the HDTV sensor is 1920×1080. Take the measured `1920x1200` as authoritative for the delivered files.

**One earlier probe timed out** (environmental, not a 404):

```
200 | image/jpeg | total=1256383 | JPEG | 1920x7722 | ... | .../sh_20071107T030713_tm4_fp_l.jpg
[timed out after 150000ms]      <- second URL in the same invocation never ran; re-run separately succeeded
```
The retried `wm4` probe succeeded, so this was a range-GET stall, not a broken URL.

**HDTV data-format facts, verbatim from `…/catalog/dataset.cat`:**

```
DATA_SET_ID = "SLN-L/E-HDTV-2-EDR-V1.0"
DATA_SET_NAME = "SELENE MOON/EARTH HDTV 2 EDR V1.0"
START_TIME = 2007-09-14T01:31:01Z
STOP_TIME = 2009-06-10T18:25:00Z
DATA_SET_RELEASE_DATE = 2016-09-21
DATA_SET_TERSE_DESC = "SELENE HDTV data for all mission phases."
CITATION_DESC = "Yamazaki,J. et al.,High-Definition Television System onboard Lunar Explorer KAGUYA (SELENE) and Imaging of the Moon and the Earth, Space Science Reviews, 154, 1-4, 21-56, 2010., http://link.springer.com/article/10.1007%2Fs11214-010-9697-0"
ABSTRACT_DESC = "The High-Definition Television (HDTV) system onboard the Japanese lunar explorer Kaguya (SELENE) consists of a telephotographic camera and a wide-angle camera. One minute-long motion pictures are acquired by the HDTV system at 30 fps (frames per second). The Experiment Data Record (EDR) from the SELENE HDTV experiment are included in this data set."
```

**Copyright clause — the single most important licence finding in this document, quoted verbatim from `DATA_SET_DESC`:**

```
Copyright
=========
Unlike generic data set in planetary data system (PDS), this data set is
copyrighted to JAXA/NHK, and opened for scientific and educational purpose.
Users of this data set must inquire Japan Aerospace Exploration Agency for
the other purposes.
```

Also verbatim from the same `DATA_SET_DESC` (frame-extraction path):

```
The High Definition television (HDTV) took more than 600 movies around the
Moon during the all mission phases. The HDTV took images and performed the
onboard processing in JPEG format. They were re-formatted to TIFF format
on the ground. These TIFF images were converted to FITS format losslessly.
The Experiment Data Record (EDR) contains these FITS images. To comply with
both FITS and PDS3 standards, each image has each detached PDS3 label.
...
All the SELENE HDTV data records are in FITS images. In other words, all the
movies are splited into the still images. Each FITS image contains red,
green, and blue bands. This type of FITS image is called as RGBCUBE.
Following the PDS standard, the data format is band-sequentail(BSQ).
...
Each EDR browse image is converted from the FITS format to the JPEG format.
All the browse images are rotated by 180 degrees because the Moon surface
stays a lower area of pictures. Therefore, the first two Earth movies taken
in September 2007 shows south up.
This data set includes the geometric information using SPICE kernels
although this is EDR and data are not calibrated.
```

Two operational consequences:
1. **Every browse JPEG is rotated 180°** relative to the FITS original. If you mix `browse/` JPEGs with `data/` FITS, you must rotate one set. Note that `browse/large/` contains a `200709.rotate180/` directory, i.e. both orientations exist for the first month — check before assuming.
2. Because the movies are already split into per-frame FITS stills **and** pre-extracted JPEG frames, **no video decoding is needed** to obtain stills.

### B9. Kaguya TC seamless ortho map — tile geometry

Path: `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-seamless-v2.0/` → 120 directories `lon000/` … `lon357/` in 3° steps.

```
…/lon000/aareadme.txt  browse/  catalog/  data/  document/  index/  voldesc.cat
…/lon000/data/  → TCO_MAPs02_N00E000S03E003SC.img  222M
                   TCO_MAPs02_N00E000S03E003SC.lbl  3.4K
                   TCO_MAPs02_N03E000N00E003SC.img  222M
                   … one .img+.lbl per 3°×3° tile
```

The `.lbl` (3,509 bytes, verified fetched) contains verbatim:

```
IMAGE_CENTER_LATITUDE =  -1.499861 <deg>
IMAGE_CENTER_LONGITUDE =   1.499861 <deg>
OBJECT = IMAGE_MAP_PROJECTION
  ^DATA_SET_MAP_PROJECTION = "DSMAP.CAT"
  MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
  A_AXIS_RADIUS = 1737.400 <km>
  CENTER_LATITUDE =   0.000000 <deg>
  CENTER_LONGITUDE =   0.000000 <deg>
  MAP_PROJECTION_ROTATION = 0.0 <deg>
  MAP_RESOLUTION = 3600.000000 <pixel/deg>
  MAXIMUM_LATITUDE =   0.000000 <deg>
  MINIMUM_LATITUDE =  -2.999722 <deg>
  LINE_PROJECTION_OFFSET = 0.000000
  SAMPLE_PROJECTION_OFFSET = 0.000000
END_OBJECT = IMAGE_MAP_PROJECTION
  LINES = 10800
  LINE_SAMPLES = 10800
  SAMPLE_TYPE = MSB_UNSIGNED_INTEGER
  SAMPLE_BITS = 16
  SCALING_FACTOR = 0.010000
  VALID_MINIMUM = 2
  VALID_MAXIMUM = 32766
  MINIMUM = 257
  MAXIMUM = 2486
```

3600 px/deg ÷ 3° = 10800 lines. ✔ Internally consistent.
`.img` size: 10800 × 10800 × 2 B = **233,280,000**; the server reports `222M` (binary MiB: 233,280,000 / 1048576 = 222.5 MiB ✔).

`voldesc.cat` states `INSTITUTION_NAME = "JAXA"`, `FACILITY_NAME = "Lunar Exploration Technology office"`, `DESCRIPTION = "This volume contains SELENE Level 2 Product file."`, and `^DATA_SET_CATALOG =` is **empty** — i.e. this volume carries **no** dataset-level copyright clause, unlike the HDTV volume. The only licence pointer for the TC/MI data is the one USGS quotes: `http://jda.jaxa.jp/en/service.php`.

### B10. CDS HiPS layer (verbatim properties)

```
https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-Evening-V04-474m/properties   (HTTP 200)
```

Key verbatim keys:

```
creator_did = ivo://CDS/P/Moon/Kaguya-Evening-V04-474m
hips_license = ODbL-1.0
hips_copyright = Universite de Strasbourg/CNRS
obs_copyright = JAXA
obs_copyright_url = http://jda.jaxa.jp/en/service.php
obs_title = Moon Kaguya-Evening-V04-474m
obs_ack = For use, refer to the JAXA Conditions for material usage page (http://jda.jaxa.jp/en/service.php ) and please credit JAXA and the SELENE/Kaguya data. copyright JAXA/SELENE
prov_progenitor = USGS (https://astrogeology.usgs.gov/) from JAXA (http://jda.jaxa.jp/en/service.php)
hips_frame = moon
hips_body = moon
hips_order = 3
hips_tile_width = 512
hips_tile_format = png
hips_pixel_scale = 0.01431
s_pixel_scale = 0.01562
dataproduct_type = image
moc_sky_fraction = 1
hips_estsize = 27532
hips_release_date = 2019-05-21T06:58Z
```

Tile probe (verbatim):

```
206 | image/png | total=298390 | PNG | 512x512 | Sun, 26 Nov 2017 14:26:58 GMT | https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-Evening-V04-474m/Norder3/Dir0/Npix0.png
404 | text/html | total=324 | HTML | - | - | https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-TC-Morning-V04-474m/properties
```

**Licence conflict flagged, not resolved:** `hips_license = ODbL-1.0` (a genuine open-data licence, attribution + share-alike) sits in the same file as `obs_copyright = JAXA` with the JAXA conditions URL and `copyright JAXA/SELENE`. Reading: CDS's *HiPS packaging* is ODbL; the *JAXA imagery* inside it is still JAXA-credited. A demo should satisfy the stricter reading.

### B11. JAXA licence position (the decisive section)

Two distinct JAXA licences apply, and they are **not** interchangeable.

#### (i) JAXA website / JAXA Digital Archives — "Using Our Materials"

Source: `https://jda.jaxa.jp/service.php?lang=e` (HTTP 200; the Japanese route also reachable at `http://jda.jaxa.jp/en/service.php`, which redirects to the Japanese home then this page). Verbatim:

> You can use JAXA's photo and video materials from JAXA Digital Archives in accordance with the procedures and conditions below.
> …
> **Credit:** Please clearly indicate "(C) Japan Aerospace Exploration Agency (JAXA)" or "(C)JAXA" as the source. However, if the owner of the material is another organization or if the work is jointly owned by JAXA and other organizations, please indicate each individual source side by side. (example: (C) JAXA/NAOJ).
> **Prohibited matters** — Usage is not allowed for the following purposes…
> - To aid, recommend, slander, or defame the activities of a specific individual or group or organization
> - For purposes or situations that are contrary to public order and morals
> - Use in a manner that causes misunderstandings about JAXA's operations or Japanese aerospace exploration activities.
> - Uses that may cause considerable decline in the organizational image of JAXA … [including appearing as individual achievement, incl. academic papers]
> - **Distributing JAXA's photos and videos without first obtaining the permission of JAXA**
> **Prohibition of alteration:** Alterations that change the meaning or intent of the material are prohibited. (Examples of prohibited alteration: **alteration to length and width**, change or invert some of the colors, **trimming in such a manner as to change the meaning** of a photo or video, or inserting it into other material)

And the free-of-charge / no-application-needed scope, verbatim:

> **Free of charge / application not needed** — photos: Immediate use for newspaper or news; **Use for academic study at a public institution, formal education or learning activities**; Use at a museum or science museum; **The scope of personal use** …
> **needed** — videos and photos: Use for planning a program or a feature page; Publications (textbooks, reference books …); Use by JAXA's partner company (for PR, advertisements); **Other, uses for purposes that do not include being free of charge … or payment required**
> **payment required** — Cases in which it is judged that the user … will obtain profits or substantial gains from sales of a product using the material or by other means. (Examples: Use in a movie)

`https://global.jaxa.jp/policy.html` ("Site Policy", March 29, 2022) adds, verbatim:

> Unless otherwise stated, all materials, including texts, drawings, images, voice data, and video data, published on the Site (the "Materials") and the copyrights therein are the property of JAXA …
> … under copyright laws, you may use the Materials without obtaining permission of the copyright holder (JAXA) to the extent that your use is for the purpose of press (media) activity/scientific research/educational activity/and/or private use …
> **Your use of the Materials for business or commercial purposes without the prior permission of the copyright holder (JAXA) is strictly prohibited.**
> … please be aware that the following uses are not covered…: For using materials, including texts, drawings, images, voice data and video data, **that belong to other organizations apart from JAXA**.
> For using the JAXA logo. The JAXA logo is a registered trademark …
> You are strictly prohibited to use the Materials … for … Acts of supporting and/or promoting, or slandering and/or defaming the activity of a specific person/group/organization; Acts … contrary to public order and morals; Acts which are likely to cause misunderstanding about JAXA's operations …; Acts which are likely to damage JAXA's image and/or reputation …

`https://jda.jaxa.jp/service.php?lang=e` also states, verbatim, on third-party works:

> Works from providers other than JAXA cannot be provided by JAXA. When using, please check with each individual provider. (Example: NASA, etc.) If the source of an image or video is NASA, please follow the NASA Guidelines.

#### (ii) The HDTV dataset itself — JAXA **and NHK**, scientific/educational only

Verbatim from `SLN-L/E-HDTV-2-EDR-V1.0` `catalog/dataset.cat` (quoted in full in §B8):

> Unlike generic data set in planetary data system (PDS), this data set is copyrighted to **JAXA/NHK**, and opened for **scientific and educational purpose**. Users of this data set must inquire Japan Aerospace Exploration Agency for the other purposes.

#### Summary of the JAXA position (what I can state from verified sources)

1. **Attribution is mandatory** and must name both owners when jointly owned: for HDTV that means *"(C) JAXA/NHK"*, not "(C) JAXA". The JDA page's own example is `(C) JAXA/NAOJ`.
2. **Non-commercial educational / scientific / news / personal use is permitted without an application.**
3. **Commercial or profit-making use requires prior permission**, and a payment may be required. A public demo website is not obviously "personal use", and if it carries ads, branding, or is a product feature, it is a §"business or commercial purpose" — **the safe reading is that permission is required**.
4. **Alteration is restricted**: "alteration to length and width", colour changes, and meaning-changing trims are explicitly listed as prohibited. For a Three.js globe you will resize, re-tint and re-project — **treat this as needing permission**, or preserve an unaltered copy alongside.
5. **Redistribution needs permission**: "Distributing JAXA's photos and videos without first obtaining the permission of JAXA" is prohibited. Re-hosting the imagery in your own repo/CDN is redistribution.
6. The HDTV data is under an **additional, stricter** clause (JAXA/NHK, sci/edu only, inquire for anything else).

#### Where Kaguya imagery is distributed by USGS/NASA instead — and what that does *not* buy you

The following are on USGS/NASA infrastructure rather than JAXA's site:

- `planetarymaps.usgs.gov/mosaic/…` (USGS Astrogeology Science Center HTTP file service)
- `astrogeology.usgs.gov/search/map/…` (USGS Astrogeology "Astropedia" catalogue + CKAN resource downloads)

**However**, every one of the Kaguya SELENE products I checked on Astropedia carries an explicit JAXA credit *and* the JAXA conditions link. Verbatim from the TC orthomosaic page:

> For use, refer to the JAXA Conditions for material usage page ( http://jda.jaxa.jp/en/service.php ) and please credit JAXA and the SELENE/Kaguya data. ©JAXA/SELENE

and verbatim from the MI page:

> For usage rights, please refer to the JAXA Conditions for material usage page ( http://jda.jaxa.jp/en/service.php ) and please credit JAXA and the SELENE/Kaguya data. ©JAXA/SELENE

So **being hosted by USGS does not make Kaguya imagery public domain.** This is the opposite of, e.g., LROC/LOLA/Clementine products on the same site, which are NASA/USGS and public domain. Note the JDA page's own carve-out confirms the principle: "Works from providers other than JAXA cannot be provided by JAXA… If the source … is NASA, please follow the NASA Guidelines." The reverse case — JAXA work redistributed by USGS — is still JAXA work.

**Practical bottom line for the demo:** the *geometry* of Kaguya TC/MI is excellent for a Three.js globe, but the *licence* is the weak point. If the demo must be unencumbered, prefer a NASA/USGS public-domain lunar mosaic (e.g. LROC WAC on the same scale) and use Kaguya only with documented JAXA permission, or under a genuine fair-use/educational framing with the exact attribution strings below.

#### Recommended attribution strings

- Kaguya TC/MI mosaics (USGS-distributed): `Kaguya Terrain Camera (TC) global orthomosaic (474 m/pixel). Data: JAXA/SELENE. Processing: USGS Astrogeology Science Center. ©JAXA/SELENE`
- Kaguya HDTV stills (JAXA/NHK): `Kaguya (SELENE) HDTV imagery. (C) JAXA/NHK. Used for scientific/educational purposes.`
- Kaguya HDTV via DARTS: `SELENE (Kaguya) HDTV data, JAXA/NHK, via DARTS/ISAS-JAXA (dataset SLN-L/E-HDTV-2-EDR-V1.0)`
- JAXA press-release frames: `(C) JAXA/NHK`
- TC seamless tiles: `JAXA/SELENE (Kaguya) Terrain Camera ortho map seamless v2.0, JAXA DARTS`
- CDS HiPS layer: `Kaguya (SELENE) TC Evening mosaic — JAXA/SELENE; HiPS rendering by CDS (Université de Strasbourg/CNRS), ODbL-1.0`

---

## (c) Reachability ledger — verified vs. unreachable

### Verified reachable (HTTP 200/206, real bytes returned)

| Host / path | Result |
|---|---|
| `https://planetarymaps.usgs.gov/mosaic/…` | 206, real TIFF/JPEG bytes, `Content-Range` totals present |
| `https://astrogeology.usgs.gov/search/results?target=moon` | 206, `application/json`, 207,461 bytes |
| `https://astrogeology.usgs.gov/search/map/…` (TC/MI/DEM pages) | 200 |
| `https://astrogeology.usgs.gov/ckan/dataset/…/download/…` (browse JPEGs) | 206, JPEG |
| `https://astrogeology.usgs.gov/search/map/…xml` | 200 `text/xml` |
| `https://data.darts.isas.jaxa.jp/pub/…` (Apache index) | 200, full directory listings for `pds3/`, `sln-l_e-hdtv-2-edr-v1.0/`, `sln-l-tc-5-ortho-map-seamless-v2.0/`, `sln-l-mi-5-map-v3.0/` |
| `https://darts.isas.jaxa.jp/` and `/en/topics/2016/20160913topic` | 200 |
| `https://global.jaxa.jp/` (+ `/policy.html`, `/press/2007/11/…`, `/press/2008/10/…`, press JPEGs) | 206/200, real JPEG bytes |
| `https://jda.jaxa.jp/` and `https://jda.jaxa.jp/service.php?lang=e` | 200 |
| `https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-Evening-V04-474m/…` | 200 properties, 206 PNG tile |
| `https://pdsimage2.wr.usgs.gov/` | 206, HTML |

### Unreachable / blocked through this proxy (verified, not assumed)

| URL | Observed |
|---|---|
| `https://pds-imaging.jpl.nasa.gov/` | `403 \| text/html \| total=118 \| HTML` |
| `https://pds-imaging.jpl.nasa.gov/portal/kaguya_mission.html` | `403 \| text/html \| total=118` |
| `https://pds-imaging.jpl.nasa.gov/data/kaguya/` | `403 \| text/html \| total=118` |
| `https://l2db.selene.darts.isas.jaxa.jp/` (and `/index.html.en`) | `ERR_TLS_CERT_ALTNAME_INVALID fetch failed` — TLS certificate hostname mismatch, consistent with proxy MITM. **Not** a dead host. |
| `https://www.darts.isas.jaxa.jp/` | `ECONNRESET fetch failed` |
| `https://www.kaguya.jaxa.jp/en/index_e.htm` | `404 \| text/html \| total=212` (host resolves; that path is gone) |
| `https://planetarymaps.usgs.gov/mosaic/Lunar_MI_multispectral_maps/` and `…/Lunar_MI_mineral_maps/` | `404 application/xml` `NoSuchKey` — S3 directory listing disabled |
| `https://alasky.cds.unistra.fr/Planets/CDS_P_Moon_Kaguya-TC-Morning-V04-474m/properties` | `404 \| text/html \| total=324` |
| `https://pdsimage2.wr.usgs.gov/Archive/` and `…/Archive/Proj/planet/kaguya/` | `404` — the task-suggested path does not exist on this mirror |
| `https://astrogeology.usgs.gov/ckan/api/3/action/package_show?...` and `…/package_search?...` | `404 \| text/html` — the CKAN **API** is not exposed, only `/ckan/dataset/<uuid>/resource/<uuid>/download/<file>` |
| `https://global.jaxa.jp/terms/`, `/terms/usage.html`, `/countdown/footer.html` | `404` (20,723-byte error page) |
| `https://global.jaxa.jp/about/ip_policy/index_e.html` | linked from `/about/` but **not probed** |
| `https://www.lpi.usra.edu/…` (referenced by USGS pages) | known-blocked per task brief; not re-probed (only linked, never fetched) |
| `https://images-assets.nasa.gov/…`, `https://commons.wikimedia.org/`, `http(s)://astropedia.astrogeology.usgs.gov/` | known-blocked per task brief; not re-probed |

**Blockers to report:**

1. **`pds-imaging.jpl.nasa.gov` is 403** — the canonical PDS Kaguya portal and its data tree are unreachable from this machine. Every Kaguya PDS need was met instead via `data.darts.isas.jaxa.jp/pub/pds3/`, which serves the same PDS3 volumes over a plain Apache index. This is a **better** mirror for scripting, and it was the key unlock for this research.
2. **`l2db.selene.darts.isas.jaxa.jp` fails on TLS** (`ERR_TLS_CERT_ALTNAME_INVALID`) even though it is the URL USGS and CDS cite for Kaguya data. Workaround used: `data.darts.isas.jaxa.jp` (different host, valid cert) plus `darts.isas.jaxa.jp`.
3. **`planetarymaps.usgs.gov` S3 buckets forbid directory listing**, so the MI multispectral/reflectance GeoTIFF filenames cannot be discovered — only the exact filenames printed in USGS page metadata work. The MI 237 m reflectance `Online File Link` is a directory that 404s, so **that full-resolution product has no verified direct URL**.
4. **`undici` is absent**, so the `ProxyAgent` fallback inside the provided helper scripts is dead code; `NODE_USE_ENV_PROXY=1` is mandatory.
5. **BigTIFF breaks the provided `probe2.mjs`** dimension reader (it prints `-` for `49492b00` files). Both MI 59 m and the LOLA-Kaguya DEM are BigTIFF. I added `.agents/research/tools/bigtiff.mjs` to read them.

---

## (d) Files added by this research

- `.agents/research/tools/bigtiff.mjs` — BigTIFF/classic-TIFF header prober (parses `magic 42` and `magic 43`, 8-byte offsets, 20-byte IFD entries; reports true width/height/bits/samples through the proxy).
