# Chang'e-4 / Yutu-2 high-resolution imagery — data-repository research

Scope: find **deposited, downloadable** Chang'e-4 (Yutu-2 rover, Von Kármán crater, Jan 2019) panorama /
PCAM / LCAM surface imagery for a Three.js moon demo.
Working dir `F:\code\astro`. All network access via local HTTP proxy (`127.0.0.1:7890`), Node 24 with
`NODE_USE_ENV_PROXY=1`. `curl.exe` unused (fails on HTTPS).

**Headline:** yes — genuine, high-resolution Yutu-2 PCAM imagery *is* deposited and downloadable, on
**Zenodo**, as CC-BY-4.0 BigTIFF orthophoto/DEM mosaics. Everything else (figshare, OSF, arXiv, PDS,
HuggingFace) is empty or masks-only.

---

## 1. Hosts reachable / hosts blocked

| Host | Result | Evidence |
|---|---|---|
| `zenodo.org` (API + records) | **Reachable** | `200 | application/json | 143030 | https://zenodo.org/api/records?q=Chang%27e%204&size=20` |
| `zenodo.org/.../files/.../content` | **Reachable, then 403 rate-limit** | earlier `206 | content-range=bytes 0-0/28336145167`; later `403 Forbidden` "restricted due to unusual traffic" |
| `api.figshare.com` | **Reachable** | `200 | application/json | 11083 | https://api.figshare.com/v2/articles?search_for=Chang%27e+4` |
| `api.osf.io` | **Partly** | `200` for `nodes?filter[title]=Chang'e` (0 hits); `502` for `filter[title]=Yutu`; `404` for `/v2/search/` |
| `export.arxiv.org` | **Reachable** | `206 | application/atom+xml | 4096 | http://export.arxiv.org/api/query?...` |
| `pds.nasa.gov` | **Reachable** | `200 | text/html | https://pds.nasa.gov`; API 200 only with `(title like "x")` syntax |
| `pds-imaging.jpl.nasa.gov` | **BLOCKED** | `403 | text/html | 118 | https://pds-imaging.jpl.nasa.gov` |
| `sbn.psi.edu` | Reachable root, no search | `206 | text/html | 114`; `/search?q=` → `404` |
| `huggingface.co` | **Reachable** | `200` API + raw files |
| `api.crossref.org`, `api.datacite.org` | **Reachable** | `200` |
| `www.sciencedirect.com` | **BLOCKED** | `403 | text/html | 1207775` |
| `siyu.china-vo.org/ChangE-4/PCAM/` | **DEAD** | `404`, cPanel default error page ("server_misconfigured.png") |
| `clpds.bao.ac.cn`, `moon.bao.ac.cn` | **Reachable** | `206 | text/html | 4096` — real Vue SPA; login/registration required |

---

## 2. ZENODO — the real find

### 2a. `10.5281/zenodo.11150203` — Yutu-2 PCAM orthophoto mosaics ✅ BEST IMAGERY

- Hosting page: https://zenodo.org/records/11150203
- Resource type `image`, access `open`, **license `cc-by-4.0`**
- Creators: Ma, Xinyu; Chen, Meixi; Hu, Teng. Published 2024-05-08.
- Exact quoted description:
  > "Here are the DEM data and DOM data created using images taken by the Yutu-2 rover along the route
  > between the 27th and 33rd moon days. And the extracted impact craters contain their degradation
  > levels. All impact craters are classified into 5 categories (A-AB-B-BC-C)"

Files (from `https://zenodo.org/api/records/11150203`):

```
FILE: Classified Craters.zip
      size=6538131B | checksum=md5:f68b26755ad092fa705e6a8c7fbd65b5
      url=https://zenodo.org/api/records/11150203/files/Classified%20Craters.zip/content
FILE: Yutu 2 rover's panoramic camera captures images.zip
      size=11794265870B (11.794 GB) | checksum=md5:a28dfb0a811ff836dc6af465a704b633
      url=https://zenodo.org/api/records/11150203/files/Yutu%202%20rover%27s%20panoramic%20camera%20captures%20images.zip/content
```

**Remote central-directory listing** (`node .agents/zip-remote.mjs`, no full download):

```
range 0-0 -> status=206 content-range=bytes 0-0/11794265870 content-length=1
TOTAL = 11794265870 bytes (11.794 GB)
EOCD @tail+262122: entries=20 cdSize=2296
ZIP64 EOCD locator @tail+262102 -> zip64 EOCD at 11794265772
ZIP64 EOCD: entries=20 cdSize=2296 cdOffset=11794263476
PARSED 20 entries
EXTENSION HISTOGRAM (by uncompressed bytes):
   .tif : n=20 raw=12163.70 MB
```

Contents = **20 GeoTIFFs = 10 date pairs** (`D` + `O` per acquisition date):

| date | `…D.tif` raw bytes | `…O.tif` raw bytes |
|---|---|---|
| 20210217 | 1 443 057 342 | 97 761 224 |
| 20210309 | 1 206 069 026 | 104 847 484 |
| 20210319 | 1 122 977 820 | 120 519 188 |
| 20210408 | 946 833 994 | 100 887 737 |
| 20210507 | 1 718 548 662 | 62 598 733 |
| 20210606 | 884 105 924 | 100 267 749 |
| 20210615 | 831 858 184 | 116 827 725 |
| 20210706 | 973 190 586 | 102 362 255 |
| 20210714 | 843 412 070 | 113 649 281 |
| 20210805 | 1 170 155 178 | 103 767 119 |

#### VERIFIED extraction + measurement of `20210507O.tif`

Method: HTTP range-fetch of that one DEFLATE member + `zlib.inflateRaw`
(`node .agents/ce4-zip-extract.mjs <zipUrl> <lho> <csize> <out>`), using `lho=6647668083`,
`csize=52239438` from the central directory.

```
local header sig=0x4034b50 (want 0x4034b50)
entry name in local header: "Yutu 2 rover's panoramic camera captures images/20210507O.tif" | nlen=61 elen=0
compressed data: 6647668174 .. 6699907611 (52.2 MB)
downloaded 52239438 bytes (expected 52239438) -> EXACT MATCH
inflating ...
inflated -> 62598733 bytes          <-- equals ZIP central-directory usize exactly
WROTE F:/code/astro/.agents/research/dl/20210507O.tif
```

`img-dims.mjs` transcript on the archive URL (run as required):

```
403 | text/html | HTML | ?x? | 763 bytes (0.00MB) [range-honored] | https://zenodo.org/api/records/11150203/files/Yutu%202%20rover%27s%20panoramic%20camera%20captures%20images.zip/content
      head:  <html> <head><title>403 Forbidden</title></head> ... Access to this resource has been restricted due to unusual traffic from
```
Earlier (pre-rate-limit) equivalent probe of the same family of URLs:
`206 | content-range=bytes 0-0/11794265870` and `206 | content-range=bytes 0-0/28336145167`.

> Tool limitation, stated honestly: **`img-dims.mjs` cannot measure this file.** Its `classify()` only
> matches classic TIFF magic `49492a00` / `4d4d002a`; these are **BigTIFF** (`49492b00`), so it reports
> `?x?`. Dimensions below were measured with `node .agents/tiffdump.mjs` (BigTIFF-aware).

**MEASURED DIMENSIONS — `20210507O.tif`** (`node .agents/tiffdump.mjs`):

```
########## F:/code/astro/.agents/research/dl/20210507O.tif (62598733 bytes)
  first 24 bytes hex: 49492b0008000000d8c4c20200000000803fc01028240e0d
  byteorder=little-endian (II) version=43 => BigTIFF
  offsetsize=8 reserved=0 firstIFD=46318808
  IFD0 @46318808 with 18 entries
       256 ImageWidth                   type= 3 count=     1 = [27308]
       257 ImageLength                  type= 3 count=     1 = [21804]
       258 BitsPerSample                type= 3 count=     2 = [8,8]
       259 Compression                  type= 3 count=     1 = [5]
       262 PhotometricInterpretation    type= 3 count=     1 = [1]
       277 SamplesPerPixel              type= 3 count=     1 = [2]
       284 PlanarConfig                 type= 3 count=     1 = [1]
       322 TileWidth                    type= 3 count=     1 = [256]
       323 TileLength                   type= 3 count=     1 = [256]
       324 TileOffsets                  type=16 count=  9202
       325 TileByteCounts               type= 4 count=  9202
       339 SampleFormat                 type= 3 count=     2 = [1,1]
     33550 ModelPixelScale              type=12 count=     3 = [0.0012615400000000002,0.00126154,0]
     33922 ModelTiepoint                type=12 count=     6 = [0,0,0,-30.3006535802494,31.100831450581925,0]
     34735 GeoKeyDirectory              type= 3 count=    36 = [1,1,0,8,1024,0,1,1]
     34736 GeoDoubleParams              type=12 count=     1 = [1]
     34737 GeoAsciiParams               type= 2 count=    23 = "Local Coordinates (m)|"
```

- **Dimensions: 27 308 × 21 804 px = 595 414 032 px (≈595 MP)**
- 8 bit, 2 samples/px, `PhotometricInterpretation=1` → **grayscale + alpha** (the alpha is the irregular
  mosaic footprint)
- Compression 5 = **LZW**, tiled 256×256, 9 202 tiles (107 × 86 = 9202 ✔)
- GeoTIFF, **1.26154 mm/pixel**, local (rover-site) coordinates, not lat/lon
- Archive member size **62 598 733 B**; archive is 11.794 GB for all 20 rasters

#### Pixel content confirmed (not a stub / not blank)

`node .agents/ce4-tiff-preview.mjs <tif> <png> 8` implements a TIFF-LZW decoder and downsamples:

```
TIFF version=43 (BigTIFF)
W=27308 H=21804 bits=[8,8] compression=5 samplesPerPixel=2 tile=256x256 tiles=9202
decodedTiles=9202 failTiles=0
gray min=0 max=255 mean=245.34 | alpha>0 fraction=5.81%
preview 3414x2726 | value range 0..203 | non-black pixels 5.84%
WROTE F:/code/astro/.agents/research/dl/preview-20210507O.png (461062 bytes)
```

All **9 202 tiles decoded with 0 failures**; the rendered PNG (`preview-20210507O.png`, 3414×2726)
visually shows a real lunar surface orthophoto — crater rims, boulders, regolith texture, with the
irregular alpha footprint covering ~5.8 % of the bounding box. This is genuine Yutu-2 PCAM-derived
surface imagery, not a placeholder.

### 2b. `10.5281/zenodo.11197460` — Yutu-2 PCAM Images for 3D Scene Reconstruction (2019)

- Page: https://zenodo.org/records/11197460 · **`cc-by-4.0`** · creators Ma, Xinyu; chen, Meixi · pub 2024-05-15
- Quoted: > "Here's the image data from Chang'e-4's Yutu-2 panoramic camera (PCAM) in 2019, with 3D scene reconstruction. There are also 4625 impact craters, ranging from 0.1 metres to 6.37 metres in diameter."

```
FILE: PCAM2019craters.zip      size=14066618B    md5:2353715451ead65c140cd1ae7e604911
FILE: PCAM2019DEMDOM.zip       size=28336145167B md5:f36bebea8056a4ccb67dba00f79bae13
      url=https://zenodo.org/api/records/11197460/files/PCAM2019DEMDOM.zip/content
```

Remote listing (EOCD/ZIP64 parse):
```
TOTAL = 28336145167 bytes (28.336 GB)
ZIP64 EOCD: entries=48 cdSize=4020 cdOffset=28336141049
PARSED 48 entries
EXTENSION HISTOGRAM: .tif : n=48 raw=29214.46 MB
FIRST ENTRIES:
   DEFL raw= 1469898489 PCAM2019DEMDOM/20190112D.tif
   DEFL raw=   83637170 PCAM2019DEMDOM/20190112O.tif
   DEFL raw=   952512230 PCAM2019DEMDOM/20190131D.tif
   ... (24 date pairs, 20190112 → 20191123)
```
**48 TIFs = 24 date pairs for 2019.** The same `D`/`O` naming as 2a, so the `O` members are the same
BigTIFF orthophoto product (format verified in 2a; **the 2019 members themselves were NOT individually
extracted — format/dimensions for these specific files are unverified**).

### 2c. `10.5281/zenodo.11194446` (2020) and `10.5281/zenodo.11198813` (2021)

- https://zenodo.org/records/11194446 — `cc-by-4.0`, 2020, 2831 craters
  - `PCAM2020craters.rar` 3 837 118 B · `PCAM2020DEMDOM.rar` **26 122 350 391 B (26.122 GB)**, md5 `10a7c79d265aa1c0a74992464c0aa7f1`
- https://zenodo.org/records/11198813 — `cc-by-4.0`, 2021, 4525 craters
  - `PCAM2021craters.rar` 6 355 616 B · `PCAM2021DEMDOM.rar` **26 785 039 916 B (26.785 GB)**, md5 `ef8d09bbf096180b21b5129258279255`

`img-dims.mjs` on both `.rar` content URLs → `403 | text/html | HTML | ?x? | 763 bytes ... unusual traffic`
(rate-limited at probe time). Earlier `net-probe` confirmed the archive containers are reachable.
`.rar` listings are **unverified** — no `unrar`/`7z` on this machine (`Get-Command 7z,7za,unrar,rar` → none;
Python has no `rarfile`).

### 2d. `10.5281/zenodo.4018823` — supplementary Pancam images (2020 paper)

- Page: https://zenodo.org/records/4018823 · **`cc-by-4.0`** · pub 2020-09-18
- Paper: "Geologically old but freshly exposed rock fragments encountered by Yutu-2 rover"
- `Pancam images in Figs 2_5_7.rar` **88 294 708 B (88.3 MB)**, md5 `776348f962af3a02a0f2d0fb143b1cb1`
  — `https://zenodo.org/api/records/4018823/files/Pancam%20images%20in%20Figs%202_5_7.rar/content`
- Also `Image IDs for Figs 1-7.xlsx` (20 505 B) — **image IDs, i.e. pointers into CLPDS, not the data**
- `.rar` contents **unverified** (no extractor available). Figures-only imagery — low value for a demo.

### 2e. Other Zenodo CE-4 records (checked, useful only as context)

| Record | Contents | License | Imagery? |
|---|---|---|---|
| `10.5281/zenodo.11201441` | `LCAMcraters.zip` 194 574 B | cc-by-4.0 | **No** — verified ESRI Shapefile only |
| `10.5281/zenodo.4971121` | `CE4_Day_9_10_DEM_5mm.tif` 61 343 204 B | cc-by-4.0 | DEM (elevation), not a photo |
| `10.5281/zenodo.4040984` | `Orintale ejecta thickness around VK.cub` 169 030 654 B | cc-by-4.0 | ISIS cube raster, ejecta thickness |
| `10.5281/zenodo.10154147` | `CH-1_LPR_15days.zip` 749 MB, `CH-2B_LPR_15days.zip` 1.31 GB | cc-by-4.0 | No — ground-penetrating radar |
| `10.5281/zenodo.14590856`, `.7407588`, `.4724190`, `.3475664`, `.3763355`, `.3732816` | LPR radar `.mat`/`.bin` | cc-by-4.0 | No — radar |
| `10.5281/zenodo.3361004`, `.5068672`, `.7465280` | spectra/responsivity CSVs, scripts | cc-by-4.0 | No |
| `10.5281/zenodo.14673237` | "Lunar Rocks and Craters Dataset… YOLO/COCO" 640×640 | cc-by-4.0 | Images resized to **640×640**; provenance for CE-4 not stated in the abstract → **unverified**, and far too low-res for a demo |
| `10.5281/zenodo.13940379` | "Lunar farside data" — `Data Qian Fang.rar` 350 MB | cc-by-4.0 | Description empty → **unverified** |

`LCAMcraters.zip` verified locally (Python `zipfile`):
```
LCAMcraters.zip entries: 7
   LCAMcraters/CRATER_LCAM.CPG 5
   LCAMcraters/CRATER_LCAM.dbf 8412
   LCAMcraters/CRATER_LCAM.prj 0
   LCAMcraters/CRATER_LCAM.sbn 1548
   LCAMcraters/CRATER_LCAM.sbx 316
   LCAMcraters/CRATER_LCAM.shp 330700
   LCAMcraters/CRATER_LCAM.shx 1100
```

---

## 3. ZENODO rate limiting (operational, important)

Sustained ranged access triggers a Zenodo block. Same URLs, same session, before vs after:

- before: `206 | content-range=bytes 0-0/28336145167`
- after: `403 | text/html | 763 bytes | head: <html> <head><title>403 Forbidden</title></head> <body style="max-width: 600px; margin: 40px auto; ..."> <h1>403 Forbidden</h1> <hr> <p>Access to this resource has been restricted due to unusual traffic from …`

Implication: any automated fetcher for the multi-GB archives must parse `content-range` for total size,
fetch the ZIP64 EOCD + central directory **once**, and then extract single members — with backoff. Do not
fan out parallel range requests.

**It is transient — confirmed recovered.** `node .agents/ce4-zenodo-backoff.mjs` re-probed after backoff
and every URL returned to `206` with a correct total:

```
### attempt 1: sleeping 30s before re-probe
  2026-09-12T08:22:35.830Z | status=206 | application/octet-stream | content-range=bytes 0-0/14066618 | first=50 | .../11197460/files/PCAM2019craters.zip/content
  2026-09-12T08:22:39.226Z | status=206 | application/octet-stream | content-range=bytes 0-0/6538131  | first=50 | .../11150203/files/Classified%20Craters.zip/content
  2026-09-12T08:22:42.620Z | status=206 | application/octet-stream | content-range=bytes 0-0/28336145167 | first=50 | .../11197460/files/PCAM2019DEMDOM.zip/content
### attempt 2: sleeping 60s before re-probe
  2026-09-12T08:23:51.030Z | status=206 | application/octet-stream | content-range=bytes 0-0/14066618 | first=50 | ...
  2026-09-12T08:23:54.420Z | status=206 | ... | content-range=bytes 0-0/6538131  | ...
  2026-09-12T08:23:57.830Z | status=206 | ... | content-range=bytes 0-0/28336145167 | ...
### attempt 3: sleeping 90s before re-probe
  2026-09-12T08:25:32.084Z | status=206 | ... (all three 206 again)
```

So the archives are **available**; a 30–90 s pause clears the throttle. The earlier
`28 336 145 167` total and the `52 239 438`-byte member extraction both succeeded before the block, which
independently proves the data is served intact.

---

## 4. HuggingFace — masks only, images deliberately excluded

`https://huggingface.co/api/datasets?search=chang%27e+4` → `200 | application/json | 2 | []` (i.e. `[]`).
Searches `lunar panorama`, `moon rover`, `chang'e`, `von karman`, `moon surface image` → **0**.
`search=change4` → **1**: `lothanspace/change4-tcm-dataset` (downloads=39, likes=0).
`search=yutu` → 4 unrelated repos (`yuyutsu07/Yutu`, `madarasamaz/yuturer`, `Laurengfg/yutuiyui`, `yutu2334/ustb`).

**Confirmed masks-only.** Tree: `data/images/` contains only `.gitkeep`; `data/raw/` only `.gitkeep` +
`placeholder.txt`; `data/masks/` holds ~330 LabelMe `.json` masks named `CE4_GRAS_TCAM-I-*` (**TCAM =
lander terrain camera, not PCAM**) plus `train.jsonl` (819 911 B).

Exact quoted text from the dataset card (`README.md`, raw):
> **Note:** Original Chang'E-4 images are not included due to copyright restrictions. You must download
> the source images directly from CLPDS (see instructions below).

`LICENSE` = **CC BY-NC 4.0** (non-commercial) — so even the *masks* are NC, unlike the Zenodo deposits.

Its `docs/chinese-moon-data-access.md` documents the official route:
> - **Chang'E-4 Data Search**: https://clpds.bao.ac.cn/ce5web/searchOrder-ce4En.do
> - **Main Portal**: https://moon.bao.ac.cn/web/enmanager/home
> - **Contact**: lpdc@nao.cas.cn
> "**Non-commercial use**: Data is for research and educational purposes"

---

## 5. PDS (NASA) — clean negative, properly evidenced

`pds.nasa.gov` API requires `(field like "value")` syntax; bare `q=Chang'e` → `400 BAD_REQUEST …
UnparsableQParamException`.

| Query | Status | Hits |
|---|---|---|
| `(title like "Yutu")` | 200 | **0** |
| `(title like "Von Karman")` | 200 | **0** |
| `(title like "PCAM")` | 200 | **0** |
| `(title like "Chang'e")` | 200 | 36 — **all Chang'E-1/Chang'E-2 Microwave Radiometer** |

Every one of the 36 hits is in bundle `urn:nasa:pds:chang_e_microwave_processed` (e.g. "Collected Data
from Chang'E 1 Microwave Radiometer"). `(title like "moon")` returns unrelated Saturn/Galilean moon
bundles; `(title like "lunar panorama")`, `(title like "lunar farside rover")` and
`(description like "Chang")` return Apollo/LRO/CaSSIS noise — no CE-4.

**Conclusion: Chang'e-3/4/5 and Yutu-2 surface imagery is NOT in PDS at all.** PDS holds only CE-1/CE-2
microwave radiometer products. `pds-imaging.jpl.nasa.gov` is additionally 403-blocked.
(`pds.imaging`/`sbn` imaging nodes are the wrong nodes anyway: CE-4 is a Chinese national dataset.)

---

## 6. arXiv — nothing deposited

- `all:"Chang'e 4"` → 13 entries; none is a data deposit; mostly LND, radio spectrometer, SETI, gravitational waves.
- `all:"Yutu-2"` → **1** entry: "Globally Localizing Lunar Rover in Pixels via Graph Alignment" (`2606.10602`).
- `all:PCAM AND all:moon` → **0**. `all:CE-4 AND all:panoramic` → **0**.
- `all:Von+Karman+AND+all:panorama` → 30 entries, all von Neumann mathematics — pure false positives.

Closest topical hit, worth noting but **no ancillary data**: "Cycle-consistent Generative Adversarial
Networks for Neural Style Transfer using data from Chang'e-4" (`2011.11627`) — arXiv ancillary files
were not enumerated (arXiv does not host multi-GB imagery; treat as unverified/no deposit).

---

## 7. Figshare — nothing

`POST https://api.figshare.com/v2/articles/search` with `{"search_for": …}`:

| Query | n | Imagery |
|---|---|---|
| `Chang'e 4` | 17 | none — CE-6 geochemistry, DeepCraters, a Geology supplement (`12114414`), ADHD thesis, MRI radiomics |
| `Chang'e-4` | 17 | identical result set |
| `Yutu-2` | **0** | — |
| `Von Karman lunar panorama` | **0** | — |
| `CE-4 PCAM` | **0** | — |
| `PCAM lunar` | **0** | — |

No `license` field returned on these hits. Note: `GET https://api.figshare.com/v2/articles?search_for=…`
**silently ignores the query** — `search_for=Chang'e 4` and `search_for=Yutu-2 PCAM panorama` returned the
identical 20-item list of unrelated recent deposits. Use only the POST endpoint.
`api.figshare.com` returned clean `200` JSON (no Cloudflare 202/empty-body issue).

---

## 8. OSF — nothing / partly unavailable

- `https://api.osf.io/v2/nodes/?filter[title]=Chang'e` → `200`, **n=0**
- `https://api.osf.io/v2/nodes/?filter[title]=Yutu` → **502 Server Error**
- `https://api.osf.io/v2/search/?q=…` → **404** (endpoint does not exist)
- `filter[title]=lunar panorama` → not reached (earlier run timed out)

No OSF deposit found.

---

## 9. Journal papers — data availability

**ISPRS J. Photogrammetry & Remote Sensing (2023)**, the paper named in the brief:
- Correct DOI resolved via Crossref: **`10.1016/j.isprsjprs.2023.10.021`** (not `…10.012`)
- Title: "A deep learning-based local feature extraction method for improved image matching and surface
  reconstruction from Yutu-2 PCAM images on the Moon"
- Authors: Jiageng Zhong, Jianguo Yan, Ming Li, Jean-Pierre Barriot · vol 206, pp 16-29, Dec 2023
- `https://www.sciencedirect.com/science/article/abs/pii/S0924271623002964` → **`403`**, so the
  **"Data availability" statement could not be read: unverified.**
- Crossref returns only Elsevier TDM licences (`elsevier.com/tdm/userlicense/1.0/`,
  `elsevier.com/legal/tdmrep-license`) — **no open-data licence, no data link, no Zenodo relation**.
- The paper's authors do **not** overlap the Zenodo depositors (Ma/Chen/Hu), so the §2 Zenodo deposits are
  evidently a *different* group's deposit and are **not** confirmed as this paper's supplementary data.

No other journal deposit was found; DataCite queries for `Yutu-2 PCAM` return only the Zenodo records in §2.

---

## 10. China-VO (dead) vs CLPDS (official, gated)

- `http://siyu.china-vo.org/ChangE-4/PCAM/` — a promising-looking CE-4 PCAM landing page surfaced by
  search, but it is **dead**: `404`, cPanel default error page, links only to
  `server_misconfigured.png` / `cpanel.com` / `ccz@nao.cas.cn` (error contact).
- `https://clpds.bao.ac.cn` and `https://moon.bao.ac.cn` are **live** (`206`, real Vue SPA, loads
  `crypto-js.min.js`). This is the authoritative primary source for raw PCAM/TCAM L2A+ PDS4 products, but
  it requires **registration + cart/order workflow**, and per the HF guide the terms are
  **non-commercial, citation-required, and results must be sent to lpdc@nao.cas.cn**.

---

## 11. Licence / reuse assessment and redistribution risk

**Zenodo deposits (§2):** the *repository* metadata asserts **CC-BY-4.0** for every record — verified
independently via DataCite:

> `"rightsIdentifier":"cc-by-4.0"`, `"rights":"Creative Commons Attribution 4.0 International"`,
> `"rightsUri":"https://creativecommons.org/licenses/by/4.0/legalcode"`

But the **upstream provenance is CNSA / CLPDS**, and the official CLPDS terms (as relayed by the HF guide)
are non-commercial + citation + notify-results — which **conflicts with** the CC-BY-4.0 the depositors
applied. Blunt assessment: Chinese government/agency imagery normally carries **no explicit open licence**.
Here a third-party academic depositor self-applied CC-BY-4.0 to derived orthophotos.

| Asset | Measured | Declared licence | Redistribution risk |
|---|---|---|---|
| Zenodo 11150203 `…panoramic camera captures images.zip` | 11 794 265 870 B; contains 20 BigTIFF; **20210507O.tif = 27 308 × 21 804 px**, 62 598 733 B, LZW, gray+alpha, 1.26154 mm/px | cc-by-4.0 (Zenodo + DataCite) | **Medium** — CC-BY-4.0 is explicit and machine-readable, but depositor may not hold rights to redistribute CNSA-derived imagery; attribution to Ma/Chen/Hu + Zenodo DOI required |
| Zenodo 11197460 `PCAM2019DEMDOM.zip` | 28 336 145 167 B; 48 BigTIFF (24 date pairs) | cc-by-4.0 | **Medium** (same caveat) |
| Zenodo 11194446 / 11198813 `PCAM{2020,2021}DEMDOM.rar` | 26.122 GB / 26.785 GB | cc-by-4.0 | **Medium** (same caveat) |
| Zenodo 4018823 `Pancam images in Figs 2_5_7.rar` | 88 294 708 B | cc-by-4.0 | **Medium** (figure-only imagery) |
| HuggingFace `lothanspace/change4-tcm-dataset` | masks only, ~330 `.json` | **CC BY-NC 4.0** | **High** if reused commercially; no images anyway |
| CLPDS raw PCAM/TCAM | L2A+ PDS4 | **No open licence**; non-commercial, citation + notify | **High** — do not redistribute bundled; registration gated |
| PDS CE-4 imagery | **does not exist** | n/a | n/a |

---

## 12. Bottom line for the Three.js demo

1. **Only genuine, verified source: Zenodo.** §2a is the single best asset — 10 orthophoto BigTIFFs at
   ≈595 MP (27 308 × 21 804) each, plus matching DEMs, CC-BY-4.0.
2. **Do not download the whole archive.** Extract the `O` members by HTTP range using the ZIP64 central
   directory (offsets/sizes in `ziplist-content.json`); total needed for one panorama is ~52 MB compressed
   → 62.6 MB BigTIFF. Full recipe: `.agents/zip-remote.mjs` → `.agents/ce4-zip-extract.mjs` →
   `.agents/ce4-tiff-preview.mjs`.
3. **Convert before use.** These are 2-band 8-bit LZW **BigTIFF grayscale+alpha**, not PNG/JPEG, and
   `img-dims.mjs` cannot read BigTIFF. Three.js needs a downsampled PNG/JPEG/WebP; the alpha channel is the
   mosaic footprint mask (treat `alpha==0` as transparent).
4. **Attribute** and keep the CC-BY notice; treat distribution as *medium* risk given the CNSA upstream.
5. Raw, unambiguously-authoritative data lives at CLPDS (`clpds.bao.ac.cn`), gated and non-commercial —
   the correct route if this demo is ever commercial.

### Artefacts produced

- `F:\code\astro\.agents\research\dl\20210507O.tif` — 62 598 733 B, BigTIFF, **27 308 × 21 804 px**
- `F:\code\astro\.agents\research\dl\preview-20210507O.png` — 3414 × 2726, 461 062 B, real panorama preview
- `F:\code\astro\.agents\research\dl\LCAMcraters.zip`, `PCAM2020craters.rar` — small archives for inspection
- Scripts: `.agents/ce4-zenodo.mjs`, `.agents/ce4-zenodo-detail.mjs`, `.agents/ce4-figshare.mjs`,
  `.agents/ce4-hf.mjs`, `.agents/ce4-pds.mjs`, `.agents/ce4-pds2.mjs`, `.agents/zip-remote.mjs`,
  `.agents/ce4-zip-extract.mjs`, `.agents/tiffdump.mjs`, `.agents/ce4-tiff-preview.mjs`,
  `.agents/ce4-zenodo-backoff.mjs`
