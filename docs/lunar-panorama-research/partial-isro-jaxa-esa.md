# Partial research — ISRO Chandrayaan-3, JAXA SLIM, JAXA Kaguya/SELENE, ESA lunar panoramas

Research conducted through the local proxy `http://127.0.0.1:7890` on Windows/pwsh from `F:\code\astro`.
All `status | ...` lines below are **verbatim probe output**. All dimensions marked *REAL* were obtained by
downloading the file and parsing the JPEG SOF0/SOF2 marker or the PNG IHDR with an inline script
(`.agents/research/tools/dims.mjs`), never from a page's stated dimensions.

Verbatim probe format used throughout:
`node .agents/net-probe.mjs <url>` 鈫?`status | content-type | content-length | magic | url`
`node .agents/research/tools/dims.mjs <url>` 鈫?`status | image/type | bytes | WxHpx [marker] | url`

---

## 0. Headline conclusions

1. **ISRO Chandrayaan-3: no genuine 360掳 panorama exists.** ISRO never published a stitched 360掳 surface
   panorama. What exists is (a) partial single-frame Lander Imager (LI) / Lander Position Detection Camera
   (LPDC) views, (b) NavCam single frames from Pragyan, and (c) one **anaglyph** (red/cyan 3D) synthesised
   from a **NavCam stereo pair** — explicitly a stereo anaglyph, not a panorama.
2. **The entire `isro.gov.in` domain is WAF-blocked (HTTP 403, Cloudflare "Just a moment...")** for every
   path, with and without browser User-Agents. No ISRO-hosted image could be downloaded at all. This is a
   hard, reproducible blocker, not a transient failure.
3. **ISRO licensing is self-contradictory across its own sites**: a permissive Government-of-India-style
   "Copyright Policy" (reproduce free of charge, acknowledge source) alongside a "Terms of Use" that
   requires **prior permission** from ISRO for reusing its material. Redistribution risk is **MEDIUM-HIGH**.
4. **JAXA SLIM: no 360掳 panorama.** The best real asset is the **MBC lunar-surface scan mosaic, 2805x1842 px,
   3,221,710 bytes** — but this is a mosaic of **257 low-resolution monochrome frames**, i.e. a partial
   surface scan, not a panorama. JAXA's terms permit press/scientific/educational/private use but
   **strictly prohibit commercial use without prior permission**.
5. **Kaguya/SELENE was ORBITAL** (~100 km, later lower passes; lowest published still is 20.7 km). It has
   **no landed surface panorama** and no lander at all. Its HDTV stills are downloadable from the ISAS
   DARTS/PDS3 archive, but are **jointly copyrighted to JAXA/NHK** and opened only for scientific and
   educational purposes — the normal permissive ISAS data policy does **not** apply, and NHK licenses
   paid-only to organisations. High-res Terrain Camera data exists (12288x12288 16-bit) but as PDS3/ISIS
   `.img`, not JPEG panoramas.
6. **ESA has no lunar surface panorama.** SMART-1 was orbital (it *impacted*, never landed), the European
   Lunar Lander was a study, Heracles "no longer exists", and Argonaut — ESA's first lunar lander" — is
   not due until 2030/2031. ESA's panorama-shaped lunar imagery is **CGI** ("Artist's impression—).
7. **No real Artemis-era surface panorama exists, and the programme has changed.** Artemis I was uncrewed
   and did not land; **Artemis II has already flown (splashdown 2026-04-10) as a crewed free-return flyby
   without landing**; and **Artemis III was restructured on 27 Feb 2026 so that it will NOT land** — the
   first crewed landing moves to Artemis IV (~2028). Artemis III "surface" pictures are **artist's concepts**.
   The genuinely valuable Artemis-era find is instead **real Artemis II lunar photography from the Orion
   spacecraft** (5568x3712 px, NASA, reusable) — not a surface panorama.

---

## 1. ISRO Chandrayaan-3

### 1.1 Blocked: the entire isro.gov.in domain

Verbatim probe output:

```
403 | text/html | 5470 | HTML | https://www.isro.gov.in/
403 | text/html | 4096 | HTML | https://global.jaxa.jp/
```

(`global.jaxa.jp` shown for contrast; ISRO is the 403.)

```
403 | text/html | 5683 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/
403 | text/html | 5743 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/CopyrightPolicy.html
403 | text/html | 5710 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/terms-use
403 | text/html | 5746 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/Copyright_Policy.html
```

(those four were fetched with `.agents/research/tools/grab.mjs`, which sends a full Chrome User-Agent)

Additional ISRO paths, all 403:

```
403 | text/html | 5576 | HTML | https://www.isro.gov.in/Copyright_Policy.html
403 | text/html | 5539 | HTML | https://www.isro.gov.in/website-policies
403 | text/html | 5533 | HTML | https://www.isro.gov.in/privacy-policy
403 | text/html | 5570 | HTML | https://www.isro.gov.in/Website_Policy.html
403 | text/html | 5515 | HTML | https://www.isro.gov.in/ISRO_EN/
403 | text/html | 5635 | HTML | https://www.isro.gov.in/Chandrayaan3.html
403 | text/html | 5648 | HTML | https://www.isro.gov.in/update/25-aug-2023/pragyan-rover-video
403 | text/html | 5642 | HTML | https://www.isro.gov.in/ISRO_HINDI/chandrayaan3_gallery.html
403 | text/html | 5588 | HTML | https://www.isro.gov.in/chandrayaan3_gallery.html
403 | text/html | 5536 | HTML | https://www.isro.gov.in/media_isro/pdf/
403 | text/html | 5732 | HTML | https://www.isro.gov.in/media_isro/image/index/Chandrayaan3/Ch3_Lander_Imager_1.jpg
403 | text/html | 5738 | HTML | https://www.isro.gov.in/media_isro/image/index/Chandrayaan3/Chandrayaan3_Anaglyph.jpg
403 | text/html | 5521 | HTML | https://www.isro.gov.in/index.html
403 | text/html | 5536 | HTML | http://www.isro.gov.in/TermsofUse.html
```

**A multi-User-Agent soft-fetch was also tried on a real ISRO image path** (Chrome 124, Firefox 126, curl/8.4):

```
403 | text/html | 6015B | HTML | ua=Mozilla/5.0 (Windows | https://www.isro.gov.in/media_isro/image/index/Chandrayaan3/Chandrayaan3_Anaglyph.jpg
```

The 403 body is Cloudflare's JS challenge. Verbatim body text from `--text https://www.isro.gov.in/`:

```
### 403 | text/html | 5662 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/
Just a moment... Enable JavaScript and cookies to continue
```

Domain-variant probes:

```
ERR  | ENOTFOUND fetch failed | https://isro.gov.in/
403 | text/html | 5521 | HTML | https://www.isro.gov.in/index.html
ERR  | ENOTFOUND fetch failed | https://isro.gov.in/TermsofUse.html
```

**Conclusion: no ISRO-hosted image, and no ISRO page, is reachable through this proxy.** The exact
`isro.gov.in` image URLs therefore could not be verified as returning image bytes, and I do not assert
any URL as a working direct download.

### 1.2 Where the images actually are — the `media_isro` path

The Bing/Google indexes confirm ISRO hosts imagery at `https://www.isro.gov.in/media_isro/image/index/Chandrayaan3/...`
and documents at `.../media_isro/pdf/...`. Both prefixes return 403 (probes above). The ISRO Hindi gallery
`https://www.isro.gov.in/ISRO_HINDI/chandrayaan3_gallery.html` also returns 403. **So the canonical
ISRO-hosted originals exist but are undownloadable here.**

### 1.3 What actually was released, and its coverage

| Date | Asset | Sensor | Coverage / type |
| --- | --- | --- | --- |
| 2023-08-18 | Moon images with craters *Fabry*, *Giordano Bruno*, *Harkhebi J* | Lander Imager (LI) Camera-1; Lander Position Detection Camera (LPDC, 2023-08-15) | **Orbital** views taken after LM/PM separation — **not surface, not panorama** |
| 2023-08-23/24 | Surface views after touchdown | LI Camera | Single partial frames |
| 2023-08-30 | First image of Vikram lander taken *by* Pragyan | Pragyan NavCam | Single frame, partial view of the lander |
| 2023-08-28 (approx.) | ChaSTE temperature-profile graph; LIBS spectra | ChaSTE / LIBS | **Instrument plots/data, not photographic panoramas** |
| 2023-09-05 | **Anaglyph (red/cyan 3D)** of Vikram | Pragyan **NavCam Stereo Imager** | Stereo anaglyph from a **left+right stereo pair** — **NOT a panorama** |

**Explicit finding on the 360掳 question:** there is **no genuine 360掳 Chandrayaan-3 panorama**. Every
released product is either a single narrow-field frame, a stereo anaglyph, or an instrument plot. The
anaglyph is frequently mis-described in secondary coverage as a "3D image of the moon's surface"; per
ISRO's own wording it is an anaglyph built from a NavCam **stereo pair**.

Verbatim from ISRO's quoted caption, as reproduced by The Indian Express
(<https://indianexpress.com/article/technology/science/isro-chandrayaan-3-vikram-lander-8927094/>):

> Anaglyph is a simple visualization of the object or terrain in three dimensions from stereo or multi-view images.
> The Anaglyph presented here is created using NavCam Stereo Images, which consist of both a left and right image
> captured onboard the Pragyan—
and the article's own description:

> In this case, the left image is in the red channel while the right image is placed in the blue and green channel,
> creating cyan. Essentially, if you use glasses with a red filter over the left eye and a cyan filter over the right
> eye, this image will look three-dimensional to you. This image was captured using the NavCam Stereo Imager on the
> Pragyan rover.

and the date:

> ISRO on Tuesday shared a 3D image of the lander taken by the rover.

(article dated 6 September 2023; ISRO posted 5 September 2023)

### 1.4 The one Chandrayaan-3 image file I could actually download

Because ISRO's own host is unreachable, the only Chandrayaan-3 file verified as real bytes is a **news
rehost**, not an ISRO original. Probe + full GET output, verbatim:

```
### 200 | image/jpeg | 79294 bytes | magic=ffd8ffe000104a46 | https://images.indianexpress.com/2023/09/ISRO-Chandrayaan-3-lander-20230906.jpg
saved -> .agents/research/ie-anaglyph.jpg
```

Real parsed dimensions:

```
200 | image/jpeg | 79294 bytes | JPEG 1200x667 | https://images.indianexpress.com/2023/09/ISRO-Chandrayaan-3-lander-20230906.jpg
```

- File: `ISRO-Chandrayaan-3-lander-20230906.jpg`, **1200x667 px, 79,294 bytes, JPEG SOF0**.
- This is the Indian Express presentation of ISRO's 5 Sep 2023 NavCam anaglyph.
- **It is a third-party rehost at news-presentation resolution, not ISRO's original.** ISRO's original
  resolution could not be determined because the origin is blocked.
- Attribution as the page states it: `(ISRO via X.com)`.
- Licence: Indian Express's own site terms — **do not treat as reusable**. Redistribution risk **HIGH**.

**Do not use this file as the Chandrayaan-3 candidate of record.** It is recorded here only as evidence
that the anaglyph is real and as the only reachable byte-level proof.

### 1.5 ISRO licensing — exact quoted terms

ISRO's own policy pages are blocked, so the text below was obtained from **ISRO-organisation websites that
are reachable** and from indexed fragments of the blocked pages. Each quote states its provenance.

#### (a) VSSC (Vikram Sarabhai Space Centre, an ISRO centre) — "Terms of Use"

Source (fetched, verbatim): <https://www.vssc.gov.in/VSSC/TermsofUse.html>
Probe: `206 | text/html | 3516 | HTML | https://www.vssc.gov.in/VSSC/TermsofUse.html`

> The copyright of the material of VSSC/ISRO contained in this website belongs to and remains solely with
> VSSC/ISRO. Anybody who is interested to use the material of VSSC/ISRO featured in this Website, is required
> to take the permission from VSSC/ISRO. Nevertheless, the material has to be reproduced accurately and not to
> be used in a derogatory manner or in a misleading context. Users are requested to acknowledge appropriately
> for the material used.

> These terms and conditions shall be governed by and construed in accordance with the Indian Laws. Any dispute
> arising under these terms and conditions shall be subject to the exclusive jurisdiction of the courts of India.

#### (b) IPRC (ISRO Propulsion Complex) — Website Policies": Copyright Policy

Source (fetched, verbatim): <https://www.iprc.gov.in/website_policies.html>
Probe: `206 | text/html | 4096 | HTML | https://www.iprc.gov.in/website_policies.html`

> Material featured on this Website may be reproduced free of charge. However, the material has to be reproduced
> accurately and not to be used in a derogatory manner or in a misleading context. Wherever the material is being
> published or issued to others, the source must be prominently acknowledged. However, the permission to
> reproduce this material shall not extend to any material which is identified as being copyright of a third
> party. Authorization to reproduce such material must be obtained from the departments/copyright holders
> concerned.

This is the standard Government-of-India website copyright formulation. Note the **third-party carve-out**,
which matters because Chandrayaan-3 images are partly credited to ISRO centres and partner institutions.

IPRC "Terms of Use" on the same page:

> The copyright of the material of IPRC contained in this website belongs to and remains solely with IPRC. If any
> user is interested to use the material of IPRC featured in this Website, then, the user is required to take the
> permission from IPRC. Nevertheless, the material has to be reproduced accurately and not to be used in a
> derogatory manner or in a misleading context. Users are requested to acknowledge appropriately for the material
> used.

#### (b2) (U R Rao Satellite Centre, ISRO) — "Copyright Policy" — the clearest ISRO statement

Source (fetched, verbatim): <https://www.ursc.gov.in/copyright.jsp>
Probe: `200 | text/html | - | 0d0a0d0a3c21444f43545950 | https://www.ursc.gov.in/copyright.jsp`
Page footer: `Last updated on: 01-Apr-2015`

> Copyright Policy
>
> Material featured on this site may be reproduced free of charge in any format or media without
> requiring specific permission except where specifically stated otherwise. This is subject to the material being
> reproduced accurately and not being used in a derogatory manner or in a misleading context. Where the material is
> being published or issued to others, the source must be prominently acknowledged. However, the deemed permission
> to reproduce this material does not extend to any material on this site, which is explicitly identified as being
> copyright of a third party as well as to materials contained in the hyper linked sites. Authorization to
> reproduce such material must be obtained from the copyright holders concerned.

**This is the most permissive ISRO wording found anywhere**, and it is materially stronger than the IPRC/SAC
variant: it grants reproduction "**free of charge in any format or media without requiring specific
permission**", with only (i) accurate reproduction, (ii) no derogatory/misleading use, (iii) prominent source
acknowledgement, and (iv) a third-party carve-out.

URSC's separate "Terms of Use" page (<https://www.ursc.gov.in/terms.jsp>, probe `200`) adds only the
linked-site caveat:

> URSC cannot authorise the use of copyrighted materials contained in linked websites. Users are advised to
> request such authorisation from the owner of the linked website.

Note that URSC's **Terms of Use does NOT** contain the "permission is required" sentence that VSSC's and
IPRC's Terms of Use carry — so URSC is internally consistent and permissive.

#### (c) SAC (Space Applications Centre, ISRO) — "Terms of Use"

Source (fetched, verbatim): <https://www.sac.gov.in/terms?lang=en>
Probe: `200 | text/html | - | 203c21444f43545950452068 | https://www.sac.gov.in/terms?lang=en`

> This website is designed, developed and maintained by Space Applications Centre, Indian Space Research
> Organisation, Department of Space, Government of India. By accessing this website, you agree that SAC/ISRO will
> not be liable for any direct or indirect loss arising from the use of the information and the material contained
> in this website.

> Space Applications Centre/ISRO, cannot authorise the use of copyright materials contained in linked website. Users
> are advised to request such authorisation from the owner of the linked website.

#### (d) `isro.gov.in/Copyright_Policy.html` — NOT OBTAINABLE VERBATIM

The main ISRO Copyright Policy page is 403-blocked. Its indexed fragment establishes the opening words but
**the full paragraph could not be obtained**; I will not reconstruct it. Indexed fragment (via web search,
shown as a page-text match, not a fetched page):

> Material featured on this site belongs to the DOS—
(that is the entirety of the recoverable text; do not extend it by inference)

Similarly blocked and **not obtained verbatim**: `isro.gov.in/TermsofUse.html`,
`isro.gov.in/Website_Policy.html`, `isro.gov.in/HyperlinkingPolicy.html`,
`issdc.gov.in/copyright.html`, `pradan.issdc.gov.in/*/disclaimer.xhtml`,
`vedas.sac.gov.in/en/copyright.html`, `vedas.sac.gov.in/en/terms-conditions.html`.

Blocked-host probes (verbatim):

```
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.issdc.gov.in/copyright.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.vedas.sac.gov.in/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://pradan.issdc.gov.in/ch2/disclaimer.xhtml
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.mosdac.gov.in/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://bhuvan.nrsc.gov.in/
```

#### (e) ISRO on broadcast copyright — relevant but narrow

Reported statement (secondary source, headline): "DD does not have copyright over rocket launch broadcast: ISRO".
This concerns **launch broadcast video**, not still imagery, and does **not** establish any general public-domain
status for Chandrayaan-3 surface images. Included only to prevent mis-citation.

### 1.6 ISRO redistribution risk

**MEDIUM-HIGH.** Assessment grounded strictly in the quoted text above:

- The ISRO-centre **Copyright Policy** wording permits free reproduction **with** prominent source
  acknowledgement, accurate reproduction, no derogatory/misleading use, and **excludes third-party
  material**.
- The ISRO-centre **Terms of Use** wording says the copyright "belongs to and remains solely with"
  the centre and that anybody wishing to use the material "**is required to take the permission**".
- These two coexist on the same servers. The conservative reading is that still imagery is
  **permission-gated**, and that the "reproduced free of charge" clause is a website-text policy that has not
  been clearly extended to Chandrayaan-3 mission photography.
- ISRO is **not** a US-government agency; **NASA's public-domain rule does not apply**, and there is no
  equivalent blanket Indian open licence established for ISRO imagery here (the Government Open Data
  Licence / NDSAP question is addressed in section 1.7.
- Practical guidance: attribute exactly, do not imply ISRO endorsement, and for any commercial or
  redistributed product **seek ISRO permission in writing**.

### 1.7 Open item — government open-data licence

Whether the Indian **NDSAP / "Government Open Data License — India"** covers ISRO imagery was being
checked separately; it was **not confirmed** in this pass. Treat as **unresolved** — do not assume ISRO
imagery is open-licensed.

---

## 2. JAXA SLIM

### 2.1 Landing site (published)

From ISAS DARTS SLIM mission page
(<https://darts.isas.jaxa.jp/en/missions/slim>, fetched, 200):

> On January 20 at 00:20 JST, SLIM successfully landed approximately 60 meters from the target site. The
> designated landing area was located east of Shioli crater (25.2 degrees east, 13.3 degrees south).

So: **鈮?3.3掳S, 25.2掳E**, east of **Shioli crater**, west of **Mare Nectaris**.

JAXA's 25 Jan 2024 press release (<https://global.jaxa.jp/press/2024/01/20240125-1_e.html>) adds that SLIM
"had reached the Moon's surface approximately 55m east of the original target landing site".

### 2.2 ⚠️ CORRECTION — a tempting file that is NOT a surface image

```
206 | image/png | 4096 | PNG | https://global.jaxa.jp/press/2024/01/images/20240125-1_e_02.png
200 | image/png | 3221710 bytes | PNG 2805x1842 | https://global.jaxa.jp/press/2024/01/images/20240125-1_e_02.png
```

**`20240125-1_e_02.png` (2805x1842 px, 3,221,710 bytes) is NOT the MBC surface mosaic.** I initially
recorded it as the strongest SLIM candidate on the strength of its size alone. That was **wrong** and is
corrected here: I opened the downloaded file and it is an **annotated landing-accuracy map** — a
Chandrayaan-2 orbital terrain image overlaid with red/blue rectangles labelled
"HV2 (obstacle detection) #2 image range (horizontal error approx. 10.2m)", "SLIM footprint (including
guidance error)", "Target landing site", "Centre of safe area", "Actual landing site (estimate)" and a
"55m" arrow.

JAXA's own caption for it, verbatim
(<https://global.jaxa.jp/press/2024/01/20240125-1_e.html>):

> 鈻?Estimation of SLIM's current location and the target landing site (credit: Chandrayaan-2:ISRO/SLIM:JAXA)
> Note: Lunar topography captured by the Indian spacecraft Chandrayaan-2, overlaid with images acquired by the
> SLIM navigation camera during the HV2 (second hovering) at an altitude of about 50m.

It is a **diagram, not a photograph of the surface from the ground**, and its base layer is ISRO
Chandrayaan-2 orbital data. **Do not use it as a panorama source.** Its real value in this research is
methodological: it proves that file size alone is not evidence of a panorama.

### 2.3 The actual MBC scan mosaic (best real SLIM surface asset)

```
200 | image/png | 402546 bytes | PNG 1000x842 | https://www.isas.jaxa.jp/topics/files/20240201_01b.png
200 | image/png | 542782 bytes | PNG 1160x875 | https://www.isas.jaxa.jp/en/topics/files/20240201_2_en.png
200 | image/png | 660627 bytes | PNG 1344x1008 | https://www.isas.jaxa.jp/topics/files/20240201_02.png
200 | image/png | 80968 bytes | PNG 489x481 | https://www.isas.jaxa.jp/topics/files/20240201_1a.png
200 | image/png | 64697 bytes | PNG 256x320 | https://www.isas.jaxa.jp/topics/files/20240201_03.png
200 | image/jpeg | 1005913 bytes | JPEG 1376x921 | https://www.isas.jaxa.jp/topics/files/20240201_4.jpg
```

| URL | REAL size | Content |
| --- | --- | --- |
| `https://www.isas.jaxa.jp/topics/files/20240201_02.png` | **1344x1008 px, 660,627 B** | **LARGEST mosaic image** (annotated, Japanese rock labels) |
| `https://www.isas.jaxa.jp/en/topics/files/20240201_2_en.png` | **1160x875 px, 542,782 B** | Annotated mosaic, **English** rock names |
| `https://www.isas.jaxa.jp/topics/files/20240201_01b.png` | **1000x842 px, 402,546 B** | **Best CLEAN mosaic** (no labels, post-power-restoration) |
| `https://www.isas.jaxa.jp/topics/files/20240201_1a.png` | 489x481 px, 80,968 B | Re-encode of the original Jan-2024 MBC figure |
| `https://www.isas.jaxa.jp/topics/files/20240201_03.png` | 256x320 px, 64,697 B | AKITAINU rock, 1.65 碌m band |
| `https://www.isas.jaxa.jp/topics/files/20240201_4.jpg` | 1376x921 px, 1,005,913 B | **Team photo — NOT a surface image** |

Released **1 February 2024** via ISAS topics; the Jan-2024 equivalents are in the 25 Jan 2024 JAXA press
release. Content, verbatim from <https://global.jaxa.jp/press/2024/01/20240125-3_e.html>:

> Figure 1:A lunar surface scan mosaic image captured by the SLIM-mounted MBC (left) and its enlarged view
> (right). (Credit: JAXA, RITSUMEIKAN UNIVERSITY, THE UNIVERSITY OF AIZU)

> The scanning is performed by moving the adjustable mirror and is for preliminary examination of the rocks of
> scientific interest that are situated around the SLIM landing site. Figure 1 shows a landscape image created
> by synthesizing 257 low-resolution monochrome pictures.

**I opened `20240201_01b.png` and `20240201_2_en.png` visually to confirm what they are.** The first is a
grey-scale surface sweep with a **jagged, sawtooth-edged border and a large dark no-data region** — the
stitched footprint of a rastered mirror scan. The second is the same mosaic with yellow circles and arrows
labelling rocks named `St. Bernard`, `Dalmatian`, `KAIKEN`, `Labrador Retriever`, `Beagle`, `Papillon`,
`AKITAINU`, `SHIBAINU`, `Toy Poodle`, `TOSAINU` — these are JAXA's published rock nicknames, and they
confirm this is the real MBC scan product, not a map.

**Coverage: PARTIAL. NOT a 360掳 panorama, and not even a complete sweep.**

- It is a **stitched mosaic** of **257** low-resolution **monochrome** frames, not a single exposure.
- The scan **was never completed**. From the official ISAS press-conference deck (2024-01-25, PDF,
  4,799,782 B), verbatim: *"white areas are without data because the scan was terminated at the half-way
  point."* JAXA's press release similarly notes: *"The grey area on the right of the mosaic lacks data due
  to the discontinuation of scanning operation."*
- MBC has a **movable mirror for panning and tilting** (DARTS: "a telephoto focusable optical system, and a
  movable mirror for panning and tilting"), so the scan is a limited commanded raster around the landing
  site, not a full horizon sweep.
- **"panorama" and "360" do NOT appear in either official English PDF** (Dec-2024 project review, 2,701,449 B;
  Jan-2024 press-conf, 4,799,782 B) — searched with whitespace-stripped text extraction.
- **Exact angular field of view in degrees is NOT published** by JAXA. I state none.
- **Best clean mosaic is only 1000x842 px.** Resolution is inadequate for a hi-res panorama viewer.

**Also byte-identical duplicates (do not double-count):** `https://www.jaxa.jp/press/2024/01/images/20240125-3_01.png`
is byte-identical to the Jan-2024 MBC figure (sha256 `c3a2d1f2fad53fb3— 89,946 B).

### 2.4 SLIM navigation-camera image after landing

```
206 | image/jpeg | 4096 | JPEG | https://global.jaxa.jp/press/2024/01/images/20240125-1_e_01.jpg
200 | image/jpeg | 50679 bytes | JPEG 545x542 | https://global.jaxa.jp/press/2024/01/images/20240125-1_e_01.jpg
```

- **REAL dimensions: 545x542 px, 50,679 bytes, JPEG SOF0.** Low resolution.
- Caption, verbatim from the release: `鈻?Image of the lunar surface captured by the SLIM onboard navigation
  camera after landing (credit: JAXA)` / `Note: the image is rotated to align with the direction of gravity.`
- **Coverage: single narrow-frame partial view. Not a panorama.**

### 2.5 The multispectral band image

```
206 | image/png | 4096 | PNG | https://global.jaxa.jp/press/2024/01/images/20240125-3_e_02.png
200 | image/png | 274207 bytes | PNG 483x477 | https://global.jaxa.jp/press/2024/01/images/20240125-3_e_02.png
206 | image/png | 4096 | PNG | https://global.jaxa.jp/press/2024/01/images/20240125-3_e_01.png
200 | image/png | 89946 bytes | PNG 489x481 | https://global.jaxa.jp/press/2024/01/images/20240125-3_e_01.png
```

- `20240125-3_e_01.png`: **489x481 px, 89,946 bytes**
- `20240125-3_e_02.png`: **483x477 px, 274,207 bytes**
- These are **small spectral/analysis figures**, not high-resolution panorama material.

### 2.6 LEV-2 (SORA-Q) image of SLIM on the surface

```
206 | image/jpeg | 4096 | JPEG | https://global.jaxa.jp/press/2024/01/images/20240125-4_e_01.jpg
200 | image/jpeg | 108020 bytes | JPEG 640x480 | https://global.jaxa.jp/press/2024/01/images/20240125-4_e_01.jpg
```

- **REAL dimensions: 640x480 px, 108,020 bytes, JPEG SOF0.**
- Release (<https://global.jaxa.jp/press/2024/01/20240125-4_e.html>), verbatim caption:
  `An image of SLIM on the lunar surface` / `(credit: JAXA/TOMY /Sony`
- Additional verbatim note: `This image is a test image acquired by the test radio wave data transfer of the
  LEV-1 and LEV-2 radio stations.`
- **Coverage: single frame, partial. Not a panorama.**

### 2.7 SLIM negatives worth recording

- **LEV-1 acquired no confirmed image.** Verbatim from
  <https://global.jaxa.jp/press/2024/01/20240125-2_e.html>:
  > On the other hand, image acquisition on the lunar surface has not been confirmed as of now.

- **200+ science images were later released**, but the DARTS SLIM dataset list currently reads
  `(in preparation)` — the PDS archive for SLIM MBC was not yet populated at time of research.

- SLIM's operational end: DARTS states "after three overnights, the operation was ended on 2024-08-23".

### 2.8 JAXA licensing — exact quoted terms

Source (fetched, verbatim): <https://global.jaxa.jp/policy.html> — JAXA | Site Policy", "Terms of Use"
Probe: `206 | text/html | 4096 | HTML | https://global.jaxa.jp/policy.html` then
`### 200 | text/html | 47104 bytes | magic=3c21444f43545950 | https://global.jaxa.jp/policy.html`

Policy version found on the page: **`March 29, 2022 Updated`**.

Ownership:

> Unless otherwise stated, all materials, including texts, drawings, images, voice data, and video data,
> published on the Site (the "Materials") and the copyrights therein are the property of JAXA, and the Materials
> are protected in Japan and internationally by copyright laws and international copyright treaties. When you use
> the Materials, you are requested to comply with the conditions stipulated by JAXA.

Permission-free uses:

> It is to be noted that, under copyright laws, you may use the Materials without obtaining permission of the
> copyright holder (JAXA) to the extent that your use is for the purpose of press (media) activity/scientific
> research/educational activity/ and/or private use (for example, printing out the Materials and/or storing the
> same on a hard disc for the purpose of use in the course of lessons in a school or other educational
> institutions established for nonprofit-making or for the purpose of personal use, family use or other similar
> uses within a limited circle).

**Commercial use is prohibited without prior permission:**

> Your use of the Materials for business or commercial purposes without the prior permission of the copyright
> holder (JAXA) is strictly prohibited. If you wish to use the Materials for such business or commercial purposes,
> please be sure to contact us for prior permission at:

Third-party carve-out (critical for Kaguya HDTV and any co-credited image):

> For using materials, including texts, drawings, images, voice data and video data, that belong to other
> organizations apart from JAXA. If you wish to use such materials, please contact the copyright holder of the
> said material.

Portrait/publicity and logo carve-outs:

> For using materials about individuals including astronauts without prior permission from JAXA in order to protect
> the publicity rights and the rights of portraits of individuals.

> For using the JAXA logo.The JAXA logo is a registered trademark in Japan and other countries. It is not available
> for the general public to use unless prior permission is received from the trademark holder (JAXA.)

Digital Archives:

> When you wish to utilize any materials, including texts, drawings, images, voice data and video data, saved in
> the JAXA Digital Archives, please refer to "Copyright Information" in the Digital Archives before you use the same.

#### ⚠️ THE DECISIVE CLAUSE — no modification, which forbids panorama stitching

Verbatim, from the same page (sub-heading `(Modification of Data)`):

> No modification is allowed to any of the Materials, except for a modification needed for indicating their source.
> The act of "modification" includes, but not limited to, acts of trimming a drawing, image, voice data or video data
> (for example, an act of changing the ratio of height and length of an image, cropping part of an image, or mounting
> an image inside another image that seriously undermines the original image etc.), changing colors, and turning over
> an image.

**This is the single most consequential finding for panorama work.** Building a panorama requires exactly the
acts this clause names: **cropping** frames, **changing the height/length ratio**, and normally
**reprojecting**. All are prohibited modifications. A derived SLIM panorama would therefore be a licence
breach even where the underlying use (e.g. educational) is otherwise permission-free.

#### Required attribution, verbatim

> When you use the Materials on the Site, you are requested to indicate their source in such a manner as designated
> by JAXA, for example, "Provided by Japan Aerospace Exploration Agency (JAXA)" or "Courtesy of JAXA". If space is
> limited, shorter versions of the indication such as "Provided by JAXA" or "JAXA" are acceptable.

> Some of the Materials may be owned and provided by an other organization or jointly owned by an other organization
> and JAXA. As long as the source of the Materials is specified on The Site, you are requested to indicate the said
> source (i.e. "Provided by NASA" or "Provided by NASA/JAXA")

#### JAXA Digital Archives (JDA) terms, verbatim

Source: <https://jda.jaxa.jp/service.php?lang=e>

- Credit required: `(C) Japan Aerospace Exploration Agency (JAXA)` or `(C)JAXA`
- Prohibition of alteration: *"Alterations that change the meaning or intent of the material are prohibited.
  (Examples of prohibited alteration: alteration to length and width, change or invert some of the colors,
  trimming ... or inserting it into other material)"*
- *"Distributing JAXA's photos and videos without first obtaining the permission of JAXA"* is prohibited.
- Commercial/for-profit use requires payment plus an application (payment procedure currently suspended).
- Note: the English JDA copyright URL is **broken** — `https://jda.jaxa.jp/en/copyright.html` 301-redirects to
  `https://jda.jaxa.jp/?lang=ecopyright.html`, which lands on the **Japanese top page**, not the copyright text.

#### ISAS image policy, verbatim

Source: <https://www.isas.jaxa.jp/en/imagepolicy/>

> explicit credit shall be given to ISAS/JAXA ... such as "(c) ISAS/JAXA," and "Courtesy of ISAS/JAXA."

The ISAS page contains **no** modification clause of its own (searched for modif/alter/crop/trim — no
match) and defers to the JDA, which does prohibit alteration.

Governing law:

> Unless otherwise stipulated, the use of the Site and the interpretation and application of the Terms of Use shall
> be governed by the laws of Japan. The Tokyo District Court in Tokyo, Japan shall have the exclusive jurisdiction
> of the first instance for any disputes arising out of or relating to the use of the Site.

**Also relevant** — old NASDA/ISAS/NAL site policies are void and JAXA's Terms of Use govern:

> Please note that the site policies or equivalent statements on websites of the three former organizations that were
> merged into JAXA, (namely, National Space Development Agency of Japan (NASDA), the Institute of Space and
> Astronautical Science (ISAS), and National Aerospace Laboratory (NAL)), have lost their validity. Therefore, only
> the Terms of Use will be applied for the use of any material including texts, drawings, images, voice data, and
> video data available from the websites of the three organizations.

**SLIM redistribution risk: HIGH** for any derived panorama product, and **HIGH** for redistribution of the
source files.

Reasoning, grounded strictly in the quoted text:

- The **no-modification clause** expressly names *cropping*, *changing the ratio of height and length of an
  image*, *changing colors*, and *turning over an image* as prohibited. Constructing a panorama from these
  frames is precisely such a modification, so the permission-free paths (press / scientific research /
  education / private) **do not extend to making a stitched or reprojected derivative**.
- The JDA terms independently prohibit distributing JAXA photos/videos without permission.
- **Commercial use is "strictly prohibited"** without prior permission, regardless of modification.
- The mosaic is **jointly credited** `JAXA, RITSUMEIKAN UNIVERSITY, THE UNIVERSITY OF AIZU`, so the
  third-party carve-out means clearance may be needed from all three for any wider use.
- The LEV-2 image has `©JAXA/TOMY/Sony Group Corporation/Doshisha University` **burned into the pixels**.

**Practical recommendation:** JAXA SLIM imagery is unsuitable as a hi-res panorama source on both counts — coverage (a partial, incomplete, no-data-bearing scan sweep; no 360掳 product exists) and licence (derivative
stitching is prohibited). If a SLIM-site panorama is genuinely required, the only correct route is **written
permission from JAXA** (Public Affairs / JAXA Imagery Service) and from the co-creditees.

---

## 3. JAXA Kaguya / SELENE — ORBITAL, not landed

### 3.1 The essential distinction (do not blur this)

**Kaguya/SELENE (launched 14 Sep 2007, ended 10 Jun 2009) was an ORBITAL mission.** Verbatim from JAXA:

> The KAGUYA is currently flying in a lunar orbit at an altitude of about 100 km.

Its final HDTV "descent" imaging was performed from **27.8 / 25.4 / 23.0 / 20.7 km** altitude (table in
<https://global.jaxa.jp/press/2009/06/20090619_kaguya_hdtv_e.html>).

**Therefore Kaguya has NO landed surface panorama.** Any Kaguya "surface panorama" is strictly an
**orbital horizon / oblique or nadir view from tens of kilometres up**. It must never be presented as a
panorama taken from the lunar surface. This is the single most important point in this section.

### 3.2 Where the real HDTV stills are (verified)

True HDTV stills are **not** in the press gallery; they are in the **ISAS DARTS / PDS3 archive**:

`https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/`

with README text stating the directory "contains all still images in the movies taken by SELENE(Kaguya)
High Definition Television System, Kaguya HDTV, for educational and scientific purposes."
`data/` holds FITS EDRs by month (`200709`..`200906`); `browse/{small,medium,large}/` holds JPEGs;
`browse/large/200804/*.mp4` holds full movies (109 MB—39 MB).

Verified files (full GET + parsed SOF0/SOF2 marker, not stated dimensions):

```
1920x7722, 1,256,383 bytes, JPEG SOF0
https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg
```
(the 7 Nov 2007 tele Earth-rise; `_fp_l` = first/last-frame **vertical filmstrip composite** of the 1-minute
movie — a **sequence composite of NADIR flyover frames with no horizon and no sky at all**, therefore
**not** a panorama)

```
1920x1200, 1,139,198 bytes, JPEG SOF0
.../browse/large/200711/sh_20071107T055245_wm4/sh_20071107T055245_wm4_0000_bl.jpg
```
(**the cleanest ORBITAL HORIZON VIEW** in the archive: a horizon arc with black space above and **no
foreground** — unambiguous proof that this is an orbital view, not a landed panorama)

```
1920x4445, 1,084,903 bytes, JPEG SOF0
.../browse/large/200804/sh_20080405T031500_wm4_fp_l.jpg
```

```
1920x1200, 703,590 bytes, JPEG SOF0
.../browse/large/200804/sh_20080406T095510_wi1/sh_20080406T095510_wi1_0000_bl.jpg
```
(6 Apr 2008 Full Earth-rise wide, single frame)

```
200 | image/jpeg | 238277 bytes | JPEG 1920x1080 | https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_01l.jpg
```
(7 Nov 2007 Earthrise wide, single frame)

```
200 | image/jpeg | 226466 bytes | JPEG 2880x1080 | https://global.jaxa.jp/press/2007/11/img/20071113_kaguya_03l.jpg
```
(5-frame Earth rise/set filmstrip; visually confirmed as Earth over a lunar horizon, with a **© JAXA/NHK
watermark** burned in — the filmstrip is a sequence composite, **not** a panorama)

```
200 | image/jpeg | 441073 bytes | JPEG 1920x1080 | https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L4.jpg
```
(final descent still, **20.7 km** altitude — the **lowest published still**)

```
1920x1080, 1,155,207 bytes, JPEG SOF0
https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01l.jpg
```
(JAXA press large Earth-rise — note my own probe returned **1,155,207 bytes** here while a teammate's run of
the same URL recorded 1,153,207; the 2 kB difference is unresolved, so treat byte size as approximate for
this one file. Dimensions 1920x1080 agree.)

```
600x2419, 367,818 bytes, JPEG SOF0
https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_1.jpg
```

**High-resolution Terrain Camera (TC) data.** The native TC ortho-map tiles are **12288x12288, 16-bit,
simple-cylindrical** (`LINES=12288`, `LINE_SAMPLES=12288`, `SAMPLE_BITS=16`). So genuine high-resolution
Kaguya terrain data exists — but as **PDS3/ISIS `.img`** products requiring ISIS processing, **not** as
ready-to-use JPEG panoramas. The browse JPEG is only **512x512** (84,854 bytes, e.g.
`.../sln-l-tc-5-ortho-map-v2.0/lon000/browse/large/TCO_MAP_02_N00E000S03E003SC.jpg`).

Full HDTV movies exist as `.mp4` at `.../browse/large/200804/` (**639 MB** and **133 MB**).

### 3.3 Kaguya licensing — a JAXA licence does NOT cover it

Verbatim from the DARTS/PDS3 `catalog/dataset.cat` (`DATA_SET_DESC`):

> Copyright
> =========
> Unlike generic data set in planetary data system (PDS), this data set is copyrighted to JAXA/NHK, and opened
> for scientific and educational purpose. Users of this data set must inquire Japan Aerospace Exploration Agency
> for the other purposes.

So ISAS's normally permissive data policy (CC-BY-compatible, per
<https://www.isas.jaxa.jp/en/researchers/data-policy/>) **does not apply to HDTV**. The HDTV product is
explicitly carved out as **JAXA/NHK joint copyright**, restricted to **scientific and educational** use,
with **all other purposes requiring an inquiry to JAXA**.

This is reinforced by the general JAXA third-party clause quoted in section 2.7, and by jda.jaxa.jp/service.php:
> Works from providers other than JAXA cannot be provided by JAXA.

**A plain JAXA-wide licence therefore does NOT cover the Kaguya HDTV frames.** This is corroborated three
independent ways: the press releases are co-issued JAXA + NHK; **every distributed HDTV JPEG carries a
burned-in `© JAXA/NHK` watermark**; and the HDTV camera was NHK-developed.

**NHK's own terms are far stricter than JAXA's.** From <https://www.nhk.or.jp/nijishiyou-qa/index_4.html>:
NHK licensing is **paid-only, organisations-only**, with **no free provision and no licensing to
individuals**.

**Contrast — the TC / MI / LALT *data* products are more permissive.** The ISAS Data Policy
(<https://www.isas.jaxa.jp/en/researchers/data-policy/>) is CC-BY-4.0-compatible, with attribution
"ISAS/JAXA" plus the SELENE TC team. **Only the HDTV material is carved out as JAXA/NHK.** So for Kaguya,
the permissive path is the terrain-camera data, not the pretty HDTV stills.

**Kaguya redistribution risk: HIGH for all HDTV stills and movies** (JAXA/NHK joint copyright,
scientific/educational only, NHK paid-only), and **LOW-MEDIUM for TC/MI/LALT data** (ISAS policy,
CC-BY-4.0-compatible, attribute "ISAS/JAXA" + SELENE TC team). Independently of licensing, Kaguya is the
**wrong product type** for a landed surface panorama: it never landed.

**Dead ends (recorded so they are not re-tried):**
```
ERR | ENOTFOUND fetch failed | wms.selene.jaxa.jp (Kaguya Image Gallery) — host gone
ERR | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www3.nhk.or.jp/...
404 | www.nhk.or.jp Kaguya archive
     global.jaxa.jp/projects/sas/selene/ now renders JAXA's "System Error" page
403 | https://www.kaguya.jaxa.jp/en/ (use /index_e.htm instead)
     the DARTS "Kaguya HDTV Data Publication System" terms page now renders an empty SPA shell
     (749 chars of chrome, empty Nuxt payload) — its text was NOT readable and is NOT paraphrased here
```

---

## 4. ESA and the Artemis era

### 4.1 ESA — no lunar surface panorama

- **ESA has never soft-landed on the Moon.** ESA's own words: **Argonaut** is "ESA's first lunar lander"
  (ESA press release N掳 6-2025), to be delivered "in 2030 for the first operational mission, ArgoNET,
  expected in 2031". So as of 2026-09-12 **no ESA spacecraft has ever operated from the lunar surface**.
- **SMART-1 (2003—006) was ORBITAL.** Verbatim from <https://sci.esa.int/web/smart-1/31407-summary>:
  "...the spacecraft carries out a complete programme of scientific observations in lunar orbit"; it
  "entered lunar orbit on 15 November 2004". Its mission ended when it "impacted the lunar surface in the
  Lacus Excellentiae region" — a planned **impact**, not a landing. Its images are individual **AMIE orbital
  frames** (credit "ESA/SMART-1/AMIE camera team/Space Exploration Institute").
- The **"European Lunar Lander"** was a 2012 **mission study** (arXiv:1207.4965, "on-going mission studies").
  The **Heracles** page states verbatim: "NB: The Heracles mission no longer exists at ESA."
- **Conclusion: ESA has NO genuine lunar surface panorama.** ESA lunar-surface imagery that looks
  panorama-like is **CGI**, and this is a real trap:

| ESA item | Caption | Credit | Licence | Verified file |
| --- | --- | --- | --- | --- |
| "Moon surface scenario" | "Artist's impression of a Moon exploration scenario." | ESA–G | `CC BY-SA 3.0 IGO` | JPEG **1921x1080, 441,640 B** |
| "Heracles lander and rover" | "Artist's impression..." | ESA/ATG Medialab | `ESA Standard Licence` | PNG **1920x1357, 3,752,391 B** |

- **Warning: presence on `esa.int` does NOT mean ESA-owned.** The IM Nova-C image on esa.int carries the
  licence value **`No ESA licences available`**.

**ESA licence, verbatim**
(<https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website>,
updated 18 January 2024):

> (i) You must always credit the ESA copyright - ©ESA

> (v) ...shall not be used for a commercial purpose... A commercial use requires a separate written
> authorisation by ESA

> (iv) SOME images... are licensed under Creative Commons (CC BY-SA 3.0 IGO)

So ESA imagery is free for **educational / editorial / informational use only**, requires a `©ESA` credit,
and **commercial use needs separate written authorisation**. The CC BY-SA 3.0 IGO option is **per-image, not
blanket** — three distinct live licence values were observed: `CC BY-SA 3.0 IGO`, `ESA Standard Licence`,
and `No ESA licences available`.

**ESA redistribution risk: N/A for surface panoramas (none exist); MEDIUM for the CGI items** — usable with
`©ESA` credit for non-commercial purposes, but they are **renders and must be labelled as such**.

Caveat on method: ESA's multimedia search is JavaScript-only (returns a 200 page with **zero** result rows),
so ESA's archive could not be enumerated exhaustively. The negative result rests on ESA's own first-party
statements plus manual image-page inspection.

### 4.2 Artemis era — no real surface panorama, and the programme has changed

> **CURRENCY WARNING.** Session date is **2026-09-12**. Several premises that were true when this task was
> framed are now **out of date**. The corrections below were verified against NASA's own APIs and
> first-party records, plus multiple independent secondary sources.

- **Artemis I (2022): uncrewed and did NOT land.** It flew a distant retrograde orbit; its cameras
  ("on the tip of one of Orion's solar arrays") imaged the Moon from the spacecraft. **No surface imagery.**
- **Artemis II has ALREADY FLOWN, and it did NOT land.** It was a **crewed free-return flyby**; NASA SVS
  product 5632 states the crew followed "a free-return trajectory". Splashdown was **2026-04-10**
  (NASA image `KSC-20260410-PH-JNV01_0001`: "splashdown in the Pacific Ocean near San Diego, California, on
  Friday, April 10, 2026, for the Artemis II test flight"). Crew: Wiseman (CDR), Glover (Pilot), Koch, Hansen.
- **Artemis III HAS BEEN RESTRUCTURED AND WILL NOT LAND.** NASA Administrator Jared Isaacman announced on
  **Friday 27 February 2026** that NASA "no longer plans to land astronauts on the moon during Artemis III";
  Artemis III becomes a LEO flight and the first crewed landing moves to **Artemis IV** (~2028). Corroborated
  by multiple outlets, and indirectly by ESA's own stale-page notice: "Editor's note: ESA will update this
  page to reflect the latest Artemis programme architecture."
  ([The Guardian, 27 Feb 2026](https://www.theguardian.com/science/2026/feb/27/nasa-changes-delays-moon-missions))
- **Therefore, as of 2026-09-12, ZERO humans have walked on the Moon in the Artemis programme, and no
  Artemis lunar SURFACE panorama exists.**

**What Artemis III "surface" imagery actually is — CGI.** NASA's Artemis III items in the official image
library are titled "Artist's Concepts Depict SpaceX's Starship HLS on the Moon for NASA Artemis", with
`AVAIL:Photographer = "Photo courtesy SpaceX"` — a render, and third-party at that. The Artemis III
landing-region visuals are derived visualisations, not photographs; NASA SVS 5013 says verbatim: "In this
visualization rendered using Lunar Reconnaissance Orbiter data, the view moves from a full disk image— revealing 13 candidate landing regions". **Label these as visualisations, never as surface photography.**

**AxEMU (Axiom) items** are all prototypes/mockups/ground tests (JSC, Neutral Buoyancy Lab, "simulated
lunar rock"), credited `Image Credit: Axiom Space` — a third-party carve-out. **None are on the Moon.**

**Machine-checkable absence proof (NASA image API, independently reproduced):**
- `Artemis panorama` 鈫?12 hits, **all Mars**
- `lunar surface panorama` 鈫?24 hits, **all Apollo-era 1972**
- `Moon surface panorama 2026` 鈫?**0**
- `Artemis III landing region` 鈫?**0**

**A genuinely valuable real find instead — Artemis II real lunar photography (from the spacecraft).**
This is real, high-resolution, downloadable material from the Artemis era; it is **not** a surface
panorama, but it is genuine lunar photography with a clean NASA licence:

```
200 | image/jpeg | 147890 bytes | JPEG 1920x1280 | https://images-assets.nasa.gov/image/art002e021278/art002e021278~large.jpg
200 | image/jpeg | 1009521 bytes | JPEG 5568x3712 | https://images-assets.nasa.gov/image/art002e021278/art002e021278~orig.jpg
```

- **Direct URL (full res): `https://images-assets.nasa.gov/image/art002e021278/art002e021278~orig.jpg`**
- **REAL dimensions: 5568x3712 px, 1,009,521 bytes, JPEG** (the `~large.jpg` variant is 1920x1280, 147,890 B).
- NASA's caption, verbatim from
  `https://images-api.nasa.gov/search?q=art002e021278`:

> art002e021278 (April 6, 2026) — Echoing the iconic Earthrise photo captured by the Apollo 8 astronauts in
> 1968, during the lunar flyby, the Artemis II crew captured a shot of Earthset as they passed behind the
> Moon's far side. It is one of many photos taken during the seven-hour lunar flyby by the Artemis II crew
> on the Orion spacecraft. Credit: NASA

- **Coverage: a single frame from lunar flyby — NOT a surface panorama and NOT a 360掳 product.**
- Note: `images-assets.nasa.gov` requires a browser User-Agent; `grab.mjs`/`dims.mjs` send one. (This
  workspace's earlier notes also record that the `http://` scheme works where `https://` 403s.)

**Nuance — real Artemis-*era* surface imagery DOES exist, from uncrewed CLPS landers**, e.g. IM-1 Odysseus
(Feb 2024) and Firefly Blue Ghost M1 (Mar 2025). But these are **not** Artemis missions, are not crewed,
and **no official stitched surface panorama was verified for them** (Firefly's site returned
`403 | "Just a moment..."` Cloudflare).

**NASA media terms, verbatim** (<https://www.nasa.gov/nasa-brand-center/images-and-media/>, verified 200,
315,461 bytes):

> NASA content — images, audio, video ... generally are not subject to copyright in the United States ...
> for educational or informational purposes

> NASA content used in a factual manner that does not imply endorsement may be used without needing explicit
> permission. NASA should be acknowledged as the source.

> If the NASA material is to be used for commercial purposes, including advertisements, it must not explicitly
> or implicitly convey NASA's endorsement of commercial goods or services.

Plus: third-party items are carve-outs, identifiable-persons rights apply, and NASA content may not be used
as NFTs. Note `https://www.nasa.gov/guidelines-for-use-of-nasa-media/` is now **404** — use the Brand
Center URL above.

**Redistribution risk: LOW for the NASA Artemis II photograph** (real photography, no copyright in the US,
attribution "NASA", no endorsement implied). **HIGH for any Artemis III "surface" image treated as real** — they are renders, and the Starship HLS items are SpaceX third-party material.

---

## 5. BLOCKED / NOT FOUND

### 5.1 Hard-blocked (403 — server refused)

```
403 | text/html | 5470 | HTML | https://www.isro.gov.in/
403 | text/html | 5683 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/   (browser UA)
403 | text/html | 5743 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/CopyrightPolicy.html
403 | text/html | 5710 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/terms-use
403 | text/html | 5746 bytes | magic=3c21444f43545950 | https://www.isro.gov.in/Copyright_Policy.html
403 | text/html | 5576 | HTML | https://www.isro.gov.in/Copyright_Policy.html
403 | text/html | 5570 | HTML | https://www.isro.gov.in/Website_Policy.html
403 | text/html | 5539 | HTML | https://www.isro.gov.in/website-policies
403 | text/html | 5533 | HTML | https://www.isro.gov.in/privacy-policy
403 | text/html | 5521 | HTML | https://www.isro.gov.in/index.html
403 | text/html | 5536 | HTML | http://www.isro.gov.in/TermsofUse.html
403 | text/html | 5515 | HTML | https://www.isro.gov.in/ISRO_EN/
403 | text/html | 5635 | HTML | https://www.isro.gov.in/Chandrayaan3.html
403 | text/html | 5648 | HTML | https://www.isro.gov.in/update/25-aug-2023/pragyan-rover-video
403 | text/html | 5642 | HTML | https://www.isro.gov.in/ISRO_HINDI/chandrayaan3_gallery.html
403 | text/html | 5588 | HTML | https://www.isro.gov.in/chandrayaan3_gallery.html
403 | text/html | 5536 | HTML | https://www.isro.gov.in/media_isro/pdf/
403 | text/html | 5738 | HTML | https://www.isro.gov.in/media_isro/image/index/Chandrayaan3/Chandrayaan3_Anaglyph.jpg
403 | text/html | 6015B | HTML | ua=Mozilla/5.0 (Windows | .../Chandrayaan3_Anaglyph.jpg  (multi-UA soft fetch)
403 | text/html | 118 | HTML | https://confit.atlas.jp/guide/event-img/jpgu2019/PPS08-14/public/pdf?type=in
403 | text/html | 530 | HTML | https://www.news18.com/india/chandrayaan-3-...-8565549.html
```

ISRO 403 body text (verbatim): `Just a moment... Enable JavaScript and cookies to continue`

**Consequence: every ISRO-hosted original image is undownloadable through this proxy. No ISRO direct file
URL can be verified, and none is asserted.**

### 5.2 Connection timeouts / DNS failures

```
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://web.archive.org/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://web.archive.org/web/2023/https://www.isro.gov.in/CopyrightPolicy.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://r.jina.ai/https://www.isro.gov.in/CopyrightPolicy.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://en.wikipedia.org/wiki/Chandrayaan-3
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://en.m.wikipedia.org/wiki/Chandrayaan-3
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.google.com/
ERR  | ENOTFOUND fetch failed | https://duckduckgo.com/html/?q=ISRO+copyright+policy
ERR  | ENOTFOUND fetch failed | https://search.marcia.cc/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://commons.wikimedia.org/wiki/Category:Chandrayaan-3
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://upload.wikimedia.org/wikipedia/commons/...
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.flickr.com/photos/isro/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.flickr.com/photos/tags/Chandrayaan-3
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.issdc.gov.in/copyright.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://pradan.issdc.gov.in/ch2/disclaimer.xhtml
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.vedas.sac.gov.in/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.vedas.sac.gov.in/en/terms-conditions.html
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.mosdac.gov.in/
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://bhuvan.nrsc.gov.in/
ERR  | EAI_AGAIN fetch failed | https://www.pib.gov.in/
ERR  | EAI_AGAIN fetch failed | https://pib.gov.in/PressReleasePage.aspx?PRID=1952053
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://aninews.in/news/national/general-news/chandrayaan-3-...
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.wionews.com/india-news/smile-please-chandrayaan-3s-...
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://www.timesnownews.com/india/chandrayaan-3-rover-pragyan-...
ERR  | ECONNRESET fetch failed | https://pbs.twimg.com/media/F5RjXjXaEAAbTKy?format=jpg&name=large
ERR  | ECONNRESET fetch failed | https://cdn.syndication.twimg.com/tweet-result?id=...&token=a
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://twitter.com/isro
ERR  | UND_ERR_CONNECT_TIMEOUT fetch failed | https://x.com/isro
```

Notable: **X/Twitter is unreachable** (`twitter.com`, `x.com`, `pbs.twimg.com`, `cdn.syndication.twimg.com`),
so ISRO's original social-media image files could not be retrieved at full resolution. `api.fxtwitter.com`
responded but returned `404 {"code":404,...}` for the guessed tweet id, and I will not invent a tweet id.

Also blocked: `www3.nhk.or.jp` (times out) — so **NHK's own reuse terms for Kaguya HDTV could not be
retrieved**.

### 5.3 NOT FOUND (searched, does not exist)

- **No genuine 360掳 Chandrayaan-3 surface panorama.** Only partial frames, a stereo anaglyph, and
  instrument plots.
- **No Chandrayaan-3 stitched surface mosaic** found in any release.
- **No genuine 360掳 SLIM panorama.** The MBC product is a 257-frame monochrome scan mosaic that was
  **terminated half-way**, with an unpublished field of view. No JAXA 3D/VR/panorama SLIM release exists
  (a false lead — an ISAS "dome experience" release — turned out to be **Hayabusa2**, not SLIM).
- **No landed Kaguya/SELENE panorama** — the mission was an orbiter with no lander or rover.
- **No ESA lunar surface panorama** — ESA has never soft-landed; Argonaut is ESA's *first* lunar lander.
- **No real Artemis-era surface panorama** — no crewed Artemis landing has occurred, and Artemis III will
  not land. NASA API checks: `Artemis panorama` 鈫?12 hits all Mars; `lunar surface panorama` 鈫?24 hits all
  Apollo-era 1972; `Moon surface panorama 2026` 鈫?0; `Artemis III landing region` 鈫?0.
- **No official stitched surface panorama** verified for the uncrewed CLPS landers (IM-1, Blue Ghost M1).

### 5.4 Unresolved at hand-off

- Verbatim text of `isro.gov.in/Copyright_Policy.html`, `/TermsofUse.html`, `/Website_Policy.html` (403).
  Only the opening fragment ("Material featured on this site belongs to the DOS—) was recoverable.
- Verbatim text of `issdc.gov.in/copyright.html` and the PRADAN/ISDA disclaimers (timeout).
- Verbatim text of `vedas.sac.gov.in` copyright/terms (timeout).
- Whether NDSAP / Government Open Data License — India covers ISRO imagery. **Do not assume it does.**
- Whether the official ISRO Flickr account (`flickr.com/photos/192271236@N03/`) declares a CC licence or
  "All Rights Reserved" (Flickr blocked).
- The DARTS "Kaguya HDTV Data Publication System" terms page now renders an empty SPA shell, so its text
  was never read (and is not paraphrased anywhere in this report). NHK's terms were readable via
  `www.nhk.or.jp/nijishiyou-qa/index_4.html`.
- ISRO original pixel dimensions for the 5 Sep 2023 anaglyph and the 30 Aug 2023 NavCam lander image.
- **Artemis III restructure rests partly on secondary reporting**: the primary NASA PDF
  `https://www.nasa.gov/wp-content/uploads/2026/03/going-back-to-the-moon.pdf` could NOT be downloaded
  (all `www.nasa.gov` GETs returned **429** this session; the saved file was a 564-byte 429 page, not a
  PDF). `images-api.nasa.gov` and `svs.gsfc.nasa.gov/api` were **not** throttled and are reliable.
- The 2 kB byte-size discrepancy noted for `20080411_kaguya_01l.jpg` (section 3.2).
- ESA's multimedia search is JS-only, so ESA's archive was not enumerated exhaustively; the ESA negative
  rests on ESA first-party statements plus manual inspection.

---

## 6. Candidate summary table

| # | Mission | Landing site / coords | Coverage | Type | Direct URL | REAL size | Licence | Attrib. | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SLIM | E of Shioli crater, 13.3掳S 25.2掳E | Partial, **incomplete** scan; FOV unpublished; **not 360掳** | Stitched mosaic of 257 mono frames (largest) | `https://www.isas.jaxa.jp/topics/files/20240201_02.png` | **1344x1008 px, 660,627 B** (PNG IHDR) | JAXA ToU: free for press/scientific/educational/private; **commercial needs prior permission**; **no modification** | JAXA, Ritsumeikan University, The University of Aizu | **High** (derivative) |
| 1b | SLIM | as above | as above | Best **CLEAN** mosaic (no labels) | `https://www.isas.jaxa.jp/topics/files/20240201_01b.png` | **1000x842 px, 402,546 B** (PNG IHDR) | as above | as above | **High** (derivative) |
| 1c | SLIM | as above | as above | Annotated mosaic, **English** rock names | `https://www.isas.jaxa.jp/en/topics/files/20240201_2_en.png` | **1160x875 px, 542,782 B** (PNG IHDR) | as above | as above | **High** (derivative) |
| 2 | SLIM | as above | Single narrow frame; **not 360掳** | Raw CAM-PX navcam frame (rotated) | `https://global.jaxa.jp/press/2024/01/images/20240125-1_e_01.jpg` | **545x542 px, 50,679 B** (SOF0) | JAXA ToU as above | JAXA | Med-High |
| 3 | SLIM (LEV-2/SORA-Q) | as above | Single frame; **not 360掳** | Raw rover frame | `https://global.jaxa.jp/press/2024/01/images/20240125-4_e_01.jpg` | **640x480 px, 108,020 B** (SOF0) | JAXA ToU as above | ©JAXA/TOMY/Sony/Doshisha (burned in) | Med-High |
| 4 | SLIM (MBC bands) | as above | Spectral analysis figures | Figures | `https://global.jaxa.jp/press/2024/01/images/20240125-3_e_01.png` / `_02.png` | **489x481 px, 89,946 B** / **483x477 px, 274,207 B** | JAXA ToU | JAXA, Ritsumeikan, Univ. of Aizu | Med-High |
| 5 | Kaguya HDTV | **ORBITAL** ~100 km | Orbital horizon/Earth-rise; **NOT a landed panorama** | Single frame | `https://data.darts.isas.jaxa.jp/pub/pds3/sln-l_e-hdtv-2-edr-v1.0/browse/large/200804/sh_20080406T095510_wi1/sh_20080406T095510_wi1_0000_bl.jpg` | **1920x1200 px, 703,590 B** (SOF0) | **JAXA/NHK joint copyright; scientific + educational only**; other uses require inquiry | JAXA/NHK | **High** |
| 6 | Kaguya HDTV | **ORBITAL** | Vertical filmstrip of movie first/last frames; **not a panorama** | Filmstrip composite | `.../browse/large/200711/sh_20071107T030713_tm4_fp_l.jpg` | **1920x7722 px, 1,256,383 B** (SOF0) | as above | JAXA/NHK | **High** |
| 7 | Kaguya HDTV (press) | **ORBITAL** | Earth-rise, single frame | Single frame | `https://global.jaxa.jp/press/2008/04/img/20080411_kaguya_01l.jpg` | **1920x1080 px, ~1,155,207 B** (SOF0) | as above | JAXA/NHK | **High** |
| 8 | Kaguya HDTV (press) | **ORBITAL** | Final descent still, **20.7 km** — lowest published | Single frame | `https://global.jaxa.jp/press/2009/06/img/20090619_kaguya_hdtv_L4.jpg` | **1920x1080 px, 441,073 B** (SOF2) | as above | JAXA/NHK | **High** |
| 9 | **Artemis II** (real photography) | **Orion spacecraft, lunar flyby — NOT surface** | Single frame; **not a surface panorama** | Raw frame, Earthset behind far side | `https://images-assets.nasa.gov/image/art002e021278/art002e021278~orig.jpg` | **5568x3712 px, 1,009,521 B** (JPEG) | NASA content generally not copyrighted in the US; acknowledge "NASA"; no implied endorsement; commercial use must not imply endorsement | NASA | **Low** |
| ✗ | SLIM — **REJECTED** | as above | **Diagram, not a surface photo** | Annotated landing-accuracy map (ISRO Chandrayaan-2 base) | `https://global.jaxa.jp/press/2024/01/images/20240125-1_e_02.png` | 2805x1842 px, 3,221,710 B | n/a — **do not use** | Chandrayaan-2:ISRO / SLIM:JAXA | n/a |
| ✗ | SLIM — **REJECTED** | as above | **Not a surface image** | Team photograph | `https://www.isas.jaxa.jp/topics/files/20240201_4.jpg` | 1376x921 px, 1,005,913 B | n/a — **do not use** | JAXA | n/a |
| ✗ | ESA — **REJECTED as real** | n/a (Earth/concept) | **CGI render, not photography** | Artist's impression | (esa.int multimedia; CC BY-SA 3.0 IGO item) | 1921x1080 px, 441,640 B | ESA ToU: non-commercial w/ `©ESA`; some items CC BY-SA 3.0 IGO | ESA–ATG | Med (must label as render) |
| ✗ | Artemis III — **REJECTED as real** | candidate regions (no landing) | **Artist's concept**, third-party | Render | NASA library, `Photo courtesy SpaceX` | 1920x960 px, 126,523 B | third-party (SpaceX) carve-out | SpaceX/NASA | **High** if passed off as real |
| —| Chandrayaan-3 | 69.37掳S 32.35掳E (landing site, published) | Partial; **no 360掳 panorama exists** | Anaglyph from NavCam stereo pair | **NO ISRO URL VERIFIED — domain 403.** Only a news rehost at 1200x667 px, 79,294 B (Indian Express), licence unsafe | n/a for original | ISRO: Copyright Policy (free w/ acknowledgement) **vs** Terms of Use (prior permission required) | ISRO | **Medium-High** |

Note: the Chandrayaan-3 landing-site coordinates above are the widely published mission coordinates;
they were **not** re-verified from an ISRO page in this pass because the domain is blocked, and should be
re-checked before publication.

---

## 7. Raw evidence files in this workspace

- `.agents/research/ie-anaglyph.jpg` — the 1200x667 Chandrayaan-3 anaglyph rehost (79,294 B)
- `.agents/research/ie-text.txt` — Indian Express anaglyph article text (source of the ISRO caption quotes)
- `.agents/research/jaxa-policy.txt` — full JAXA Site Policy text (source of all JAXA licence quotes)
- `.agents/research/sac-terms.txt` — SAC Terms of Use text
- `.agents/research/slim1.txt`, `.agents/research/slim-press.txt` — SLIM press release link/image dumps
- `.agents/research/tools/dims.mjs` — downloads a URL and parses real JPEG SOF / PNG IHDR dimensions
- `.agents/research/tools/body2.mjs` — extracts main body text from a page
- `.agents/research/tools/soft.mjs` — multi-User-Agent lenient fetch (used to prove ISRO blocks all UAs)
- `.agents/research/downloads/` — files saved by `dims.mjs` during verification

## 8. Companion delegated reports (same workspace)

Four deeper dossiers were produced in parallel by delegated sub-agents. This file is the integrating
summary; these hold the full detail and should be consulted for per-item evidence:

| File | Size | Covers |
| --- | --- | --- |
| `.agents/research/partial-slim.md` | 39,016 B | Full SLIM audit: 16 downloaded images, 2 PDFs text-searched, no-modification analysis |
| `.agents/research/partial-kaguya.md` | 49,703 B | Full Kaguya/SELENE audit: HDTV/Terrain Camera, JAXA–K licensing |
| `.agents/research/partial-esa-artemis.md` | 62,111 B | Full ESA + Artemis audit incl. NASA API absence proofs |
| `.agents/research/partial-isro-licence.md` | (delegated) | ISRO licence-text extraction |

Downloaded evidence samples also exist under `.agents/research/samples/slim/` (incl. both official ISAS
press PDFs) and `.agents/research/samples/kaguya_*.jpg`.

## 9. Bottom line for the parent report

**There is no downloadable genuine 360掳 lunar surface panorama from any of ISRO Chandrayaan-3, JAXA SLIM,
JAXA Kaguya, or ESA.** Each mission fails for a different reason:

- **Chandrayaan-3** — never produced a panorama, and its entire hosting domain is WAF-blocked.
- **SLIM** — produced a *partial, half-terminated* scan mosaic, and JAXA's terms forbid the cropping and
  ratio changes that stitching a panorama requires.
- **Kaguya** — was an orbiter; it has no landed imagery at all, and its HDTV frames are JAXA/NHK-restricted.
- **ESA** — has never landed; its panorama-shaped lunar imagery is CGI.
- **Artemis** — as of 2026-09-12 no crewed landing has occurred, and Artemis III will not land.

**The best real, high-resolution, low-risk lunar image found in this whole pass is not a panorama at all:**
the **Artemis II Earthset photograph**, `art002e021278`, **5568x3712 px, 1,009,521 bytes**, real NASA
photography from the Orion spacecraft, releasable with a "NASA" credit.

**If a genuine landed lunar surface panorama is required, the only mission that actually delivers one is
Apollo** — already documented in this workspace in `lunar-panorama-sources.md` and
`apollo-surface-panoramas.json` (up to 30000x3600, public domain, sky-masked, though still partial sweeps
rather than true 360掳).
