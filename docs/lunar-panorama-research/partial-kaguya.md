# Kaguya / SELENE (JAXA) lunar imagery — hard-verified findings

Researcher: subagent delegated from `2b6dac5e-c65f-4eff-a756-c1324763721a`
Date of work: session current
Working dir: `F:\code\astro` (Windows / pwsh)
Network: **all HTTP through local proxy `http://127.0.0.1:7890`**; every byte size, magic number and pixel
dimension below came from a **full GET through that proxy**, and every JPEG dimension was parsed from the
**SOF0/SOF2 marker in the actual file** — never from a stated or HTML-attribute dimension.

Tools used (all in `F:\code\astro\.agents\research\tools\`):
`grab.mjs` (full GET / `--text` / `--links`), `imgdim.mjs` (full GET + magic + SOF0/SOF2/IHDR parse, `--save`),
`lsdir.mjs` (directory-index listing), `policytxt.mjs` (tag-stripped text window around a needle),
`fulltext.mjs` (untruncated text dump), `utf8page.mjs` (byte-exact UTF-8 decode for Japanese pages).

---

## 0. THE HEADLINE FINDING — Kaguya was ORBITAL. There is no landed surface panorama.

**Kaguya (SELENE) was a lunar ORBITER. It carried no lander and no rover. Nothing on Kaguya was ever
photographed from the lunar surface.** Therefore:

* **No Kaguya "surface panorama" in the terrestrial sense exists.** A landed panorama is a wide-angle
  image taken *from the ground*, with the camera at ~2 m height, showing an horizon of the *same* body
  and usually its own foreground (footprints, hardware, horizon-to-horizon sky). Kaguya has none.
* Every Kaguya "wide" frame is an **ORBITAL HORIZON VIEW** or an **orbital oblique / nadir view**, taken
  from ~100 km (nominal) with the camera looking *down* or *along* the surface from orbit.
* In particular, the Kaguya images that *look* like panoramas are **vertical or horizontal FILMSTRIP
  COMPOSITES of sequential frames from a 1-minute movie** — not single stitched panoramic projections.
* JAXA's own wording throughout the press material is "Earth-rise"/"Earth-set"/"still image ... cut out
  from a moving image" and gives altitudes of 100 km / 27.8 km / 20.7 km. It never claims a surface panorama.

**Mission parameters (verbatim from JAXA Kaguya site, `https://www.kaguya.jaxa.jp/en/about/about_sat_e.htm`):**

> Mission Orbit: Circular orbit, Altitude 100km Inclination 90 degree

> The Japan Aerospace Exploration Agency(JAXA) launched "KAGUYA (SELENE)" by the H-IIA Launch Vehicle at 10:31:01 a.m. on September 14, 2007 (JST) from Tanegashima Space Center.

**Orbital-vs-landed statement for any downstream use:**
> Kaguya/SELENE imagery is *orbital* imagery. Views showing the lunar horizon are orbital horizon views
> photographed from roughly 100 km altitude (and, for the final descent sequence, from 27.8 km down to
> 20.7 km). Terrain Camera products are map-projected *nadir* mosaics from orbit. **None of it is a
> landed surface panorama, and none of it should be labelled as one.**

---

## 1. Scope of imagery actually available

| Family | What it is | Geometry | Native / largest verified |
|---|---|---|---|
| HDTV (NHK co-developed) | colour TV stills + movies, 600+ movies | orbital oblique / horizon, nadir | 1920x1080 frames; filmstrips up to 1920x7722 |
| Terrain Camera (TC) | stereo pushbroom imager, 430–850 nm | orbital **nadir**, stereo | 12288x12288 px 16-bit `.img`; browse JPEG 512x512 |
| Multiband Imager (MI) | 9-band visible/NIR | orbital nadir | see DARTS `sln-l-mi-*` |
| LALT | laser altimeter topography | orbital nadir (points) | gridded maps |

---

## 2. CANDIDATE A — Kaguya HDTV stills, JAXA global press releases (direct, verified)

### A1. "Earth-rise" Earthrise wide shot, 7 Nov 2007 — **best single verified Earthrise still**
* **Mission / orbit:** Kaguya (SELENE) main orbiter, injected into lunar orbit 18 Oct 2007 at ~100 km.
* **Date:** 7 November 2007, 2:52 p.m. JST (wide shot); 12:07 p.m. JST (tele Earth-set).
* **Description (JAXA verbatim, `https://global.jaxa.jp/press/2007/11/20071113_kaguya_e.html`):**
  > The Japan Aerospace Exploration Agency (JAXA) and NHK (Japan Broadcasting Corporation) have successfully performed the world's first high-definition image taking of an Earth-rise* by the lunar explorer "KAGUYA" (SELENE,) which was injected into a lunar orbit at an altitude of about 100 km on October 18, 2007

  > This still image was cut out from a moving image (wide shot) taken by the HDTV onboard the KAGUYA at 2:52 p.m. on November 7, 2007 (JST) then sent to the JAXA Usuda Deep Space Center. In the image, the Moon's surface is near the North Pole, and the Arabian Peninsula and Indian Ocean can be observed on the Earth.

* **Coverage / geometry:** **ORBITAL HORIZON VIEW.** Single HDTV frame. No ground-level foreground.
  HDTV wide-camera FOV (JAXA Table 1, same page):
  > T: 51.23°(horizontal) 30.17°(vertical)  W: 15.60°(horizontal) 8.80°(vertical)
* **Raw frame vs mosaic vs projection:** raw single movie frame (cut out of a moving image), no projection.
* **Verbatim probe lines (full GET via proxy):**
  ```
  ### 200 | image/jpeg | bytes=238277 | declared-cl=238277 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF0 | https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_01l.jpg
  ### 200 | image/jpeg | bytes=104009 | declared-cl=104009 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF0 | https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_02l.jpg
  ### 200 | image/jpeg | bytes=226466 | declared-cl=226466 | magic=ffd8ffe000104a4649460001 | JPEG 2880x1080 3.11 MP SOF0 | https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_03l.jpg
  ```
* **Real pixel dimensions + byte size:** 1920x1080 (2.07 MP), 238,277 bytes — parsed SOF0.
* **Direct file URL:** `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_01l.jpg`
* **Licence:** JAXA Site Policy + **NHK joint copyright** (this release is co-issued "Japan Aerospace
  Exploration Agency (JAXA) / NHK (Japan Broadcasting Corporation)"). See §6 — this is a joint work.
* **Attribution string:** `(C) JAXA/NHK` (that is exactly the watermark burned into the HDTV files themselves).
* **Redistribution risk:** **HIGH** for anything commercial or commercial-adjacent, because the HDTV
  instrument and imagery are JAXA/NHK joint copyright and NHK licences nothing for free (see §6.5).

### A2. Earth-rise / Earth-set filmstrip, 7 Nov 2007 — 5-frame sequence (the "panorama-looking" one)
* **Verified content (I downloaded and visually inspected this file):** five HDTV frames laid out
  left→right on a 2880x1080 canvas. Earth descends/rises relative to a lunar horizon whose cratered
  surface fills the lower ~half of each frame, with black sky above. A `© JAXA/NHK` watermark is burned
  into the bottom-right of the composite.
* **Coverage / geometry:** **ORBITAL HORIZON VIEW, as a 5-frame horizontal FILMSTRIP COMPOSITE** over
  ~70 s of Earth-set. **NOT a stitched panoramic projection**, and emphatically not a landed panorama.
* **Real pixel dimensions + byte size:** 2880x1080 (3.11 MP), 226,466 bytes, SOF0 (probe line above).
* **Direct file URL:** `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_03l.jpg`
* **Saved evidence:** `.agents/research/samples/kaguya_20071113_03l.jpg` (226,466 bytes)
* **Redistribution risk:** **HIGH** (JAXA/NHK joint work; filmstrip layout is itself a JAXA/NHK editorial artefact).

### A3. "Full Earth-Rise", 6 Apr 2008 — the famous 2008 full Earthrise
* **Date:** 6 April 2008 (JST). Press release 11 April 2008.
* **Verbatim (from `https://global.jaxa.jp/press/2008/04/20080411_kaguya_e.html`):**
  > The Japan Aerospace Exploration Agency (JAXA) and NHK (Japan Broadcasting Corporation) successfully captured a movie of the "Full Earth-Rise"*1 using the onboard High Definition Television (HDTV) of the lunar explorer "KAGUYA " (SELENE) on April 6, 2008 (Japan Standard Time, JST, all the following dates and time are JST.) The KAGUYA is currently flying in a lunar orbit at an altitude of about 100 km.

  > The location on the Moon is around the South Pole on the back side at a south latitude of 83 degrees or higher.

  > The shooting was performed by the KAGUYA's onboard HDTV for space use, which was developed by NHK. The movie data was received at JAXA, then processed by NHK.

  JAXA is explicit that this is an orbital-only phenomenon:
  > *1 The phenomenon expressed as a "Full Earth-Rise" can be seen from a satellite that travels around the Moon such as the KAGUYA (SELENE) or the Apollo manned spacecraft. The Earth is almost stationary when it is observed from the Moon, thus a Full Earth-Rise coming out from the horizon cannot be seen from the Moon.

* **Coverage / geometry:** **ORBITAL HORIZON VIEW** at ~100 km, lunar far side, south lat ≥83°.
* **Raw frame vs mosaic:** "The above still image is a cutout from the movie taken by the KAGUYA HDTV
  (tele camera)" — a raw single frame cutout.
* **Verbatim probe lines:**
  ```
  ### 200 | image/jpeg | bytes=22496 | declared-cl=22496 | magic=ffd8ffe000104a4649460001 | JPEG 640x360 0.23 MP SOF0 | https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01.jpg
  ### 200 | image/jpeg | bytes=1153207 | declared-cl=1153207 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF0 | https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01l.jpg
  ### 200 | image/jpeg | bytes=22756 | declared-cl=22756 | magic=ffd8ffe000104a4649460001 | JPEG 640x279 0.18 MP SOF0 | https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_02.jpg
  ### 200 | image/jpeg | bytes=1545382 | declared-cl=1545382 | magic=ffd8ffe000104a4649460001 | JPEG 2475x1080 2.67 MP SOF0 | https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_02l.jpg
  ```
* **Best direct file URL:** `https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01l.jpg`
  — 1920x1080, 1,153,207 bytes, SOF0.
* **Secondary (wider) file:** `https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_02l.jpg`
  — 2475x1080, 1,545,382 bytes, SOF0 (Earth-rise + Earth-set pair layout).
* **Attribution:** `(C) JAXA/NHK`. **Redistribution risk: HIGH.**

### A4. Final descent stills, 11 Jun 2009 — proves the "approaching surface" is orbital
* **Press release:** `https://global.jaxa.jp/press/2009/06/20090619_kaguya_hdtv_e.html` (19 June 2009),
  co-issued JAXA + NHK. Kaguya impacted the Moon **11 June 2009** (launched 14 Sep 2007).
* **Verbatim:**
  > The series of continued shots was taken with an interval of about one minute by the HDTV (Teltephoto) while the KAGUYA was maneuvered to decrease its altitude toward the impact position (around GILL crater.)
  > We can see the approaching Moon surface as the KAGUYA went closer to it. After the final image, the KAGUYA moved into the shaded area to make its final landing, thus it was pitch dark while taking an image.

* **Altitude table (verbatim from the same page) — this is the decisive orbital evidence:**
  | Image No. | Time (11 Jun 2009 JST) | Location | Altitude | Note |
  |---|---|---|---|---|
  | 1 | 3:11 a.m. | lat.74° S, long. 261° E | **27.8 km** | Near Zeeman G and BOLTZMANN |
  | 2 | 3:12 a.m. | lat.77° S, long. 261° E | **25.4 km** | Between BOLTZMANN and Drygalski |
  | 3 | 3:13 a.m. | lat.79° S, long. 261° E | **23.0 km** | Near side of Drygalski P (about 30 km) |
  | 4 | 3:14 a.m. | lat.81° S, long. 261° E | **20.7 km** | Around Drygalski P |

* **Coverage / geometry:** **ORBITAL oblique/nadir views during powered descent**, 27.8 → 20.7 km.
  The lowest altitude reached in the released stills is **20.7 km** — the spacecraft never landed;
  it impacted. So even the "closest" published Kaguya image is from ~21 km up, not from the ground.
* **Verbatim probe lines:**
  ```
  ### 200 | image/jpeg | bytes=367818 | declared-cl=367818 | magic=ffd8ffe000104a4649460001 | JPEG 600x2419 1.45 MP SOF0 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_1.jpg
  ### 200 | image/jpeg | bytes=456401 | declared-cl=456401 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L1.jpg
  ### 200 | image/jpeg | bytes=471336 | declared-cl=471336 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L2.jpg
  ### 200 | image/jpeg | bytes=423406 | declared-cl=423406 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L3.jpg
  ### 200 | image/jpeg | bytes=441073 | declared-cl=441073 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L4.jpg
  ### 200 | image/jpeg | bytes=335054 | declared-cl=335054 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L5.jpg
  ### 200 | image/jpeg | bytes=291678 | declared-cl=291678 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L6.jpg
  ### 200 | image/jpeg | bytes=225721 | declared-cl=225721 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1080 2.07 MP SOF2 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L7.jpg
  ### 200 | image/jpeg | bytes=21944 | declared-cl=21944 | magic=ffd8ffe000104a4649460001 | JPEG 300x226 0.07 MP SOF0 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_2.jpg
  ### 200 | image/jpeg | bytes=85119 | declared-cl=85119 | magic=ffd8ffe000104a4649460001 | JPEG 580x415 0.24 MP SOF0 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_3_e.jpg
  ```
* **Best direct URLs:** the seven `_L1..L7` tele stills, **all 1920x1080 SOF2 (progressive)**, 225,721–471,336
  bytes each — e.g. `https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L4.jpg` (1920x1080, 441,073 B).
  Plus `https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_1.jpg` — **600x2419, 367,818 bytes,
  SOF0**, a vertical strip stacking the descent images. That 600x2419 file is a *low-resolution web
  contact-strip*, not a wide panorama.
* **Attribution:** `(C) JAXA/NHK`. **Redistribution risk: HIGH.**

---

## 3. CANDIDATE B — Kaguya official mission site (www.kaguya.jaxa.jp)

* **Site reachable.** `https://www.kaguya.jaxa.jp/index_e.htm` → `200`, magic `efbbbf3c21444f4354595045` (BOM+`<!DOCTYPE`).
* The `en/` directory path is blocked but the `en/<section>/` paths work (see BLOCKED section for the `en/` 403).
* **Top-of-page HDTV hero image — verified:**
  ```
  ### 200 | image/jpeg | bytes=132433 | declared-cl=132433 | magic=ffd8ffe000104a4649460001 | JPEG 1240x698 0.87 MP SOF0 | https://www.kaguya.jaxa.jp/image/Top_HDTV.jpg
  ```
  Real size **1240x698, 132,433 bytes**, `last-modified: Wed, 10 Jun 2009 05:50:44 GMT` (i.e. the day
  before impact). **Direct URL:** `https://www.kaguya.jaxa.jp/image/Top_HDTV.jpg`
* HDTV instrument page `https://www.kaguya.jaxa.jp/en/equipment/hdtv_e.htm` (200) states verbatim:
  > This hardware has a telephoto and a wide-angle HDTV color cameras used three 2.2M-pixel CCDs.

  > The camera mounted to the moon side of the explorer, and it can shoot the earth rise.

  and credits the instrument section to "Junichi Yamazaki, **NHK Broadcast Engineering Department**".
* Its inline figures are tiny web graphics — verified dimensions, all far too small for any pano use:
  ```
  ### 200 | image/jpeg | bytes=46590 | declared-cl=46590 | magic=ffd8ffe000104a4649460001 | JPEG 250x188 0.05 MP SOF0 | https://www.kaguya.jaxa.jp/en/equipment/image/img_hdtb_001.jpg
  ### 200 | image/jpeg | bytes=12590 | declared-cl=12590 | magic=ffd8ffe000104a4649460001 | JPEG 120x147 0.02 MP SOF0 | https://www.kaguya.jaxa.jp/en/equipment/image/img_hdtb_006.jpg
  ### 200 | image/jpeg | bytes=42061 | declared-cl=42061 | magic=ffd8ffe000104a4649460001 | JPEG 350x197 0.07 MP SOF0 | https://www.kaguya.jaxa.jp/ja/equipment/image/img_hdtb_004.jpg
  ```
* **Coverage:** instrument/hardware documentation and a single orbital hero frame — no surface panorama.
* **Attribution:** JAXA site footer reads `Copyright 2007 Japan Aerospace Exploration Agency` with a
  `Site policy` link; note that the on-page HDTV credit names NHK personnel, reinforcing joint ownership.
* **Redistribution risk:** MEDIUM for the pure JAXA site graphics; **HIGH** for the HDTV photograph itself
  (NHK joint copyright).

---

## 4. CANDIDATE C — DARTS / PDS3 Kaguya HDTV EDR archive (the real still archive)

**This is the actual bulk still-image archive and it is directly downloadable.** Dataset directory:
`https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/`

* **README.html verbatim:**
  > SELENE(Kaguya) HDTV EDR DATASET
  > This directory contains all still images in the movies taken by SELENE(Kaguya) High Definition Television System,
  > Kaguya HDTV, for educational and scientific purposes.
  > For more details, please go to the Kaguya HDTV Data Publication System and follow the terms of use.

* **Structure (verified by directory listing):**
  * `data/200709/ … data/200906/` — monthly dirs of `sh_<UTCstamp>_<camera>/` products, each holding
    **FITS EDR** stills (all movies split to stills).
  * `browse/small/`, `browse/medium/`, `browse/large/` — JPEG derivatives by month.
  * `browse/large/<month>/*.mp4` — **full HDTV movies**, and `*_bl.zip` frame sets (multi-GB).
  * `catalog/`, `index/`, `voldesc.cat`.

* **Verified movie sizes (real, from the archive index):**
  `sh_20080406T082429_tm8.mp4` 639M · `sh_20080405T194447_tm4.mp4` 133M · `sh_20080405T214347_tm1.mp4` 124M
  · `sh_20080405T031500_wm4.mp4` 109M. Frame-set zips run `5.3M`–`2.2G`.

### C1. The "panorama-looking" HDTV filmstrip — best wide Kaguya lunar frame found
* **File:** `sh_20071107T030713_tm4_fp_l.jpg` (tele camera 4, 7 Nov 2007 03:07:13 UTC).
* **Verified probe line / real dimensions:**
  ```
  ### 200 | image/jpeg | bytes=1256383 | declared-cl=1256383 | magic=ffd8ffe000104a4649460001 | JPEG 1920x7722 14.83 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg
  ```
  **1920x7722 px, 14.83 MP, 1,256,383 bytes, SOF0.**
* **I downloaded and visually inspected this file.** It is a **vertical filmstrip of sequential frames**
  of a lunar surface flyover seen from orbit — heavily cratered, high relief, long shadows, **no horizon
  and no sky anywhere in it**, i.e. a **nadir/oblique surface view**, NOT a horizon view.
* **CRITICAL CLASSIFICATION:** this is a **sequence-concatenation / filmstrip composite** (`_fp_l` =
  first/last-frame large composite built from the 1-minute movie). It is **not** a stitched panoramic
  projection and **not** a landed panorama. Do **not** label it "Kaguya surface panorama" — label it
  "vertical filmstrip of sequential orbital nadir frames".
* **Direct file URL:** `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg`
* **Saved evidence:** `.agents/research/samples/kaguya_20071107T030713_tm4_fp_l.jpg` (1,256,383 bytes)
* **Redistribution risk:** **HIGH** — JAXA/NHK copyright, scientific+educational only (§5).

### C2. Kaguya orbital horizon view — clearest example of the orbital/landed distinction
* **File:** `sh_20071107T055245_wm4/sh_20071107T055245_wm4_0000_bl.jpg` (wide camera 4, 7 Nov 2007 05:52:45 UTC).
* **Verified probe line / real dimensions:**
  ```
  ### 200 | image/jpeg | bytes=1139198 | declared-cl=1139198 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1200 2.30 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4/sh_20071107T055245_wm4_0000_bl.jpg
  ```
  **1920x1200 px, 2.30 MP, 1,139,198 bytes, SOF0.**
* **I downloaded and visually inspected this file.** Content: a clean **lunar horizon arc** running across
  the middle of the frame, **black space above it**, and cratered lunar surface below receding to the limb.
  There is **no foreground and no ground-level vantage point** — this is precisely an **ORBITAL HORIZON VIEW**.
* **Direct file URL:** `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4/sh_20071107T055245_wm4_0000_bl.jpg`
* **Burned-in watermark (read off the actual pixels of every `_bl.jpg` I checked):**
  `© JAXA/NHK` bottom-right, plus bottom-left Japanese + English:
  > 本映像のご利用は下記URLを参考にしてください。 Please refer to the following URL for terms of use:
  > http://darts.isas.jaxa.jp/planet/project/selene/hdtv/

  This is direct in-file proof of **joint JAXA/NHK copyright**.
* **Redistribution risk:** **HIGH.**

### C3. Full Earth-Rise 2008 wide-camera frames (single frames, verified)
```
### 200 | image/jpeg | bytes=703590 | declared-cl=703590 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1200 2.30 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T095510_wi1/sh_20080406T095510_wi1_0000_bl.jpg
### 200 | image/jpeg | bytes=702561 | declared-cl=702561 | magic=ffd8ffe000104a4649460001 | JPEG 1920x1200 2.30 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T095510_wi1/sh_20080406T095510_wi1_0004_bl.jpg
### 200 | image/jpeg | bytes=1084903 | declared-cl=1084903 | magic=ffd8ffe000104a4649460001 | JPEG 1920x4445 8.53 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080405T031500_wm4_fp_l.jpg
### 200 | image/jpeg | bytes=755631 | declared-cl=755631 | magic=ffd8ffe000104a4649460001 | JPEG 1920x3924 7.53 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4_fp_l.jpg
```
* **Honest content note:** the two `sh_20080406T095510_wi1` frames I downloaded (`0000`, `0004`) are
  **near-black** with a scatter of star points and the JAXA/NHK watermark — in that wide-camera sequence
  the Earth itself is outside the field of view at those instants. I am reporting this rather than
  implying they show an Earthrise. The tele sequences (`_tm4`/`_tm8`) and the JAXA press stills in §2
  are the ones that actually show the Earth.
* **The `*_fp_l.jpg` files above (1920x4445, 1920x3924) are again vertical filmstrips**, not panoramas.

### C4. Dataset catalogue — THE decisive licence statement
From `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/catalog/dataset.cat`
(`DATA_SET_ID = "SLN-L/E-HDTV-2-EDR-V1.0"`), **verbatim**:

> DATA_SET_DESC = "
> Copyright
> =========
> Unlike generic data set in planetary data system (PDS), this data set is
> copyrighted to JAXA/NHK, and opened for scientific and educational purpose.
> Users of this data set must inquire Japan Aerospace Exploration Agency for
> the other purposes.

Also verbatim from the same catalogue:

> The High Definition television (HDTV) took more than 600 movies around the
> Moon during the all mission phases.

> All the browse images are rotated by 180 degrees because the Moon surface
> stays a lower area of pictures.

Coverage from the same file: `START_TIME = 2007-09-14T01:31:01Z`,
`STOP_TIME = 2009-06-10T18:25:00Z`, `DATA_SET_RELEASE_DATE = 2016-09-21`,
`PRODUCER_FULL_NAME = "YUKIO YAMAMOTO"`.

---

## 5. CANDIDATE D — Terrain Camera (TC) mosaics

TC is the *stereo, nadir, pushbroom* imager (verbatim from `https://www.kaguya.jaxa.jp/en/about/about_sat_e.htm`:
> Terrain Camera (TC): High-resolution geographical features are acquired by the stereo cameras.)

### D1. SELENE TC Ortho Map v2.0 — a true map-projected mosaic (NOT a panorama)
* Dataset page: `https://darts.isas.jaxa.jp/datasets/sln-l-tc-5-ortho-map-v2.0` (200) and
  `https://darts.isas.jaxa.jp/en/datasets/sln-l-tc-5-ortho-map-v2.0` (200). Overview verbatim:
  > Map-projected product mosaicking appropriate TC ortho data in plural DTM TCOrtho products: Though the source data of this product are registered to L2DB in Simple Cylindrical, users can choose a map projection type from several ones using L2DB's function. Each pixel of TC ortho has radiance value.
* **Data distribution URL (verbatim from the page):**
  `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-v2.0/`
  Tiled by longitude: `lon000/ … lon357/`, each with `data/`, `browse/{small,large}/`, `catalog/`, `index/`.
* **Native product geometry, verbatim from `lon000/data/TCO_MAP_02_N00E000S03E003SC.lbl`:**
  > MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
  > LINES = 12288
  > LINE_SAMPLES = 12288
  > SAMPLE_TYPE = MSB_UNSIGNED_INTEGER
  > SAMPLE_BITS = 16
  > MAP_RESOLUTION = 4096.000000
  > MAP_SCALE = 0.0074031617246699
  > UPPER_LEFT_LATITUDE = 0.000000 / UPPER_RIGHT_LONGITUDE = 2.999756 / LOWER_LEFT_LATITUDE = -2.999756
  > INSTRUMENT_NAME = "TERRAIN CAMERA"
  > INSTRUMENT_HOST_NAME = "SELENE MAIN ORBITER"
  > DATA_SET_NAME = "SELENE MOON TC 5 ORTHO MAP V2.0"

  i.e. **each native tile is a 12288x12288 px, 16-bit, simple-cylindrical, 3°x3° nadir mosaic**
  (~302 MB of 16-bit sample data per tile before labels).
* **The published browse JPEGs are small.** Verified:
  ```
  ### 200 | image/jpeg | bytes=84854 | declared-cl=84854 | magic=ffd8ffe000104a4649460001 | JPEG 512x512 0.26 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-v2.0/lon000/browse/large/TCO_MAP_02_N00E000S03E003SC.jpg
  ### 200 | image/jpeg | bytes=22182 | declared-cl=22182 | magic=ffd8ffe000104a4649460001 | JPEG 256x256 0.07 MP SOF0 | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-v2.0/lon000/browse/small/TCO_MAP_02_N00E000S03E003SC.jpg
  ```
  → **browse large = 512x512 (84,854 B)**, browse small = 256x256 (22,182 B). **Useful as a mosaic, but
  far too low-resolution to republish as a wide scenic image.** High resolution means downloading the
  16-bit `.img` (PDS3/ISIS, not a ready JPEG).
* **Raw frame vs mosaic vs projection:** **mosaic, map-projected (simple cylindrical). ORBITAL NADIR.**
  It is not a perspective panorama and not a horizon view; there is no horizon in it at all.
* **Attribution (verbatim from the dataset page):**
  > "We thank the SELENE(KAGUYA) TC team and the SELENE Data Archive for providing the SELENE(KAGUYA) data. SELENE is a Japanese mission developed and operated by JAXA."
* **Licence:** the dataset page names the licence as **`https://www.isas.jaxa.jp/en/researchers/data-policy/`**
  and lists 著作権者 / copyright holders as **JAXA and ISAS**. This is the *permissive* ISAS policy (§6.3) —
  **not** the HDTV carve-out. **Redistribution risk: LOW–MEDIUM** (permissive/CC-BY-compatible per ISAS
  policy, but high-res means handling PDS3 16-bit products, and the browse JPEGs are only 512x512).

### D2. Other TC products verified to exist in `https://data.darts.isas.jaxa.jp/pub/pds3/`
`sln-l-tc-3-s-level2b0-v1.0/` · `sln-l-tc-3-sp-support-level2b0-v1.0/` · `sln-l-tc-3-w-level2b0-v1.0/` ·
`sln-l-tc-4-dem-ortho-v1.0/` · `sln-l-tc-4-dtm-ortho-v3.0/` · `sln-l-tc-5-dtm-map-v2.0/` ·
`sln-l-tc-5-dtm-map-seamless-v2.0/` · `sln-l-tc-5-evening-map-v4.0/` · `sln-l-tc-5-morning-map-v4.0/` ·
`sln-l-tc-5-ortho-map-seamless-v2.0/` · `sln-l-tc-5-ortho-map-v2.0/` · `sln-l-tc-5-sldem2013-v1.0/` ·
`sln-l_e-hdtv-2-edr-v1.0/`

There is **no** `sln-l-tc-*-panorama-*` product. The dataset list contains no panoramic/cylindrical
perspective product of the kind a landed mission produces.

---

## 6. LICENCE / TERMS OF USE — verbatim, with URLs

### 6.1 JAXA global Site Policy — `https://global.jaxa.jp/policy.html` (200)
> Unless otherwise stated, all materials, including texts, drawings, images, voice data, and video data, published on the Site (the "Materials") and the copyrights therein are the property of JAXA, and the Materials are protected in Japan and internationally by copyright laws and international copyright treaties.

Source-indication requirement (verbatim):
> When you use the Materials on the Site, you are requested to indicate their source in such a manner as designated by JAXA, for example, "Provided by Japan Aerospace Exploration Agency (JAXA)" or "Courtesy of JAXA". If space is limited, shorter versions of the indication such as "Provided by JAXA" or "JAXA" are acceptable.

No-modification rule (verbatim):
> No modification is allowed to any of the Materials, except for a modification needed for indicating their source. The act of "modification" includes, but not limited to, acts of trimming a drawing, image, voice data or video data (for example, an act of changing the ratio of height and length of an image, cropping part of an image, or mounting an image inside another image that seriously undermines the original image etc.), changing colors, and turning over an image.

Commercial restriction (verbatim):
> Your use of the Materials for business or commercial purposes without the prior permission of the copyright holder (JAXA) is strictly prohibited.

**THE THIRD-PARTY CARVE-OUT — the clause that decides the NHK question (verbatim):**
> For using materials, including texts, drawings, images, voice data and video data, that belong to other organizations apart from JAXA. If you wish to use such materials, please contact the copyright holder of the said material.

> Some of the Materials may be owned and provided by an other organization or jointly owned by an other organization and JAXA. As long as the source of the Materials is specified on The Site, you are requested to indicate the said source (i.e. "Provided by NASA" or "Provided by NASA/JAXA")

> When you wish to utilize any materials ... saved in the JAXA Digital Archives, please refer to "Copyright Information" in the Digital Archives before you use the same.

### 6.2 JAXA Digital Archives — "Using Our Materials" — `https://jda.jaxa.jp/service.php?lang=e` (200)
Credit requirement (verbatim):
> Credit: Please clearly indicate "(C) Japan Aerospace Exploration Agency (JAXA)" or "(C)JAXA" as the source. However, if the owner of the material is another organization or if the work is jointly owned by JAXA and other organizations, please indicate each individual source side by side. (example: (C) JAXA/NAOJ).

Prohibited (verbatim):
> Distributing JAXA's photos and videos without first obtaining the permission of JAXA

No-alteration (verbatim):
> Prohibition of alteration: Alterations that change the meaning or intent of the material are prohibited. (Examples of prohibited alteration: alteration to length and width, change or invert some of the colors, trimming in such a manner as to change the meaning of a photo or video, or inserting it into other material)

**Third-party works explicitly excluded (verbatim):**
> Works from providers other than JAXA cannot be provided by JAXA. When using, please check with each individual provider. (Example: NASA, etc.)

Application classification (verbatim, materially important — free use is narrow):
> Free of charge / not needed ... Immediate use for newspaper or news; Use for academic study at a public institution, formal education or learning activities; Use at a museum or science museum (such as a special exhibition); The scope of personal use ...
> needed ... videos and photos: Use for planning a program or a feature page; Publications (such as textbooks, reference books, children's books, magazines, science magazines, information magazines); Use by JAXA's partner company (for PR, advertisements)
> payment required / needed ... Cases in which it is judged that the user of the image or video will obtain profits or substantial gains from sales of a product using the material or by other means.

### 6.3 ISAS Data Policy (applies to TC/MI, **NOT** to HDTV) — `https://www.isas.jaxa.jp/en/researchers/data-policy/` (200)
> In principle, open data can be used free of charge, either for commercial or non-commercial purposes. They may be copied, forwarded or modified. However, for some open data kept at ISAS, third parties who are involved in the data production may impose other restrictions (for example, in instances when a third party shares the copyright).

> When using data, please indicate origin of the data as "ISAS/JAXA".

> *** These rules follow Government of Japan Standard Terms of Use (Version 2.0) ... and are compatible with Creative Commons BY 4.0 ...).

**Crucially, this policy itself contains the third-party exception that the HDTV data falls under**, and the
HDTV dataset separately declares its own stricter terms (§6.4).

### 6.4 THE HDTV-SPECIFIC LICENCE (decisive) — `.../sln-l_e-hdtv-2-edr-v1.0/catalog/dataset.cat`
> Unlike generic data set in planetary data system (PDS), this data set is copyrighted to JAXA/NHK, and opened for scientific and educational purpose. Users of this data set must inquire Japan Aerospace Exploration Agency for the other purposes.

**Therefore: HDTV is a deliberate, explicit carve-out from the normally-permissive PDS/ISAS data policy.**
Scientific and educational use only; everything else requires an inquiry to JAXA — and JAXA cannot grant
it alone, because the copyright is **joint with NHK**.

### 6.5 NHK's own terms — `https://www.nhk.or.jp/nijishiyou-qa/index_4.html` (200)
NHK (Japan Broadcasting Corporation) is a **broadcaster, not JAXA**. Its published position on secondary
use of NHK content is strict. Verbatim (Japanese, fetched UTF-8):

> NHKの番組やコンテンツ（映像・音声・画像・出版物等）には、NHKだけでなく多くの権利者の権利が含まれています（例：出演者、音楽、外部調達素材等）。そのため、利用には、営利目的か非営利かを問わず、そのすべての権利者の許諾を得ることが必要です（著作権法により例外とされた場合を除きます）。

*(NHK programmes and content (video, audio, images, publications, etc.) contain the rights not only of NHK but of many rights holders (e.g. performers, music, externally procured material). Therefore, for any use — whether for-profit or non-profit — it is necessary to obtain the permission of all those rights holders, except in cases exempted by copyright law.)*

> これらの理由により、NHKの番組やコンテンツの提供および使用許諾はすべて
> ・有償に限ります（無償での提供はしておりません）
> ・法人や団体に限ります（個人の方への提供・許諾はしておりません）
> とさせていただいています。……許諾ができない場合もあります。ご自身で録画・録音等された番組等であっても、著作権法により例外とされた場合を除き、許諾なく使用することはできません。

*(For these reasons, provision and licensing of NHK programmes and content is: limited to paid use (we do not provide free of charge); limited to corporations and organisations (we do not provide or license to individuals). ... There are also cases where permission cannot be granted. Even for programmes you recorded yourself, you may not use them without permission except where exempted by copyright law.)*

NHK's site-wide rules page is `https://www.nhk.or.jp/rules/` (200, "NHKインターネットサービス利用規約").

### 6.6 → THE REDISTRIBUTION-RISK CONCLUSION (the key warning)

> **A JAXA licence does NOT cover the Kaguya HDTV material.** The HDTV camera was developed by NHK, the
> HDTV data set is declared **"copyrighted to JAXA/NHK"**, every distributed HDTV JPEG carries a burned-in
> **`© JAXA/NHK`** watermark, the JAXA press releases themselves are co-issued **JAXA + NHK**, and JAXA's
> own Site Policy and Digital Archives terms both say third-party / jointly-owned material is *excluded*
> and that "Works from providers other than JAXA cannot be provided by JAXA."
>
> So: quoting JAXA's permissive-looking terms to justify reusing an HDTV Earthrise frame would be **wrong**.
> The HDTV material is restricted to **scientific and educational** purposes by the data set's own
> catalogue, and NHK additionally licenses nothing for free and nothing to individuals.
>
> **Risk rating: HIGH** for any Kaguya HDTV still/movie (A1–A4, C1–C3, and every `© JAXA/NHK`-watermarked
> `_bl.jpg` / `_bm.jpg` / `_fp_l.jpg` / `_bl.zip` / `.mp4` in the EDR archive).
> **Risk rating: LOW–MEDIUM** for TC / MI / LALT *data* products (permissive ISAS policy, CC-BY-4.0
> compatible), provided the "ISAS/JAXA" + SELENE TC team acknowledgement string is used.
> **Risk rating: MEDIUM** for pure JAXA-site instrument graphics (JAXA-owned; source indication and a
> no-commercial-use default apply).

---

## 7. Attribution strings to use

* HDTV stills/movies (any source): **`© JAXA/NHK`** — that is the rights line burned into the files
  themselves, and it matches JDA's requirement to "indicate each individual source side by side" for
  jointly owned works.
* HDTV, if a fuller form is wanted: `Courtesy of JAXA/NHK — KAGUYA (SELENE) HDTV`. Note this does **not**
  create a licence; permission is still required for anything beyond scientific/educational use.
* Terrain Camera / MI / LALT data: `ISAS/JAXA` plus, per the dataset page,
  > "We thank the SELENE(KAGUYA) TC team and the SELENE Data Archive for providing the SELENE(KAGUYA) data. SELENE is a Japanese mission developed and operated by JAXA."
* Pure JAXA site images: `Provided by Japan Aerospace Exploration Agency (JAXA)` or `Courtesy of JAXA`.

---

## 8. Best verified direct file URLs (summary table)

Every row below was fetched in full through the proxy; dimensions are parsed from the file's own marker.

| # | What | Real px | Bytes | Marker | Direct URL |
|---|---|---|---|---|---|
| 1 | Earth-rise wide HDTV still, 7 Nov 2007 | 1920x1080 | 238,277 | SOF0 | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_01l.jpg` |
| 2 | Earth rise/set 5-frame orbital filmstrip, 7 Nov 2007 | 2880x1080 | 226,466 | SOF0 | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_03l.jpg` |
| 3 | Earth-set tele HDTV still, 7 Nov 2007 | 1920x1080 | 104,009 | SOF0 | `https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_02l.jpg` |
| 4 | Full Earth-Rise HDTV, 6 Apr 2008 | 1920x1080 | 1,153,207 | SOF0 | `https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01l.jpg` |
| 5 | Full Earth-Rise/Set pair layout, 6 Apr 2008 | 2475x1080 | 1,545,382 | SOF0 | `https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_02l.jpg` |
| 6 | Final descent tele still #4, 11 Jun 2009 (20.7 km) | 1920x1080 | 441,073 | SOF2 | `https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L4.jpg` |
| 7 | Final descent web contact strip | 600x2419 | 367,818 | SOF0 | `https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_1.jpg` |
| 8 | Kaguya site HDTV hero frame | 1240x698 | 132,433 | SOF0 | `https://www.kaguya.jaxa.jp/image/Top_HDTV.jpg` |
| 9 | HDTV vertical filmstrip, orbital nadir flyover, 7 Nov 2007 | 1920x7722 | 1,256,383 | SOF0 | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg` |
| 10 | **HDTV ORBITAL HORIZON VIEW**, 7 Nov 2007 | 1920x1200 | 1,139,198 | SOF0 | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T055245_wm4/sh_20071107T055245_wm4_0000_bl.jpg` |
| 11 | Full Earth-Rise wide single frame, 6 Apr 2008 | 1920x1200 | 703,590 | SOF0 | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T095510_wi1/sh_20080406T095510_wi1_0000_bl.jpg` |
| 12 | HDTV filmstrip, 5 Apr 2008 | 1920x4445 | 1,084,903 | SOF0 | `.../browse/large/200804/sh_20080405T031500_wm4_fp_l.jpg` |
| 13 | HDTV filmstrip (wide), 7 Nov 2007 | 1920x3924 | 755,631 | SOF0 | `.../browse/large/200711/sh_20071107T055245_wm4_fp_l.jpg` |
| 14 | TC ortho mosaic browse (3°x3° tile) | 512x512 | 84,854 | SOF0 | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-tc-5-ortho-map-v2.0/lon000/browse/large/TCO_MAP_02_N00E000S03E003SC.jpg` |

**Full HDTV movies (real sizes from the archive index, verified listing):**
`https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T082429_tm8.mp4` (639M)
`https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080405T194447_tm4.mp4` (133M)

**Saved local evidence samples:**
`.agents/research/samples/kaguya_20071113_01l.jpg` · `kaguya_20071113_03l.jpg` ·
`kaguya_20071107T030713_tm4_fp_l.jpg` · `kaguya_wm4_20071107_0000.jpg` ·
`kaguya_20080406_wi1_0000_bl.jpg` · `kaguya_earthrise_wi1_0004.jpg`

---

## 9. BLOCKED / NOT FOUND (verbatim error lines)

All of the following are exact tool output lines. Nothing here was inferred.

### 9.1 NHK Kaguya archive — URL is dead (BOTH proxy-timeout on the old host AND 404 on the live host)
The JAXA 2009 press release itself points at `http://www3.nhk.or.jp/kaguya/archive/index_e.html`. That host
is unreachable through this proxy, and the equivalent path on the live NHK host 404s:
```
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | http://www3.nhk.or.jp/kaguya/archive/index_e.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www3.nhk.or.jp/kaguya/archive/index_e.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | http://www3.nhk.or.jp/kaguya/archive/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www3.nhk.or.jp/kaguya/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www3.nhk.or.jp/nhkworld/en/terms/
404 | text/html | - | 3c21646f6374797065206874 | https://www.nhk.or.jp/kaguya/archive/index_e.html
```
**Interpretation (evidence-based):** `www3.nhk.or.jp` is not reachable via this proxy at all (same failure
class as `web.archive.org`, `en.wikipedia.org`, `r.jina.ai`, `duckduckgo.com`), **and** the Kaguya archive
path does not exist on the reachable `www.nhk.or.jp` host (404). So the original NHK Kaguya archive was
**not retrievable**. I did reach NHK's live Japanese terms/FAQ pages on `www.nhk.or.jp` (§6.5).

### 9.2 Kaguya image gallery — host does not resolve
```
ERR  | ENOTFOUND fetch failed | http://wms.selene.jaxa.jp/selene_viewer/index_e.html
```
This is the "JAXA KAGUYA Image Gallery" URL that the JAXA 2009 press release directs users to. The hostname
`wms.selene.jaxa.jp` **fails DNS resolution through this proxy — the gallery is gone.** No Kaguya Image
Gallery content could be checked.

### 9.3 `www.kaguya.jaxa.jp/en/` directory — 403 Forbidden
```
403 | text/html | 205 | HTML | https://www.kaguya.jaxa.jp/en/
403 | text/html | 214 | HTML | https://www.kaguya.jaxa.jp/en/index.htm
```
Body verbatim: `403 Forbidden / Forbidden / You don't have permission to access /en/index.htm on this server.`
The working entry point is `https://www.kaguya.jaxa.jp/index_e.htm` (200) or `https://www.kaguya.jaxa.jp/` (200).

### 9.4 JAXA SELENE project page — now a System Error
`https://global.jaxa.jp/projects/sas/selene/` returns HTTP 200 but the page is JAXA's **error page**:
```
  A   JAXA | System Error
  A   https://global.jaxa.jp/error/500.html
  A   Get information on the System Error. The Japan Aerospace Exploration Agency (JAXA) performs various activities related to aerospace as an organization, from basic research in the aerospace field to development and utilization.
```
And the canonical sub-path is gone:
```
404 | text/html | 20723 | HTML | https://global.jaxa.jp/projects/sas/selene/index.html
```
**So the JAXA global "SELENE project page" as linked from the Kaguya press releases no longer serves
project content.** The live Kaguya project site is `https://www.kaguya.jaxa.jp/` instead.

### 9.5 DARTS "Kaguya HDTV Data Publication System" page — no longer serves its content
The watermark in the HDTV JPEGs and the EDR README both point to
`https://darts.isas.jaxa.jp/planet/project/selene/hdtv/`. **That URL now returns the generic DARTS
JavaScript shell (Nuxt SPA), whose body contains no HDTV content at all.** Verified:
```
### 200 | 107301 chars html | 749 chars text -> .agents/research/tmp/hdtv-ps.txt | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/index.html.en
needle /terms|Terms|condition|copyright|Copyright|use/ -> -1
```
The only 749 characters of text are DARTS site chrome (Japanese news/topics boilerplate), and the hydration
payload is empty, confirming the SPA renders nothing for this route:
```
### 200 | application/json | 69 bytes | magic=5b7b226461746122 | https://darts.isas.jaxa.jp/_payload.json?e6977afc-e4b5-40bb-ba51-46a7dae13931
[{"data":1,"prerenderedAt":3},["ShallowReactive",2],{},1789087349422]
```
Every plausible terms-page variant also returns the same empty shell, so **I could not read the HDTV
"terms of use" page that the watermarks reference**, and I am not going to paraphrase it. The
enforceable terms I *did* read verbatim are in the PDS3 `catalog/dataset.cat` (§6.4).
```
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/terms.html.en
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/policy.html.en
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/terms_e.html
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/usage.html.en
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/termsofuse.html.en
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/policy_e.html
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/index_e.html
206 | text/html | 4096 | HTML | https://darts.isas.jaxa.jp/planet/project/selene/hdtv/index.html
404 | text/plain | 19 | 3430342070616765206e6f74 | https://legacy.darts.isas.jaxa.jp/planet/project/selene/hdtv/index.html.en
```
(The `legacy.darts...` host answers `404 page not found`.)

### 9.6 NDL web archive copy — 403
```
403 | text/html | 430 | HTML | https://warp.da.ndl.go.jp/info:ndljp/pid/10202044/darts.isas.jaxa.jp/planet/project/selene/hdtv/index.html.en
```
(`https://warp.da.ndl.go.jp/` root itself returns 200, so the host is reachable but this archived item is not served.)

### 9.7 ISAS English topics image — 404
`https://www.isas.jaxa.jp/e/topics/2007/1113.shtml` returns 200 HTML referencing `image/1113/1113_topics.jpg`,
but that asset resolves to ISAS's 404 page:
```
### 200 | text/html | bytes=22659 | declared-cl=- | magic=3c21444f4354595045206874 | HTML/XML n/a  | https://www.isas.jaxa.jp/404.html
```

### 9.8 JAXA HDTV dataset specific pages that do not exist
```
404 | text/html | 196 | HTML | https://data.darts.isas.jaxa.jp/pub/metadata/datasets/sln-l_e-hdtv-2-edr-v1.0.jsonld
404 | text/html | 196 bytes html | https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/document/
404 Not Found / Not Found / The requested URL was not found on this server.
```

### 9.9 Kaguya press releases that 404 (searched for additional HDTV releases)
```
404 | text/html | 20723 | HTML | https://global.jaxa.jp/press/2008/11/20081107_kaguya_e.html
404 | text/html | 20723 | HTML | https://global.jaxa.jp/press/2008/10/20081031_kaguya_e.html
404 | text/html | 20723 | HTML | https://global.jaxa.jp/press/2008/06/20080630_kaguya_e.html
```
(Confirmed live and relevant: `.../press/2007/11/20071113_kaguya_e.html` 200,
`.../press/2008/04/20080411_kaguya_e.html` 200, `.../press/2009/06/20090619_kaguya_hdtv_e.html` 200.)

### 9.10 Known blockers (pre-supplied; not retried)
`web.archive.org`, `en.wikipedia.org`, `r.jina.ai`, `duckduckgo.com` — all time out through this proxy.
`www.bing.com/search?q=...` and `global.jaxa.jp` / `www.isas.jaxa.jp` work as documented.

---

## 10. Bottom line

1. **No true Kaguya surface panorama exists, and none can exist** — Kaguya was an orbiter (100 km circular
   orbit, 90° inclination) with no lander. Every "wide" Kaguya image is an **orbital horizon view** or an
   **orbital oblique/nadir view**, or a **filmstrip composite of sequential movie frames**. The lowest
   published still altitude is **20.7 km** (final descent). Never present Kaguya imagery as a landed panorama.
2. **Best verified direct URLs** are in §8; the strongest single images are the 1920x1080 Earthrise press
   stills (§2 A1/A3) and the 1920x1200 DARTS orbital-horizon and nadir frames (C2/C3), plus the
   2880x1080 five-frame Earth rise/set filmstrip (A2) and the 1920x7722 vertical filmstrip (C1).
   Real dimensions and byte sizes were all parsed from the downloads, and several were visually inspected.
3. **Licensing:** Kaguya **HDTV is JAXA/NHK joint copyright** — "copyrighted to JAXA/NHK, and opened for
   scientific and educational purpose. Users of this data set must inquire Japan Aerospace Exploration
   Agency for the other purposes." A **JAXA licence alone does not cover it**, and JAXA's own terms say
   third-party/jointly-owned material is excluded and "Works from providers other than JAXA cannot be
   provided by JAXA." NHK licenses nothing free and nothing to individuals. **Redistribution risk: HIGH**
   for all HDTV material. **Terrain Camera / MI / LALT data is the licensing-safe route** (ISAS Data Policy,
   CC-BY-4.0 compatible, "ISAS/JAXA" attribution) — but the published TC browse JPEGs are only **512x512**,
   and high resolution means the 12288x12288 16-bit PDS3/ISIS products.
4. **Dead ends found and reported verbatim:** the Kaguya Image Gallery host `wms.selene.jaxa.jp` no longer
   resolves (ENOTFOUND); the NHK Kaguya archive is unreachable (proxy timeout) and 404s on the live host;
   the JAXA global SELENE project page is a System Error; and the DARTS "Kaguya HDTV Data Publication
   System" page the watermarks reference now renders an empty SPA shell, so its terms text could not be read.
