# Chang'e 4 / Yutu-2 high-resolution farside imagery — research notes

**Researcher:** DSH subagent · **Date of research session:** this session
**Target:** downloadable high-resolution imagery of the Chang'e 4 farside landing (Yutu-2 rover, Von Kármán crater) for a Three.js moon demo.
**Working dir:** `F:\code\astro` (Windows, PowerShell 7)

---

## 0. CRITICAL ENVIRONMENT CORRECTION (read this first)

The task brief stated that the local HTTP proxy `http://127.0.0.1:7890` was the only route out, and
listed four hosts as "KNOWN BLOCKED". **That list is wrong.** The earlier failures were a *tooling*
bug, not a network block: Node's global `fetch` does **not** read `HTTP_PROXY`/`HTTPS_PROXY` on its own.

**The fix — every node command needs `NODE_USE_ENV_PROXY=1`:**

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"; node <script>
```

### Re-verification of the "blocked" hosts (all WORKING)

```
206 | image/jpeg | 4096      | JPEG | https://images-assets.nasa.gov/image/PIA23383/PIA23383~orig.jpg
200 | text/html | -          | HTML | https://www.lpi.usra.edu/
200 | text/html | 150439     | HTML | https://commons.wikimedia.org/wiki/Category:Chang%27e_4
206 | image/jpeg | 4096      | JPEG | https://upload.wikimedia.org/wikipedia/commons/1/1b/The_first_panorama_from_the_far_side_of_the_moon.jpg
```

| Host from brief | Brief said | **Actual result** |
|---|---|---|
| `images-assets.nasa.gov` | 403 | **206 OK** — downloads fine |
| `www.lpi.usra.edu` | 403 | **200 OK** |
| `commons.wikimedia.org` | connection timeout | **200 OK** (full HTML, 150 KB) |
| `upload.wikimedia.org` | "sometimes works" | **206 OK** — works reliably |

**Only genuinely unavailable host found:** `www.iau.org` returns **404** for the image-detail URL
(the page has moved). Its archive mirror `iauarchive.eso.org` returns **200** and serves the
originals — use that instead.

**Rate limiting is real on Wikimedia.** Rapid successive requests to `upload.wikimedia.org` return
HTTP **429** with an HTML "Wikimedia Error" page (which `net-probe` reports as `HTML`, not an image).
Space out requests; a 429 is not a block.

---

## 1. Headline results — the best available files

### 1.1 The famous 11 January 2019 farside panorama — HIGHEST RESOLUTION RELEASE FOUND

The panorama was made from PCAM (panoramic camera) images and released by CNSA/CLEP, distributed
internationally **15 February 2019** via the International Astronomical Union as image **`iau1901a`**.

**Both the JPEG and the TIFF are 10000 × 1229 px.** There is no larger version of this composite
in any source I could find. (See §1.5 for the alternative: build a bigger one yourself from raw frames.)

| Format | Direct URL | Dimensions (measured) | Bytes | Notes |
|---|---|---|---|---|
| **TIFF (original)** | `https://iauarchive.eso.org/static/archives/images/original/iau1901a.tif` | **10000 × 1229** | **20,995,646** | IAU "original"; lossless |
| TIFF (publication 10k) | `https://iauarchive.eso.org/static/archives/images/publicationtiff10k/iau1901a.tif` | **10000 × 1229** | 21,784,359 | re-encoded, same pixels |
| **JPEG (large)** | `https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg` | **10000 × 1229** | **3,346,126** | best size/quality tradeoff |
| JPEG (publication) | `https://iauarchive.eso.org/static/archives/images/publicationjpg/iau1901a.jpg` | 4000 × 492 | 619,216 | downscaled |
| JPEG (screen) | `https://iauarchive.eso.org/static/archives/images/screen/iau1901a.jpg` | 1280 × 157 | 69,245 | thumbnail |

**Probe transcripts (measured, not guessed):**

```
200 | image/tiff | tiff | 10000x1229 | 20995646 bytes (20.02MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/original/iau1901a.tif
200 | image/tiff | tiff | 10000x1229 | 21784359 bytes (20.78MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/publicationtiff10k/iau1901a.tif
206 | image/jpeg | jpeg | 10000x1229 | 3346126 bytes (3.19MB) [range-honored]  | https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg
206 | image/jpeg | jpeg | 4000x492   | 619216 bytes (0.59MB) [range-honored]   | https://iauarchive.eso.org/static/archives/images/publicationjpg/iau1901a.jpg
206 | image/jpeg | jpeg | 1280x157   | 69245 bytes (0.07MB) [range-honored]    | https://iauarchive.eso.org/static/archives/images/screen/iau1901a.jpg
```

- **Source page:** `https://iauarchive.eso.org/public/images/detail/iau1901a/` (HTTP 200)
  — the canonical `https://www.iau.org/public/images/detail/iau1901a/` is **404 (dead)**.
- **Format note:** 10000×1229 is an ~8.1:1 **cylindrical** strip, not an equirectangular 2:1.
  For a Three.js `SphereGeometry`/`equirectangular` skybox you must pad vertically or remap.

#### Visual inspection of the panorama (I downloaded and looked at it)

I fetched `https://iauarchive.eso.org/static/archives/images/publicationjpg/iau1901a.jpg`
(4000 × 492, 619,216 bytes) and viewed it directly. Confirmed content:

- The **lander deck** fills the lower-left and lower-right foreground: gold/black multilayer
  thermal blankets, deployed solar panels, a mast, and the gold spherical tanks.
- The **Yutu-2 rover** sits mid-frame on the surface, with its **wheel tracks** clearly visible
  curving away toward the horizon on the right.
- The horizon is a clean grey regolith skyline against a **pure black sky** (airless Moon) —
  the black band occupies the top ~20% of the frame.
- **No watermark, no burned-in credit line, no logo, no caption text anywhere in the image.**
  Any attribution you give is a licence obligation, not a visual one.

This confirms it is a genuine **360° cylindrical** panorama (~360° azimuth × ~45° elevation), with the
camera near the lander. It is *not* a nadir/zenith-complete equirectangular projection: there is no
ground directly beneath and no sky directly overhead, so a Three.js
`CylinderGeometry(..., openEnded: true, side: BackSide)` render is a closer match than
`SphereGeometry` — or pad the top/bottom before equirectangular mapping.

#### Licence — this is the single most important legal finding

The IAU published this image under a **genuine, explicit CC BY 4.0 licence**, and Wikimedia Commons
records it as such. Raw wikitext of
`https://commons.wikimedia.org/w/index.php?title=File:The_first_panorama_from_the_far_side_of_the_moon.jpg&action=raw`:

```
| Description    = Panorama of the landing site of Chang'e-4 on the far side of the Moon
| Date           = Release date: 15 February 2019, 07:00
| Source         = [https://www.iau.org/public/images/detail/iau1901a/ Panorama of the Landing Site of Chinese Chang’e-4 Probe on Far Side of the Moon].  International Astronomical Union.
| Permission     = [https://www.iau.org/copyright/ Usage of Images, Videos and Web Texts]. International Astronomical Union.
| Author         = CNSA

== {{int:license-header}} ==
{{IAU-source|iau1901a}}
{{cc-by-4.0|CNSA}}
```

Commons extmetadata for the same file:

```
LICENCE    : CC BY 4.0 | Creative Commons Attribution 4.0
LICENCE URL: https://creativecommons.org/licenses/by/4.0
ARTIST     : CNSA
CREDIT     : Panorama of the Landing Site of Chinese Chang’e-4 Probe on Far Side of the Moon. International Astronomical Union.
```

> **Verdict: LOW-MEDIUM risk.** The IAU (not the Commons uploader) is the distributing body, and the
> Commons page cites the IAU's own copyright page as the permission basis. CNSA itself has never
> published an open licence for this imagery — the CC BY 4.0 comes from the IAU's redistribution
> terms. **Attribute as "CNSA / CLEP, via International Astronomical Union (IAU), CC BY 4.0"** and
> you are behaving correctly. Keep the credit line; do not imply CNSA endorses your demo.

#### Commons mirrors of the same pixels (convenient, same licence)

```
TITLE : File:The first panorama from the far side of the moon.jpg
URL   : https://upload.wikimedia.org/wikipedia/commons/1/1b/The_first_panorama_from_the_far_side_of_the_moon.jpg
SIZE  : 10000x1229 | 3346126 bytes | image/jpeg      (independently re-measured: same)
UPLOADER: Cold Season @ 2019-02-27

TITLE : File:Landing site of Chang'e 4 on the far side of the Moon.tif
URL   : https://upload.wikimedia.org/wikipedia/commons/1/19/Landing_site_of_Chang%27e_4_on_the_far_side_of_the_Moon.tif
SIZE  : 10000x1229 | 20995646 bytes | image/tiff     ← byte-identical size to the IAU original
LICENCE: CC BY 4.0

TITLE : File:Yutu-2 leaving Chang e-4-iau1901a.jpg
URL   : https://upload.wikimedia.org/wikipedia/commons/5/54/Yutu-2_leaving_Chang_e-4-iau1901a.jpg
SIZE  : 2185x1229 | 1637770 bytes | image/jpeg      CC BY 4.0   (a crop of the panorama)
```

### 1.2 Yutu-2's view of the lander (PCAM reprocessed) — high res, CC BY 2.0

```
TITLE : File:ChangE-4 - PCAM.png
URL   : https://upload.wikimedia.org/wikipedia/commons/4/48/ChangE-4_-_PCAM.png
SIZE  : 5324x3204 | 20286075 bytes | image/png        (independently re-measured: 206 | image/png | png | 5324x3204 | 20286075)
LICENCE: CC BY 2.0 | https://creativecommons.org/licenses/by/2.0
ARTIST : CSNA/Siyu Zhang/Kevin M. Gill
DESC   : The Chang'e-4 lander imaged by the Yutu-2 rover on the lunar far side.
UPLOADER: Tiouraren @ 2021-06-12
```

```
TITLE : File:ChangE-4, Yutu-2 (51197517450).png
URL   : https://upload.wikimedia.org/wikipedia/commons/1/1b/ChangE-4%2C_Yutu-2_%2851197517450%29.png
SIZE  : 2286x2553 | 9956507 bytes | image/png         (independently re-measured: 206 | image/png | png | 2286x2553 | 9956507)
LICENCE: CC BY 2.0
ARTIST : Kevin M. Gill ; CREDIT: CSNA/Siyu Zhang/Kevin M. Gill
```

> **Verdict: MEDIUM risk.** These are *derivative works*: the underlying CNSA frames carry no open
> licence; the CC BY 2.0 was applied by the Flickr/Commons uploader (Kevin M. Gill, a well-known
> NASA JPL image processor). The licence is only as good as the uploader's right to grant it.
> Credit line is mandatory: **"CNSA/Siyu Zhang/Kevin M. Gill, CC BY 2.0"**.

### 1.3 User-made PCAM composite (48 images)

```
TITLE : File:Aitken Basin Von Kármán A Chang'e 4 (48 images).jpg
URL   : https://upload.wikimedia.org/wikipedia/commons/e/e5/Aitken_Basin_Von_K%C3%A1rm%C3%A1n_A_Chang%27e_4_%2848_images%29.jpg
SIZE  : 7999x3166 | 3405741 bytes | image/jpeg
LICENCE: CC BY-SA 4.0 | ARTIST/CREDIT: Marcusagrippa7777 (Own work) — "composite from 48 images. Chang'e 4."
PROBE : 206 | image/jpeg | jpeg | 7999x3166 | 3405741 bytes (3.25MB) [range-honored]   ← independently measured
```
**Verdict: MEDIUM-HIGH risk** — a volunteer's mosaic of unlicensed CNSA frames; the "own work" claim
is questionable (the pixels are CNSA's), and CC BY-SA would force **share-alike** onto your
derivative work. Also it is described as a *Von Kármán / Aitken Basin* composite — despite the
filename, it is built from **48** images, not the official 80. Avoid for a demo.

### 1.4 Public-domain orbital imagery of the exact landing site — LOWEST RISK

These are **NASA / GSFC / Arizona State University LROC** products. Genuinely **public domain**,
no attribution legally required (courtesy credit expected). They are *orbital*, not surface, but they
are the highest-resolution imagery of the Von Kármán CE-4 site available anywhere.

```
TITLE : File:First Look: Chang'e 4 (LROC1090).tiff
URL   : https://upload.wikimedia.org/wikipedia/commons/a/a7/First_Look-_Chang%27e_4_%28LROC1090%29.tiff
SIZE  : 14943x9869 | 147495868 bytes (140.66MB) | image/tiff
LICENCE: Public domain | ARTIST: NASA/GSFC/Arizona State University
PROBE : 206 | image/tiff | tiff | 14943x9869 | 147495868 bytes (140.66MB) [range-honored]   ← independently measured

TITLE : File:Above the Landing Site (LROC1092).tiff
URL   : https://upload.wikimedia.org/wikipedia/commons/5/59/Above_the_Landing_Site_%28LROC1092%29.tiff
SIZE  : 10280x52400 | 538692872 bytes (513.74MB) | image/tiff
LICENCE: Public domain | ARTIST: NASA/GSFC/Arizona State University
PROBE : 206 | image/tiff | tiff | 10280x52400 | 538692872 bytes (513.74MB) [range-honored]   ← independently measured
        ^ the single largest verified image found in this whole research pass

TITLE : File:Topographic Map of the Chang'e 4 Site (LROC1100).tiff
URL   : https://upload.wikimedia.org/wikipedia/commons/3/3f/Topographic_Map_of_the_Chang%27e_4_Site_%28LROC1100%29.tiff
SIZE  : 5150x5163 | 26617140 bytes (25.38MB) | image/tiff | LICENCE: Public domain | ARTIST: NASA/GSFC/ASU
PROBE : 206 | image/tiff | tiff | 5150x5163 | 26617140 bytes (25.38MB) [range-honored]   ← independently measured

TITLE : File:Chang'e 4 Lander- A Closer Look (01 m1303619844lr closC5A1C).jpg
URL   : https://upload.wikimedia.org/wikipedia/commons/b/b3/Chang%27e_4_Lander-_A_Closer_Look_%2801_m1303619844lr_closC5A1C%29.jpg
SIZE  : 1100x1100 | 713892 bytes (0.68MB) | image/jpeg
LICENCE: Public domain | ARTIST: NASA Goddard Space Flight Center
CREDIT: "...catalogued by Goddard Space Flight Center of the United States National Aeronautics and Space
        Administration (NASA) under Photo ID: 01_m1303619844lr_closC5A1C."
DESC  : "Chang'e 3 (left, M147290066LR) and Chang'e 4 (right, M1303619844LR) are very similar in size and
        instrumentation... Each panel is..." [truncated]
PROBE : 206 | image/jpeg | jpeg | 1100x1100 | 713892 bytes (0.68MB) [range-honored]   ← independently measured
```

Other LROC products present in `Category:Chang'e 4` on Commons (URLs not individually probed —
**unverified**): `Chang'e 4 Rover Comes into View (LROC1091).tiff`,
`Topographic Map of the Chang'e 4 Site (LROCcontent_...)`, `Statio_Tianhe_M1316588439RC.jpg`,
`Landing_site_of_Chang%27e_4_on_the_far_side_of_the_Moon.tif`,
`Longjiang-2_Impact_Site_Found!_(LROC1132)`, `Chang'e_4_Rover_on_the_Move_(LROC1096)`.

> **Verdict: LOW risk.** Public domain via NASA. Safe to ship. Required credit is a courtesy:
> **"NASA/GSFC/Arizona State University"**.

### 1.5 ⭐ THE REAL PRIZE — raw PCAM/LCAM/TCAM science frames, openly downloadable

Detail in §3. **Every raw instrument frame is downloadable over plain HTTPS with no login,
no cookies, no registration.** PCAM frames are **2352 × 1728, 16-bit**. ~26,742 PCAM frames are
listed. This is how you build a panorama larger and sharper than the 10000 × 1229 press composite.

---

## 2. Hosts reached vs blocked

**Reachable (verified this session):**
`iauarchive.eso.org`, `www.iau.org` (404 on the old path only), `upload.wikimedia.org`,
`commons.wikimedia.org`, `en.wikipedia.org`, `images-assets.nasa.gov`, `images-api.nasa.gov`,
`www.lpi.usra.edu`, `moon.bao.ac.cn`, `clpds.bao.ac.cn`, `www.nssdc.ac.cn`, `vsso.nssdc.ac.cn`,
`www.smoc.ac.cn`, `www.cas.cn`, `english.cas.cn`, `www.nao.cas.cn`, `www.cnsa.gov.cn`,
`www.clep.org.cn`, `www.news.cn`, `www.xinhuanet.com`, `www.stdaily.com`, `www.chinanews.com.cn`,
`www.guancha.cn`, `www.thepaper.cn`, `www.people.com.cn`, `china.huanqiu.com`,
`himg2.huanqiucdn.cn`, `media.bjnews.com.cn`, `huggingface.co`, `zenodo.org`, `arxiv.org`,
`osf.io`, `www.higp.hawaii.edu`.

**Blocked / non-functional:**
- `spaceflight101.com` → **403**
- `figshare.com` → **202 with empty body** (Cloudflare challenge); use `api.figshare.com` instead
- `www.iau.org/public/images/detail/iau1901a/` → **404** (page moved to iauarchive.eso.org)
- `moon.bao.ac.cn/PUBDATA/.../` directory listings → **403** (no browse; individual file URLs work)
- `qimg.hxnews.com` → **502 "Firewall 666"** (own edge filter)
- `thepaper.cn` krpano cube faces (`pano_0..5.jpg`) → **404**; `thepaper.xml` → **403**
  ⇒ the interactive 360° viewer is **not scrapeable**
- `moon.bao.ac.cn/moon-admin/api/*` and `/shopGoodsList` → **401** (auth required) — but note the
  `/client/...` family is **open**; only the `/api/...` mall family needs auth

**Flaky, not blocked:** `www.cnsa.gov.cn` and `www.higp.hawaii.edu` intermittently time out and then
succeed on retry. `upload.wikimedia.org` rate-limits to **429** under rapid requests.

---

## 3. GRAS / CLPDS — the Chinese Lunar and Planetary Data System (MAJOR FINDING)

**Portal:** `https://moon.bao.ac.cn/` (Lunar and Planetary Data Release System 月球与行星数据发布系统)
Operated by NAOC (National Astronomical Observatories, CAS) — the mission's official ground segment.

It is a Vue SPA, but its backing API at **`https://moon.bao.ac.cn/moon-admin`** is **open and
unauthenticated for metadata queries**, and — critically — **file downloads need no login either.**

### 3.1 The endpoints that matter

From `/js/config.js`:
```js
proPrefix: `${currentHost}/moon-admin`,   // 线上接口环境 中心
imgDev: currentHost,                      // 图片服务路径
```

From `/js/app.2cceeacb.js` (the bundled endpoint table):
```
/client/science/dataInfoList          ← product search
/client/science/dataInfo/{id}         ← product record
/client/science/dataInfo/getAnnexZip/{id}   ← ⭐ RESOLVES TO A DIRECT FILE URL
/client/psd/pdsDataset                ← PDS dataset bundles
/common/download
/client/science/category/{id}         ← mission / instrument tree
```

### 3.2 Mission and instrument IDs (from `/client/science/category/...`)

```
category/-1 →  1: 月球/MOON ,  2: 行星/Planet
category/1  →  4: CE-1 , 5: CE-2 , 6: CE-3 , 7: 嫦娥四号 CE-4  (…)
category/7  →  366: 降落相机 LCAM   368: 地形地貌相机 TCAM
               370: 低频射电频谱仪 LFRS   372: 全景相机 PCAM   (…)
```

### 3.3 Product counts (measured from the live API)

| Instrument | GRAS load id | Products | Level | Notes |
|---|---|---|---|---|
| **PCAM** 全景相机 | 372 | **26,742** | 2B | left+right cameras (`PCAML-`/`PCAMR-`); spans 2019-01 → 2025-12 |
| **LCAM** 降落相机 | 366 | **10,882** | 2A | descent imaging from landing day **2019-01-03** |
| **TCAM** 地形地貌相机 | 368 | **480** | 2C | lander terrain camera, from **2019-01-06** |

CE-4 total across all instruments (query `?task=7`): **44,158** records.
PCAM is **only offered at level 2B** — there is **no mosaic / panorama product** in GRAS
(verified: `dataLevel` 383–386 all return `total=0`). You get individual frames, not a finished pano.

### 3.4 ⭐ Verified: direct download, NO login

`GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfo/getAnnexZip/{dataInfoId}` returns:
```json
{"msg":"","code":200,"data":"https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/LCAM/1/2A/2019-03/CE4_GRAS_LCAM-1-5357_SCI_N_20190103022914_20190103022914_0001_A.2A"}
```

**Probe of the returned PUBDATA URLs (all succeeded, no auth, no cookies):**
```
206 | application/octet-stream | 4096 | 08000a000800090009000900 | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAMR/C/2B/2019-07/CE4_GRAS_PCAMR-C-000_SCI_N_20190104041502_20190104041502_0001_B.2B
206 | application/octet-stream | 4096 | ffffffffffffffffffffffff | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/LCAM/1/2A/2019-03/CE4_GRAS_LCAM-1-0000_SCI_N_20190103022009_20190103022009_0001_A.2A
206 | application/octet-stream | 4096 | 040100000000060001000000 | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/TCAM/I/2C/2019-03/CE4_GRAS_TCAM-I-002_SCI_N_20190106033401_20190106033401_0004_A.2C
403 | text/html | 153 | HTML | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAMR/C/2B/2019-07/     ← directory listing denied
403 | text/html | 153 | HTML | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/                     ← directory listing denied
```
HTTP **206** on all three instruments ⇒ the files really transfer. Directory browsing is 403, but the
API hands you every filename, so that is irrelevant.

True sizes via `Range: bytes=0-0` → `Content-Range`:
```
SIZE PCAM.2B -> content-range=bytes 0-0/8128512   cl=1 status=206
SIZE LCAM.2A -> content-range=bytes 0-0/1048576   cl=1 status=206
SIZE TCAM.2C -> content-range=bytes 0-0/12192768  cl=1 status=206
```

### 3.5 ⭐ Verified pixel dimensions from the real PDS4 labels

Each product has a companion **`…L`** file (`.2BL` / `.2AL` / `.2CL`) that is the **PDS4 XML label**
(`content-type: application/octet-stream`, but the body is `<?xml … Product_Observational …>`).
Fetched and parsed:

**PCAM — `CE4_GRAS_PCAMR-C-000_…_0001_B.2BL`**
```xml
<file_size unit="byte">8128512</file_size>
<Array_2D_Image>
  <axes>2</axes>
  <Element_Array><data_type>UnsignedLSB2</data_type><unit>data number</unit></Element_Array>
  <Axis_Array><axis_name>Line</axis_name><elements>1728</elements><sequence_number>1</sequence_number></Axis_Array>
  <Axis_Array><axis_name>Sample</axis_name><elements>2352</elements><sequence_number>2</sequence_number></Axis_Array>
  <Object_Statistics><maximum>255.000000</maximum><minimum>0.000000</minimum>
    <mean>6.201889</mean><standard_deviation>9.622408</standard_deviation></Object_Statistics>
</Array_2D_Image>
```

**LCAM — `CE4_GRAS_LCAM-1-0000_…_0001_A.2AL`**
```xml
<logical_identifier>CE4_GRAS_LCAM-1-0000_SCI_N_20190103022009_20190103022009_0001_A.2A</logical_identifier>
<instrument_name>Landing Camera</instrument_name><instrument_id>LCAM</instrument_id>
<start_date_time>2019-01-03T02:20:09.000Z</start_date_time>
<Instrument_Parm>
  <focal_length unit="mm">8.550000</focal_length>
  <pixel_size unit="micrometer">6.7</pixel_size>
  <principle_point_coordinate><x0 unit="pixel">478.629870</x0><y0 unit="pixel">513.093420</y0></principle_point_coordinate>
</Instrument_Parm>
<Element_Array><data_type>UnsignedByte</data_type><unit>data number</unit></Element_Array>
<Axis_Array><axis_name>Line</axis_name><elements>1024</elements><sequence_number>1</sequence_number></Axis_Array>
<Axis_Array><axis_name>Sample</axis_name><elements>1024</elements><sequence_number>2</sequence_number></Axis_Array>
```
Caveat: that same label carries `<file_size unit="byte">1323302912</file_size>` (1.32 GB), which
**contradicts** the real 1,048,576-byte file verified by `Content-Range`. Treat the GRAS
`<file_size>` element as **unreliable**; trust the HTTP size and the `Axis_Array` counts.

**TCAM — `CE4_GRAS_TCAM-I-002_…_0004_A.2CL`**
```xml
<file_size unit="byte">12192768</file_size>
<Array_3D_Image>
  <axes>3</axes>
  <Element_Array><data_type>UnsignedByte</data_type><unit>data number</unit></Element_Array>
  <Axis_Array><axis_name>Line</axis_name><elements>1728</elements><sequence_number>1</sequence_number></Axis_Array>
  <Axis_Array><axis_name>Sample</axis_name><elements>2352</elements><sequence_number>2</sequence_number></Axis_Array>
  <Axis_Array><axis_name>Band</axis_name><elements>3</elements><sequence_number>3</sequence_number></Axis_Array>
</Array_3D_Image>
```

#### ⭐ Consolidated, arithmetically self-consistent instrument table

| Instrument | Level | **Dimensions** | Data type | Bytes/file | Check |
|---|---|---|---|---|---|
| **PCAM** | 2B | **2352 × 1728** | `UnsignedLSB2` (16-bit LE) | **8,128,512** | 2352×1728×2 = 8,128,512 ✔ |
| **LCAM** | 2A | **1024 × 1024** | `UnsignedByte` (8-bit) | **1,048,576** | 1024×1024 = 1,048,576 ✔ |
| **TCAM** | 2C | **2352 × 1728 × 3 bands** | `UnsignedByte` (8-bit RGB) | **12,192,768** | 2352×1728×3 = 12,192,768 ✔ |

Every byte count was independently confirmed by HTTP `Content-Range`, and each factorises exactly
into the labelled axis lengths. **These dimensions are solid.**

Files are **headerless raw rasters** — the pixel data starts at `offset 0`. Render with the XML label;
there is no JPEG/PNG header. Useful example URLs (real, resolvable, no login):

```
PCAM right, 2019-01-04 : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAMR/C/2B/2019-07/CE4_GRAS_PCAMR-C-000_SCI_N_20190104041502_20190104041502_0001_B.2B
PCAM left,  2019-01-04 : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAML/C/2B/2019-07/CE4_GRAS_PCAML-C-000_SCI_N_20190104041518_20190104041518_0001_B.2B
LCAM,       2019-01-03 : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/LCAM/1/2A/2019-03/CE4_GRAS_LCAM-1-0000_SCI_N_20190103022009_20190103022009_0001_A.2A
LCAM label            : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/LCAM/1/2A/2019-03/CE4_GRAS_LCAM-1-0000_SCI_N_20190103022009_20190103022009_0001_A.2AL
TCAM,       2019-01-06 : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/TCAM/I/2C/2019-03/CE4_GRAS_TCAM-I-002_SCI_N_20190106033401_20190106033401_0004_A.2C
TCAM label            : https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/TCAM/I/2C/2019-03/CE4_GRAS_TCAM-I-002_SCI_N_20190106033401_20190106033401_0004_A.2CL
```

**Worked example — enumerate everything programmatically:**
```
GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfoList?pageNum=1&pageSize=200&task=7&load=372
→ {"total":26742,"rows":[{"dataInfoId":"...","name":"CE4_GRAS_PCAML-Q-055_SCI_N_..._B.2B","dataSize":"2032128.0",...}]}
GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfo/getAnnexZip/{dataInfoId}
→ {"code":200,"data":"https://moon.bao.ac.cn/PUBDATA/..."}
```

### 3.6 Licence / terms — **blunt assessment**

- GRAS/CLPDS publishes **no open licence (no CC, no public-domain dedication)** anywhere I could find.
- The mission's own data-access guide (written by a third party, mirrored at
  `https://huggingface.co/datasets/lothanspace/change4-tcm-dataset/raw/main/docs/chinese-moon-data-access.md`)
  states the requirements verbatim:
  > **Usage Requirements** — 1. **Non-commercial use**: Data is for research and educational purposes
  > 2. **Citation required**: Acknowledge the data source in publications
  > 3. **Submit results**: Send publications to lpdc@nao.cas.cn

  and gives the suggested citation:
  > `Ground Research and Application System of China's Lunar and Planetary Exploration Program.
  > Chang'E-4 [Instrument] Data. China National Space Administration, [Year]. https://moon.bao.ac.cn`

  That guide also says (unverified against the portal itself — I did not create an account):
  > "Only calibrated L2+ data is publicly available. Raw L0/L1 telemetry remains proprietary."

  **User-contributed, so treat the licence wording as unverified.** My own probes did establish that
  downloads genuinely need no login, which contradicts the guide's registration instructions.

- The primary portal `https://clpds.bao.ac.cn/ce5web/searchOrder-ce4En.do` is an **order/cart** flow.
  I did not register, so I cannot confirm whether the cart path imposes extra terms.

> **Verdict: MEDIUM-HIGH risk for redistribution, LOW risk for private/internal use.**
> The data is downloadable without authentication, but that is *not* the same as licensed for
> redistribution. Chinese government/agency imagery normally carries **no explicit open licence** —
> say so bluntly. For a demo: use it, credit **"CNSA/CLEP, GRAS/CLPDS (moon.bao.ac.cn)"**, keep it
> non-commercial, and do **not** redistribute a packaged image collection.
>
> **Important qualification — read §3.8.** These *raw L2B/2A/2C science frames* have no stated
> licence. But a **separate** GRAS distribution — the 科普教育 gallery described in §3.8 — **does**
> carry a verified **CC BY 4.0** grant (via the NSSDC metadata records, with DOIs), and those
> gallery images are downloadable through the same open portal. If you want a properly licensed
> Chinese-official surface panorama, use §3.8, not §3.4.

### 3.7 NSSDC / VSSO — PCAM quick-look images (27 images, order-gated)

A separate Chinese channel, found via `https://www.smoc.ac.cn/news/2242.jhtml` (release time
**2020-07-27 15:12:33**, title 国家空间科学数据中心公开发布嫦娥四号全景相机快视图).
Quoted (translated):

> "On 27 July 2020, the National Space Science Data Center publicly released a batch of Chang'e 4
> panoramic camera **quick-look images**, provided by the Lunar and Deep Space Exploration Research
> Department of the National Astronomical Observatories, Chinese Academy of Sciences. … This release
> includes quick-look images from the **first to the ninth lunar day** taken by the panoramic camera
> aboard the Chang'e 4 rover (Yutu-2), **27 images in total**. The specific image collection is the
> Chang'e 4 Panoramic Camera Image Collection. Users may access these data resources through the
> National Space Science Data Center's Virtual Space Science Observatory (vsso.nssdc.ac.cn)."

- Collection page: `https://vsso.nssdc.ac.cn/nssdc_zh/html/vssoinfo.html?1240` (全景相机图片集) — **200 OK**
- Related dataset: `https://www.nssdc.ac.cn/nssdc_zh/html/vssoinfo.html?1074` (嫦娥四号全景相机2B级科学数据) — **200 OK**
- Contact given on the page: `ldpc@nao.cas.cn`
- **Gating:** the page JS (`/nssdc_zh/js/vsso_order.js`) contains `/nssdc/orderInfo/dataOrderAdd` and
  `/nssdc/orderInfo/orderFileDownload/`, and `/js/common.js` contains `/logindo?jumlUrl=`.
  i.e. **download is via a data-order application and a login** (`orderForm` / `orderApply` /
  `orderPlaceholder` elements are present in the page HTML).
- I did **not** obtain the actual image files, so **dimensions are unverified** for this collection.
  The `?1240` gallery page returned no image links to a plain GET (content is injected by JS).

> **Verdict: MEDIUM-HIGH risk, and low value here** — order/login-gated, only quick-look (preview)
> quality, and 27 images. The GRAS PUBDATA route (§3.4) gives the same instrument's *science* frames
> with no login at all. **However — see §3.8: the NSSDC records themselves carry a real CC BY 4.0
> licence, and the images they describe turned out to be reachable elsewhere with no login.**

### 3.8 ⭐⭐ THE BEST FIND OF THIS ENTIRE PASS — official CE-4 panoramas, CC BY 4.0, no login

**This supersedes the earlier "no open licence" assessment for this material.** I verified the
NSSDC/VSSO metadata records directly (script `nssdc-licence.mjs`), then followed the `url` field in
those records back into the GRAS portal — and found the images sitting in an **unauthenticated
JSON API**, downloadable with no account.

#### (a) The licence is real — independently verified

```
===== /nssdc/coreMetadata/getDetail?linkId=1240 -> 200 ct=application/json len=3826
  license: CC BY 4.0
  doi: 10.12176/03.88.00007
  DOI: 10.12176/03.88.00007
===== /nssdc/coreMetadata/getDetail?linkId=1302 -> 200
  license: CC BY 4.0
  doi: 10.12176/03.88.00006
===== /nssdc/coreMetadata/getDetail?linkId=1076 -> 200
  license: CC BY 4.0
  doi: 10.12176/03.88.00008
===== /nssdc/coreMetadata/getDetail?linkId=1074 -> 200
  license: CC BY 4.0
  doi: 10.12176/03.04.004
===== /nssdc/coreMetadata/getDetail?linkId=1195 -> 200
  license: CC BY 4.0
  doi: 10.12176/03.04.002
```

Full record for `linkId=1240` (the PCAM gallery), quoted verbatim:

```json
"doi": "10.12176/03.88.00007",
"cstr": "14804.11.03.88.00007",
"dataNameCh": "全景相机图片集",
"dataNameEn": "Panoramic camera image galleries",
"themCategory": "月球与行星科学>科普产品",
"desEn": "This image galleries are quick-view images acquired by panoramic camera onboard
          Chang'e-4 Rover(Yutu-2) from the 1st to the 9th lunar day. It includes the pictures of
          lander taken by Panoramic camera when Yutu-2 at point A and D; the panoramic picture when
          Yutu-2 at point S1, which used azimuthal projection and cylindrical projection.",
"sharePlan": "设保护期",
"shareMathod": "线上共享",
"shareScope": "完全共享",
"url": "https://moon.bao.ac.cn/mall/moonDATA",
"license": "CC BY 4.0",
"dataProducerEn": "National Astronomical Observatories, Chinese Academy of Sciences
                   (Grand Research and Application System)",
"releaseDate": "2020-03-30 00:00:00",
"versionNum": "1.0"
```

- `shareScope: 完全共享` = **"fully shared"**; `shareMathod: 线上共享` = "online sharing".
- `license: CC BY 4.0` is a machine-readable field on a **Chinese government data centre** record,
  with a citable **DOI `10.12176/03.88.00007`** and CSTR `14804.11.03.88.00007`.
- Producer: **NAOC / GRAS** (National Astronomical Observatories, CAS — Ground Research and
  Application System). Contact `ldpc@nao.cas.cn`.

#### (b) The images themselves are downloadable with NO login

Endpoint discovered by parsing the GRAS `app.js` bundle — **unauthenticated**, returns JSON:
```
GET https://moon.bao.ac.cn/moon-admin/client/education/educationList?pageNum=1&pageSize=100&task=7&load=372
```
(`task=7` = Chang'e 4; `load=372` PCAM, `368` TCAM, `366` LCAM). Images resolve to
`https://moon.bao.ac.cn/img-api/upload/...` — plain HTTPS, no cookie, no auth.

**I enumerated all 48 CE-4 gallery items and measured every single one.**
(Full transcript saved to `F:\code\astro\.agents\research\gras-gallery-transcript.txt`;
script `gras-gallery-list.mjs`.)

#### (c) The panoramas — measured

| Item | Direct URL | **Measured** | Bytes |
|---|---|---|---|
| **S1 360° PCAM, cylindrical** | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/5S1环拍图（圆柱投影）_20260721041755A164.jpg` | **10000 × 833** | **6,228,953** |
| **A point 360° TCAM, cylindrical** | `https://moon.bao.ac.cn/img-api/upload/www/201911/5A点三圈镶嵌图（圆柱投影）.jpg` | **10000 × 1229** | **1,894,270** |
| A point 360° TCAM, azimuthal | `https://moon.bao.ac.cn/img-api/upload/www/201911/4A点三圈镶嵌图（方位投影）.jpg` | 5000 × 4915 | 3,039,109 |
| D point 360° TCAM, cylindrical | `https://moon.bao.ac.cn/img-api/upload/www/201911/7D点三圈镶嵌图（圆柱投影）.jpg` | 5000 × 687 | 3,609,970 |
| D point 360° TCAM, azimuthal | `https://moon.bao.ac.cn/img-api/upload/www/201911/6D点三圈镶嵌图（方位投影）.jpg` | 5000 × 4879 | 4,614,955 |
| A point PCAM lander mosaic | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/1A点拍着陆器_20260721085708A262.jpg` | 5638 × 3113 | 2,655,851 |
| D point PCAM lander mosaic | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/2D点拍着陆器_20260721085750A264.jpg` | 5691 × 3179 | 1,895,578 |
| S1 point PCAM lander mosaic | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/3S1点拍着陆器_20260721085854A266.jpg` | 5397 × 3157 | 5,358,411 |
| LCAM "着陆" (touchdown frame) | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/5着陆_20260721085557A260.jpg` | 1024 × 1024 | 591,507 |
| LCAM landing video (MP4) | `https://moon.bao.ac.cn/img-api/upload/www/201911/6嫦娥四号降落视频.mp4` | n/a | 116,233,479 |
| TCAM single frame, A point rover | `https://moon.bao.ac.cn/img-api/upload/www/201911/1A点月球车.jpg` | 2352 × 1728 | 765,254 |
| TCAM single frame, D point rover | `https://moon.bao.ac.cn/img-api/upload/www/201911/2D点月球车.jpg` | 2352 × 1728 | 2,194,320 |

Sample transcript lines (real probe output):
```
PCAM 全景相机 | S1环拍图（圆柱投影）
  URL   : https://moon.bao.ac.cn/img-api/upload/2026/07/21/5S1环拍图（圆柱投影）_20260721041755A164.jpg
  PROBE : 200 | image/jpeg | jpeg | 10000x833 | 6228953 bytes
TCAM 地形地貌相机 | A点三圈镶嵌图（圆柱投影）
  URL   : https://moon.bao.ac.cn/img-api/upload/www/201911/5A点三圈镶嵌图（圆柱投影）.jpg
  PROBE : 200 | image/jpeg | jpeg | 10000x1229 | 1894270 bytes
PCAM 全景相机 | S1点拍着陆器
  URL   : https://moon.bao.ac.cn/img-api/upload/2026/07/21/3S1点拍着陆器_20260721085854A266.jpg
  PROBE : 200 | image/jpeg | jpeg | 5397x3157 | 5358411 bytes
```

#### (d) ⚠ Two accuracy corrections — do not repeat these as facts

**(1) The GRAS catalogue has a duplicate/bug.** The gallery lists two S1 360° entries,
"S1环拍图（方位投影）" and "S1环拍图（圆柱投影）". They are **the same file**: both URLs return
identical bytes.
```
S1_title_azimuthal.jpg | 200 | 6228953 B | sha256=220d1c88a59f0b6de69793670864a0191446cc22
S1_cylindrical.jpg     | 200 | 6228953 B | sha256=220d1c88a59f0b6de69793670864a0191446cc22   ← identical
```
Both underlying filenames also literally contain 圆柱投影 ("cylindrical"). So **there is only ONE
S1 panorama image, and it is cylindrical.** Any claim that an S1 azimuthal panorama exists is wrong.

**(2) ⚠ EVERY GRAS gallery image carries a VISIBLE 「中国探月 CLEP / GRAS」 WATERMARK.**
I downloaded and visually inspected them:
- `A点三圈镶嵌图（圆柱投影）` — CLEP logo, top-right corner.
- `A点三圈镶嵌图（方位投影）` — 「中国探月 CLEP」 + 「GRAS」 logos, top-right corner.
- `S1环拍图（圆柱投影）` — CLEP/GRAS logos, top-right (and a second mark at top-left).

The watermark is **baked into the pixels**. This is a real constraint on redistribution (CC BY 4.0
does not oblige CNSA to let you remove it; stripping a logo is a separate legal risk in most
jurisdictions). Budget for either accepting the watermark or not using these files.

#### (e) ⭐ The single most important comparison: GRAS vs IAU copy of the famous panorama

The GRAS `A点三圈镶嵌图（圆柱投影）` and the famous IAU `iau1901a` are **the same scene** —
I viewed both. This confirms the famous 11 Jan 2019 panorama is the **A-point TCAM three-ring
mosaic (三圈镶嵌图)**, i.e. shot by the **lander's terrain camera**, consistent with the HIGP caption
"a camera on the lander" (§5) — *not* the rover PCAM. Yet they differ materially:

| | IAU `iau1901a` | GRAS `A点三圈镶嵌图（圆柱投影）` |
|---|---|---|
| Dimensions | 10000 × 1229 | 10000 × 1229 |
| Bytes | **3,346,126** (JPEG) / 20,995,646 (TIFF) | 1,894,270 |
| **Watermark** | **NONE** | **visible CLEP/GRAS logo** |
| Licence | CC BY 4.0 (IAU) | CC BY 4.0 (NSSDC DOI record) |

> **Use the IAU copy.** Same pixels, ~1.8× the bitrate, no watermark, and a licence that is at least
> as solid. The GRAS copy is only better if you specifically want the *azimuthal* "little planet"
> projection (5000 × 4915), which the IAU does not publish.

#### (f) What is genuinely NEW here (not available from IAU/Commons)

1. **The S1 360° PCAM panorama, 10000 × 833, 6,228,953 bytes** — the rover's own 360° view from
   point S1. I viewed it: it shows the **lander on the surface with solar panels deployed**, the
   **rover's own shadow**, the PCAM mast, and **Yutu-2's wheel tracks** leading away. This image is
   **not on Commons and not in the IAU release** — it is *only* available from this GRAS gallery.
   It is the best "rover's-eye view of the lander" asset found in this whole pass.
2. **Azimuthal/polar ("little planet") projections** at 5000 × 4915 (A) and 5000 × 4879 (D) — a
   projection nobody else publishes. (I viewed the A-point one: the lander sits at the centre,
   ringed by the surface, with the unimaged zenith as a blown-out white disc.)

> **Verdict: ⚠ MEDIUM-HIGH risk — the CC BY 4.0 grant is CONTESTED. Read §3.9 before relying on it.**
> A real, machine-readable **CC BY 4.0** field does exist on the NSSDC record (with DOI
> `10.12176/03.88.00007`, `shareScope: 完全共享`), which is the best licence signal found for Chinese
> surface imagery. **But the GRAS platform that actually hosts the files publishes its own
> all-rights-reserved copyright statement demanding written permission and a signed application form
> for publication or commercial use (§3.9). The two directly conflict.**
>
> Practical reading: **safe for private/internal/educational use with attribution; NOT safe to treat
> as CC BY 4.0 for redistribution or commercial use.** The `license: CC BY 4.0` field looks like
> catalogue metadata attached at registration time rather than a considered legal grant, and the
> hosting platform's own terms are the more conservative and more specific statement. If this demo
> ships publicly or commercially, either use the IAU panorama (§1.1) / public-domain LROC (§1.4)
> instead, or actually complete GRAS's application form and get written permission.
>
> Also: **keep the visible CLEP/GRAS watermark.**

### 3.9 ⚠⚠ THE LICENCE CONTRADICTION — GRAS's own copyright statement

I flagged this as an open item and then resolved it. The GRAS API exposes the platform's own
copyright statement at `/client/education/educationQuteList` and `/client/science/copyrightList`.
The CE-4-specific record (`copyrightId: 6, taskName: 嫦娥四号`) and the education record
(`educationQuteId: 9`) read, translated verbatim:

> **数据版权申明 — Data Copyright Statement**
> ● 本平台对其发布的数据产品或服务及平台上发布的相关信息的全部内容拥有版权等知识产权，受法律保护。
>   — *This platform owns the copyright and other intellectual property rights in all content of the
>   data products or services it publishes and in the related information published on the platform,
>   protected by law.*
> ● 未经本平台书面许可，任何单位及个人不得以任何方式或理由对上述数据产品、服务、信息、材料的任何部分
>   进行复制、修改、抄录、传播及销售。
>   — ***Without the written permission of this platform, no entity or individual may, in any way or
>   for any reason, reproduce, modify, excerpt, disseminate or sell any part of the above data
>   products, services, information or materials.***
> ● 凡侵犯本平台版权知识产权的，必依法追究其法律责任，特此郑重声明！
>   — *Anyone who infringes this platform's copyright and intellectual property will be held legally
>   responsible in accordance with the law; this is hereby solemnly declared!*
> 凡是使用我们平台上的数据或图片尤其是进行出版或商业用途的，必须填写《月球与行星探测数据申请表》
> 按要求进行数据申请，得到允许后再进行使用。… 承诺栏的申请人签字必须是手签，将签字后的PDF文件发到
> 我们的邮箱（lpdc@nao.cas.cn）。
>   — ***Anyone using data or images from our platform — especially for publication or commercial
>   purposes — must complete the "Lunar and Planetary Exploration Data Application Form", apply as
>   required, and only use them after obtaining permission.** … The applicant's signature in the
>   commitment section must be handwritten; send the signed PDF to our mailbox (lpdc@nao.cas.cn).*

**This is an all-rights-reserved statement** that prohibits reproduction and dissemination without
**written permission** and mandates a **hand-signed application** for publication or commercial use.

**The conflict, stated plainly:**

| Source | Says |
|---|---|
| NSSDC metadata field (`linkId` 1240/1302/1076/1074/1195) | `license: CC BY 4.0`, `shareScope: 完全共享` |
| **GRAS platform copyright statement** (the host of the actual files) | All rights reserved; written permission + signed application required for publication/commercial use |

I cannot reconcile these, and **I will not claim the imagery is CC BY 4.0-licensed.** The honest
verdict: the CC BY 4.0 field is real but **not corroborated by the hosting platform's own terms**.
Treat the material as **all-rights-reserved with a permission-request path**, exactly like the rest
of Chinese agency imagery — which is what the task brief predicted and is the blunt answer.

**The required citation and acknowledgement (GRAS's own wording, verbatim):**

> 数据引用 — Data citation:
> 中文：中国月球与深空探测工程地面应用系统. XXXX数据集（如：嫦娥四号全景相机数据集）. 中国国家航天局, 2020. http://moon.bao.ac.cn
> English: *Ground Research and Application System of China's Lunar and Planetary Exploration
> Program. XXXX Dataset (For example: Chang'E 4 Panoramic Cameras Dataset). China National Space
> Administration, 2020. http://moon.bao.ac.cn*
>
> 致谢 — Acknowledgement:
> *This data set is processed and produced by "Ground Research and Application System (GRAS) of
> China's Lunar and Planetary Exploration Program, provided by China National Space Administration
> (http://moon.bao.ac.cn)".*
>
> Contact: `lpdc@nao.cas.cn`

### 3.10 CE-4 instrument nomenclature (authoritative, from the GRAS CE-4 data-product definition)

From `/client/science/dataExplainList` (record `explainId: 6, taskName: 嫦娥四号`), verbatim:

- Filename format: `CEx_st_pl_ty_dc_yyyymmddhhmiss_YYYYMMDDHHMISS_ob_ver.lv`
- Mission identifiers: `CE4` = 1st/2nd-level data; `CE4-La` = lander 0-level; `CE4-Ro` = rover
  0-level; `CE4-Re` = relay satellite 0-level.
- Receiving stations: `GRAS1` 北京密云站 (Miyun), `GRAS2` 云南昆明站 (Kunming),
  `GRAS3` 北京密云站, `BACC` 测控系统天线 (TT&C antenna), `GRAS` = optimised.
- **Payloads:**
  - Lander: `TCAM` 地形地貌相机 — `TCAM-I` static photo mode, `TCAM-A` dynamic video mode;
    `LCAM` 降落相机 — `LCAM-1` mode 1 (**8:1**), `LCAM-2` mode 2 (**64:1**);
    `LND` 月表中子与辐射剂量探测仪.
  - Rover: **`PCAM` 全景相机 — `PCAML-C` camera A colour, `PCAML-Q` camera A panchromatic,
    `PCAMR-C` camera B colour, `PCAMR-Q` camera B panchromatic**; `VNIS` 红外成像光谱仪
    (`VNIS-SD`/`-SC`/`-VD`/`-VC`); `LPR` 测月雷达 (`LPR-1`, `LPR-2A`, `LPR-2B`);
    `ASAN` 中性原子探测仪.
  - Relay: `NCLE` 低频射电探测仪.

This explains the `-Q` / `-C` suffixes on the PCAM filenames seen in §3.4 / §3.8:
**`-C` = colour, `-Q` = panchromatic (全色)**, and **`L`/`R` = the two stereo cameras.** Useful when
picking frames to build a colour panorama: use the `-C` products. Note the CE-4 explain record
contains a typo (it lists `PCAML-C`/`PCAML-Q` then repeats `PCAML-C`/`PCAML-Q` where the CE-3 record
correctly shows `PCAMR-*` for the second camera).

---

## 4. Chinese media — the 11 January 2019 TCAM "环拍" release (low resolution)

The 11 Jan 2019 release was the **TCAM (terrain camera) surround panorama**, distinct from the PCAM
360° panorama. Reporters' copies are on Chinese news CDNs. All **low resolution**:

```
206 | image/jpeg | jpeg | 1080x1061  | 100075 bytes (0.10MB) | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/19/20190111091909143.jpg
206 | image/jpeg | jpeg | 872x7087   | 755134 bytes (0.72MB) | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/20/20190111092020960.jpg
206 | image/jpeg | jpeg | 800x787    | 47401 bytes (0.05MB)  | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/08/20190111090851527.jpg
206 | image/jpeg | jpeg | 800x99     | 11472 bytes (0.01MB)  | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/09/20190111090904360.jpg
206 | image/jpeg | jpeg | 1080x1061  | 100058 bytes (0.10MB) | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/19/20190111091909143.jpg?imageView2/2/w/1260
```
The 872×7087 file is the TCAM surround-panorama strip — tall, thin, and only 0.72 MB.

- **Source page:** `https://china.huanqiu.com/article/9CaKrnKgT6M` (月背清晰的环拍影像图来了！) — 200 OK
- **Source page:** `https://china.huanqiu.com/article/9CaKrnKgT67` — 200 OK
- **Article text (translated, quoted):** "As of 08:00 on 11 January, the Chang'e 4 lander, the
  Yutu-2 rover and the Queqiao relay satellite are in stable condition… The terrain and landform
  camera configured on the lander completed the surround imaging (环拍), and researchers produced a
  clear surround image map from the data relayed back by Queqiao."
- **Licence text on the page (translated, quoted):** "Huanqiu Network copyright work; **reproduction
  or mirroring strictly prohibited without written authorization**, violators will be prosecuted."
  (环球网版权作品，未经书面授权，严禁转载或镜像，违者将被追究法律责任。)

> **Verdict: HIGH risk and low value.** Explicitly all-rights-reserved, and the resolution is far
> worse than the IAU panorama. Do not use.

### 4.1 Broader media sweep (parallel subagent — full report in `notes-change4-media.md`)

A dedicated sweep of Xinhua / CNSA / CAS / NAOC / CLEP / stdaily / chinanews / guancha / thepaper /
people.com.cn / bjnews found **nothing that beats the IAU panorama**, and no Chinese state-media
image with an open licence. Key measured results:

| Direct URL | **Measured** | Bytes | Note |
|---|---|---|---|
| `http://www.chinanews.com/cr/2019/0111/415251673.png` | **960 × 4096** | 5,357,215 | largest media copy found; no visible watermark |
| `http://www.chinanews.com/cr/2019/0111/3478659747.png` | **960 × 3713** | 4,372,062 | page labels it 圆柱投影 (cylindrical) |
| `http://www.chinanews.com/cr/2019/0111/1272058806.png` | 800 × 786 | 521,246 | 方位投影 (azimuthal) |
| `http://www.clep.org.cn/n5982341/c6805144/part/6780069.jpg` | 900 × 885 | 143,428 | official CLEP 2019-01-11 release page |
| `https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782935.jpg` | 800 × 787 | 216,936 | the **1-year-anniversary** page (2020-01-13) |
| `https://media.bjnews.com.cn/image/2019/01/11/4747739891901735117.jpg` | 900 × 7321 | 1,439,299 | **⚠ visible 「我们的太空」 watermark** |

Findings from that sweep worth carrying forward:

- **Xinhua caps at 640 × 357** and every larger-size suffix 404s — **no large Xinhua original exists.**
- The **largest Chinese-media file anywhere is 960 px wide**, versus the verified 10000-px IAU panorama.
- **No Chinese state-media image has an open licence.** Xinhua's 版权声明, chinanews's
  未经授权禁止转载, bjnews and CNSA's 版权所有：国家航天局 all reserve rights explicitly.
- The **1-year-anniversary release (Jan 2020) is not a larger panorama** — the CNSA anniversary page
  `https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/content.html` reuses the same
  ~800-px panorama. **No distinct high-resolution anniversary master exists** at CNSA.
- **Dead ends confirmed, not left open:** the thepaper interactive 360° viewer is **not scrapeable**
  (krpano cube faces `pano_0..5.jpg` → 404, `thepaper.xml` → 403);
  `qimg.hxnews.com` is blocked by its own edge filter (502 "Firewall 666");
  `chinafotobank` large sizes are purchase-gated (returns a 150 × 150 placeholder).
- `www.cnsa.gov.cn` is **intermittently slow, not blocked** — one path timed out and then succeeded
  on retry. Record it as flaky.
- All dimensions in that table were measured with `img-dims.mjs`, not estimated.

---

## 5. Repositories (Zenodo / Figshare / OSF / arXiv / PDS / HuggingFace)

**Headline: Zenodo has genuine, CC BY 4.0, ~595 MP Yutu-2 PCAM mosaics. See §5.1.**
Everything else in these repositories is empty, masks-only, or non-imagery. Full transcript in
`F:\code\astro\.agents\research\notes-change4-repos.md`.

One repository item is confirmed relevant and inspected directly:

**HuggingFace — `lothanspace/change4-tcm-dataset`** (`https://huggingface.co/datasets/lothanspace/change4-tcm-dataset`, HTTP 200)
- README front-matter: `license: cc-by-nc-4.0`, tags `lunar`, `chang-e-4`, `terrain-classification`, `segmentation`
  → **CC BY-NC 4.0 = non-commercial only.** Unsuitable if the demo is ever commercial.
- README says verbatim:
  > **Note:** Original Chang'E-4 images are not included due to copyright restrictions. You must
  > download the source images directly from CLPDS (see instructions below).

  i.e. **this dataset contains LabelMe annotation masks only — no Chang'e 4 pixels.**
- Its `docs/chinese-moon-data-access.md` is a useful third-party guide to CLPDS (quoted in §3.6) and
  points at `https://clpds.bao.ac.cn/ce5web/searchOrder-ce4En.do`.

**HIGP PRPDC (University of Hawaii) release catalogue — SOLVED, and it holds a real image file.**

The University of Hawaii **Pacific Regional Planetary Data Center (PRPDC)**, a NASA-affiliated
regional planetary image facility, archives each month's releases as a TIFF + a caption PDF.
Directory listing of `https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/` (HTTP 200)
contains `PRPDC-0062.pdf`, **`PRPDC-0062.tif`**, `2019_01_Index.tif`, `January_2019_Captions.pdf`.

I wrote a Flate-stream PDF text extractor (`pdf-text.mjs`) to read the captions. **PRPDC-0062 is the
Chang'e 4 record**, quoted from `PRPDC-0062.pdf` (and identically from `January_2019_Captions.pdf`):

> "PRPDC **PR Set: 2019-01** Image Title: **Chang'e-4** Original Source: **CNSA/CLEP**
> Image Released: **2019/01/11** Images Acquired: **2019/01/04**
> Instrument: **TCAM lander and PCAM rover** Mission: **Chang'e-4** …
> The **360-degree panorama image was published by CNSA** on Friday, **pieced together from 80 photos**
> taken by a camera on the lander, according to **Li Chunlai, deputy director of the National
> Astronomical Observatories of China and commander-in-chief of the ground application system of
> Chang'e-4**."

> "Chang'e-4 probe touched down at the preselected landing area at **177.6 degrees east longitude and
> 45.5 degrees south latitude in the Von Karman Crater in the South Pole-Aitken (SPA) Basin** on the
> farside of the Moon on January 3 …"

> "The CNSA released video of the landing process of the Chang'e-4, which was produced by processing
> **more than 4,700 pictures** taken by a camera on the landing craft."

This is the **authoritative confirmation of the "~80 PCAM images" figure** in the task brief, from a
named mission official (Li Chunlai) via a NASA-affiliated data centre. Landing coordinates
177.6°E, 45.5°S — note these are *farside* coordinates; the demo should place the site accordingly.

**Measured file:**
```
206 | image/tiff | tiff | 2200x1700 | 11246072 bytes (10.73MB) [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/PRPDC-0062.tif
206 | image/tiff | tiff | 1760x2420 | 12820748 bytes (12.23MB) [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/2019_01_Index.tif
206 | image/jpeg | jpeg | 400x550    | 103435 bytes (0.10MB)   [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/sm_2019_01_Index.jpg
```

- `PRPDC-0062.tif` = **2200 × 1700, 11,246,072 bytes, TIFF.** (I could not view it — TIFF is not a
  format the image reader accepts — so **its visual content is unverified**; it is a TCAM/PCAM frame
  or mosaic per the caption, but I cannot say which.)
- Source is still **CNSA/CLEP**; the PRPDC is redistributing, not licensing. **No open licence stated**
  on the directory listing.

> **Verdict: MEDIUM-HIGH risk**, but valuable as *corroborating official metadata* (the 80-photo
> figure and the landing coordinates). Not worth using as the demo's image source — 2200×1700 is far
> below the 10000×1229 IAU panorama.

---

## 5.1 ⭐⭐ ZENODO — the best-LICENSED high-resolution imagery found anywhere

This is the strongest result of the whole research pass on the **licence** axis. A parallel sweep
(see `notes-change4-repos.md` for the full transcript) found genuine Yutu-2 PCAM-derived mosaics
deposited on Zenodo under a **properly registered CC BY 4.0 licence**.

**I independently re-verified the licences through DataCite — the authoritative DOI registry — not
just through Zenodo** (Zenodo was rate-limiting me with HTTP 403 at the time):

```
===== 10.5281/zenodo.11150203  status=200
  titles : ["Study on the degradation pattern of impact crater communities in Yutu-2's rovering area"]
  rights : [{"rights":"Creative Commons Attribution 4.0 International",
             "rightsUri":"https://creativecommons.org/licenses/by/4.0/legalcode",
             "schemeUri":"https://spdx.org/licenses/",
             "rightsIdentifier":"cc-by-4.0","rightsIdentifierScheme":"SPDX"}]
  pubYear: 2024   types: {"resourceTypeGeneral":"Image"}
  creators: ["Ma, Xinyu","Chen, Meixi","Hu, Teng"]
  publisher: Zenodo

===== 10.5281/zenodo.11197460  status=200
  titles : ["Yutu-2 PCAM Images for 3D Scene Reconstruction (2019)"]
  rights : [{"rights":"Creative Commons Attribution 4.0 International",
             "rightsIdentifier":"cc-by-4.0", ...}]
  pubYear: 2024   types: {"resourceTypeGeneral":"Dataset"}
  creators: ["Ma, Xinyu","chen, Meixi"]
```

A CC BY 4.0 licence registered with **DataCite under an SPDX identifier** is a far stronger legal
signal than a `license:` string in a Chinese catalogue record (§3.8/§3.9).

### The files

| Record | Contents | Licence | Size |
|---|---|---|---|
| **`10.5281/zenodo.11150203`** | `Yutu 2 rover's panoramic camera captures images.zip` — **20 GeoTIFFs = 10 date pairs** (D = DEM, O = orthophoto), lunar days 27–33 | **CC BY 4.0** | **11,794,265,870 B (11.79 GB)**, md5 `a28dfb0a811ff836dc6af465a704b633` |
| `10.5281/zenodo.11197460` | `PCAM2019DEMDOM.zip` — **48 BigTIFFs = 24 date pairs**, **2019-01-12 → 2019-11-23** | **CC BY 4.0** | 28,336,145,167 B (28.34 GB) |
| `10.5281/zenodo.11194446` | `PCAM2020DEMDOM.rar` | CC BY 4.0 | 26.12 GB |
| `10.5281/zenodo.11198813` | `PCAM2021DEMDOM.rar` | CC BY 4.0 | 26.79 GB |
| `10.5281/zenodo.4018823` | supplementary Pancam figures (`.rar`) | CC BY 4.0 | 88.3 MB |

Direct download (record 11150203):
`https://zenodo.org/api/records/11150203/files/Yutu%202%20rover%27s%20panoramic%20camera%20captures%20images.zip/content`

Quoted description of record 11150203 (from the Zenodo metadata):
> "Here are the DEM data and DOM data created using images taken by the Yutu-2 rover along the route
> between the 27th and 33rd moon days. And the extracted impact craters contain their degradation
> levels. All impact craters are classified into 5 categories (A-AB-B-BC-C)"

### ⭐ Measured dimensions — 27308 × 21804 px

The archive was **not** downloaded in full. Instead the ZIP64 central directory was parsed over HTTP
range requests, then **one member** was range-extracted and inflated
(`lho=6647668083`, `csize=52239438`):

```
compressed data: 6647668174 .. 6699907611 (52.2 MB)
downloaded 52239438 bytes (expected 52239438) -> EXACT MATCH
inflated -> 62598733 bytes          <-- equals ZIP central-directory usize exactly
```

BigTIFF IFD0 of `20210507O.tif` (measured with a BigTIFF-aware dumper, since `img-dims.mjs` at the
time could not read BigTIFF — see §7):

```
first 24 bytes hex: 49492b0008000000d8c4c20200000000803fc01028240e0d
byteorder=little-endian (II) version=43 => BigTIFF
      256 ImageWidth                = [27308]
      257 ImageLength               = [21804]
      258 BitsPerSample             = [8,8]
      259 Compression               = [5]                 (LZW)
      262 PhotometricInterpretation = [1]
      277 SamplesPerPixel           = [2]
      322 TileWidth / 323 TileLength = 256 / 256           (9202 tiles = 107 x 86)
      33550 ModelPixelScale         = [0.00126154, 0.00126154, 0]
      34737 GeoAsciiParams          = "Local Coordinates (m)|"
```

> **`20210507O.tif` = 27,308 × 21,804 px = 595,414,032 px (~595 MP)**, 8-bit,
> **2 samples/px, `PhotometricInterpretation=1` ⇒ grayscale + alpha** (the alpha carries the
> irregular mosaic footprint), LZW, tiled 256×256, GeoTIFF at **1.26154 mm/pixel** in **local
> (rover-site) coordinates — not lat/lon**, archive member 62,598,733 bytes.

**Pixel content was verified, not assumed:** all **9,202 tiles decoded with 0 failures** via a
hand-written TIFF-LZW decoder, and the rendered preview (3414 × 2726) is a genuine lunar surface
orthophoto — crater rims, boulders, regolith texture. Mean grey 245.34; the alpha footprint covers
5.81 % of the bounding box. Full 62.6 MB BigTIFF and the preview PNG are saved under
`.agents/research/dl/`.

> **Verdict: MEDIUM risk — but the best licence available for genuine Yutu-2 surface imagery.**
> The CC BY 4.0 is explicit, machine-readable, SPDX-identified, and registered with DataCite.
> **However**, this is a **third-party academic deposit** (Ma Xinyu / Chen Meixi / Hu Teng), and the
> upstream data is CNSA/CLPDS, whose own terms are non-commercial + citation + notify-results
> (§3.9). So the depositors' CC BY 4.0 is a **self-applied licence over someone else's data** — the
> same licence-washing concern that applies to the Commons CC BY files in §1.2, though here it comes
> from academic authors with a DOI and a real paper behind it.
>
> Practical guidance: **attribute "Ma, Xinyu; Chen, Meixi; Hu, Teng (2024), Yutu-2 PCAM DEM/DOM,
> Zenodo, CC BY 4.0, DOI 10.5281/zenodo.11150203"**, keep it non-commercial if you want to mirror
> GRAS's own terms too, and note the provenance chain. For a demo this is a defensible, citable,
> openly-licensed source of genuine Yutu-2 surface imagery at ~595 MP — **nothing else found in this
> pass combines that resolution with that licence clarity.**
>
> Caveat for a Three.js demo: these are **orthorectified nadir DOM/DEM mosaics in local rover
> coordinates**, i.e. **map products, not 360° panoramas**. They are ideal for a *terrain/texture*
> layer over the landing site, not for a skybox.

### Clean negatives from the repository sweep

- **PDS (NASA): CE-4 is not there at all.** Queries `(title like "Yutu")`, `(title like "Von Karman")`,
  `(title like "PCAM")` all return **0 hits**; `(title like "Chang'e")` returns 36 hits, **all
  Chang'E-1/Chang'E-2 Microwave Radiometer** products. `pds-imaging.jpl.nasa.gov` is additionally
  **403-blocked**.
- **arXiv:** no supplementary CE-4 imagery deposited (0).
- **Figshare:** `Yutu-2`, `Von Karman lunar panorama`, `CE-4 PCAM` all return **n=0**. Note its GET
  `search_for` silently ignores the query — use POST.
- **OSF:** 0 hits.
- **HuggingFace `lothanspace/change4-tcm-dataset`:** confirmed **masks only** — `data/images/` holds
  just a `.gitkeep`. CC BY-**NC** 4.0.
- **`siyu.china-vo.org/ChangE-4/PCAM/`** — **DEAD (404)**, cPanel default error page. This URL family
  appears in some papers; do not chase it.
- **`www.sciencedirect.com` → 403**, so the ISPRS paper's data-availability statement is
  **UNVERIFIED**. (The correct DOI is `10.1016/j.isprsjprs.2023.10.021`; Crossref shows no data link,
  and its authors do not match the Zenodo depositors.)

---

## 6. Bottom-line recommendation for the Three.js demo

**⚠ Read §3.9 first.** The GRAS/Chinese-official imagery carries a **contested** licence: a
`CC BY 4.0` metadata field that the hosting platform's own all-rights-reserved copyright statement
contradicts. **Only the IAU panorama and the LROC frames are cleanly licensed for public shipping.**

**Ship-safe pairing (recommended):**

1. **Surface panorama → the IAU/CNSA panorama (§1.1), verified 10000 × 1229, 3,346,126-byte JPEG**
   (or the 20,995,646-byte TIFF). Genuine **CC BY 4.0**, **no watermark**, highest bitrate of any copy.
   Mandatory credit: **"CNSA / CLEP, via the International Astronomical Union (IAU), CC BY 4.0"**.
   It is an ~8.1:1 cylindrical strip — pad vertically or render with an open-ended
   `CylinderGeometry` rather than an equirectangular skybox.

2. **Orbital context → public-domain LROC (§1.4)**, e.g. the verified **10280 × 52400**
   `Above the Landing Site (LROC1092).tiff`. Credit "NASA/GSFC/Arizona State University". No legal risk.

**For private / internal / educational-only use (not redistribution), additionally:**

3. **Rover's-eye view of the lander → the GRAS S1 PCAM panorama (§3.8c), verified 10000 × 833,
   6,228,953 bytes.** Unique to GRAS — not on Commons or in the IAU release. I viewed it: the lander
   with panels deployed, the rover's own shadow, the PCAM mast, and Yutu-2's wheel tracks.
   **⚠ Contested licence (§3.9) and a visible CLEP/GRAS watermark that must be kept.**
   Cite GRAS's own wording and contact `lpdc@nao.cas.cn` (signed form) before any publication.

4. **Azimuthal "little planet" projection (optional, distinctive) → GRAS 5000 × 4915 A-point mosaic
   (§3.8c).** Same contested terms + watermark.

5. ⭐ **Best-licensed genuine Yutu-2 surface imagery → Zenodo `10.5281/zenodo.11150203` (§5.1),
   verified 27308 × 21804 px (~595 MP), CC BY 4.0 registered with DataCite.** Use it as a
   **terrain/texture layer** over the landing site (it is a nadir orthomosaic + DEM in local rover
   coordinates, **not** a 360° panorama). Attribute "Ma, Xinyu; Chen, Meixi; Hu, Teng (2024),
   Yutu-2 PCAM DEM/DOM, Zenodo, CC BY 4.0". This is the only source found that pairs genuinely high
   resolution with a DOI-registered open licence — though note the CC BY is a depositor's self-applied
   licence over upstream CNSA/CLPDS data.

**Maximum-detail alternative (research / non-commercial only):** rebuild the panorama from the raw
GRAS PCAM frames (§3.4) — 2352 × 1728, 16-bit, 8,128,512 bytes each, **no login**, 26,742 frames.
Use the `-C` (colour) products. These have **no stated licence** beyond GRAS's all-rights-reserved
statement — keep non-commercial and do not redistribute a packaged set.

**Do not use:** `Aitken_Basin_Von_Kármán_A_Chang'e_4_(48_images).jpg` (CC BY-SA, questionable
provenance, would force share-alike); the huanqiu / chinanews / bjnews Chinese-news CDN copies
(explicitly all-rights-reserved, ≤960 px, and the bjnews copy has a visible 「我们的太空」 watermark);
or `lothanspace/change4-tcm-dataset` (CC BY-**NC** 4.0, and contains no imagery at all).

**Landing-site coordinates for placement** (from the HIGP PRPDC caption, §5):
**177.6°E, 45.5°S** — Von Kármán crater, South Pole–Aitken basin, lunar farside.

**One-line licence summary:** Chinese agency imagery — including everything on GRAS, CNSA, CLEP and
NSSDC — has **no reliable open licence**; the single genuinely open surface panorama is the one the
**IAU** distributes under **CC BY 4.0** (which is itself a Chinese CNSA image), and the only
unambiguously free imagery of the site is **NASA/ASU's public-domain LROC** frames.

---

## 7. Tools written during this pass (in `F:\code\astro\.agents\`)

| Script | Purpose |
|---|---|
| `img-dims.mjs` | **The dimension measurer.** Range-GETs 64 KB, parses JPEG SOF / PNG IHDR / WebP / GIF / **TIFF *and* BigTIFF** headers, falls back to a full GET, reports true total size from `Content-Range`. Also accepts a **local filesystem path**. |
| `commons-info.mjs` | Wikimedia Commons `imageinfo` API → URL, size, dimensions, licence, artist, credit (with retry against 429/HTML responses). |
| `grep-api.mjs` | Fetches JS/JSON bundles and extracts candidate API endpoint strings. |
| `gras-query.mjs` | Queries the GRAS `moon-admin` API for CE-4 mission/instrument/product listings. |
| `gras-gallery-list.mjs` | Enumerates the GRAS 科普教育 CE-4 galleries (PCAM/TCAM/LCAM) and measures every image. **This found the CC BY 4.0 panoramas (§3.8).** |
| `gras-hash.mjs` | Downloads panorama candidates and sha256-hashes them to detect duplicate/catalogue errors. |
| `nssdc-licence.mjs` | Reads the NSSDC `coreMetadata/getDetail` records to extract the authoritative `license` + `doi` fields. |
| `pdf-text.mjs` | Minimal PDF text extractor — inflates FlateDecode streams in pure Node (`zlib`), pulls `Tj`/`TJ` text. Used to read the HIGP PRPDC captions. |
| `tiffdump.mjs` | BigTIFF-aware TIFF IFD dumper (from the repository sweep). Used to read the Zenodo mosaics' `ImageWidth`/`ImageLength`. |
| `zip-remote.mjs` | Parses a remote ZIP/ZIP64 central directory over HTTP range requests **without downloading the archive** — the technique that made the 11.8 GB Zenodo record tractable. |
| `ce4-zip-extract.mjs` | Range-extracts + inflates a single ZIP member by local-header offset + compressed size. |
| `ce4-tiff-preview.mjs` | Hand-written TIFF-LZW decoder that renders a downsampled preview — used to prove the Zenodo mosaics contain real imagery. |

> ⚠ **Bug found and fixed during this pass:** the original `img-dims.mjs` only matched **classic**
> TIFF magic (`49492a00` / `4d4d002a`). The Zenodo Yutu-2 mosaics are **BigTIFF** (`49492b00` /
> `4d4d002b`), so the script silently reported `?x?` on them. `tiffSize()` now handles the BigTIFF
> header (version 43, 8-byte offsets, 8-byte entry count, 20-byte IFD entries), local-file paths are
> supported, and the fix was verified to return **27308 × 21804** on the real BigTIFF while leaving
> classic TIFF (`10000 × 1229`, `2200 × 1700`) and JPEG (`10000 × 1229`) parsing unchanged.

**Environment prelude for all of them:**
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"; node .agents/<script>.mjs <args>
```

---

## 8. Unverified / open leads

- **RESOLVED (was open):** the GRAS 数据版权申明 copyright statement — I read it in full at
  `/client/education/educationQuteList` and `/client/science/copyrightList`. It is
  **all-rights-reserved** and contradicts the `license: CC BY 4.0` metadata field. **See §3.9.**
- **Unresolved:** *why* the NSSDC record says `CC BY 4.0` while the GRAS platform says all rights
  reserved. I could not find an authoritative tie-breaker. Which one governs is **unverified** —
  assume the more restrictive one.
- **Unresolved:** whether the CE-4 NSSDC **data-application form** (《月球与行星探测数据申请表》,
  hand-signed PDF to `lpdc@nao.cas.cn`) would actually be granted. Not attempted — no form submitted.
- The visual content of `PRPDC-0062.tif` (2200×1700) — **unverified**: TIFF is not viewable with the
  tools available, so whether it is a TCAM frame, a PCAM frame, or a small mosaic is unknown.
- Whether CLPDS's `clpds.bao.ac.cn` cart flow adds terms beyond GRAS's — **unverified** (no account created).
- No CNSA/NAOC release of a **larger** version of the 10000×1229 panorama was found. Whether one
  exists internally is **unverified**. The 10000-px ceiling appears to be the publication maximum.
- **Pixel-content verification is partial.** I visually inspected: the IAU panorama, the GRAS
  A-point TCAM cylindrical + azimuthal mosaics, and the GRAS S1 PCAM cylindrical panorama.
  Every other dimension in this document is a header/byte measurement — I did not eyeball those files.
- Other LROC products in `Category:Chang'e 4` on Commons were not individually probed —
  **unverified**: `Chang'e 4 Rover on the Move (LROC1096).png/.gif`,
  `Longjiang-2 Impact Site Found! (LROC1132)`, `Statio_Tianhe_M1316588439RC.jpg`.
  (`Chang'e 4 Rover Comes into View (LROC1091).tiff` = 30810×9866, 303,992,964 B and
  `Chang'e 4 Lander Coordinates (LROC1087).tiff` = 8285×13155, 109,014,044 B are reported by the
  Commons API `imageinfo` but hit HTTP 429 on every independent re-probe attempt — so those two are
  **API-reported, not independently measured**.)
- The GRAS `<file_size>` XML element disagrees with the real HTTP byte count for LCAM
  (1,323,302,912 declared vs 1,048,576 actual) — **treat that element as unreliable**; the HTTP
  `Content-Range` value is the trustworthy one.
- **A "1-year anniversary" (Jan 2020) release as a distinct larger panorama: NOT FOUND** — the CNSA
  anniversary page reuses the same ~800-px image (see §4.1).
- **Repositories (§7 / `notes-change4-repos.md`)** — the parallel sweep found nothing usable; see
  that file for the per-host probes.

---

## 8.1 Complete Commons inventory of `Category:Chang'e 4`

The category holds exactly **55 files**. Ranked by pixel count (Commons API `imageinfo`):

```
10280x52400 | 513.74MB | image/tiff | File:Above the Landing Site (LROC1092).tiff              ← measured ✔
30810x9866  | 289.91MB | image/tiff | File:Chang'e 4 Rover Comes into View (LROC1091).tiff    ← API only
14943x9869  | 140.66MB | image/tiff | File:First Look- Chang'e 4 (LROC1090).tiff               ← measured ✔
8285x13155  | 103.96MB | image/tiff | File:Chang'e 4 Lander Coordinates (LROC1087).tiff       ← API only
5150x5163   |  25.38MB | image/tiff | File:Topographic Map of the Chang'e 4 Site (LROC1100).tiff ← measured ✔
7999x3166   |   3.25MB | image/jpeg | File:Aitken Basin Von Kármán A Chang'e 4 (48 images).jpg ← measured ✔
5323x3264   |  20.79MB | image/png  | File:ChangE-4 - PCAM (51216550288).png                   ← API only
5324x3204   |  19.35MB | image/png  | File:ChangE-4 - PCAM.png                                 ← measured ✔
10000x1229  |   3.19MB | image/jpeg | File:The first panorama from the far side of the moon.jpg ← measured ✔
10000x1229  |  20.02MB | image/tiff | File:Landing site of Chang'e 4 on the far side of the Moon.tif
2286x2553   |   9.50MB | image/png  | File:ChangE-4, Yutu-2 (51197517450).png                  ← measured ✔
```

`Category:Yutu-2` and `Category:Chang'e 4 (Yutu-2)` both exist but are **empty (0 files)**.

**Top-level conclusion on Commons:** the largest *surface* panorama anywhere in the category is
**10000 × 1229**. The only larger files are orbital LROC imagery. **No Commons file beats 10000 px
of surface panorama.**

## 8.2 GRAS `<file_size>` vs reality (recorded so it is not trusted later)

```
PCAM label declares 8128512  | HTTP Content-Range = 8128512   ✔ agrees
LCAM label declares 1323302912 | HTTP Content-Range = 1048576 ✘ disagrees by ~1262×
TCAM label declares 12192768 | HTTP Content-Range = 12192768  ✔ agrees
```
So the LCAM label's `<file_size>` is wrong. The `Axis_Array` element counts (1024×1024) and the HTTP
size (1,048,576) agree with each other, so the *dimensions* are still sound — only that one element
is untrustworthy.

---

## 9. Every measurement made in this pass (raw transcript)

```
# The famous farside panorama
206 | image/jpeg | jpeg | 10000x1229 | 3346126 bytes (3.19MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg
200 | image/tiff | tiff | 10000x1229 | 20995646 bytes (20.02MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/original/iau1901a.tif
200 | image/tiff | tiff | 10000x1229 | 21784359 bytes (20.78MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/publicationtiff10k/iau1901a.tif
206 | image/jpeg | jpeg | 4000x492 | 619216 bytes (0.59MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/publicationjpg/iau1901a.jpg
206 | image/jpeg | jpeg | 1280x157 | 69245 bytes (0.07MB) [range-honored] | https://iauarchive.eso.org/static/archives/images/screen/iau1901a.jpg
206 | image/jpeg | jpeg | 10000x1229 | 3346126 bytes (3.19MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/1/1b/The_first_panorama_from_the_far_side_of_the_moon.jpg

# Commons derivatives
206 | image/png | png | 5324x3204 | 20286075 bytes (19.35MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/4/48/ChangE-4_-_PCAM.png
206 | image/png | png | 2286x2553 | 9956507 bytes (9.50MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/1/1b/ChangE-4%2C_Yutu-2_%2851197517450%29.png
206 | image/jpeg | jpeg | 7999x3166 | 3405741 bytes (3.25MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/e/e5/Aitken_Basin_Von_K%C3%A1rm%C3%A1n_A_Chang%27e_4_%2848_images%29.jpg

# Public-domain LROC
206 | image/tiff | tiff | 14943x9869 | 147495868 bytes (140.66MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/a/a7/First_Look-_Chang%27e_4_%28LROC1090%29.tiff
206 | image/tiff | tiff | 10280x52400 | 538692872 bytes (513.74MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/5/59/Above_the_Landing_Site_%28LROC1092%29.tiff
206 | image/tiff | tiff | 5150x5163 | 26617140 bytes (25.38MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/3/3f/Topographic_Map_of_the_Chang%27e_4_Site_%28LROC1100%29.tiff
206 | image/jpeg | jpeg | 1100x1100 | 713892 bytes (0.68MB) [range-honored] | https://upload.wikimedia.org/wikipedia/commons/b/b3/Chang%27e_4_Lander-_A_Closer_Look_%2801_m1303619844lr_closC5A1C%29.jpg

# NASA (orbital, unrelated PIA)
206 | image/jpeg | jpeg | 1167x2582 | 249593 bytes (0.24MB) [range-honored] | https://images-assets.nasa.gov/image/PIA23383/PIA23383~orig.jpg

# Chinese media (low res, all-rights-reserved)
206 | image/jpeg | jpeg | 1080x1061 | 100075 bytes | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/19/20190111091909143.jpg
206 | image/jpeg | jpeg | 872x7087  | 755134 bytes | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/20/20190111092020960.jpg
206 | image/jpeg | jpeg | 800x787   | 47401 bytes  | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/08/20190111090851527.jpg
206 | image/jpeg | jpeg | 800x99    | 11472 bytes  | https://himg2.huanqiucdn.cn/attachment2010/2019/0111/09/09/20190111090904360.jpg

# HIGP PRPDC (NASA-affiliated archive of the CNSA release)
206 | image/tiff | tiff | 2200x1700 | 11246072 bytes (10.73MB) [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/PRPDC-0062.tif
206 | image/tiff | tiff | 1760x2420 | 12820748 bytes (12.23MB) [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/2019_01_Index.tif
206 | image/jpeg | jpeg | 400x550   | 103435 bytes (0.10MB)   [range-honored] | https://www.higp.hawaii.edu/prpdc/img/Months/January_2019/sm_2019_01_Index.jpg

# GRAS raw science frames (headerless rasters — Content-Range sizes, dims from PDS4 labels)
206 | application/octet-stream | 4096 | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAMR/C/2B/2019-07/CE4_GRAS_PCAMR-C-000_SCI_N_20190104041502_20190104041502_0001_B.2B   -> 8128512 B, 2352x1728x16bit
206 | application/octet-stream | 4096 | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/LCAM/1/2A/2019-03/CE4_GRAS_LCAM-1-0000_SCI_N_20190103022009_20190103022009_0001_A.2A    -> 1048576 B, 1024x1024x8bit
206 | application/octet-stream | 4096 | https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/TCAM/I/2C/2019-03/CE4_GRAS_TCAM-I-002_SCI_N_20190106033401_20190106033401_0004_A.2C     -> 12192768 B, 2352x1728x3x8bit

# Rate-limit behaviour of Wikimedia (recorded so it is not mistaken for a block)
429 | text/html | HTML | ?x? | 1965 bytes | https://upload.wikimedia.org/wikipedia/commons/...   ("Wikimedia Error")

# GRAS 科普教育 gallery — the CC BY 4.0 panoramas (§3.8). All 200, no login.
200 | image/jpeg | jpeg | 10000x833  | 6228953 bytes  | https://moon.bao.ac.cn/img-api/upload/2026/07/21/5S1环拍图（圆柱投影）_20260721041755A164.jpg
200 | image/jpeg | jpeg | 10000x1229 | 1894270 bytes  | https://moon.bao.ac.cn/img-api/upload/www/201911/5A点三圈镶嵌图（圆柱投影）.jpg
200 | image/jpeg | jpeg | 5000x4915  | 3039109 bytes  | https://moon.bao.ac.cn/img-api/upload/www/201911/4A点三圈镶嵌图（方位投影）.jpg
200 | image/jpeg | jpeg | 5000x687   | 3609970 bytes  | https://moon.bao.ac.cn/img-api/upload/www/201911/7D点三圈镶嵌图（圆柱投影）.jpg
200 | image/jpeg | jpeg | 5000x4879  | 4614955 bytes  | https://moon.bao.ac.cn/img-api/upload/www/201911/6D点三圈镶嵌图（方位投影）.jpg
200 | image/jpeg | jpeg | 5638x3113  | 2655851 bytes  | https://moon.bao.ac.cn/img-api/upload/2026/07/21/1A点拍着陆器_20260721085708A262.jpg
200 | image/jpeg | jpeg | 5691x3179  | 1895578 bytes  | https://moon.bao.ac.cn/img-api/upload/2026/07/21/2D点拍着陆器_20260721085750A264.jpg
200 | image/jpeg | jpeg | 5397x3157  | 5358411 bytes  | https://moon.bao.ac.cn/img-api/upload/2026/07/21/3S1点拍着陆器_20260721085854A266.jpg
200 | image/jpeg | jpeg | 1024x1024  | 591507 bytes   | https://moon.bao.ac.cn/img-api/upload/2026/07/21/5着陆_20260721085557A260.jpg
200 | video/mp4  | ?    | ?x?        | 116233479 bytes| https://moon.bao.ac.cn/img-api/upload/www/201911/6嫦娥四号降落视频.mp4
200 | image/jpeg | jpeg | 2352x1728  | 765254 bytes   | https://moon.bao.ac.cn/img-api/upload/www/201911/1A点月球车.jpg

# sha256 duplicate check (§3.8d) — the two "S1" entries are the SAME file
S1_title_azimuthal.jpg | 200 | 6228953 B | sha256=220d1c88a59f0b6de69793670864a0191446cc22
S1_cylindrical.jpg     | 200 | 6228953 B | sha256=220d1c88a59f0b6de69793670864a0191446cc22

# Zenodo Yutu-2 PCAM mosaics (§5.1) — BigTIFF, verified via DataCite + range-extraction
200 | - | tiff | 27308x21804 | 62598733 bytes (59.70MB) [range-honored] | F:\code\astro\.agents\research\dl\20210507O.tif
   (source: https://zenodo.org/api/records/11150203/files/Yutu%202%20rover%27s%20panoramic%20camera%20captures%20images.zip/content ,
    member lho=6647668083 csize=52239438 -> inflated 62598733 B; 9202/9202 LZW tiles decoded, 0 failures)
10.5281/zenodo.11150203 -> rightsIdentifier=cc-by-4.0 (SPDX) via https://api.datacite.org/dois/10.5281/zenodo.11150203
10.5281/zenodo.11197460 -> rightsIdentifier=cc-by-4.0 (SPDX) via https://api.datacite.org/dois/10.5281/zenodo.11197460

# NSSDC licence fields (independently read, §3.8a) — and contradicted by §3.9
/nssdc/coreMetadata/getDetail?linkId=1240 -> license: CC BY 4.0 | doi: 10.12176/03.88.00007
/nssdc/coreMetadata/getDetail?linkId=1302 -> license: CC BY 4.0 | doi: 10.12176/03.88.00006
/nssdc/coreMetadata/getDetail?linkId=1076 -> license: CC BY 4.0 | doi: 10.12176/03.88.00008
/nssdc/coreMetadata/getDetail?linkId=1074 -> license: CC BY 4.0 | doi: 10.12176/03.04.004
/nssdc/coreMetadata/getDetail?linkId=1195 -> license: CC BY 4.0 | doi: 10.12176/03.04.002
# GRAS platform's own statement instead says: 未经本平台书面许可…不得…复制、修改、抄录、传播及销售
#   (no reproduction/dissemination/sale without written permission; signed form to lpdc@nao.cas.cn)
```
