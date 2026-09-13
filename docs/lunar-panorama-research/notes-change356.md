# Chang'e 3 / 5 / 6 — downloadable high-resolution lunar surface imagery

Research date: 2026-09-12. Working dir `F:\code\astro`. Proxy `http://127.0.0.1:7890`.

Every dimension below is a **real measurement** I made (`HTTP Range: bytes=0-65535` GET, then parse
JPEG SOF0–SOF15 / PNG IHDR, or read `Content-Range` total for the true byte size) — never a host's
marketing claim and never a guess. Anything I could not confirm is marked **UNVERIFIED**.
Quoted licence text is copied verbatim from the page; Chinese quotes are given in the original with a
translation.

---

## 0. Environment corrections (read this first)

Two premises in the brief are **wrong**, and one tool silently does nothing.

1. **`net-probe.mjs` never uses the proxy.** It does `require('undici')` to build a `ProxyAgent`, and
   `undici` is not importable here (`Cannot find package 'undici'`), so `dispatcher` is `undefined`
   and the fetch goes out **direct**, ignoring `HTTP_PROXY`/`HTTPS_PROXY`. Every "blocked host"
   conclusion produced with that script is unreliable.
2. **`NODE_USE_ENV_PROXY=1` fixes global `fetch` on this exact Node build.** Verified:
   ```
   $env:NODE_USE_ENV_PROXY="1"; $env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"
   node -e "fetch('https://upload.wikimedia.org/wikipedia/commons/7/76/Chang%27e-6_scooped_sampling_area.jpg',{headers:{Range:'bytes=0-200'}}).then(r=>console.log(r.status, r.headers.get('content-range')))"
   -> 206 bytes 0-200/300703
   ```
   `--use-env-proxy` as a CLI flag is **not** supported on v24.4.1 (`bad option: --use-env-proxy`).
3. Because `undici` is unavailable I wrote a raw **CONNECT-tunnel** fetcher and used it for all
   probing: `.agents/proxy-http-356.mjs` (module + CLI), plus `.agents/img-dims-356.mjs` (dimension
   measurer), `.agents/commons-356.mjs` (Commons API), `.agents/wayback-356.mjs` (CDX/availability),
   `.agents/text-356.mjs`, `.agents/scan-356.mjs`, `.agents/dl-356.mjs`, `.agents/reach-356.mjs`.

### Host reachability (my own sweep, `.agents/reach-356.mjs`)

**Reachable (200/206 through the tunnel):**
`www.cnsa.gov.cn` (+`/english/`), `www.cas.cn`, `english.cas.cn`, `www.nao.cas.cn`,
`english.nao.cas.cn`, `www.clep.org.cn`, `moon.bao.ac.cn`, `www.news.cn`,
`www.xinhuanet.com/english/`, `www.chinanews.com.cn`, `www.stdaily.com`, `www.people.com.cn`,
`en.people.cn`, `www.thepaper.cn`, `www.guancha.cn`, `www.planetary.org`,
`planetary.s3.amazonaws.com`, `www.space.com`, `www.universetoday.com`,
`www.nasaspaceflight.com`, `web.archive.org`, `archive.org`, `commons.wikimedia.org`,
`upload.wikimedia.org`, `thumb.wikimedia.org`, `en.wikipedia.org`, `www.chinadaily.com.cn`,
`www.globaltimes.cn`, `www.scmp.com`, `www.nature.com`, `www.gov.cn`, `www.most.gov.cn`,
`www.cmse.gov.cn`, `www.chinaspaceflight.com`, `www.spacechina.com`,
`www.chinaspacenews.com.cn`, `images-assets.nasa.gov`, `thumb.wikimedia.org`.

**Blocked / failed (re-verified):**

| host | result |
|---|---|
| `images-assets.nasa.gov` | **REACHABLE — 206, `image/jpeg`.** The brief's "403" is wrong. |
| `www.lpi.usra.edu` | 403 (confirmed blocked) |
| `spaceflight101.com` | 403 |
| `www.science.org` | 403 |
| `agupubs.onlinelibrary.wiley.com` | 403 |
| `commons.wikimedia.org` | **REACHABLE via tunnel.** The brief's "timeout" was the broken `net-probe.mjs`. |
| `upload.wikimedia.org` | reachable but returns **HTTP 429** under load (2255-byte HTML body). See §4. |
| `thumb.wikimedia.org` | reachable, **not** rate-limited — use this for scaled derivatives. |
| `dayooimg.dayoo.com` | `ECONNRESET` / `UND_ERR_SOCKET` both via proxy and direct |
| `moonftp.bao.ac.cn`, `159.226.88.39` | "socket ended before headers" (no response) |
| `photo.chncpa.org` | TLS `ECONNRESET` |

---

## 1. Chang'e 3 — site id `change-3`

**Verdict: excellent.** The full-resolution lander panorama and the whole Yutu PCAM / lander TCAM raw
frame archive are publicly downloadable with no login — but not from a Chinese government host.

### 1.1 THE lander 360° panorama — 15743 × 3505 (the headline CE-3 asset)

```
15743 x 3505 | 15302339 bytes | JPEG | ct=image/jpeg | range:206 |
https://planetary.s3.amazonaws.com/web/assets/pictures/20160129_TCAM-I-001_SCI_P_20131217113548_0004_A_2C_stitch.jpg
```

- Hosting page: `https://www.planetary.org/space-images/change-3-lander-panorama`
- Second reference: `https://www.planetary.org/articles/01281656-fun-with-a-new-data-set-change`
- **Credit line, quoted:** "Chinese Academy of Sciences / China National Space Administration / The
  Science and Application Center for Moon and Deepspace Exploration / Emily Lakdawalla"
- **Caption, quoted:** "Part of a full 360-degree panorama taken by the Chang'e 3 lander on December
  17, 2013, three days after landing. To the left is a crater nearly 20 meters in diameter whose rim
  features large blocks of bright rock."
- **Licence, quoted:** "This work is licensed under a Creative Commons
  Attribution-NonCommercial-NoDerivs 3.0 Unported License. For uses not allowed by that license,
  contact us to request publication permission from the copyright holder:"
- **Projection:** the caption calls it "**Part of** a full 360-degree panorama" — i.e. a subset, not a
  full 360° surround. The published file is a very wide, low strip (4.49:1); no projection name is
  stated by the publisher. **Do not claim equirectangular or a degree figure beyond the quoted
  "part of a full 360-degree panorama".**
- **Independent cross-check:** a Chinese article describing the same 2016 CNSA 35 GB release states,
  verbatim: **"2013年12月17日，着陆三天后，着陆器拍摄的全景照片。…分辨率15743×3505。"** ("17 December 2013,
  three days after landing, the panorama photographed by the lander … Resolution 15743×3505.")
  Source: `https://m.techweb.com.cn/article/2016-02-01/2271813.shtml` (快科技 via TechWeb,
  2016-02-01). This matches my measurement exactly.
- **Risk: HIGH** for a public/commercial Three.js demo — **NonCommercial** forbids monetised use and
  **NoDerivs** arguably forbids reprojection/scaling. Attribution + share-alike-style compliance is
  not enough.

### 1.2 Yutu rover PCAM mosaics (same archive, same licence) — all measured

| content | dimensions | bytes | direct URL |
|---|---|---|---|
| Tracks in the regolith, 2014-01-12 | **8192 × 5293** | 17,633,613 | `https://planetary.s3.amazonaws.com/web/assets/pictures/20160128_PCAML-C-023_SCI_N_20140112133444_0007_A_2C_stitch.jpg` |
| Yutu view near "Long Yan"/Pyramid Rock, 2014-01-13 | **4095 × 2768** | 3,672,385 | `https://planetary.s3.amazonaws.com/web/assets/pictures/20160128_PCAMR-C-012_SCI_N_20140113191151_0008_A_2C_stitch.jpg` |
| "Yutu on the road" mosaic, 2013-12-23 (lander TCAM) | **2144 × 2144** | 2,034,540 | `https://planetary.s3.amazonaws.com/web/assets/pictures/20160129_TCAM-I-143_SCI_P_20131223174541_0010_A_2C_stitch.jpg` |

These three also match the TechWeb article's quoted figures exactly (`分辨率8192×5293`,
`分辨率4095×2768`, `分辨率2144×2144`) — strong independent corroboration.

### 1.3 Raw PCAM / TCAM frame archive (no login, complete)

Index pages (both HTTP 200, no auth):
- `http://planetary.s3.amazonaws.com/data/change3/pcam.html` (430,058 B) — Yutu rover Panoramic Camera
- `http://planetary.s3.amazonaws.com/data/change3/tcam.html` (634,570 B) — lander Terrain Camera

Measured samples:

```
2352 x 1728 | 3638532 bytes | PNG | https://planetary.s3.amazonaws.com/data/change3/pcam/png/PCAMR-C-001_SCI_N_20131221194448_0005_A_2A.png
2352 x 1728 | 3997739 bytes | PNG | https://planetary.s3.amazonaws.com/data/change3/tcam/png/TCAM-I-001_SCI_P_20131215085729_0002_A_2A.png
147 x 108   |   10117 bytes | PNG | .../pcam/t/PCAMR-C-001_SCI_N_20131221194448_0005_A_2A_t.png   (thumbnail)
NO-DIMS     | 8133216 bytes | application/octet-stream | .../pcam/img/PCAMR-C-001_SCI_N_20131221194448_0005_A_2A.IMG  (raw PDS, magic "PDS_VERSION_ID")
```

Facts quoted from `pcam.html`:
- "Credit for these images goes to Chinese Academy of Sciences / China National Space
  Administration / The Science and Application Center for Moon and Deepspace Exploration."
- "The Yutu rover panoramic camera (PCAM) system is a stereo pair of color cameras with CMOS
  detectors, 2352 by 1728 pixels in size, with Bayer filter arrays for color. The PCAM field of view
  is 19.7 by 14.5 degrees."
- "PCAM images come in two sizes. "PCAML-C" and "PCAMR-C" are color observations using the full
  resolution of the detector. They are 2352 by 1728 pixels in size. "PCAML-Q" and "PCAML-Q" are
  panchromatic images that were downsampled by a factor of 2 before downlinking. … They are 1176 by
  864 pixels in size."
- "These data were downloaded from China's Science and Application Center for Moon and Deepspace
  Exploration on January 21, 2016…"
- No licence is asserted on the data pages — **credit only, no reuse grant**. The underlying data are
  CNSA/CAS. Risk: **HIGH** (no grant), though the practical risk of redistributing raw science frames
  in a demo is lower than for a press-release panorama.

### 1.4 CC BY 4.0 alternative (low risk) — Yutu PCAM mosaic

- File: `File:Chang'e 3 - rocks near Ziwei crater.jpg`
- Commons page: `https://commons.wikimedia.org/wiki/File:Chang%27e_3_-_rocks_near_Ziwei_crater.jpg`
- Direct original: `https://upload.wikimedia.org/wikipedia/commons/1/11/Chang%27e_3_-_rocks_near_Ziwei_crater.jpg`
- Commons API `imageinfo`: **1594 × 646, 265,094 bytes, image/jpeg**; `LicenseShortName` = **CC BY 4.0**,
  `UsageTerms` = "Creative Commons Attribution 4.0", `AttributionRequired` = true.
- `Artist`: "Chunyu Ding, Zhiyong Xiao, Yan Su"; `Credit`: `https://doi.org/10.1186/s40623-021-01359-7`
- `ImageDescription`, quoted: "Abundant meter-scale boulders have been excavated by the Ziwei crater.
  … **This mosaic was obtained by the panoramic camera on the Yutu rover.**"
- Direct byte probe of the original was **429 rate-limited**; I confirmed the aspect ratio from the
  non-rate-limited thumbnail host:
  ```
  1280 x 519 | 196871 bytes | JPEG | https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Chang%27e_3_-_rocks_near_Ziwei_crater.jpg/1280px-Chang%27e_3_-_rocks_near_Ziwei_crater.jpg
  ```
  (1280/519 = 2.466; API 1594/646 = 2.467 ✓ consistent.)
- **Risk: LOW.** CC BY 4.0 — attribution required, commercial use allowed, derivatives allowed.

### 1.5 Also probed, not recommended

- `https://www.universetoday.com/article_images/Change-3-landing-site-pano2K_Ken-Kremer.jpg` →
  `1588 x 744 | 295003 bytes | JPEG` — a 2K crop of the official panorama, credited to Ken Kremer.
  Too small for a demo and no licence statement found.
- Four Sina images from the **2014-01-11** CNSA "first lunar-day photo release"
  (`http://i2.sinaimg.cn/dy/o/2014-01-11/1389380407_F0QaO8.jpg` etc.) measured only
  `550 x 404 / 550 x 550 / 550 x 404 / 550 x 404`. Article:
  `https://news.sina.com.cn/o/2014-01-11/025929211611.shtml` ("嫦娥三号：首次集中公布第一月昼期拍摄照片").
  Sina hosts no larger copy.
- `https://www.planetary.org/articles/12191156-a-new-change-3-and-yutu` — Emily Lakdawalla's
  announcement of the archive. Useful for provenance; no additional high-res files.
- **UNVERIFIED:** a CNSA/CLEP-hosted copy of the 15743×3505 stitch. I did not find one; the live
  Chinese gov sites did not expose it during this session.

---

## 2. Chang'e 5 — site id `change-5`

**Verdict: YES — a genuine high-resolution PCAM panorama exists, and it is the single best asset
found in this whole research pass.**

### 2.1 CE-5 PCAM "环拍" panorama, 7500 × 4053 — 23.6 MB, no login

```
206 | image/jpeg | cl=24758565 | cr=bytes 0-65535/24758565 | JPEG | (Range probe)
200 | 24758565 bytes | image/jpeg | (full GET, .agents/dl-356.mjs)
```

- **Exact direct URL (no query string):**
  `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg`
- **Source page:** `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/content.html`
  — title **"国家航天局公布嫦娥五号月表国旗展示照片"**, `发布日期：2020年12月04日`.
- **Measured: 7500 × 4053, 24,758,565 bytes, JPEG.**
- Byte-identical mirror on the CLEP site (same 24,758,565 bytes, same dimensions):
  `http://www.clep.org.cn/n5982341/c6810754/part/6785492.jpg`
  (page `http://www.clep.org.cn/n5982341/c6810754/content.html`)
- **Caption, quoted verbatim:** "嫦娥五号着陆器和上升器组合体全景相机环拍成像，五星红旗在月面成功展开，
  此外图像上方可见已完成表取采样的机械臂及采样器。"
  ("Pan-around image from the panoramic camera on the Chang'e 5 lander+ascender combination; the
  five-star red flag was successfully unfurled on the lunar surface; above the image the robotic arm
  and sampler that have completed surface sampling are visible.")
- **Projection / coverage:** CNSA states only "全景相机环拍成像" (panoramic camera pan-around
  imaging). **No projection and no degree coverage figure is stated anywhere on the page.** I
  inspected a downscaled copy of the actual file and it is a **fan/sector-shaped stitched mosaic with
  large black unfilled corners in a 1.85:1 frame** — it is **not** an equirectangular 2:1 strip and
  **not** a 360°×180° surround. Treat it as a wide partial panorama only; do not advertise a degree
  figure.
- **Licence:** none granted. The site footer states only, quoted:
  "版权所有：国家航天局 承办单位：国家航天局新闻宣传中心" ("Copyright held by: China National Space
  Administration; operated by: CNSA News and Publicity Centre"), plus
  "网站标识码：bm63000001 京ICP备05081655号 京公网安备11040102100142号".
  **There is no open licence, no reuse grant, no Creative Commons statement — this is a Chinese
  government all-rights-reserved publication.**
- **Redistribution risk: HIGH.** Bluntly: publishing these bytes in a public demo is legally
  unsanctioned. Low practical enforcement risk for a non-commercial demo with clear CNSA credit, but
  it is not licensed.
- Visible in the image: the CLEP/中国探月 logo watermark top-right — reuse would carry the watermark.

### 2.2 CE-5 single PCAM frame (the flag shot itself)

```
2352 x 1728 | 1943272 bytes | JPEG | https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785487.jpg
```
Same file on CLEP: `http://www.clep.org.cn/n5982341/c6810754/part/6785491.jpg` (same 1,943,272 bytes).
Caption quoted: "嫦娥五号着陆器和上升器组合体全景相机拍摄五星红旗在月面成功展开。"

### 2.3 Landscape / context images (not panoramas)

- `File:Landepunkt Chang'e 5.jpg` on Commons — 2657 × 2359, 1,227,247 bytes, **Public domain**
  (NASA/LROC WAC base), but it is an **annotated orbital map**, not surface imagery.
- `File:Chang-e-5-Lander-Flag.png` on Commons — 1620 × 1080, 1,322,790 bytes, **CC BY 4.0**,
  `Artist`: "China News Service". **BUT** the `ImageDescription` says verbatim: "Artist's impression
  of Chinese national flag shown by Chang'e 5 on the moon surface. **Image capture from a CGI video
  (thus not a photograph).**" → **Do not use as real mission imagery.**

### 2.4 What was NOT found

- No higher-resolution CE-5 panorama than 7500 × 4053. No CNSA/CLEP release of the raw CE-5 PCAM
  frames as a public archive (unlike CE-3). **Nothing found; UNVERIFIED** for any CE-5 raw PCAM frame
  archive.

---

## 3. Chang'e 6 — **needs a NEW site id** (suggest `change-6`)

**Verdict: a surface panorama WAS returned and published — but only at 800 × 421.** That is the
binding constraint for a Three.js demo.

### 3.1 CE-6 PCAM mosaic — the only official surface panorama: 800 × 421

```
800 x 421 | 40868 bytes | JPEG | https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543423.jpg
```

- **Source page:** `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/content.html`
  — title "嫦娥六号拍摄月背系列影像图", body opens "6月4日，国家航天局发布嫦娥六号着陆器着陆月球背面拍摄的
  系列影像图，包括落月过程中降落相机拍摄的着陆区域附近影像、全景相机拍摄的着陆点影像。"
  (4 June [2024], CNSA released a series of images taken by the CE-6 lander on the lunar far side,
  including landing-camera images of the region near the landing area during descent and
  **panoramic-camera images of the landing site**.)
- **Caption for this file, quoted verbatim:** "该图由全景相机在嫦娥六号表取采样前，对着陆点北侧月面拍摄的
  彩色图像镶嵌制作而成。图像上方是着陆点北部查菲环形山，图像的下方是着陆腿和着陆时冲击挤压隆起的月壤。"
  ("This image was produced as a colour mosaic from images taken by the panoramic camera of the lunar
  surface north of the landing site before CE-6's surface sampling. The upper part of the image is
  Chaffee crater north of the landing site; the lower part is the landing legs and the lunar soil
  pushed up by the landing impact.")
- **Byte-identical mirror (same 40,868 bytes) on CLEP:**
  `http://www.clep.org.cn/n5982014/c10707551/part/10707557.jpg`
  (page `http://www.clep.org.cn/n5982014/c10707551/content.html`)
- **I verified the file visually.** It is a fan-shaped wide-angle mosaic with heavy black borders and
  the **中国探月 CLEP logo watermark** burned in at top-right. The actual image content inside the
  black padding is roughly 800 × 300.
- **Every other mirror is an upscale of this same master**, confirmed by measurement:
  - `http://www.chinaspacenews.com.cn/n26/n42/n44/c1632/part/2746.png` → 1024 × 752 PNG (verified
    visually as the same padded mosaic — the extra pixels are black padding, not detail)
  - `https://en.people.cn/mediafile/pic/BIG/20240604/17/9292031629426019497.png` → 1024 × 752
  - `http://images.china.cn/site1000/2024-06/04/117233028_00394723-...png` → 711 × 400
- **Risk: HIGH.** No licence, all rights reserved (same CNSA footer as §2.1).

### 3.2 CE-6 LCAM descent-camera frames — 2352 × 1728 (the real high-res CE-6 assets)

| image | dimensions | bytes | direct URL |
|---|---|---|---|
| descent camera, just after power-on | **2352 × 1728** | 1,119,718 | `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543420.jpg` |
| descent camera, during descent | **2352 × 1728** | 1,240,539 | `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543421.jpg` |
| descent camera, after safe landing | **2352 × 1728** | 1,296,393 | `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543422.jpg` |

Identical files on CLEP: `.../c10707551/part/10707580.jpg`, `.../10707559.jpg`, `.../10707558.jpg`
(bytes match exactly: 1119718 / 1240539 / 1296393).

### 3.3 CE-6 lander + ascender selfie (from the "移动相机" mini rover)

```
1280 x 800 | 637713 bytes | JPEG | https://www.cnsa.gov.cn/n6758823/n6758842/c10543444/part/10543450.jpg
```
Source page: `https://www.cnsa.gov.cn/n6758823/n6758842/c10543444/content.html`
("嫦娥六号着陆器和上升器合影来了！"). Context from the 中国航天新闻 write-up, quoted:
"6月3日，嫦娥六号携带的"移动相机"自主移动并成功拍摄、回传着陆器和上升器合影。"

### 3.4 CC BY 4.0 alternative (low risk) — CE-6 PCAM close-up

- File: `File:Chang'e-6 scooped sampling area.jpg`
- Commons page: `https://commons.wikimedia.org/wiki/File:Chang%27e-6_scooped_sampling_area.jpg`
- Direct original: `https://upload.wikimedia.org/wikipedia/commons/7/76/Chang%27e-6_scooped_sampling_area.jpg`
- **Directly byte-probed and measured:** `804 x 682 | 300703 bytes | JPEG | ct=image/jpeg | range:206`.
  This matches the Commons API exactly.
- `LicenseShortName` = **CC BY 4.0**, `UsageTerms` = "Creative Commons Attribution 4.0",
  `AttributionRequired` = true. `Artist`: "Chunlai Li, Hao Hu, Meng-Fei Yang";
  `Credit`: `https://doi.org/10.1093/nsr/nwae328`.
- `ImageDescription`, quoted: "**Image of the scooped area on the lunar surface captured by the
  Chang'e-6 panoramic camera.**"
- **Risk: LOW.** CC BY 4.0. Small (804 × 682) but it is a genuine CE-6 PCAM frame and it is licensed.

### 3.5 CE-6 flag (五星红旗 on the far side) — **UNVERIFIED**

Text confirms the event — quoted from `http://www.chinaspacenews.com.cn/n6/c1444/content.html`:
"6月4日，嫦娥六号着陆器表取完成后，将携带的五星红旗在月球背面成功展开。这是中国首次在月球背面独立动态展示国旗。"
— but I could **not** locate a CNSA-hosted, downloadable CE-6 flag image, and could not measure one.
Four candidate flag JPEGs were found on `dayooimg.dayoo.com` (via
`https://news.dayoo.com/china/202406/04/139997_54675721.htm`) but that host fails both through the
proxy and direct (`ECONNRESET` / `UND_ERR_SOCKET`), so **no dimensions are available and I will not
guess them**. `zsrbapp.zsnews.cn` also carried the flag story but yielded no measurable image URL.
**Report as nothing-found.**

### 3.6 Site id

The demo currently has `change-3`, `change-4`, `change-5`. **Chang'e 6 requires a new id — suggest
`change-6`** (Apollo crater, South Pole–Aitken basin, 2024-06). No existing id covers it.

---

## 4. `upload.wikimedia.org` rate limiting (important operational note)

`upload.wikimedia.org` intermittently returns **HTTP 429** with a 2255-byte HTML body
(`<!DOCTYPE html>\n`) and `content-type: text/html`. Retrying after 20 s and 45 s did **not** clear it
in this session — it appears to be a shared-IP limit on the proxy.

**Workaround that worked every time: use `thumb.wikimedia.org` instead.** It served scaled
derivatives immediately with no 429 and no proxy issue, e.g.

```
1280 x 519  | 196871 bytes  | JPEG | https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Chang%27e_3_-_rocks_near_Ziwei_crater.jpg/1280px-Chang%27e_3_-_rocks_near_Ziwei_crater.jpg
1280 x 853  | 1002383 bytes | PNG  | https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Chang-e-5-Lander-Flag.png/1280px-Chang-e-5-Lander-Flag.png
```
Note `thumb.wikimedia.org` answered `200` (not `206`) and ignored my `Range` header on those two
requests, so pull the whole file.

---

## 5. The Chinese official data system (CLEP / GRAS) — access reality

- Portal: `https://moon.bao.ac.cn/` — a Vue SPA (HTTP 200, 9,002 B shell). API base is
  `https://moon.bao.ac.cn/moon-admin` (from `https://moon.bao.ac.cn/js/config.js`,
  `proPrefix: ${currentHost}/moon-admin`).
- `https://moon.bao.ac.cn/moon-admin/` returns `text/plain`, quoted:
  "欢迎使用月球深空科学应用中心后台管理框架，当前版本：v1.0.0，请通过前端地址访问。"
- Every data endpoint I guessed returned **404 JSON** with a `timestamp` field
  (`/client/dataInfo/list`, `/client/scienceData/list`, `/client/cms/infoList`,
  `/client/cms/copyrightList`). The SPA's real paths are inside a 95 KB minified bundle and were not
  worth reverse-engineering further, because the policy below already answers the question.
- The old Emily-Lakdawalla-era endpoint `http://moon.bao.ac.cn/ceweb/datasrv/dmsce3.jsp` now
  **redirects to the SPA root** — that open JSP is gone.
- **The official access policy is registration-gated.** Quoted verbatim from
  `http://www.clep.org.cn/n487142/n6006876/c6008214/content.html` ("探月工程数据申请流程", 2015-03-27):
  - "目前CE-1的所有2级和3级科学数据，以及CE-2的3级数据对外开放，用户可通过网站进行注册，注册后即可下载；"
    ("Currently all CE-1 level-2 and level-3 science data, and CE-2 level-3 data, are open to the
    public; **users may register on the website and download after registration**.")
  - "CE-2的其它级别数据目前属于专有期，用户须向工程中心提交《探月工程科学数据用户申请表》…"
  - "地面应用系统数据中心将审核合格后的数据上传至FTP服务器ftp://159.226.88.39 或
    http://moonftp.bao.ac.cn。" — **both of these hosts are unreachable from here.**
  - "所申请数据在服务器上的存放时限为一个星期，一个星期后将删除数据！"
  - "网站注册用户可下载网站公开发布的所有数据，如需获取更高级别的数据产品请参照本流程提交数据申请。"
  - Contact given: `moondatacenter@nao.cas.cn`
  - The SPA's own i18n strings confirm the two-tier model: `"PublicData":"公共数据"` /
    `"ProtectedData":"保护数据"`, `"PublicAccess":"公开获取"` / `"AuthorizedAccess":"授权获取"`,
    `"applyDownload":"申请下载"`, `"pendingReview":"待审核"`.
- Emily Lakdawalla, 2016-01-28, quoted: "the website has not worked at all for me this week; **you
  need to log in to download data**, and the login function is not working."
  (`https://www.planetary.org/articles/01281656-fun-with-a-new-data-set-change`)
- **Conclusion: CLEP/GRAS is NOT a no-login direct-download source, and it grants no open licence.**
  The Planetary Society S3 mirror of the CE-3 PCAM/TCAM sets is the practical open route.

---

## 6. Licence summary (blunt)

| source | licence | commercial demo? | attribution? |
|---|---|---|---|
| CNSA / CLEP web images (CE-5 7500×4053, CE-6 set) | **NONE — all rights reserved** ("版权所有：国家航天局") | no | credit CNSA |
| Planetary Society `planetary.s3` stitches (CE-3 15743×3505, PCAM mosaics) | **CC BY-NC-ND 3.0** | **no** (NC), and ND restricts derivatives/reprojection | yes |
| Planetary Society `planetary.s3/data/change3/*` raw frames | **no licence stated — credit only** | unclear | yes |
| Wikimedia Commons CC BY 4.0 files | **CC BY 4.0** | **yes** | yes |
| Wikimedia Commons `Landepunkt Chang'e 5.jpg` | Public domain (NASA base) | yes | no |

**No Chinese government lunar image found in this pass carries an explicit open licence.** The only
cleanly licensed, demo-safe real surface imagery is the two Commons CC BY 4.0 files (§1.4, §3.4),
which are small (1594 × 646 and 804 × 682) — neither is a full panorama.

---

## 7. Recommended assets for the Three.js demo, per mission

- **`change-3`** — best: the **15743 × 3505** lander panorama
  (`.../20160129_TCAM-I-001_SCI_P_20131217113548_0004_A_2C_stitch.jpg`). Detail-rich and genuinely
  usable, but CC BY-NC-ND → risk HIGH. Fallback for an unambiguously licensed asset:
  the CC BY 4.0 Yutu PCAM mosaic (1594 × 646). Raw 2352 × 1728 PCAM/TCAM frames are available in
  bulk if a synthetic mosaic is acceptable.
- **`change-5`** — best: the **7500 × 4053** PCAM panorama
  (`https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg`, 23.6 MB). This is the
  highest-quality real Chinese lunar surface panorama located. No licence → risk HIGH. It is fan
  shaped, **not** equirectangular; a texture-mapped sphere would need cropping/correction.
- **`change-6`** (new id) — the only official surface panorama is **800 × 421**. That is too small to
  be a hero asset; expect visible blur if scaled. Better licensed option: the CC BY 4.0
  804 × 682 PCAM frame. The 2352 × 1728 LCAM descent frames are the sharpest CE-6 material but they
  are oblique descent views, not panoramas.

## 8. Local evidence files kept alongside this note

| file | what it is | provenance |
|---|---|---|
| `_ce5_pcam_7500x4053.jpg` | verbatim copy of the CE-5 panorama | `https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg` — full GET returned `200`, `24758565` bytes, `image/jpeg` |
| `_ce6_pcam_800x421.jpg` | verbatim copy of the CE-6 PCAM mosaic | `https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543423.jpg` — full GET returned `200`, `40868` bytes, `image/jpeg` |
| `_ce6_chinaspacenews_2744.png` | CE-6 **LCAM descent** frame (not a panorama) | `http://www.chinaspacenews.com.cn/n26/n42/n44/c1632/part/2744.png` — `200`, `461963` bytes, `image/png`, measured `1024 x 752` |
| `_ce6_chinaspacenews_2747.png` | CE-6 lander+ascender selfie mirror | `http://www.chinaspacenews.com.cn/n26/n42/n44/c1632/part/2747.png` — `200`, `503045` bytes, `image/png`, measured `864 x 454` |

All four were checked visually. `_ce5_pcam_7500x4053.jpg` and `_ce6_pcam_800x421.jpg` both carry the
burned-in 中国探月 / CLEP logo watermark.

### Helper scripts I added under `.agents/`
`proxy-http-356.mjs` (CONNECT-tunnel GET), `img-dims-356.mjs` (true dimension measurer),
`proxy-page-356.mjs`, `text-356.mjs`, `scan-356.mjs`, `dl-356.mjs`, `commons-356.mjs`,
`wayback-356.mjs`, `reach-356.mjs`.
