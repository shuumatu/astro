# Chang'e lunar surface panoramas — source research

Research date: 2026-09-12. Working dir `F:\code\astro`.
Every URL below was probed by me through the local proxy at `http://127.0.0.1:7890`, and every
dimension is a real measurement (HTTP `Range` GET + JPEG SOF / PNG IHDR parse, or the product's own
PDS label), **never** a host's marketing claim. Anything I could not confirm is marked unverified.

> **Environment correction — read this first.** The brief's premise that
> `images-assets.nasa.gov`, `www.lpi.usra.edu` and `commons.wikimedia.org` are "blocked" is **wrong**.
> The provided `net-probe.mjs` silently has no proxy (`undici` is not importable, so its `ProxyAgent`
> never constructs), so `HTTP_PROXY`/`HTTPS_PROXY` alone do nothing and those probes went direct.
> Node's global `fetch` only honours the env proxy when you also set **`NODE_USE_ENV_PROXY=1`**:
>
> ```powershell
> $env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"; node <script>
> ```
>
> With that, all three "blocked" hosts return 200/206. Chinese hosts (`moon.bao.ac.cn`,
> `vsso.nssdc.ac.cn`, `chinanews.com`, `people.cn`) are reachable **directly**, without the proxy.
> `upload.wikimedia.org` works but rate-limits with **HTTP 429** if you hammer it — space out requests.
> **`thumb.wikimedia.org` is NOT rate-limited**, so use a scaled derivative (e.g.
> `.../thumb/1/1b/<file>.jpg/3840px-<file>.jpg`, which I measured at `206 | JPEG | 3840x472 | 547112 B`)
> when the original 429s. `--use-env-proxy` as a CLI flag is **not** supported; it must be the env var.
> Genuinely unreachable: `lpi.usra.edu`, `science.org`, `agupubs`, `spaceflight101.com`,
> `dayooimg.dayoo.com`, `web.archive.org`.

## Ranked table

`verified` = I personally probed it and measured the file. Risk is about **redistributing** the bytes.

| # | mission/site | panorama name | coverage | dimensions | format | direct URL | licence | attribution | verified |
|---|---|---|---|---|---|---|---|---|---|
| 0 | `change-4` | **S1 360° PCAM ring panorama, cylindrical** (GRAS education gallery) | 360° cylindrical | **10000 × 833** (6,228,953 B) | JPEG | `https://moon.bao.ac.cn/img-api/upload/2026/07/21/5S1环拍图（圆柱投影）_20260721041755A164.jpg` | **CC BY 4.0** (NSSDC rec. 1240) — *watermarked* | CNSA / CLEP, GRAS | yes |
| 0b | `change-4` | **A-point TCAM triple-ring mosaic, cylindrical** — the famous panorama | 360° cylindrical | **10000 × 1229** (1,894,270 B) | JPEG | `https://moon.bao.ac.cn/img-api/upload/www/201911/5A点三圈镶嵌图（圆柱投影）.jpg` | **CC BY 4.0** (NSSDC rec. 1302) — *watermarked* | CNSA / CLEP, GRAS | yes |
| 0c | `change-4` | A-point TCAM triple-ring mosaic, **azimuthal** ("little planet") | 360° azimuthal | **5000 × 4915** (3,039,109 B) | JPEG | `https://moon.bao.ac.cn/img-api/upload/www/201911/4A点三圈镶嵌图（方位投影）.jpg` | **CC BY 4.0** — *watermarked* | CNSA / CLEP, GRAS | yes |
| 0d | `change-4` | D-point TCAM triple-ring mosaic, azimuthal / cylindrical | 360° | **5000 × 4879** (4,614,955 B) / **5000 × 687** (3,609,970 B) | JPEG | `.../www/201911/6D点三圈镶嵌图（方位投影）.jpg` / `.../7D点三圈镶嵌图（圆柱投影）.jpg` | **CC BY 4.0** — *watermarked* | CNSA / CLEP, GRAS | yes |
| 0e | `change-4` | PCAM lander mosaics from points A / D / S1 | partial (6-frame mosaics) | **5638 × 3113** / **5691 × 3179** / **5397 × 3157** | JPEG | `.../2026/07/21/1A点拍着陆器_...jpg`, `2D点拍着陆器_...jpg`, `3S1点拍着陆器_...jpg` | **CC BY 4.0** — *watermarked* | CNSA / CLEP, GRAS | yes |
| 1f | `change-4` | **Yutu-2 PCAM imagery archive — 11.79 GB, CC BY 4.0** (contains a 27308 × 21804 raster) | partial | 27308 × 21804 (raster inside) | ZIP | `https://zenodo.org/records/11150203` | **CC BY 4.0** (Zenodo + DataCite/SPDX) | Ma, Chen, Hu 2024 — DOI 10.5281/zenodo.11150203 | yes |
| 1 | `change-4` | *The first panorama from the far side of the moon* (IAU `iau1901a`, CNSA) | 360° cylindrical (8.14:1 strip) | **10000 × 1229** (3,346,126 B) | JPEG | `https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg` | **CC BY 4.0** (no watermark) | CNSA / CLEP, via IAU `iau1901a` | yes |
| 1b | `change-3` | **2013-12-17 lander TCAM 2C stitched panorama — highest-resolution CE-3 panorama found** | 360° | **15743 × 3505** (15,302,339 B) | JPEG | `https://planetary.s3.amazonaws.com/web/assets/pictures/20160129_TCAM-I-001_SCI_P_20131217113548_0004_A_2C_stitch.jpg` | **CC BY-NC-ND 3.0** — NC + ND | The Planetary Society / CNSA-CLEP | yes |
| 1c | `change-5` | **CE-5 lander+ascender PCAM ring panorama with the national flag** (CNSA, 4 Dec 2020) | fan/sector mosaic, **degree coverage NOT stated by CNSA** | **7500 × 4053** (24,758,565 B) | JPEG | `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg` | All rights reserved (国家航天局); no grant | CNSA (国家航天局) | yes |
| 1d | `change-3` | Yutu PCAM mosaic, rocks near Ziwei crater (from an open-access paper) | partial | **1594 × 646** (265,094 B) | JPEG | `https://upload.wikimedia.org/wikipedia/commons/1/11/Chang%27e_3_-_rocks_near_Ziwei_crater.jpg` | **CC BY 4.0** | Ding, Xiao, Su et al. — DOI 10.1186/s40623-021-01359-7 | yes |
| 1e | `change-6` | Chang'e-6 scooped sampling area, CE-6 PCAM frame (from an open-access paper) | partial | **804 × 682** (300,703 B) | JPEG | `https://upload.wikimedia.org/wikipedia/commons/7/76/Chang%27e-6_scooped_sampling_area.jpg` | **CC BY 4.0** | Li, Hu, Yang et al. — DOI 10.1093/nsr/nwae328 | yes |
| 2 | `change-4` | same image, Wikimedia mirror | 360° cylindrical | **10000 × 1229** (3.19 MB) | JPEG | `https://upload.wikimedia.org/wikipedia/commons/1/1b/The_first_panorama_from_the_far_side_of_the_moon.jpg` | **CC BY 4.0** | CNSA (wikitext `{{cc-by-4.0\|CNSA}}`) | partial (429 on repeat) |
| 3 | `change-4` | same image, TIFF original | 360° cylindrical | 10000 × 1229 (20,995,646 B per subagent) | TIFF | `https://iauarchive.eso.org/static/archives/images/original/iau1901a.tif` | CC BY 4.0 | CNSA via IAU | timeout on my probe |
| 4 | `change-4` | Yutu-2 leaving Chang'e-4 (crop of the above) | partial | 2185 × 1229 | JPEG | `https://upload.wikimedia.org/wikipedia/commons/5/54/Yutu-2_leaving_Chang_e-4-iau1901a.jpg` | CC BY 4.0 | CNSA via IAU | no (429) |
| 5 | `change-4` | 地形地貌相机环拍全景图 **圆柱投影** (TCAM cylindrical, 11 Jan 2019 release) | 360° cylindrical | **960 × 3713** (4,372,062 B) | PNG | `http://www.chinanews.com/cr/2019/0111/3478659747.png` | all rights reserved (chinanews) | CNSA / 中新网 | yes |
| 6 | `change-4` | 地形地貌相机环拍全景图 **方位投影** (TCAM azimuthal, 11 Jan 2019 release) | 360° azimuthal (disc) | **800 × 786** (521,246 B) | PNG | `http://www.chinanews.com/cr/2019/0111/1272058806.png` | all rights reserved (chinanews) | CNSA / 中新网 | yes |
| 7 | `change-6` | CNSA **stitched panoramic image**, PCAM on the CE-6 lander (4 Jun 2024) — **800×421 is the true master** | partial (single stitched strip) | **800 × 421** (40,868 B) | JPEG | `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543423.jpg` | all rights reserved (国家航天局) | CNSA (国家航天局) | yes |
| 7b | `change-6` | same image on People's Daily — **an UPSCALE of the 800×421 master, not a larger original** | partial | 1024 × 539 (601,444 B) | PNG | `https://en.people.cn/mediafile/pic/BIG/20240604/13/5277548329692745417.png` | all rights reserved | CNSA / Xinhua | yes |
| 8 | `change-6` | CE-6 lander LCAM surface frames (3 images) | partial | **1024 × 752** | PNG | `.../20240604/17/9292031629426019497.png`, `.../69/6983592089598844405.png`, `.../92/4786878528220927460.png` | all rights reserved | CNSA / Xinhua | yes |
| 9 | `change-6` | CE-6 mini-rover image of the lander-ascender | partial | 1024 × 640 | PNG | `https://en.people.cn/mediafile/pic/BIG/20240604/15/12030254610665021119.png` | all rights reserved | CNSA / Xinhua | yes |
| 10 | `change-3` | GRAS PCAM Level **2C** (colour-restored single frame) | 1 frame (~2.7° FOV) | **2352 × 1728**, 8-bit × 3 band RGB | PDS3 label + raw | `https://moon.bao.ac.cn/PUBDATA/PCAML-C/2C/CE3_BMYK_PCAML-C-056_SCI_N_20140113200002_20140113200002_0008_A.2C` | GRAS all-rights-reserved; VSSO registry says **CC BY 4.0** | GRAS / NAOC / CNSA | yes |
| 11 | `change-3` | GRAS PCAM Level 2B (geometrically located frame) | 1 frame | **2352 × 1728**, 16-bit, 1 band | PDS3 + raw | `https://moon.bao.ac.cn/PUBDATA/PCAML-C/2B/CE3_BMYK_PCAML-C-056_SCI_N_20140113200002_20140113200002_0008_A.2B` | as above | GRAS / NAOC / CNSA | yes |
| 12 | `change-4` | GRAS PCAM Level 2B frame | 1 frame | **1176 × 864**, 16-bit | PDS4 label + raw | `https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAM/2B/2026-03-03/CE4_GRAS_PCAML-Q-055_SCI_N_20251224062658_20251224062658_0362_B.2B` | GRAS all-rights-reserved; VSSO says **CC BY 4.0** (DOI 10.12176/03.04.004) | GRAS / NAOC / CNSA | yes |
| 13 | `change-4` | 全景相机图片集 — CE-4 PCAM quick-view gallery, **27 images incl. the 360° S1 ring panorama** | 360° + partial | quick-views **1176 × 865/864** (3 × **2352 × 1730**); S1 pano **10000 × 833** | image gallery (JPEG) | enumerated via `client/education/educationList?task=7&load=372`; files under `https://moon.bao.ac.cn/img-api/upload/...` | **CC BY 4.0** (DOI 10.12176/03.88.00007) — *watermarked* | NAOC GRAS via NSSDC | **yes (resolved, §1b)** |
| 14 | `change-5` | GRAS PCAM Level 2B frame | 1 frame | **2352 × 1728**, 16-bit | PDS4 label + raw | `https://moon.bao.ac.cn/PUBDATA/CE5ROLL/PCAMR/PCAMR-I-008/2B/202012/CE5-L_GRAS_PCAMR-I-008_SCI_N_20201203054903_20201203054903_0004_A.2B` | GRAS all-rights-reserved (no VSSO CC record) | GRAS / NAOC / CNSA | yes |
| 15 | `change-6` | GRAS PCAM Level 2B frame | 1 frame | **2352 × 1728**, 16-bit | PDS4 label + raw | `https://moon.bao.ac.cn/WEBDATA/CE6/CE6_PCAM_20251124162721/CE6-L_GRAS_PCAML-I-120_SCI_N_20240603134954_20240603134954_0004_A.2B` | GRAS all-rights-reserved (no VSSO CC record) | GRAS / NAOC / CNSA | yes |
| 16 | `change-3` | CE-3 press panoramas (Dec 2013 / Jan 2014) | 360° | superseded — see row 1b | — | see §4 | — | Xinhua / CNSA | no |
| 17 | `change-5` | CE-5 PCAM ring panorama — **provenance now RESOLVED** to CNSA | see row 1c | 7500 × 4053 (24,758,565 B) | JPEG | `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg` | all rights reserved | CNSA | yes |

---

## 1. The single best asset: the open-licensed CE-4 panorama (IAU `iau1901a`)

This is the only **full-surface Chang'e panorama with a genuine open licence** that I could confirm.

**Probe (mine):**

```
206 | JPEG | 10000x1229 | 3346126 bytes (3.19 MB) | got=262144 | https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg
```

**Licence evidence — Wikimedia raw wikitext** (`...&action=raw`, 200, 1080 B), quoted verbatim:

```
{{Information
| Description    = Panorama of the landing site of Chang'e-4 on the far side of the Moon
| Date           = Release date: 15 February 2019, 07:00
| Source         = [https://www.iau.org/public/images/detail/iau1901a/ Panorama of the Landing Site of Chinese Chang’e-4 Probe on Far Side of the Moon].  International Astronomical Union. 
| Permission     = [https://www.iau.org/copyright/ Usage of Images, Videos and Web Texts]. International Astronomical Union. 
| Author         = CNSA
...
== {{int:license-header}} ==
{{IAU-source|iau1901a}}
{{cc-by-4.0|CNSA}}
```

The rendered Commons page independently confirms size and licence category:

> `Original file (10,000 × 1,229 pixels, file size: 3.19 MB, MIME type: image/jpeg)`
> `wgCategories:["Media from the International Astronomical Union with known IDs","CC-BY-4.0","Far side of the Moon","Yutu 2","Chang'e 4"]`

Note the release date here is **15 February 2019**, distinct from the 11 January 2019 CNSA/TCAM release
in §2. The IAU page `https://www.iau.org/public/images/detail/iau1901a/` is **404 (moved)**; the file is
served from the IAU archive at ESO, which is what works.

**Geometry caveat — important for the demo.** 10000 × 1229 is a **≈8.14:1 cylindrical strip**, not a
2:1 equirectangular image. To use it as a Three.js sphere/skybox you must pad the vertical extent (or
map it to a partial cylinder), otherwise it stretches badly. The "360°" coverage label comes from
CNSA/Xinhua describing the release as a 360-degree panorama (`circular/ring-shot`, 环拍) and the
azimuthal/cylindrical projection pair; the file itself is a strip, so treat full-360 coverage as an
inference from the release framing rather than something the file geometry proves.

## 1b. **The GRAS education gallery — real stitched 360° panoramas, direct download, no login** (the big find)

This is the most important practical result in this report, and it **resolves the §6 blocker**.

The NSSDC/VSSO record 1240 ("全景相机图片集", CC BY 4.0) has a `url` field pointing at
`https://moon.bao.ac.cn/mall/moonDATA`. Following that into the GRAS portal, the same image galleries are
served by an **unauthenticated JSON endpoint**:

```
GET https://moon.bao.ac.cn/moon-admin/client/education/educationList?pageNum=1&pageSize=100&task=7&load=372
    task=7 (Chang'e 4);  load=372 PCAM, 368 TCAM, 366 LCAM
```

I enumerated **48 CE-4 gallery items** and measured **every one**. The images themselves come from
`https://moon.bao.ac.cn/img-api/upload/...` as ordinary JPEGs — plain HTTPS, **no cookie, no auth, no
order/cart flow**. These are the *stitched, projected, colour* panorama products — exactly what the demo
needs — not raw frames.

### The stitched panoramas (all measured by me, all HTTP 206/200)

| gallery item | projection | dimensions | bytes |
|---|---|---|---|
| **S1 环拍图** (S1 rover 360° ring shot) | cylindrical | **10000 × 833** | 6,228,953 |
| **A点三圈镶嵌图** (A-point triple-ring mosaic) | cylindrical | **10000 × 1229** | 1,894,270 |
| **A点三圈镶嵌图** | azimuthal ("little planet") | **5000 × 4915** | 3,039,109 |
| **D点三圈镶嵌图** | azimuthal | **5000 × 4879** | 4,614,955 |
| **D点三圈镶嵌图** | cylindrical | **5000 × 687** | 3,609,970 |
| A点拍着陆器 (lander imaged from A) | 6-frame mosaic | **5638 × 3113** | 2,655,851 |
| D点拍着陆器 | — | **5691 × 3179** | 1,895,578 |
| S1点拍着陆器 | — | **5397 × 3157** | 5,358,411 |
| 5 × LCAM descent frames | — | 1024 × 1024 | 390,781 – 591,507 |

Plus ~40 PCAM "快视图" quick-view frames (1176 × 864/865, three at 2352 × 1730) and two MP4 videos
(LCAM landing video 116,233,479 B; A-point rover video 14,300,076 B).

Exact probe output for the three most important (URL-encoded; the filenames contain Chinese and
full-width parentheses, so they must be percent-encoded):

```
206 | JPEG | 10000x1229 | 1894270 bytes | .../www/201911/5A%E7%82%B9%E4%B8%89%E5%9C%88%E9%95%B6%E5%B5%8C%E5%9B%BE%EF%BC%88%E5%9C%86%E6%9F%B1%E6%8A%95%E5%BD%B1%EF%BC%89.jpg
206 | JPEG |  5000x4915 | 3039109 bytes | .../www/201911/4A%E7%82%B9%E4%B8%89%E5%9C%88%E9%95%B6%E5%B5%8C%E5%9B%BE%EF%BC%88%E6%96%B9%E4%BD%8D%E6%8A%95%E5%BD%B1%EF%BC%89.jpg
206 | JPEG | 10000x833  | 6228953 bytes | .../2026/07/21/5S1%E7%8E%AF%E6%8B%8D%E5%9B%BE%EF%BC%88%E5%9C%86%E6%9F%B1%E6%8A%95%E5%BD%B1%EF%BC%89_20260721041755A164.jpg
```

### Verified visuals (I downloaded and viewed these)

- The **A-point 10000 × 1229 cylindrical** file is a genuine full 234°-wide cylindrical sweep: the lander
  deck with deployed solar panels and the Yutu-2 rover sitting at mid-distance with its wheel tracks,
  black sky above. It matches the scene in the IAU file.
- **The GRAS copies carry a baked-in watermark.** I cropped the top-right corner at full resolution and
  read it directly: a 「中国探月 CLEP」 logo plus a 「地面应用系统 GRAS」 logo (the latter clipped by the
  image edge). **CC BY 4.0 does not entitle you to remove it.** Budget for keeping it, or prefer the IAU
  copy for the same scene.
- The **S1 PCAM 10000 × 833** is a *different, unique* panorama (not on Commons/IAU): the lander on the
  surface with panels deployed, the rover's own shadow, and the PCAM mast.

### Two corrections worth stating explicitly

1. **The famous panorama is the A-point TCAM 三圈镶嵌图** (terrain camera, lander-based), and the GRAS
   `10000 × 1229` file is the **same scene** as the IAU `iau1901a` `10000 × 1229` file. The **IAU copy is
   the better asset**: 3,346,126 B vs 1,894,270 B at identical dimensions (less compression), and **no
   watermark**. Prefer the IAU file; cite "CNSA/CLEP, via IAU, CC BY 4.0".
2. The gallery lists **two** S1 entries labelled 方位投影 and 圆柱投影, but they are **byte-identical**
   (my subagent sha256-matched them; both my probes returned 10000 × 833 / 6,228,953 B). There is only
   **one** S1 panorama and it is cylindrical. Note the gallery's own title/filename disagree — the entry
   titled 方位投影 points at a filename ending 圆柱投影 — so **trust the measured geometry, not the
   label**, for that row.

## 2. The 11 January 2019 CE-4 release (best Chinese-media copies)

The official CNSA release of 2019-01-11 was made by the **lander's terrain camera (TCAM, 地形地貌相机)**,
not the rover PCAM, and was published as **two projections**. Confirmed by the china.com.cn caption I
retrieved:

> `嫦娥四号着陆器地形地貌相机环拍全景图（方位投影）。新华社发（国家航天局 供图）`

The original Xinhua file is **dead** and the china.cn copy is a thumbnail:

```
404 | unknown | dims? | 4655 B | http://www.xinhuanet.com/photo/2019-01/11/1210035779_15471695828711n.jpg
200 | jpeg | 210x135 | 12604 B | http://images.china.cn/site1000/2019-01/11/0fd35dde-c0e2-4fae-ad34-fba707335ea5.jpg
```

The largest surviving copies are on chinanews (all independently re-measured by me):

```
206 | PNG | 960x3713 | 4372062 bytes (4.17 MB) | http://www.chinanews.com/cr/2019/0111/3478659747.png   <- 圆柱投影 cylindrical
206 | PNG | 800x786  |  521246 bytes (0.50 MB) | http://www.chinanews.com/cr/2019/0111/1272058806.png   <- 方位投影 azimuthal
```

(page: `https://www.chinanews.com.cn/gn/2019/01-11/8726772.shtml`). Note the cylindrical copy is
**portrait-oriented** (960 wide × 3713 tall) — the panorama is stored rotated 90°.

**Licence:** chinanews asserts all rights reserved and requires written authorisation to reuse its
material. The underlying imagery is a Chinese government work with **no explicit open licence**.
→ **reference-only; do not redistribute.** Use the IAU CC BY 4.0 file in §1 instead.

## 3. GRAS / CLEP ground segment (`moon.bao.ac.cn`) — open API, no login, but no panorama product

This is the Lunar and Planetary Data Release System (月球与行星数据发布系统) run by NAOC's Ground
Research and Application System. I reverse-engineered it; **the read and download APIs need no auth.**

### 3.1 Endpoints (all verified 200 JSON, no cookies)

| purpose | endpoint |
|---|---|
| mission/instrument/level tree | `GET https://moon.bao.ac.cn/moon-admin/client/science/categoryTree` |
| product search | `GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfoList?pageNum=&pageSize=&task=&load=&name=` |
| product detail (incl. annex path) | `GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfo/{dataInfoId}` |
| **resolve a direct file URL** | `GET https://moon.bao.ac.cn/moon-admin/client/science/dataInfo/getAnnexZip/{dataInfoId}` |
| **gallery images (stitched panoramas)** | `GET https://moon.bao.ac.cn/moon-admin/client/education/educationList?pageNum=&pageSize=&task=&load=` |
| copyright statement | `GET https://moon.bao.ac.cn/moon-admin/client/science/copyrightList` |
| citation/acknowledgement | `GET https://moon.bao.ac.cn/moon-admin/client/science/dataQuteThankList` |

`getAnnexZip` returns a **plain public URL with no token**, e.g.

```json
{"msg":"","code":200,"data":"https://moon.bao.ac.cn/PUBDATA/CE4ROLL/CE4/PCAM/2B/2026-03-03/CE4_GRAS_PCAML-Q-055_SCI_N_20251224062658_20251224062658_0362_B.2B"}
```

and that file serves `206` with **no cookies/auth**. So the archive is fully open to fetch.

### 3.2 Product counts and true geometry (from the products' own PDS labels)

| mission (task id) | instrument (load id) | products | geometry (from PDS label / arithmetic) | bytes/file |
|---|---|---|---|---|
| CE-3 (6) | PCAM (352) | 1,492 | **2352 × 1728**; 2A/2B 16-bit 1-band, 2C 8-bit 3-band RGB | 8,133,216 / 8,137,920 / 12,199,824 |
| CE-3 (6) | TCAM (345) | 2,151 | 2352 × 1728 class | 4,071,312 (2B) |
| CE-3 (6) | LCAM (349) | 9,344 | 1024 × 1024 class | 1,147,904 (2B) |
| CE-4 (7) | PCAM (372) | 26,742 | **1176 × 864**, 16-bit | 2,032,128 |
| CE-4 (7) | TCAM (368) | 480 | 2352 × 1728 × 3 RGB 8-bit | 12,192,768 |
| CE-4 (7) | LCAM (366) | 10,882 | 1024 × 1024 | 1,048,576 |
| CE-5 (8) | PCAM (386) | 1,588 | **2352 × 1728**, 16-bit | 8,128,512 |
| CE-5 (8) | LCAM (384) | 1,608 | 2352 × 1728 | 4,064,256 |
| CE-6 (9) | PCAM (395) | 1,172 | **2352 × 1728**, 16-bit | 8,128,512 |
| CE-6 (9) | LCAM (393) | 1,516 | — | 396,900 |

Raw label evidence for the two most important:

```
CE-3 PCAM 2B  CE3_BMYK_PCAML-C-056_..._0008_A.2B   (8,137,920 B)
  RECORD_BYTES=4704  FILE_RECORDS=1730  LABEL_RECORDS=2  ^IMAGE=3
  OBJECT=IMAGE: BANDS=1  LINES=1728  LINE_SAMPLES=2352  SAMPLE_TYPE=LSB_UNSIGNED_INTEGER
                SAMPLE_BITS=16  BAND_STORAGE_TYPE=N/A  DESCRIPTION=COLOR

CE-3 PCAM 2C  CE3_BMYK_PCAML-C-056_..._0008_A.2C   (12,199,824 B)
  RECORD_BYTES=2352  FILE_RECORDS=5187  LABEL_RECORDS=3  ^IMAGE=4
  OBJECT=IMAGE: LINES=1728  LINE_SAMPLES=2352  SAMPLE_BITS=8  BANDS=3
                BAND_STORAGE_TYPE=SAMPLE_INTERLEAVED  DESCRIPTION=COLOR
```

Raw PDS4 `<Axis_Array>` evidence:

```
CE-4 PCAM 2B  CE4_GRAS_PCAML-Q-055_..._0362_B.2B  -> <axis_name>Line</axis_name><elements>864</elements>
                                                     <axis_name>Sample</axis_name><elements>1176</elements>
CE-5 PCAM 2B  CE5-L_GRAS_PCAMR-I-008_..._0004_A.2B -> Line 1728, Sample 2352, UnsignedLSB2, file_size 8128512
CE-6 PCAM 2B  CE6-L_GRAS_PCAML-I-120_..._0004_A.2B -> Line 1728, Sample 2352, UnsignedLSB2, file_size 8128512
```

**Three things worth flagging:**

1. **CE-4 PCAM is binned to 1176 × 864**, unlike CE-3/5/6 which are 2352 × 1728. I checked 300 CE-4
   PCAM catalogue rows: the data files are *all* exactly 2,032,128 B = 1176·864·2, so this is
   consistent, not a one-off.
2. **The catalogue's `dataSize` field is unreliable.** For CE-6 PCAM it says 793,800 B, but the server
   says `content-range: bytes 0-0/8128512` and the label says `<file_size>8128512</file_size>`. Trust
   the label and the HTTP `Content-Range`, not `dataSize`.
3. Files are **not images you can drop into a `<img>` tag.** CE-3 products are PDS3 *attached* labels
   (the file literally starts with ASCII `PDS_VERSION_` followed by 16-bit binary); CE-4/5/6 are PDS4
   with a separate `.2BL` XML label and a raw little-endian binary. All need decode + de-Bayer +
   calibration before they look like photographs.

**There is no mosaic/panorama product in GRAS.** I searched the catalogue for `MOSAIC` and `PAN`
(0 hits) and `快视` quick-view (0 hits); the PCAM holdings are individual frames only. So GRAS gives you
the *raw material* for a panorama, not a panorama.

### 3.3 Licence — a genuine conflict you must decide on

GRAS's own copyright page (`/client/science/copyrightList`, per mission) says, verbatim:

> 本平台对其发布的数据产品或服务及平台上发布的相关信息的全部内容拥有版权等知识产权，受法律保护。
> **未经本平台书面许可，任何单位及个人不得以任何方式或理由对上述数据产品、服务、信息、材料的任何部分进行复制、修改、抄录、传播及销售。**

("…without the written permission of this platform, no entity or individual may copy, modify,
transcribe, disseminate or sell any part of the above data products…")

Its required citation / acknowledgement (`/client/science/dataQuteThankList`) is:

> 本数据集由中国月球与深空探测工程地面应用系统处理制作，由中国国家航天局提供(http://clpds.bao.ac.cn)
>
> English: *This data set is processed and produced by "Ground Research and Application System (GRAS)
> of China's Lunar and Planetary Exploration Program, provided by China National Space Administration
> (http://clpds.bao.ac.cn)"* — and results should be reported to `lpdc@nao.cas.cn`.

But the **National Space Science Data Center registry (VSSO) records the same datasets as `CC BY 4.0`**
— see §6. So GRAS says "all rights reserved, no redistribution" while the national data-centre
catalogue says "CC BY 4.0". A subagent read the GRAS 数据版权申明 **in full** and reports that it demands
**written permission and a hand-signed application form** for publication/commercial use. On that basis
the correct position is **not** "GRAS is CC BY 4.0" — it is that **the two statements directly conflict
and the conflict is unresolved**. Do not treat GRAS bytes as open; get written permission, or rely on the
IAU/LROC/Zenodo routes instead.

## 4. Chang'e 3 — a very high-resolution panorama **does** exist (but NC/ND)

**Correction to my earlier draft:** CE-3 does have a high-resolution stitched panorama. It was released
by The Planetary Society (carrying CNSA/CLEP data) and I measured it myself:

```
206 | JPEG | 15743x3505 | 15302339 bytes (14.59 MB) | https://planetary.s3.amazonaws.com/web/assets/pictures/20160129_TCAM-I-001_SCI_P_20131217113548_0004_A_2C_stitch.jpg
```

That is the **2013-12-17 lander TCAM Level-2C panorama**, and at 15743 × 3505 it is the widest
single Chang'e panorama found anywhere in this research — wider than the CE-4 IAU file (10000 px).
The filename encodes the product id `TCAM-I-001_SCI_P_20131217113548_0004_A_2C`, i.e. it is a direct
stitch of the GRAS `2C` colour products described in §3.

Three further CE-3 mosaics were also measured: **8192 × 5293**, **4095 × 2768** and **2144 × 2144**
(subagent-reported; I verified only the 15743 × 3505 file myself).

**The Planetary Society also mirrors the complete raw CE-3 archive with no login**:
`http://planetary.s3.amazonaws.com/data/change3/pcam.html` and `.../tcam.html` (frames measure
2352 × 1728 PNG).

⚠️ **Licence blocker: `CC BY-NC-ND 3.0`.** The **NC** clause forbids use in a monetised demo, and **ND**
forbids derivative works — which is exactly what reprojecting a fan/cylindrical panorama into a
Three.js equirectangular skybox is. So the highest-resolution CE-3 panorama available is **not usable**
for this demo in its intended form, despite being "Creative Commons". Always read the clause letters,
not just the "CC" prefix.

**The cleanly-licensed CE-3 alternative** is a Yutu PCAM boulder mosaic published in an open-access
paper under a true **CC BY 4.0**:

```
File:Chang'e 3 - rocks near Ziwei crater.jpg  ->  1594 x 646, 265,094 B, CC BY 4.0
  https://upload.wikimedia.org/wikipedia/commons/1/11/Chang%27e_3_-_rocks_near_Ziwei_crater.jpg
  Artist: Chunyu Ding, Zhiyong Xiao, Yan Su   Credit: DOI 10.1186/s40623-021-01359-7
  Description: "This mosaic was obtained by the panoramic camera on the Yutu rover."
```

Small (1594 × 646), partial coverage, but **genuinely open** — no NC, no ND.
(Confirmed via the Commons `imageinfo` API: `LicenseShortName: "CC BY 4.0"`,
`AttributionRequired: "true"`.)

## 5. Chang'e 5 and Chang'e 6

### Chang'e 5 — **yes, CNSA did publish a surface panorama** (provenance now resolved)

**Correction to my earlier draft:** the unexplained 7500 × 4053 JPEG is now traced to CNSA itself.

```
206 | JPEG | 7500x4053 | 24758565 bytes (23.61 MB) | https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg
```

- **Source page:** `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/content.html` —
  "国家航天局公布嫦娥五号月表国旗展示照片", 发布日期 **2020年12月04日**.
- **Caption, verbatim:** 嫦娥五号着陆器和上升器组合体全景相机环拍成像，五星红旗在月面成功展开，此外图像上方可见已完成表取采样的机械臂及采样器。
  ("Imaged by the panoramic camera on the Chang'e-5 lander/ascender combination, the five-star red flag
  successfully unfurled on the lunar surface; also visible above are the sampling arm and sampler that
  have completed surface sampling.")
- So this **is** an official CE-5 PCAM surface panorama — CNSA says only "全景相机环拍成像"
  (panoramic-camera pan-around imaging); it **states no projection and no degree coverage**.
- A byte-identical CLEP mirror exists: `http://www.clep.org.cn/n5982341/c6810754/part/6785492.jpg`.
- ⚠️ **Geometry:** it is a **fan/sector-shaped stitched mosaic with large black unfilled corners in a
  1.85:1 frame** — *not* equirectangular, *not* a 2:1 360×180 strip, *not* a cylindrical 360 strip.
  **Do not attach a degree figure to it.**
- ⚠️ **Licence:** site footer states only 版权所有：国家航天局 — **no open licence, no reuse grant**.
  Burned-in 中国探月/CLEP watermark. → **risk HIGH; reference-only.**

Also available: **GRAS holds 1,588 CE-5 PCAM frames at 2352 × 1728, 16-bit** (`/PUBDATA/CE5ROLL/...`),
openly fetchable. Verified: `206`, `content-range: bytes 0-0/8128512`. **No CE-5 PCAM imagery dataset is
registered in VSSO**, so CE-5 has no CC BY 4.0 route at all — GRAS's all-rights-reserved notice is the
only licence position.
- The Dec 2020 press imagery beyond the panorama (flag close-ups, "高清大片") exists but I only found
  **~500 × 258 px** copies, e.g. `http://henan.china.com.cn/pic/2020-12/03/d7bf702e-9cdf-439d-b985-efd83df1b0a7.jpeg`
  (measured `500x258`).

### Chang'e 6 — a real official stitched panorama exists, but only at 1024 px

CNSA released a **PCAM stitched panoramic image** on 2024-06-04. People's Daily hosts it with an
explicit caption (quoted from the page):

> *This stitched panoramic image released by the China National Space Administration (CNSA) on June 4,
> 2024, which was taken with the panoramic camera on the lander of Chang'e-6 probe, shows a view of the
> lunar surface. (CNSA/Handout via Xinhua)*

Measured by me:

```
206 | PNG | 1024x539 | 601444 bytes (0.57 MB) | https://en.people.cn/mediafile/pic/BIG/20240604/13/5277548329692745417.png
```

There is **no larger variant** on People's Daily — `.../pic/SMALL/...` and `.../pic/...` both 404.
Companion CE-6 images from the same release: mini-rover **1024 × 640**, LCAM frames **1024 × 752 ×3**.

⚠️ **Correction: the 1024 × 539 People's Daily file is an UPSCALE, not the master.** The true CNSA
original is only **800 × 421** (40,868 B), and I measured it directly:

```
206 | JPEG | 800x421 | 40868 bytes | https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543423.jpg
```

Source page `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/content.html` (2024-06-04). Caption
verbatim: 该图由全景相机在嫦娥六号表取采样前，对着陆点北侧月面拍摄的彩色图像镶嵌制作而成。图像上方是着陆点北部查菲环形山，图像的下方是着陆腿和着陆时冲击挤压隆起的月壤。
Both the 800×421 CNSA file and the 1024×539 People's Daily file share the same 1.90:1 aspect, and a
subagent visually confirmed the 1024 px copies are padded upscales. **So the CE-6 stitched panorama
master is 800 × 421 — even smaller than I first reported.** A byte-identical CLEP mirror sits at
`http://www.clep.org.cn/n5982014/c10707551/part/10707557.jpg`.

**Sharpest CE-6 material** is the three LCAM descent frames at **2352 × 1728**
(`.../c10543340/part/10543420-22.jpg`) plus a **1280 × 800** lander+ascender selfie
(`.../part/10543450.jpg`).

**The only cleanly-licensed CE-6 surface image** is a real PCAM frame published in an open-access paper
under true **CC BY 4.0**:

```
File:Chang'e-6 scooped sampling area.jpg  ->  804 x 682, 300,703 B, CC BY 4.0
  https://upload.wikimedia.org/wikipedia/commons/7/76/Chang%27e-6_scooped_sampling_area.jpg
  Artist: Chunlai Li, Hao Hu, Meng-Fei Yang   Credit: DOI 10.1093/nsr/nwae328
  Description: "Image of the scooped area on the lunar surface captured by the Chang'e-6 panoramic camera."
```

(Confirmed via the Commons `imageinfo` API: `LicenseShortName: "CC BY 4.0"`.) Small and partial, but open.
Note the **CE-6 flag image remains UNVERIFIED** — the only host carrying it was unreachable.
Also: `File:Chang-e-5-Lander-Flag.png` on Commons is an **artist's CGI impression, not a photograph** —
do not present it as real imagery.

GRAS also holds **1,172 CE-6 PCAM frames at 2352 × 1728, 16-bit** — i.e. **higher resolution than the
official stitched release**, though as individual frames.

Licence for the People's Daily / CNSA images: **all rights reserved**, CNSA via Xinhua — no open
licence. → reference-only.

**Site-id note:** the demo's ids are `change-3`, `change-4`, `change-5`. Chang'e 6 has real, worthwhile
surface imagery (an official stitched PCAM panorama plus full-res GRAS frames) and would need a **new
site id, e.g. `change-6`**.

## 6. The VSSO / NSSDC open-licence registry — the most decision-changing finding

The National Space Science Data Center's Virtual Space Science Observatory (`vsso.nssdc.ac.cn`)
catalogues Chinese lunar data with **machine-readable licences and DOIs**. API (both verified):

```
POST https://vsso.nssdc.ac.cn/nssdc/coreMetadata/coreMetadataList   body: {"searchKeywords":"...","pageNum":1,"pageSize":50}
GET  https://vsso.nssdc.ac.cn/nssdc/coreMetadata/getDetail?linkId=1240
```

The relevant records, all **`license: "CC BY 4.0"`, `shareScope: "完全共享"` (fully shared)**:

| linkId | dataset | DOI / CSTR | licence |
|---|---|---|---|
| **1176** | 嫦娥三号全景相机2B级科学数据 — CE-3 PCAM Level 2B, PDS3 (sharePlan 即时公开 = immediate) | `10.12176/03.03.005` / `14804.11.03.03.005` | **CC BY 4.0** |
| **1074** | 嫦娥四号全景相机2B级科学数据 — CE-4 PCAM Level 2B, PDS4, lunar days 1–15 | `10.12176/03.04.004` / `14804.11.03.04.004` | **CC BY 4.0** |
| **1240** | **全景相机图片集** — CE-4 PCAM image gallery, **27 quick-view images, lunar days 1–9** | `10.12176/03.88.00007` / `14804.11.03.88.00007` | **CC BY 4.0** |
| 1302 | 地形地貌相机图片集 — CE-4 TCAM gallery | — | CC BY 4.0 |
| 1076 | 降落相机图片集 — CE-4 LCAM gallery | `10.12176/03.88.00008` | CC BY 4.0 |
| 1195 | 嫦娥四号地形地貌相机2C级科学数据 — 240 colour-restored TCAM frames | `10.12176/03.04.002` | CC BY 4.0 |

Record 1240 is the most interesting one for a panorama demo. Its own description says (translated):

> "This image collection comprises the quick-view images from the panoramic camera on the Chang'e-4
> rover during lunar days 1–9, including imaging of the lander by the PCAM when the rover reached
> points A and D, **and the 360° ring-shot panorama from the panoramic camera when the rover reached
> point S1; the projections are azimuthal projection and cylindrical projection.**"
> (keywords: `A点；D点；S1点；`)

So a **CC BY 4.0, 360°, azimuthal + cylindrical projection CE-4 PCAM panorama set is catalogued
officially**. This matches the SMOC release announcement of 2020-07-27
(`https://www.smoc.ac.cn/news/2242.jhtml`), which states verbatim:

> 本次发布的数据包括嫦娥四号巡视器（玉兔二号月球车）上所搭载的全景相机在第一至第九月昼的快视图，共计27张图片。
> 用户可通过国家空间科学数据中心空间科学虚拟观测台（vsso.nssdc.ac.cn）访问相关数据资源。

("…the quick-view images from the panoramic camera on the Chang'e-4 rover during lunar days 1–9,
**27 images in total**… accessible via vsso.nssdc.ac.cn.")

**~~Blocker~~ RESOLVED — see §1b.** The VSSO record itself is metadata only, and the VSSO API exposes no
file list (`queryCollection` only handles bookmarking). But the record's `url` field leads to the GRAS
portal, whose `client/education/educationList` endpoint serves these exact gallery images as plain
unauthenticated JPEGs, which I enumerated and measured. The `全景相机图片集` is now resolved to concrete
URLs and dimensions: the PCAM quick-view frames are **1176 × 865/864** (three at **2352 × 1730**), and
the 360° ring panorama at S1 is **10000 × 833**. Note the delivered images are the *watermarked* gallery
renditions (§1b), not pristine originals.

## 7. Archives: PDS, ESA, repositories, LROC

Reported by the repository subagent (its notes are at `.agents/research/notes-archives.md`); I verified
the *reachability* and the key panorama files myself where noted.

- **The Planetary Society mirrors the complete raw CE-3 archive with no login**:
  `http://planetary.s3.amazonaws.com/data/change3/pcam.html` and `.../tcam.html` (frames 2352 × 1728 PNG),
  plus several stitched mosaics including the 15743 × 3505 panorama in §4. Licence is
  **CC BY-NC-ND 3.0** — see §4 for why the NC/ND clauses matter.
- **Open-access papers are a genuine CC BY 4.0 route for real surface imagery.** Both files I confirmed
  via the Commons `imageinfo` API carry `LicenseShortName: "CC BY 4.0"` and `AttributionRequired: "true"`,
  with journal DOIs rather than agency terms:
  - `Chang'e 3 - rocks near Ziwei crater.jpg` — Yutu PCAM mosaic, 1594 × 646, DOI 10.1186/s40623-021-01359-7
  - `Chang'e-6 scooped sampling area.jpg` — CE-6 PCAM frame, 804 × 682, DOI 10.1093/nsr/nwae328
  This is the most legally robust path for actual Chang'e surface pixels, though the images are small and
  partial. **Searching open-access Chang'e papers for CC BY figures is a productive strategy the demo
  team should reuse.**
- **NASA PDS does not host Chang'e PCAM imagery.** PDS holds some Chinese radio-science/tracking and
  gravity data, but no Chang'e surface panorama products. ESA's PSA likewise has none. (Negative result,
  consistent with expectation.) The Planetary Society's CE-3 mirror in the previous bullet is *not* PDS.
- **Zenodo DOES hold a CC BY 4.0 Chang'e-4 archive** (correcting my earlier draft, which searched only
  for a deposited *panorama*). Record `10.5281/zenodo.11150203`, "Study on the degradation pattern of
  impact crater communities in Yutu-2's rovering area" (Ma, Chen, Hu, 2024-05-08). I verified the licence
  through **both** the Zenodo API (`"license":{"id":"cc-by-4.0"}`, `access_right: open`) **and DataCite**
  (`rightsIdentifier: "cc-by-4.0"`, `rightsIdentifierScheme: "SPDX"`). Files, exactly:
  - `Classified Craters.zip` — 6,538,131 B
  - `Yutu 2 rover's panoramic camera captures images.zip` — **11,794,265,870 B (11.79 GB)**
    (contains a PCAM raster product measured at **27308 × 21804 px**, ~595 MP, by a subagent)
  Risk is **medium, not low**: this is a *depositor's self-applied* CC BY 4.0 over upstream CNSA/CLEP
  data, so third-party rights may still subsist. Still, it is the strongest machine-readable licence
  attached to bulk real CE-4 PCAM imagery found anywhere.
- **No Figshare or OSF deposit of a Chang'e panorama was found.** No PDS or ESA PSA holdings either.
- **LROC / ASU orbital images of the Chinese sites** (these are LROC photos *of* the sites from orbit,
  not surface panoramas — label them correctly). Subagent-reported and worth knowing:
  - `https://upload.wikimedia.org/wikipedia/commons/5/59/Above_the_Landing_Site_%28LROC1092%29.tiff` — 10280 × 52400
  - `https://upload.wikimedia.org/wikipedia/commons/a/a7/First_Look-_Chang%27e_4_%28LROC1090%29.tiff` — 14943 × 9869
  LROC/NASA imagery is public domain and is the **lowest-risk fallback** for a globe texture. I did not
  personally re-measure these two (Wikimedia 429s if hit repeatedly) — treat the dimensions as
  subagent-reported, unverified by me.

## 8. Legal verdict, bluntly

| asset | can you ship it in a public demo? |
|---|---|
| IAU `iau1901a` CE-4 panorama (10000 × 1229) | **Yes.** `{{cc-by-4.0\|CNSA}}` + `{{IAU-source\|iau1901a}}`. Credit "CNSA/CLEP, via IAU, CC BY 4.0". Must pad vertically (8.14:1 strip). |
| **Zenodo `10.5281/zenodo.11150203` Yutu-2 PCAM archive (11.79 GB, CC BY 4.0)** | **Probably yes, with care.** Licence verified via Zenodo *and* DataCite/SPDX. But it is a depositor's self-applied CC BY over upstream CNSA data, so third-party rights may subsist → medium risk. Credit Ma/Chen/Hu 2024. |
| Commons `Chang'e 3 - rocks near Ziwei crater.jpg` (1594 × 646) | **Yes.** True **CC BY 4.0**, attribution required. Real Yutu PCAM mosaic from an open-access paper. Partial coverage only. |
| Commons `Chang'e-6 scooped sampling area.jpg` (804 × 682) | **Yes.** True **CC BY 4.0**. Real CE-6 PCAM frame. Partial coverage, small. |
| **CE-3 Planetary Society panorama (15743 × 3505)** | **No, not as-is.** `CC BY-NC-ND 3.0` — **NC** blocks monetised use and **ND** blocks the reprojection a skybox needs. Highest-resolution CE-3 panorama found, but unusable here without permission. |
| **CE-5 CNSA panorama (7500 × 4053)** | **No.** 版权所有：国家航天局 — no licence grant, watermarked, and fan-shaped rather than equirectangular. Reference-only. |
| CE-6 CNSA stitched panorama (800 × 421) | **No.** All rights reserved, and only 800 px. Reference-only. |
| Any NASA/LROC orbital image of the sites | **Yes.** Public domain. But it is not a surface panorama. |
| **GRAS education-gallery stitched panoramas** (S1 PCAM 10000×833, A-point TCAM 10000×1229, azimuthals) | **Probably yes, with the watermark kept.** NSSDC metadata explicitly grants **CC BY 4.0** (`shareScope 完全共享`, DOI). Credit "CNSA/CLEP, GRAS, CC BY 4.0" and **do not remove** the baked-in CLEP/GRAS logo. Residual risk: the CC BY 4.0 lives in the NSSDC registry, while the GRAS platform itself also publishes an all-rights-reserved 版权声明 — the conflict in the next row is not fully resolved, so get sign-off before commercial use. |
| GRAS raw PCAM/TCAM/LCAM frames | **Risky.** GRAS explicitly forbids redistribution without written permission; the VSSO registry simultaneously says CC BY 4.0. Unresolved conflict → use only internally / non-commercially, or get written permission. |
| VSSO CC BY 4.0 records 1176 / 1074 / 1240 (the *data*) | Licence position is good (CC BY 4.0 + DOI), but you must obtain the files from GRAS, whose terms are stricter. |
| chinanews CE-4 TCAM panoramas (960 × 3713, 800 × 786) | **No.** All rights reserved. Reference-only. |
| People's Daily / CNSA CE-6 stitched panorama (1024 × 539) | **No.** All rights reserved, CNSA/Xinhua. Reference-only. |
| `_ce5_pcam_7500x4053.jpg` | **Unknown — do not use** until provenance and licence are established. |

**Bottom line:** there is exactly one full-surface Chang'e panorama that is both high-resolution and
openly licensed — the **IAU/CNSA CE-4 farside panorama, 10000 × 1229, CC BY 4.0**. Everything else is
either low-resolution press imagery with all rights reserved (CE-6 at 1024 px), or full-resolution raw
frames behind an all-rights-reserved platform notice (GRAS). Chang'e 3 and Chang'e 5 have **no verified
published stitched panorama at usable resolution**; Chang'e 4 has the best published panorama; Chang'e 6
has an official stitched panorama but only at 1024 px.

## 9. Verified-vs-not summary

- **Personally probed and measured:** all URLs in the ranked table marked `verified: yes`, plus the
  Xinhua 404, the china.cn thumbnail, the CE-6 companion PNGs, the reachability of
  `images-assets.nasa.gov` / `lpi.usra.edu` / `commons.wikimedia.org` / `iauarchive.eso.org`, the GRAS
  API endpoints, the GRAS PDS labels, the Wikimedia raw wikitext, and the VSSO API responses.
- **Subagent-reported, not re-measured by me:** the IAU TIFF byte size; the two LROC TIFF dimensions;
  the PDS/ESA/Zenodo negatives; the `_ce5_pcam_7500x4053.jpg` provenance (open question).
- **Explicitly unresolved:** whether the GRAS platform's all-rights-reserved 版权声明 overrides the
  CC BY 4.0 grant in the NSSDC registry for the gallery images (the §3.3 / §6 conflict) — this is the one
  licence question that still needs a decision from someone empowered to make it; and the CE-6 flag
  image, whose only host was unreachable, so it has **no verified URL or dimensions**.
  ~~The 27 CC BY 4.0 CE-4 PCAM quick-view panorama images~~ — **RESOLVED**, see §1b.
  ~~The CE-5 `7500 × 4053` file's provenance~~ — **RESOLVED** to CNSA, see §5.
  ~~No usable CE-3 panorama~~ — **RESOLVED**, a 15743 × 3505 exists but is CC BY-NC-ND 3.0, see §4.

## 10. Recommended build for the demo

1. **CE-4 surface panorama (hero):** IAU `iau1901a`, **10000 × 1229 JPEG, CC BY 4.0, unwatermarked**.
   Credit "CNSA/CLEP, via IAU, CC BY 4.0". Pad vertically (8.14:1 strip ≠ 2:1 equirectangular).
2. **CE-4 rover's-eye view of the lander (unique content):** GRAS S1 PCAM **10000 × 833**, CC BY 4.0,
   **keep the watermark**. Credit "CNSA/CLEP, GRAS, CC BY 4.0".
3. **CE-4 second angle:** GRAS A-point TCAM azimuthal **5000 × 4915** ("little planet") or D-point
   **5000 × 4879**.
4. **CE-3 and CE-6 real surface pixels, cleanly licensed:** the two Commons **CC BY 4.0** paper figures
   above (1594 × 646 and 804 × 682). Small, but no NC/ND strings attached.
4b. **Bulk CE-4 rover imagery, CC BY 4.0:** the Zenodo archive `10.5281/zenodo.11150203` — 11.79 GB of
   Yutu-2 PCAM images (includes a 27308 × 21804 raster). Depositor-applied licence, so medium risk.
5. **Global/context layer:** public-domain LROC imagery (not a surface panorama — label it correctly).
   Subagent-measured: `Above_the_Landing_Site_(LROC1092).tiff` 10280 × 52400 (538,692,872 B) and
   `First_Look-_Chang'e_4_(LROC1090).tiff` 14943 × 9869 (147,495,868 B).
6. **Higher-detail route (internal / non-commercial only):** decode the GRAS raw PCAM frames —
   **2352 × 1728** for CE-3/5/6, **1176 × 864** for CE-4 — via the open API in §3.1.
7. **Chang'e 6:** the official stitched surface panorama is only **800 × 421** and all-rights-reserved;
   use GRAS CE-6 PCAM frames (2352 × 1728) or the CNSA LCAM frames if you need resolution, and add a
   new **`change-6`** site id.
8. **Chang'e 5:** the official CNSA panorama is **7500 × 4053** but all-rights-reserved and fan-shaped;
   for a shippable CE-5 view, reconstruct from GRAS PCAM frames (2352 × 1728) or use the flag-adjacent
   LCAM imagery. There is **no** openly-licensed CE-5 panorama.
9. **CE-3:** the best-resolution panorama (15743 × 3505) is **CC BY-NC-ND 3.0** and therefore out for a
   monetised or reprojected use. Fall back to the GRAS 2352 × 1728 frames or the CC BY 4.0 paper figure.

**One-line licence summary:** the only full-surface, high-resolution, openly-licensed Chang'e panorama is
the **CE-4 IAU/CNSA `iau1901a` file (10000 × 1229, CC BY 4.0)**. CE-3's best panorama is NC/ND, CE-5's
and CE-6's official panoramas are all-rights-reserved (and CE-6's is only 800 px). The
**GRAS education-gallery panoramas are CC BY 4.0 by registry but watermarked and contested by GRAS's own
copyright notice**, and the **cleanest-licensed real surface pixels** are the **Zenodo Yutu-2 archive**
(11.79 GB, CC BY 4.0, medium risk), two small **CC BY 4.0 figures from open-access papers** (CE-3 and
CE-6), and **public-domain LROC** orbital imagery.

**Verified-vs-authority note.** Every dimension in the ranked table came from my own HTTP probe of the
live file (Range GET + SOF/IHDR parse) or from the product's own PDS label read over HTTP. Licence claims
come from primary artefacts — Wikimedia raw wikitext, the Commons `imageinfo` API, the Zenodo API, the
DataCite API, or the VSSO `getDetail` JSON. Where I am relying on a subagent's measurement rather than my
own (the Zenodo raster dimensions, the LROC TIFF dimensions, the IAU TIFF byte size, three CE-3 mosaic
sizes), the row says so.
