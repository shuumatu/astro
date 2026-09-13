# Verification: NASA Image Library Apollo panorama candidates

**Scope.** 29 library assets were checked one by one - the 13 seed ids, every additional member of the same
release family found by searching the NASA Image and Video Library API, plus the Apollo 15/16 non-JSC panorama
sheets and the two Apollo 17 "Panorama of the moon from Lunar Module" assets that turn out **not** to be panoramas.

**What was actually done for each asset** (nothing below is inferred from a filename or a search hit):

1. `https://images-api.nasa.gov/asset/<id>` -> the file list, and `https://images-assets.nasa.gov/image/<id>/metadata.json`
   -> title, description, date, centre, keywords. Titles/descriptions in this file are quoted **verbatim** from those responses.
2. The `~orig.jpg` was downloaded in full (every asset had one; no fallback to `~large.jpg` was needed) and its true
   pixel dimensions read from the JPEG SOF marker - not from any host's claim.
3. A contact sheet was generated (whole file squeezed, left/right end strips at native scale, and K equal panels) and
   **looked at with `read_image`**. Every asset below was inspected visually, including crops for the very wide ones.
4. Mechanical column analysis: near-black pixel/column fractions, longest run of near-black columns (a black gutter
   between two pasted panoramas would show up here), top/bottom black bands, and an 8-panel signature.
5. `.agents/wrap-test.py` on every file, with its calibrated reference points, and its side-by-side output inspected.
   The resulting `wrapRatio` is reported for every asset and **disagreements between the ratio and my eyes are stated explicitly**.

**Network.** All requests went through the local proxy with `HTTP_PROXY`/`HTTPS_PROXY` **and `NODE_USE_ENV_PROXY=1`**.
Every asset was then re-downloaded over `https://` through the proxy and compared byte-for-byte (size + dimensions) with
the first pass: **0 mismatches across all 29 files**, and `metadata.json` returned HTTP 200 for all 29 over https.
The `downloadUrl` fields below are therefore `https://` URLs.

## Headline findings

* **The JSC "Panorama view of Apollo NN Lunar surface photos" family really are single continuous stitched panoramas** -
  one row, no black gutters between sub-panoramas, no repeated frames, no visible vertical seam lines. The same is true
  of `jsc2007e045375/376/377` ("Panoramas of Apollo sites").
* **Only two assets are demonstrably a complete 360 deg**: `S72-35970` and `S72-35971`, and only because NASA's own
  descriptions say "A 360-degree field of view". Both are TV-derived, annotated graphic sheets, not photographs.
* **One stitched panorama is a genuine full-rotation candidate**: `jsc2004e20304` (Apollo 17 Station 5). Its
  `wrapRatio` is 0.410, matching the calibration point for "the ends show the same object", and the side-by-side
  image shows the same hill silhouette and boulder field at both ends. Moderate confidence, not proven.
* **For every other stitched panorama the arc could not be established**, and I say so rather than guessing. The
  prescribed "N x 50-60 deg" rule cannot be applied to these files: 8 frames would be 400-480 deg and 29 frames
  1450-1740 deg, both impossible for a single rotation, because adjacent Apollo pan frames overlap by roughly half.
* **Four assets are not surface panoramas at all** and should be kept out of, or labelled differently in, a
  landing-site panorama browser: `jsc2012e052597` (view out of the LM window *in lunar orbit*),
  `S72-54413` (a map sheet with a computer-generated contour panorama), and `S72-35970`/`S72-35971`
  (annotated TV-derived graphic sheets with baked-in direction labels).
* **Two assets are single frames mislabelled as panoramas**: `AS17-145-22196` and `AS17-145-22216`
  ("Apollo 17, Panorama of the moon from Lunar Module"), both 1:1 square Hasselblad frames.
* **One title is flatly wrong**: `jsc2011e118358` is titled "Apollo 15 lunar panorama" but its description and its
  source frames (AS12-46-6777..6780) are **Apollo 12**, Surveyor Crater, Alan Bean.
* **The Apollo 15 "Rover RIP pan" 360 is incomplete in this library**: parts 1 and 2 are present
  (`S71-43942`, `S71-43943`) but part 3, `S71-43940`, referenced by both descriptions, is **not** in the library.
  Neither present part is a seamless stitch - both are hand-assembled print paste-ups with visible print edges.
* **wrapRatio screen: what it does and does not do.** It flagged genuine differences well (jsc2007e045375 = 2.339,
  jsc2004e52779 = 2.173, jsc2004e52777 = 1.485) and it agreed with my eyes on the one closing candidate
  (jsc2004e20304 = 0.410). It produced **four false "related ends" signals** that my eyes overruled
  (jsc2007e045376 = 0.519, jsc2007e045377 = 0.470, jsc2004e52776 = 0.565, jsc2014e021523 = 0.382) - in all four the
  ends are visibly different and the low score comes from featureless bright regolith under an equally black sky. It
  also produced one **false "wrap" signal that is pure artefact**: `S71-43943` = 0.001 because both ends of that
  paste-up are black margin. It is a screen, exactly as advertised.

## Table

`estimated FOV` is only populated where there is real evidence (NASA's stated compass coverage, a stated 360, or a
single 70 mm frame); elsewhere it is "not established". `full 360?` = YES only on NASA's own statement or on the
end-match evidence described above.

| asset id | mission/site | station (if stated) | true WxH | aspect | bytes | continuous stitch or mosaic | estimated FOV | full 360? | verified how |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `jsc2008e040725` | Apollo 11 - Tranquility Base | - | 15634x4460 | 3.51:1 | 8.75 MB | continuous stitch | not established | no (partial) | wrapRatio 1.868; metadata+asset API |
| `jsc2007e045375` | Apollo 11 - Tranquility Base (plus-Z pan) | - | 30000x2309 | 12.99:1 | 14.35 MB | continuous stitch | not established | no (partial) | wrapRatio 2.339; metadata+asset API |
| `jsc2007e045376` | Apollo 12 - Surveyor Crater | view from NE of the LM toward Surveyor Crater | 25481x3000 | 8.49:1 | 10.90 MB | continuous stitch | not established | no (partial) | wrapRatio 0.519; metadata+asset API |
| `jsc2007e045377` | Apollo 14 - Fra Mauro | - | 30000x3600 | 8.33:1 | 9.25 MB | continuous stitch | not established | no (partial) | wrapRatio 0.47; metadata+asset API |
| `jsc2011e118358` | Apollo 12 - Surveyor Crater rim (title wrongly says Apollo 15) | just inside the rim of Surveyor Crater, EVA 1 | 10000x3276 | 3.05:1 | 3.03 MB | continuous stitch | not established | no (partial) | wrapRatio 1.886; metadata+asset API |
| `jsc2011e118359` | Apollo 15 - Hadley Rille, S of Station 2 | south of Station 2, above Hadley Rille | 10000x3465 | 2.89:1 | 3.45 MB | continuous stitch | not established | no (not shown) | wrapRatio 1.106; metadata+asset API |
| `jsc2011e118360` | Apollo 15 - Station 8 / Mons Hadley | Station 8 / Mons Hadley | 10000x3893 | 2.57:1 | 4.14 MB | continuous stitch | not established | no (partial) | wrapRatio 1.992; metadata+asset API |
| `jsc2011e118361` | Apollo 15 - EVA 2 traverse | EVA 2 - Irwin making a trench with the scoop | 10000x1030 | 9.71:1 | 1.62 MB | continuous stitch | not established | no (not shown) | wrapRatio 1.338; metadata+asset API |
| `jsc2011e118362` | Apollo 16 - Station 10, Descartes | Station 10 / Sample 381 rock | 10000x956 | 10.46:1 | 1.47 MB | continuous stitch | not established | no (not shown) | wrapRatio 1.115; metadata+asset API |
| `jsc2011e118363` | Apollo 16 - EVA 1 LRV/ALSEP site | EVA 1, LRV / ALSEP deployment site | 10000x3379 | 2.96:1 | 3.47 MB | continuous stitch | not established | no (partial) | wrapRatio 1.441; metadata+asset API |
| `jsc2012e052597` | Apollo 16 - LUNAR ORBIT (LM window), not a surface pan | LM window, in lunar orbit - NOT a surface station pan | 18326x8537 | 2.15:1 | 9.45 MB | continuous stitch | not established | no (not shown) | wrapRatio 0.996; metadata+asset API |
| `jsc2012e052598` | Apollo 16 - Station 1, Flag Crater rim | Station 1 (Flag Crater rim) - Duke centred | 30000x3112 | 9.64:1 | 9.62 MB | continuous stitch | not established | no (partial) | wrapRatio 1.537; metadata+asset API |
| `jsc2012e052599` | Apollo 16 - Station 1, Flag Crater rim | Station 1 (Flag Crater rim) - Duke centred and walking right | 30000x3112 | 9.64:1 | 9.56 MB | continuous stitch | not established | no (partial) | wrapRatio 1.536; metadata+asset API |
| `jsc2014e021523` | Apollo 16 - EVA 2 (mag 117) | EVA 2 (mag 117) | 20000x2164 | 9.24:1 | 3.95 MB | continuous stitch | not established | no (partial) | wrapRatio 0.382; metadata+asset API |
| `jsc2004e52772` | Apollo 17 - ALSEP station (EVA 1) | ALSEP station, EVA 1 | 29524x3000 | 9.84:1 | 10.32 MB | continuous stitch | not established | no (partial) | wrapRatio 1.28; metadata+asset API |
| `jsc2004e52775` | Apollo 17 - Station 7 (EVA 3) | Station 7, EVA 3 | 26968x5001 | 5.39:1 | 7.49 MB | continuous stitch | not established | no (partial) | wrapRatio 1.567; metadata+asset API |
| `jsc2004e52776` | Apollo 17 - Station 1 (EVA 1) | Station 1, EVA 1 | 21067x3575 | 5.89:1 | 8.38 MB | continuous stitch | not established | no (partial) | wrapRatio 0.565; metadata+asset API |
| `jsc2004e52777` | Apollo 17 - Station 2 (EVA 2) | Station 2, EVA 2 | 28316x3000 | 9.44:1 | 17.75 MB | continuous stitch | not established | no (partial) | wrapRatio 1.485; metadata+asset API |
| `jsc2004e52779` | Apollo 17 - Station 6 (EVA 3) | Station 6, EVA 3 | 9495x1200 | 7.91:1 | 1.45 MB | continuous stitch | not established | no (partial) | wrapRatio 2.173; metadata+asset API |
| `jsc2004e20304` | Apollo 17 - Station 5 (EVA 2) | Station 5, EVA 2 | 9000x1066 | 8.44:1 | 1.84 MB | continuous stitch | not established | YES | wrapRatio 0.41; metadata+asset API |
| `S71-43941` | Apollo 15 - Hadley-Apennine (LM window mosaic) | LM window view (one of the three parts of the 360) | 3252x1710 | 1.90:1 | 0.71 MB | mosaic (layout of separate prints/sections) | 135 deg | no (partial) | wrapRatio 0.118; metadata+asset API |
| `S71-43942` | Apollo 15 - Hadley-Apennine (Rover RIP pan 1 of 3) | Rover "RIP" pan part 1 (astronaut 325 ft east of the LM) | 4689x2256 | 2.08:1 | 1.41 MB | mosaic (layout of separate prints/sections) | 157 deg | no (partial) | wrapRatio 1.477; metadata+asset API |
| `S71-43943` | Apollo 15 - Hadley-Apennine (Rover RIP pan 2 of 3) | Rover "RIP" pan part 2 | 6132x2969 | 2.07:1 | 2.00 MB | mosaic (layout of separate prints/sections) | 158 deg | no (partial) | wrapRatio 0.001; metadata+asset API |
| `S72-35970` | Apollo 16 - Flag Crater rim (annotated TV sheet) | Flag Crater rim, EVA I, Station 1 | 4372x1686 | 2.59:1 | 0.80 MB | continuous stitch | 360 deg | YES | wrapRatio 0.797; metadata+asset API |
| `S72-35971` | Apollo 16 - North Ray Crater rim (annotated TV sheet) | North Ray Crater rim, EVA III, Stations 11 & 12 | 4133x1824 | 2.27:1 | 0.88 MB | continuous stitch | 360 deg | YES | wrapRatio 1.062; metadata+asset API |
| `S72-54413` | Apollo 17 - Taurus-Littrow (map sheet, not a photo panorama) | nominal LM landing site (map sheet) | 2893x3847 | 0.75:1 | 1.42 MB | mosaic (layout of separate prints/sections) | not established | no (not shown) | wrapRatio 1.436; metadata+asset API |
| `AS17-145-22196` | Apollo 17 - LM window (single frame) | LM window view late in the mission | 3000x3009 | 1.00:1 | 2.07 MB | single raw frame | 50 deg | no (not shown) | wrapRatio 1.296; metadata+asset API |
| `AS17-145-22216` | Apollo 17 - LM window (single frame) | LM window view (US flag, north Massif) | 3023x3000 | 1.01:1 | 1.97 MB | single raw frame | 50 deg | no (not shown) | wrapRatio 2.108; metadata+asset API |
| `as11-40-5881` | Apollo 11 - Tranquility Base (single frame) | first frame of Aldrin's plus-Z pan | 4000x4000 | 1.00:1 | 9.48 MB | single raw frame | 50 deg | no (not shown) | wrapRatio 2.966; metadata+asset API |

## Scope notes and what I could not establish

* **True arc of the JSC stitched panoramas.** NASA's descriptions give the exact source frame range for each file
  (quoted verbatim below) but never the angular coverage. I tried three ways to measure it and none of them survived
  scrutiny: (a) the prescribed N x 50-60 deg rule overshoots 360 deg for every multi-frame file in the set, because
  Apollo pan frames overlap heavily; (b) autocorrelation of the column luminance profile found no reliable frame pitch;
  (c) registering a raw source frame against the canvas left edge worked numerically once (as11-40-5881 vs
  jsc2007e045375, NCC 0.779, implying ~415 deg) but failed outright on the second attempt (as11-40-5954 vs
  jsc2008e040725, NCC 0.437, with side-by-side crops that were plainly different scenery), so I do not trust either
  result. Only two raw frames referenced by these panoramas are present in the library at all (as11-40-5881 and
  as11-40-5954); every other source frame I probed returned HTTP 403, i.e. it is not hosted.
* **Reseau crosses.** The crosses are visible in most files, which in principle calibrates the frame pitch, but my
  cross detector produced too many false positives on rocky terrain to be trustworthy, so no FOV is derived from them.
* **`isFull360: false` means "not established as a complete 360", not "proven to be a partial arc"** - except where the
  end strips are visibly different views, which is stated per asset.
* Two files are strongly **downscaled** relative to their siblings (`jsc2011e118361` 10000x1030, ~526 px per source
  frame; `jsc2011e118362` 10000x956, ~556 px per source frame; `jsc2004e52779` 9495x1200, ~327 px per frame).
  They are usable as contextual strips but not as detailed browsable panoramas.
* The metadata title field is **truncated at about 220 characters** by the API for several assets (they end mid-word,
  e.g. "...starting with frame A"). The full sentence is present in the description field, which is what I quote.
* Working artefacts for this verification (downloads, contact sheets, end strips, wrap-test outputs, raw JSON) are in
  `.agents/research/tmp/verify/`.

## Licence and attribution

NASA's media-usage position, as quoted above: **NASA content - images, audio, video, and media files - are
generally not subject to copyright in the United States**, and may be used for educational or informational purposes.
Apollo photography is a US Government work; the JSC-assembled panorama products carry no separate photographer credit.
The live NASA Media Usage Guidelines page (https://www.nasa.gov/nasa-brand-center/images-and-media/) returned
**HTTP 429** from this environment during verification, so that wording should be re-confirmed against the live page
before publication. No NASA insignia, logotype or endorsement is implied by any of the attribution strings below.

A demo should display, per asset:

```
NASA/JSC - "<title>" - JSC asset <nasaId>[, source frames <range>]
via NASA Image and Video Library - https://images.nasa.gov/details/<nasaId>
NASA imagery is generally not subject to copyright in the United States.
```

The exact strings are in `credit` in `verify-apollo.json`.

## Per-asset record

### `jsc2008e040725` - Apollo 11 - Tranquility Base - crater Armstrong noted during descent

* **NASA title (verbatim):** "jsc2008e040725 - Panorama view of Apollo 11 Lunar surface photos taken by Astronaut Neil Armstrong at Tranquility Base of a crater Armstrong noted during the Lunar Module descent. The panoramas were built by combining Apollo 11 images starting with frame A"
* **NASA description (verbatim):** "jsc2008e040725 - Panorama view of Apollo 11 Lunar surface photos taken by Astronaut Neil Armstrong at Tranquility Base of a crater Armstrong noted during the Lunar Module descent. The panoramas were built by combining Apollo 11 images starting with frame AS11-40-5954 through end frame AS11-40-5961. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 15634x4460 jpeg, 9172122 bytes (8.75 MB),
  aspect 3.5054:1, 69.7 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2008e040725/jsc2008e040725~orig.jpg` - source page: https://images.nasa.gov/details/jsc2008e040725
* **Source frames:** AS11-40-5954 .. AS11-40-5961 (8 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.868 (ratio vs visual judgement: **agree**)
* **What I saw:** Single continuous stitched row of Hasselblad frames; sky painted black down to the horizon; reseau cross marks survive. Left end: Armstrong's shadow with the LM small in the distance. Middle/right: smooth regolith with a crater and a large elliptical lens-flare artefact. No vertical seams, no gutters, no repeated frames.
* **Wrap / closure:** Ends unrelated: the right end is a dark flared region, the left end holds the LM.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded and JPEG-SOF parsed; contact sheet + end strips viewed with read_image; .agents/wrap-test.py; column black-run analysis (0 black gutters).
* **Uncertainty:** Whether the 8-frame sweep closed a circle cannot be shown from the file - the two ends are different views. NASA gives the frame range but no angular coverage.


### `jsc2007e045375` - Apollo 11 - Tranquility Base, ~30-40 ft west of the plus-Z footpad (Aldrin's plus-Z pan)

* **NASA title (verbatim):** "Panoramas of Apollo sites"
* **NASA description (verbatim):** "Panoramas of Apollo sites are required to familiarize various Constellation projects with the actual nature of the lunar surface. This image is the first of a multi-framed panorama photographed from a point some 30 or 40 feet west of the plus-Z (west) footpad of the Lunar Module \"Eagle.\" The view is looking toward the southwest showing part of the horizon crater rim that was pointed out as being visible from the Eagle's window. Image taken at Tranquility Base. View was created using Apollo 11 images - mag 40 frames 5881 thru 5891."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO 11 FLIGHT","APOLLO PROJECT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","panorama","EVA"]
* **File:** 30000x2309 jpeg, 15047263 bytes (14.35 MB),
  aspect 12.9926:1, 69.3 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2007e045375/jsc2007e045375~orig.jpg` - source page: https://images.nasa.gov/details/jsc2007e045375
* **Source frames:** AS11-40-5881 .. AS11-40-5891 (11 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 2.339 (ratio vs visual judgement: **agree**)
* **What I saw:** Single continuous stitched row of 11 frames; sky blacked to the horizon; reseau crosses survive. Left end: smooth crater-rim slope. Middle: the US flag on its pole beside a white LM leg with a black foreground shadow. Quarter point: a long thin shadow streak. Right end: a smooth slope with a crater rim. No gutters or seam lines.
* **Wrap / closure:** Ends show different terrain; the canvas does not visibly close. Ratio 2.339 is the highest of the set.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (30000x2309); contact sheet + end strips viewed; wrap-test.py; attempted raw-frame registration; Apollo Lunar Surface Journal cross-check.
* **Uncertainty:** I tried to measure the true arc by registering the raw first frame as11-40-5881 (the one raw frame of this pan present in the library) against the canvas left edge: best NCC 0.779 at canvas scale 0.934, implying ~27% overlap, ~36.5 deg per frame and an arc of ~415 deg. I do NOT trust it - the same method failed outright on as11-40-5954 vs jsc2008e040725 (NCC 0.437, and the crops were plainly different scenery), and it assumes 50 deg frames with uniform steps. The ALSJ narrative (pan starts on the southern wall of the double crater, sweeps north and ends back on the younger component) is consistent with a closed rotation but does not prove one. FOV left null.


### `jsc2007e045376` - Apollo 12 - Apollo 12 landing site, Surveyor Crater

* **NASA title (verbatim):** "Panoramas of Apollo sites"
* **NASA description (verbatim):** "Panoramas of Apollo sites were created to familiarize various Constellation projects with the actual nature of the lunar surface. Image is a view taken from northeast of the Lunar module (LM) looking west at panel and Flag, then to southwest at LM and counterclockwise to south and west looking into Surveyor Crater. View was created using Apollo 12 images - mag 47 frames 6982 thru 7006."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO PROJECT","APOLLO 12 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","panorama"]
* **File:** 25481x3000 jpeg, 11428560 bytes (10.90 MB),
  aspect 8.4937:1, 76.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2007e045376/jsc2007e045376~orig.jpg` - source page: https://images.nasa.gov/details/jsc2007e045376
* **Source frames:** AS12-47-6982 .. AS12-47-7006 (25 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.519 (ratio vs visual judgement: **disagree**)
* **What I saw:** Single continuous stitched row. Left end: flat regolith with a small white pole-like object and craterlets. Middle: the LM Intrepid with Sun glare, then Surveyor Crater with the Sun disc and flare rings. Right end: the US flag on its pole, the photographer's shadow and the parasol-shaped ALSEP antenna. No gutters or repeats.
* **Wrap / closure:** Ends are plainly different views (pole object vs flag).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (25481x3000); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Ratio 0.519 sits between the tool's two calibration points and would read as "ends related", but the side-by-side crops show clearly different scenery - the low score comes from both ends being flat bright regolith under an equally black sky. VISUAL JUDGEMENT OVERRIDES THE RATIO: partial sweep.


### `jsc2007e045377` - Apollo 14 - Apollo 14 (Fra Mauro) - view toward the western horizon

* **NASA title (verbatim):** "Panoramas of Apollo sites"
* **NASA description (verbatim):** "Panoramas of Apollo sites were created to familiarize various Constellation projects with the actual nature of the lunar surface. View of the Lunar Surface towards the western Horizon. Image was created using Apollo 14 images - mag 66 frames 9271 thru 9293."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO 14 FLIGHT","APOLLO PROJECT","APOLLO 12 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET"]
* **File:** 30000x3600 jpeg, 9696109 bytes (9.25 MB),
  aspect 8.3333:1, 108 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2007e045377/jsc2007e045377~orig.jpg` - source page: https://images.nasa.gov/details/jsc2007e045377
* **Source frames:** AS14-66-9271 .. AS14-66-9293 (23 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.47 (ratio vs visual judgement: **disagree**)
* **What I saw:** Single continuous stitched row. Left end: the photographer's dark shadow on bright regolith. Middle: the LM Antares with the flag, the ALSEP area, and a very large Sun disc with flare rings. Right end: a plain cratered slope with the horizon under a black sky. No gutters or repeats.
* **Wrap / closure:** Ends differ (shadow figure vs plain cratered slope).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (30000x3600); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Ratio 0.470 looks like a related-end pair but the crops are visibly different views; the score is driven by uniformly bright regolith. Partial sweep.


### `jsc2011e118358` - Apollo 12 - Surveyor Crater, Apollo 12

* **NASA title (verbatim):** "Apollo 15 lunar panorama"
* **NASA description (verbatim):** "jsc2011e118358 - Panorama view of Apollo 12 lunar surface photos with lunar module pilot Alan L. Bean and the TV taken from just inside the rim of Surveyor Crater on the first moonwalk of the mission. The panoramas were built by combining Apollo 12 images starting with frame AS12-46-6777 thru end frame AS12-46-6780. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x3276 jpeg, 3172177 bytes (3.03 MB),
  aspect 3.0525:1, 32.8 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118358/jsc2011e118358~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118358
* **Source frames:** AS12-46-6777 .. AS12-46-6780 (4 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.886 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 4 frames, colour. The LM (gold-kapton descent stage) at the left with an astronaut in a white suit walking away to the right, a flag marker, a white instrument on a pole, bootprints in the foreground, black sky above the horizon. No gutters or repeats.
* **Wrap / closure:** Ends differ.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x3276); contact sheet viewed; wrap-test.py.
* **Uncertainty:** The library TITLE says "Apollo 15 lunar panorama" but the DESCRIPTION names Apollo 12, Alan Bean, the TV and Surveyor Crater, and the frames AS12-46-6777..6780 (mag 46 = Apollo 12 EVA 1). I follow the description and the frame numbers: Apollo 12. NASA metadata error worth flagging. With 4 frames the arc is well under 360 deg.


### `jsc2011e118359` - Apollo 15 - Hadley Rille / Hadley Delta, Apollo 15

* **NASA title (verbatim):** "Apollo 15 lunar panorama"
* **NASA description (verbatim):** "jsc2011e118359 - Panorama view of Apollo 15 lunar surface photos south of Station 2 taken by lunar module pilot James B. Irwin. Astronaut David R. Scott, mission commander, performs a task at the Lunar Roving Vehicle parked on the edge of Hadley Rille (Rima Hadley) during the first moonwalk of the mission. The panoramas were built by combining Apollo 15 images starting with frame AS15-85-11448 thru end frame AS15-85-11453. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x3465 jpeg, 3613987 bytes (3.45 MB),
  aspect 2.8860:1, 34.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118359/jsc2011e118359~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118359
* **Source frames:** AS15-85-11448 .. AS15-85-11453 (6 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.106 (ratio vs visual judgement: **inconclusive**)
* **What I saw:** Continuous stitch of 6 frames, colour, wide mountain landscape: Hadley Delta / the Apennine front at the left, a dark rille (Hadley Rille) running through the middle, a bright slope on the right, with the LRV and an astronaut small in the centre. Reseau crosses throughout. No gutters or repeats.
* **Wrap / closure:** Ends are both feature-poor streaky slopes; no landmark match, so no evidence of closure.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x3465); contact sheet viewed; wrap-test.py (1.106).
* **Uncertainty:** Ratio 1.106 is above the "related ends" calibration but below the partial-sweep reference, and the ends are feature-poor, so the screen cannot settle it. 6 frames is far short of a 360 in Apollo practice. Treated as partial but not proven.


### `jsc2011e118360` - Apollo 15 - Hadley-Apennine, Mount Hadley

* **NASA title (verbatim):** "jsc2011e118360 - Panorama view of Station 8 and (Mons) Mt. Hadley taken during the third moonwalk of the Apollo 15 mission. The panoramas were built by combining Apollo 15 images starting with frame AS15-82-11054 thru end frame AS15-82-11058. The panoramic"
* **NASA description (verbatim):** "jsc2011e118360 - Panorama view of Station 8 and (Mons) Mt. Hadley taken during the third moonwalk of the Apollo 15 mission. The panoramas were built by combining Apollo 15 images starting with frame AS15-82-11054 thru end frame AS15-82-11058. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x3893 jpeg, 4342987 bytes (4.14 MB),
  aspect 2.5687:1, 38.9 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118360/jsc2011e118360~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118360
* **Source frames:** AS15-82-11054 .. AS15-82-11058 (5 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.992 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 5 frames, colour. A rolling dune-like massif (Mount Hadley) across the full width with a black sky band, and a wide plain with vehicle tracks in the foreground. Only 5 source frames for a 10000 px canvas, so per-frame resolution is low. No gutters or repeats.
* **Wrap / closure:** Ends are similar-looking smooth slopes; no matching landmark, no evidence of closure.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x3893); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** 5 frames cannot span 360 deg unless overlap is tiny. Treated as a partial sweep.


### `jsc2011e118361` - Apollo 15 - Apollo 15 EVA 2 traverse area

* **NASA title (verbatim):** "jsc2011e118361 - Panorama view of Apollo 15 lunar module pilot James B. Irwin, using a scoop in making a trench in the lunar soil during the second moonwalk of the mission. The panoramas were built by combining Apollo 15 images starting with frame AS15-92-"
* **NASA description (verbatim):** "jsc2011e118361 - Panorama view of Apollo 15 lunar module pilot James B. Irwin, using a scoop in making a trench in the lunar soil during the second moonwalk of the mission. The panoramas were built by combining Apollo 15 images starting with frame AS15-92-12420 thru end frame AS15-92-12438. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x1030 jpeg, 1699459 bytes (1.62 MB),
  aspect 9.7087:1, 10.3 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118361/jsc2011e118361~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118361
* **Source frames:** AS15-92-12420 .. AS15-92-12438 (19 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.338 (ratio vs visual judgement: **inconclusive**)
* **What I saw:** Continuous stitch of 19 frames, colour, but only 1030 px tall - a strongly downscaled product (~526 px per source frame). Content: the LRV and an astronaut, a lone object with a long shadow, plain regolith, and the whole LRV filling the lower right at the end. No gutters or repeats.
* **Wrap / closure:** Ends differ (a small dark object at the left vs plain terrain at the right).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x1030); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Extreme downscaling destroys the detail needed to judge seam structure.


### `jsc2011e118362` - Apollo 16 - Descartes highlands, Station 10

* **NASA title (verbatim):** "jsc2011e118362 - Panorama view of Apollo 16 lunar surface photos of the Station 10 and Sample 381 Rock taken during the second moonwalk of the mission. The panoramas were built by combining Apollo 16 images starting with frame AS16-114-18450 thru end frame"
* **NASA description (verbatim):** "jsc2011e118362 - Panorama view of Apollo 16 lunar surface photos of the Station 10 and Sample 381 Rock taken during the second moonwalk of the mission. The panoramas were built by combining Apollo 16 images starting with frame AS16-114-18450 thru end frame AS16-114-18467. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x956 jpeg, 1538903 bytes (1.47 MB),
  aspect 10.4603:1, 9.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118362/jsc2011e118362~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118362
* **Source frames:** AS16-114-18450 .. AS16-114-18467 (18 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.115 (ratio vs visual judgement: **inconclusive**)
* **What I saw:** Continuous stitch of 18 frames, colour, only 956 px tall (~556 px per source frame - heavily downscaled). The LRV appears at the left of the strip and again large in the middle, with tracks and craters. No gutters or hard seam lines.
* **Wrap / closure:** Ends differ.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x956); contact sheet viewed; wrap-test.py (1.115).
* **Uncertainty:** The LRV appearing at two bearings cannot be resolved at this resolution: two separate pieces of hardware (LM vs LRV) or a sweep passing the same bearing twice. Flagged, not resolved.


### `jsc2011e118363` - Apollo 16 - Descartes landing site, near LM Orion

* **NASA title (verbatim):** "jsc2011e118363 - Panorama view of Apollo 16 commander Astronaut John W. Young, working at the Lunar Roving Vehicle (LRV) just prior to deployment of the Apollo Lunar Surface Experiments Package (ALSEP) during the first moonwalk of the mission on April 21,"
* **NASA description (verbatim):** "jsc2011e118363 - Panorama view of Apollo 16 commander Astronaut John W. Young, working at the Lunar Roving Vehicle (LRV) just prior to deployment of the Apollo Lunar Surface Experiments Package (ALSEP) during the first moonwalk of the mission on April 21, 1972. The panoramas were built by combining Apollo 16 images starting with frame AS16-116-18573 thru end frame AS16-116-18581. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 10000x3379 jpeg, 3634584 bytes (3.47 MB),
  aspect 2.9595:1, 33.8 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2011e118363/jsc2011e118363~orig.jpg` - source page: https://images.nasa.gov/details/jsc2011e118363
* **Source frames:** AS16-116-18573 .. AS16-116-18581 (9 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.441 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 9 frames, colour. The LM Orion stands on the surface about two-thirds across, with the US flag on its pole and the LRV to its left, a wide bright plain in front, black sky above. No gutters or repeats.
* **Wrap / closure:** Ends are plain dark terrain on both sides; no landmark match visible.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (10000x3379); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** None material for the kind verdict; arc not established.


### `jsc2012e052597` - Apollo 16 - Lunar orbit (LM window view)

* **NASA title (verbatim):** "jsc2012e052597"
* **NASA description (verbatim):** "jsc2012e052597 - Panorama view from the Apollo 16 Lunar Module (LM) window taken on-orbit during Revolution 16 of the mission. The panoramas were built by combining Apollo 16 images starting with frame AS16-113-18297 thru end frame AS16-113-18307. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 18326x8537 jpeg, 9913479 bytes (9.45 MB),
  aspect 2.1467:1, 156.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2012e052597/jsc2012e052597~orig.jpg` - source page: https://images.nasa.gov/details/jsc2012e052597
* **Source frames:** AS16-113-18297 .. AS16-113-18307 (11 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.996 (ratio vs visual judgement: **inconclusive**)
* **What I saw:** A wide, tall (18326x8537) black-and-white stitch that is a view OUT OF THE LM WINDOW while in orbit, not a surface panorama: dark window-frame members and struts crossing both ends, a bright horizon band with sunlit surface beyond, about 49% of the frame black. The black elements at the left and right edges look like the same window geometry.
* **Wrap / closure:** The two ends share the same dark window-frame geometry and horizon; not a terrain wrap.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (18326x8537); contact sheet viewed; wrap-test.py (0.996); black-column analysis - the only black column run is the leading edge (0..544 px), so no internal gutter.
* **Uncertainty:** A window view cannot be a 360-degree rotation of the surface. It is in the same release family, but a landing-site demo should exclude it or label it as an orbital window view.


### `jsc2012e052598` - Apollo 16 - Descartes landing site, Station 1

* **NASA title (verbatim):** "jsc2012e052598"
* **NASA description (verbatim):** "jsc2012e052598 - Panorama view of Apollo 16 lunar surface photos as lunar module pilot Charles M. Duke Jr. is photographed by commander John W. Young collecting lunar samples at Station No. 1 during the first moonwalk of the mission at the Descartes landing site. The panoramas were built by combining Apollo 16 images starting with frame AS16-114-18416 thru end frame AS16-114-18431. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun. With significant overlap and time delay between frames, it is possible to create two different versions of this panorama with astronaut Charles Duke (Apollo 16) in the center (jsc2012e052598) and both in the center and walking away to the right (jsc2012e052599)."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 30000x3112 jpeg, 10087675 bytes (9.62 MB),
  aspect 9.6401:1, 93.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2012e052598/jsc2012e052598~orig.jpg` - source page: https://images.nasa.gov/details/jsc2012e052598
* **Source frames:** AS16-114-18416 .. AS16-114-18431 (16 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.537 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 16 frames, colour. Astronaut and LRV across the strip, bootprints and tracks, craters; a large dark shadow falls across the left end. No gutters, seam lines or repeated frames.
* **Wrap / closure:** Ends differ.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (30000x3112); contact sheet viewed; wrap-test.py (1.537).
* **Uncertainty:** Twin of jsc2012e052599; the two differ only in where astronaut Duke appears (NASA says so explicitly).


### `jsc2012e052599` - Apollo 16 - Descartes landing site, Station 1

* **NASA title (verbatim):** "jsc2012e052599"
* **NASA description (verbatim):** "jsc2012e052599 - Panorama view of Apollo 16 lunar surface photos as lunar module pilot Charles M. Duke Jr. is photographed by commander John W. Young collecting lunar samples at Station No. 1 during the first moonwalk of the mission at the Descartes landing site. The panoramas were built by combining Apollo 16 images starting with frame AS16-114-18416 thru end frame AS16-114-18431. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun. With significant overlap and time delay between frames, it is possible to create two different versions of this panorama with astronaut Charles Duke (Apollo 16) in the center (jsc2012e052598) and both in the center and walking away to the right (jsc2012e052599)."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 30000x3112 jpeg, 10024305 bytes (9.56 MB),
  aspect 9.6401:1, 93.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2012e052599/jsc2012e052599~orig.jpg` - source page: https://images.nasa.gov/details/jsc2012e052599
* **Source frames:** AS16-114-18416 .. AS16-114-18431 (16 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.536 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 16 frames, colour; the same scene as jsc2012e052598 with astronaut Duke in a different position. No gutters or repeats.
* **Wrap / closure:** Ends differ.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (30000x3112); contact sheet viewed; wrap-test.py (1.536).
* **Uncertainty:** None material.


### `jsc2014e021523` - Apollo 16 - Descartes landing site

* **NASA title (verbatim):** "Apollo and Earth Ob Composites"
* **NASA description (verbatim):** "Panorama view of Apollo 16 Lunar surface photos for use in presentations to NASA management and for Outreach Education in regard to new NASA initiative for human planetary research. Photo numbers used for this panoramic include: Apollo 16 start frame AS16-117-18805 thru end frame AS16-117-18823."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 20000x2164 jpeg, 4141515 bytes (3.95 MB),
  aspect 9.2421:1, 43.3 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2014e021523/jsc2014e021523~orig.jpg` - source page: https://images.nasa.gov/details/jsc2014e021523
* **Source frames:** AS16-117-18805 .. AS16-117-18823 (19 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.382 (ratio vs visual judgement: **disagree**)
* **What I saw:** Continuous stitch of 19 frames, colour, black sky above the horizon, reseau crosses visible. Left end: plain regolith with crosses. Middle: a small vehicle-like object with tracks. Right: the LRV large in the foreground. Right end: a plain horizon. No gutters or repeats.
* **Wrap / closure:** Ends differ (flat plain vs a different ridge line).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (20000x2164); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Ratio 0.382 is below the tool's "same object at both ends" calibration and would suggest closure, but the side-by-side crops are plainly different views; the left-vs-mirrored-right figure (0.079) is near zero, i.e. the profile is dominated by brightness rather than structure. VISUAL JUDGEMENT OVERRIDES THE RATIO: not a proven 360.


### `jsc2004e52772` - Apollo 17 - Taurus-Littrow, ALSEP deployment site

* **NASA title (verbatim):** "Panorama view of Apollo 17 Lunar surface photos"
* **NASA description (verbatim):** "Panorama view of Apollo 17 Lunar surface photos for use in presentations to NASA management and for Outreach Education in regard to new NASA initiative for human planetary research. Photo numbers used for this panoramic include: Apollo 17 start frame AS17-147-22572 thru end frame AS17-147-22600. View is of the Apollo Lunar Surface Experiment Package (ALSEP) Station taken during Extravehicular Activity (EVA) 1."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO PROJECT","APOLLO 17 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","EVA"]
* **File:** 29524x3000 jpeg, 10818991 bytes (10.32 MB),
  aspect 9.8413:1, 88.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e52772/jsc2004e52772~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e52772
* **Source frames:** AS17-147-22572 .. AS17-147-22600 (29 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.28 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 29 frames, black sky painted to the horizon, reseau crosses. Content: the ALSEP central station with cabling, the RTG (dark finned cylinder), the LRV with an astronaut, a boulder outcrop, the photographer's shadow and massif slopes. No gutters, seam lines or repeated frames.
* **Wrap / closure:** Both ends are feature-poor terrain; the screen says the ends are unrelated (1.280).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (29524x3000); contact sheet + end strips viewed; wrap-test.py; column black-run analysis (zero black gutters).
* **Uncertainty:** The prescribed N x 50-60 deg rule is unusable here: 29 frames would give 1450-1740 deg, impossible for one rotation. That proves only that the frames overlap heavily, so the true arc is not established from the file.


### `jsc2004e52775` - Apollo 17 - Taurus-Littrow, Station 7

* **NASA title (verbatim):** "Panorama view of Apollo 17 Lunar surface photos"
* **NASA description (verbatim):** "Panorama view of Apollo 17 Lunar surface photos for use in presentations to NASA management and for Outreach Education in regard to new NASA initiative for human planetary research. Photo numbers used for this panoramic include: Apollo 17 start frame AS17-146-22339 thru end frame AS17-146-22363. View is of Station 7 Panorama taken during Extravehicular Activity (EVA) 3."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO PROJECT","APOLLO 17 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","EVA"]
* **File:** 26968x5001 jpeg, 7858345 bytes (7.49 MB),
  aspect 5.3925:1, 134.9 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e52775/jsc2004e52775~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e52775
* **Source frames:** AS17-146-22339 .. AS17-146-22363 (25 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.567 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 25 frames. Left end: bright slope with small rocks and crosses. Middle: the LRV. Right end: plain bright terrain. Black sky band along the top. No gutters or repeats.
* **Wrap / closure:** Ends unrelated by the screen (1.567); visually both are feature-poor.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (26968x5001); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Arc not established (25 frames cannot be read as 25 x 50-60 deg).


### `jsc2004e52776` - Apollo 17 - Taurus-Littrow, Station 1

* **NASA title (verbatim):** "Panorama view of Apollo 17 Lunar surface photos"
* **NASA description (verbatim):** "Panorama view of Apollo 17 Lunar surface photos for use in presentations to NASA management and for Outreach Education in regard to new NASA initiative for human planetary research. Photo numbers used for this panoramic include: Apollo 17 start frame AS17-136-20745 thru end frame AS17-136-20759. View is of Station 1, taken during the first Extravehicular Activity (EVA) 1."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO PROJECT","APOLLO 17 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","panorama","EVA"]
* **File:** 21067x3575 jpeg, 8790736 bytes (8.38 MB),
  aspect 5.8929:1, 75.3 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e52776/jsc2004e52776~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e52776
* **Source frames:** AS17-136-20745 .. AS17-136-20759 (15 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.565 (ratio vs visual judgement: **disagree**)
* **What I saw:** Continuous stitch of 15 frames. The photographer's shadow stands about a sixth of the way across, the LRV and an astronaut occupy the right-hand third, and boulders mark Station 1. Reseau crosses throughout, black sky above the horizon. No gutters or repeats.
* **Wrap / closure:** Ends plainly differ: left end is a smooth slope with the distant LRV, right end is the LRV and astronaut close up.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (21067x3575); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Ratio 0.565 looks "related" but the crops are obviously different views - a false positive from flat regolith. Partial sweep.


### `jsc2004e52777` - Apollo 17 - Taurus-Littrow, Station 2

* **NASA title (verbatim):** "Panorama view of Apollo 17 Lunar surface photos"
* **NASA description (verbatim):** "Panorama view of Apollo 17 Lunar surface photos for use in presentations to NASA management and for Outreach Education in regard to new NASA initiative for human planetary research. Photo numbers used for this panoramic include: Apollo 17 start frame AS17-138-21053 thru end frame AS17-138-21073. View is of Station 2, taken during the second Extravehicular Activity (EVA) 2."
* **Date created / centre:**  / HQ
* **Keywords (verbatim):** ["APOLLO PROJECT","APOLLO 17 FLIGHT","LUNAR","LUNAR SOIL","MOON","PLANET","SPACE AGENCY","SPACE PROGRAM","SURFACE","panorama","EVA"]
* **File:** 28316x3000 jpeg, 18609825 bytes (17.75 MB),
  aspect 9.4387:1, 84.9 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e52777/jsc2004e52777~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e52777
* **Source frames:** AS17-138-21053 .. AS17-138-21073 (21 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.485 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 21 frames. The LRV with an astronaut appears near the left third and again at the far left of the next panel (a panel-split artefact, not a duplicate). Plain slopes elsewhere, reseau crosses, black sky. No gutters or seam lines.
* **Wrap / closure:** Ends are unrelated terrain. Ratio 1.485 - this is effectively the parent's partial-sweep calibration case.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (28316x3000); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Arc not established.


### `jsc2004e52779` - Apollo 17 - Taurus-Littrow, Station 6 (base of the North Massif)

* **NASA title (verbatim):** "jsc2004e52779 - Panorama view of Apollo 17 lunar surface photos for Station 6 taken during the third moonwalk of the mission by Apollo 17 commander Eugene Cernan and lunar module pilot Harrison (Jack) Schmitt. The panoramas were built by combining Apollo 1"
* **NASA description (verbatim):** "jsc2004e52779 - Panorama view of Apollo 17 lunar surface photos for Station 6 taken during the third moonwalk of the mission by Apollo 17 commander Eugene Cernan and lunar module pilot Harrison (Jack) Schmitt. The panoramas were built by combining Apollo 17 images starting with frame AS17-141-21575 through end frame AS17-141-21603. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["moon","apollo"]
* **File:** 9495x1200 jpeg, 1518325 bytes (1.45 MB),
  aspect 7.9125:1, 11.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e52779/jsc2004e52779~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e52779
* **Source frames:** AS17-141-21575 .. AS17-141-21603 (29 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 2.173 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 29 frames, but only 9495x1200 px - the lowest-resolution member of the family (~327 px per source frame). Content: slopes, a very large boulder (the Station 6 boulder), boulder fields, and the LRV with an astronaut at the bottom centre-right. Reseau crosses. No gutters or repeats.
* **Wrap / closure:** Ends unrelated by the screen (2.173, second highest of the set).
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (9495x1200); contact sheet + end strips viewed; wrap-test.py.
* **Uncertainty:** Low resolution limits any seam judgement; the ends are plainly different views. Arc not established.


### `jsc2004e20304` - Apollo 17 - Taurus-Littrow, Station 5

* **NASA title (verbatim):** "jsc2004e20304 - Panorama view of Apollo 17 lunar surface photos for Station 5 at the Taurus-Littrow landing site taken during the second moonwalk of the mission by Apollo 17 commander Eugene Cernan and lunar module pilot Harrison (Jack) Schmitt. The panora"
* **NASA description (verbatim):** "jsc2004e20304 - Panorama view of Apollo 17 lunar surface photos for Station 5 at the Taurus-Littrow landing site taken during the second moonwalk of the mission by Apollo 17 commander Eugene Cernan and lunar module pilot Harrison (Jack) Schmitt. The panoramas were built by combining Apollo 17 images starting with frame AS17-145-22159 through end frame AS17-145-22181. The panoramic images received minimal retouching by NASA imagery specialists, including the removal of lens flares that were problematic in stitching together the individual frames and blacking out the sky to the lunar horizon. These adjustments were made based on observations of the Moon walkers who reported that there are no stars visible in the sky due to the bright lunar surface reflection of the Sun."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** []
* **File:** 9000x1066 jpeg, 1927196 bytes (1.84 MB),
  aspect 8.4428:1, 9.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/jsc2004e20304/jsc2004e20304~orig.jpg` - source page: https://images.nasa.gov/details/jsc2004e20304
* **Source frames:** AS17-145-22159 .. AS17-145-22181 (23 frames)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** true
* **wrapRatio:** 0.41 (ratio vs visual judgement: **agree**)
* **What I saw:** Continuous stitch of 23 frames, 9000x1066. Boulder field with massif slopes and black sky above the horizon. The left 12.5% and the right 12.5% show the SAME hill silhouette in the same relative position with a very similar boulder distribution, i.e. the two ends depict the same bearing. The join is not pixel-identical.
* **Wrap / closure:** Ratio 0.410 matches the parent's calibration for "ends show the same object" (Change-4 = 0.41) and also matches the visual read.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (9000x1066); contact sheet viewed; wrap-test.py ratio 0.410 with the side-by-side image inspected at length.
* **Uncertainty:** The only JSC station stitched panorama in this set where the numeric screen AND my eyes agree that the ends show the same view. isFull360 = true with MODERATE (not high) confidence: NASA states no arc, and the residual seam misregistration means the stored file is not a perfect cylindrical wrap.


### `S71-43941` - Apollo 15 - Hadley-Apennine, view SSW to NNW

* **NASA title (verbatim):** "Apollo 15 EVA panorama"
* **NASA description (verbatim):** "S71-43941 (2 Aug. 1971) --- A photographic mosaic showing a portion of the Apollo 15 Hadley-Apennine landing site with a field of view from about south by southwest to about north by northwest. The photographs were taken from the windows of the Lunar Module (LM) which was resting on the lunar surface facing west. Note bootprints and tracks of the Lunar Roving Vehicle (LRV) in the foreground. Visible on the horizon from left to right are: Hadley Delta Mountain and St. George Crater; Bennett Hill; and Hill 305, with the ALSEP equipment deployed in front of it."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 3252x1710 jpeg, 746829 bytes (0.71 MB),
  aspect 1.9018:1, 5.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S71-43941/S71-43941~orig.jpg` - source page: https://images.nasa.gov/details/S71-43941
* **Source frames:** not stated
* **Kind:** `mosaic-of-panoramas` &nbsp; **estimated FOV:** 135 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.118 (ratio vs visual judgement: **n/a**)
* **What I saw:** A hand-assembled photo mosaic, NOT a seamless stitch: several rectangular Hasselblad prints overlapped with visible print edges, tilts, black unfilled corners, and a white text box reading "LM WINDOW MOSAIC". Straight cut lines break the terrain.
* **Wrap / closure:** Ratio 0.118 is meaningless here: both ends are the black unfilled margin of the paste-up.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (3252x1710); full image viewed; wrap-test.py (ratio discounted); black-column analysis.
* **Uncertainty:** FOV is NASA's stated compass range ("about south by southwest to about north by northwest" = 135 deg). It is one of three parts of a 360 that also needs S71-43940 (NOT present in this library) and S71-43942.


### `S71-43942` - Apollo 15 - Hadley-Apennine, view SE to WNW

* **NASA title (verbatim):** "Apollo 15 - Extravehicular Activity (EVA) Panorama"
* **NASA description (verbatim):** "S71-43942 (2 Aug. 1971) --- This view is the second of a series of three mosaic photographs which compose a 360-degree panoramic view of the Apollo 15 Hadley-Apennine landing site, taken near the close of the third and final lunar surface extravehicular activity (EVA) by astronauts David R. Scott, commander, and James B. Irwin, lunar module pilot. This group of photographs was designated the Rover \"RIP\" Pan because the Lunar Roving Vehicle (LRV) was parked in its final position prior to the two crew men returning to the Lunar Module (LM). The astronaut taking the pan was standing about 325 feet east of the LM. The LRV was parked about 300 feet east of the LM. This mosaic covers a field of view from about southeast to about west by northwest. Visible on the horizon from left to right are: Sliver Spur on the Apennine Front; Hadley Delta Mountain and St. George Crater; Bennett Hill; and the LM. The other two views which compose the 360-degree pan are S71-43940 and S71-43943."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 4689x2256 jpeg, 1474908 bytes (1.41 MB),
  aspect 2.0785:1, 10.6 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S71-43942/S71-43942~orig.jpg` - source page: https://images.nasa.gov/details/S71-43942
* **Source frames:** not stated
* **Kind:** `mosaic-of-panoramas` &nbsp; **estimated FOV:** 157 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.477 (ratio vs visual judgement: **agree**)
* **What I saw:** Hand-assembled mosaic with a white text box reading "ROVER 'RIP' PAN" and the numeral 1: five to six rectangular prints with visible edges and slight tilts, black gaps between and around them, the LRV in the third print and a small white object in the first.
* **Wrap / closure:** Ratio 1.477 (unrelated) and both ends are print margins rather than a continuous strip.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (4689x2256); full image viewed; wrap-test.py.
* **Uncertainty:** FOV is NASA's stated compass range (southeast to about west by northwest = 157 deg). With S71-43943 and the missing S71-43940 it composes a 360; this file alone is a ~157 deg sector.


### `S71-43943` - Apollo 15 - Hadley-Apennine, view NNE to S

* **NASA title (verbatim):** "Apollo 15 - Extravehicular Activity (EVA) Panorama"
* **NASA description (verbatim):** "S71-43943 (2 Aug. 1971) --- Mosaic photographs which compose a 360-degree panoramic view of the Apollo 15 Hadley-Apennine landing site, taken near the close of the third lunar surface extravehicular activity (EVA) by astronauts David Scott and James Irwin. This group of photographs was designated the Rover \"RIP\" Pan because the Lunar Roving Vehicle was parked in its final position prior to the two crewmen returning to the Lunar Module. The astronaut taking the pan was standing 325 feet east of the Lunar Module (LM). The Rover was parked about 300 feet east of the LM. This mosaic covers a field of view from about north-northeast to about south. Visible on the horizon from left to right are: Mount Hadley; high peaks of the Apennine Mountains which are farther in the distance than either Mount Hadley or Hadley Delta Mountain; Silver Spur on the Apennine Front; and the eastern portion of Hadley Delta. Note Rover tracks in the foreground. The numbers of the other two views composing the 360-degree pan are S71-43940 and S71-43942."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 6132x2969 jpeg, 2098525 bytes (2.00 MB),
  aspect 2.0653:1, 18.2 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S71-43943/S71-43943~orig.jpg` - source page: https://images.nasa.gov/details/S71-43943
* **Source frames:** not stated
* **Kind:** `mosaic-of-panoramas` &nbsp; **estimated FOV:** 158 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 0.001 (ratio vs visual judgement: **disagree**)
* **What I saw:** Hand-assembled mosaic with a white text box reading "ROVER 'RIP' PAN" and the numeral 2: five rectangular prints of differing brightness joined with visible straight edges, black unfilled regions left and right, cross marks and rover tracks inside the frames.
* **Wrap / closure:** Ratio 0.001 is an artefact: both ends of the canvas are pure black margin. The side-by-side image confirms black at both ends.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (6132x2969); full image viewed; wrap-test.py (ratio explicitly discounted); black-column analysis showed black only in the outer 217 px and 155 px.
* **Uncertainty:** FOV is NASA's stated compass range (north-northeast to about south = 158 deg). Report the ratio but do not read it as a wrap: this is a print paste-up with black margins.


### `S72-35970` - Apollo 16 - Descartes landing site, Flag Crater

* **NASA title (verbatim):** "INFLIGHT - APOLLO 16 (CREW)"
* **NASA description (verbatim):** "S72-35970 (21 April 1972) --- A 360-degree field of view of the Apollo 16 Descartes landing site area composed of individual scenes taken from color transmission made by the color RCA TV camera mounted on the Lunar Roving Vehicle (LRV). This panorama was made while the LRV was parked at the rim of Flag Crater (Station 1) during the first Apollo 16 lunar surface extravehicular activity (EVA) by astronauts John W. Young and Charles M. Duke Jr. The overlay identifies the directions and the key lunar terrain features. The camera panned across the rear portion of the LRV in its 360-degree sweep. Astronauts Young, commander; and Duke, lunar module pilot; descended in the Apollo 16 Lunar Module (LM) \"Orion\" to explore the Descartes highlands landing site on the moon. Astronaut Thomas K. Mattingly II, command module pilot, remained with the Command and Service Modules (CSM) \"Casper\" in lunar orbit."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 4372x1686 jpeg, 836393 bytes (0.80 MB),
  aspect 2.5931:1, 7.4 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S72-35970/S72-35970~orig.jpg` - source page: https://images.nasa.gov/details/S72-35970
* **Source frames:** TV frames from the RCA colour TV on the LRV (not stated)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** 360 deg
  &nbsp; **isFull360:** true
* **wrapRatio:** 0.797 (ratio vs visual judgement: **agree**)
* **What I saw:** A prepared graphic sheet, not clean imagery: title block "APOLLO 16 TV PANORAMA FROM RIM OF FLAG CRATER EVA I STATION 1", a single row of TV frames with visible joins, compass labels (EAST, SOUTH, WEST, NORTH), named features (PLUM CRATER, FLAG CRATER, STONE MOUNTAIN, SOUTH RAY CRATER), and the credit "PREPARED BY: MAPPING SCIENCES BRANCH, FOD, NASA MANNED SPACECRAFT CENTER".
* **Wrap / closure:** Ratio 0.797; closure is stated by NASA and the labels run around the compass rather than being inferred.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (4372x1686); full graphic viewed; wrap-test.py; NASA description states "A 360-degree field of view".
* **Uncertainty:** isFull360 true on NASA's own statement. Demo caveat: TV-derived, low resolution, with baked-in text labels and direction arrows.


### `S72-35971` - Apollo 16 - Descartes landing site, North Ray Crater

* **NASA title (verbatim):** "INFLIGHT - APOLLO XVI (CREW)"
* **NASA description (verbatim):** "S72-35971 (21 April 1972) --- A 360-degree field of view of the Apollo 16 Descartes landing site area composed of individual scenes taken from color transmission made by the color RCA TV camera mounted on the Lunar Roving Vehicle (LRV). This panorama was made while the LRV was parked at the rim of North Ray Crater (Stations 11 & 12) during the third Apollo 16 lunar surface extravehicular activity (EVA) by astronauts John W. Young and Charles M. Duke Jr. The overlay identifies the directions and the key lunar terrain features. The camera panned across the rear portion of the LRV in its 360-degree sweep. Note Young and Duke walking along the edge of the crater in one of the scenes. The TV camera was remotely controlled from a console in the Mission Control Center (MCC). Astronauts Young, commander; and Duke, lunar module pilot; descended in the Apollo 16 Lunar Module (LM) \"Orion\" to explore the Descartes highlands landing site on the moon. Astronaut Thomas K. Mattingly II, command module pilot, remained with the Command and Service Modules (CSM) \"Casper\" in lunar orbit."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 4133x1824 jpeg, 920214 bytes (0.88 MB),
  aspect 2.2659:1, 7.5 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S72-35971/S72-35971~orig.jpg` - source page: https://images.nasa.gov/details/S72-35971
* **Source frames:** TV frames from the RCA colour TV on the LRV (not stated)
* **Kind:** `continuous-panorama` &nbsp; **estimated FOV:** 360 deg
  &nbsp; **isFull360:** true
* **wrapRatio:** 1.062 (ratio vs visual judgement: **inconclusive**)
* **What I saw:** Prepared graphic sheet: title block "APOLLO 16 TV PANORAMA FROM RIM OF NORTH RAY CRATER EVA III STATION 11 12", two rows of TV frames with visible joins, compass labels (EAST, SOUTH, WEST, NORTH), named features (SMOKY MOUNTAIN, STONE MOUNTAIN, NORTH RAY CRATER) and the Mapping Sciences Branch credit.
* **Wrap / closure:** Ratio 1.062; closure is stated in NASA's description, not inferred from pixels.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (4133x1824); full graphic viewed; wrap-test.py.
* **Uncertainty:** isFull360 true on NASA's own statement, but the ratio is uninformative because the sheet is a two-row labelled layout with black borders.


### `S72-54413` - Apollo 17 - Taurus-Littrow, computer-generated panorama

* **NASA title (verbatim):** "LANDING SITE - APOLLO 17 (MAP)"
* **NASA description (verbatim):** "S72-54413 (December 1972) --- A vertical view of the Taurus-Littrow landing area photographed on an earlier Apollo mission from lunar orbit. The mission photograph is surrounded on all sides by a computer-generated 360-degree panorama of the region as seen by an observer at the nominal Apollo 17 Lunar Module landing site. The 360-degree panorama is divided into four sections, north-east-south-west. Each section includes an overlap of about 15 degrees with each adjacent section. The observer's eye level is 1.8 meters above the surface. The features on the panorama are marked by an overlay on the photograph. The panoramic scene was generated by processing a digitized form of the U.S. Army TOPCOM compilation of the terrain contours in the Taurus-Littrow landing area."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** [""]
* **File:** 2893x3847 jpeg, 1484354 bytes (1.42 MB),
  aspect 0.7520:1, 11.1 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/S72-54413/S72-54413~orig.jpg` - source page: https://images.nasa.gov/details/S72-54413
* **Source frames:** n/a - generated from US Army TOPCOM terrain contours
* **Kind:** `mosaic-of-panoramas` &nbsp; **estimated FOV:** not established
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.436 (ratio vs visual judgement: **n/a**)
* **What I saw:** Not a photograph: a vertical orbital-view photograph of Taurus-Littrow with coordinate ticks, surrounded on all sides by a computer-generated contour/wireframe horizon profile with a numeric elevation scale. NASA describes the panorama as divided into four sections (N, E, S, W) with about 15 deg overlap, eye level 1.8 m.
* **Wrap / closure:** Ratio 1.436 is irrelevant - the "ends" are map borders.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded (2893x3847); full sheet viewed; wrap-test.py (discounted).
* **Uncertainty:** kind reported as mosaic-of-panoramas because the file is a layout of four separate generated panorama sections around a photo, not a single continuous stitch. NOT usable as browsable photographic imagery. isFull360 false: no photographic rotation exists.


### `AS17-145-22196` - Apollo 17 - Taurus-Littrow (from the LM window)

* **NASA title (verbatim):** "Apollo 17, Panorama of the moon from Lunar Module"
* **NASA description (verbatim):** "AS17-145-22196 (7-19 Dec. 1972) --- Astronaut Harrison H. Schmitt's discarded Portable Life Support System (PLSS), along with tracks from the Lunar Roving Vehicle (LRV) and boot prints were photographed through the Lunar Module (LM) window late in the mission. While astronauts Eugene A. Cernan, commander, and Schmitt, lunar module pilot, descended in the LM \"Challenger\" to explore the Taurus-Littrow region of the moon, astronaut Ronald E. Evans, command module pilot, remained with the Command and Service Modules (CSM) \"America\" in lunar orbit."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["Apollo","Apollo 17"]
* **File:** 3000x3009 jpeg, 2169683 bytes (2.07 MB),
  aspect 0.9970:1, 9 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/AS17-145-22196/AS17-145-22196~orig.jpg` - source page: https://images.nasa.gov/details/AS17-145-22196
* **Source frames:** single frame (1 frames)
* **Kind:** `single-frame` &nbsp; **estimated FOV:** 50 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 1.296 (ratio vs visual judgement: **n/a**)
* **What I saw:** One square Hasselblad frame (3000x3009): regolith with LRV tracks and bootprints, a discarded PLSS, reseau crosses, seen from the LM window. Not a panorama despite the title.
* **Wrap / closure:** Ratio 1.296 for a single frame - meaningless by construction.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded; full frame viewed; wrap-test.py (ratio recorded only).
* **Uncertainty:** The library TITLE ("Apollo 17, Panorama of the moon from Lunar Module") is misleading: this is one frame with 1:1 aspect. The ~50 deg FOV is the standard 70 mm / 60 mm Biogon frame width (consistent with the square scan), not a measurement of this file.


### `AS17-145-22216` - Apollo 17 - Taurus-Littrow (from the LM window)

* **NASA title (verbatim):** "Apollo 17, Panorama of the moon from Lunar Module"
* **NASA description (verbatim):** "AS17-145-22216 (7-19 Dec. 1972) --- In this view looking out the Lunar Module (LM) windows shows the United States Flag on the moon's surface. This view looks toward the north Massif. The LM thrusters can be seen in foreground. While astronauts Eugene A. Cernan, commander, and Harrison H. Schmitt, lunar module pilot, descended in the LM \"Challenger\" to explore the Taurus-Littrow region of the moon, astronaut Ronald E. Evans, command module pilot, remained with the Command and Service Modules (CSM) \"America\" in lunar orbit."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["Apollo","Apollo 17"]
* **File:** 3023x3000 jpeg, 2062960 bytes (1.97 MB),
  aspect 1.0077:1, 9.1 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/AS17-145-22216/AS17-145-22216~orig.jpg` - source page: https://images.nasa.gov/details/AS17-145-22216
* **Source frames:** single frame (1 frames)
* **Kind:** `single-frame` &nbsp; **estimated FOV:** 50 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 2.108 (ratio vs visual judgement: **n/a**)
* **What I saw:** One square Hasselblad frame (3023x3000): the US flag on its pole, the north Massif beyond, part of the LM structure and a thruster bell in the dark foreground; about 20% of the frame is black. Not a panorama.
* **Wrap / closure:** Ratio 2.108 for a single frame - meaningless by construction.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded; full frame viewed; wrap-test.py (ratio recorded only).
* **Uncertainty:** Same misleading-title caveat as AS17-145-22196: single frame, not a panorama.


### `as11-40-5881` - Apollo 11 - Tranquility Base

* **NASA title (verbatim):** "Apollo 11 Mission image - Lunar surface and horizon"
* **NASA description (verbatim):** "AS11-40-5881 (20 July 1969) --- This 70mm handheld camera's image on the Sea of Tranquility's lunar surface is the first of a multi-framed panorama photographed from a point some 30 or 40 feet west of the plus-Z (west) footpad of the Lunar Module \"Eagle.\" The view is looking toward the southwest showing part of the horizon crater rim that was pointed out as being visible from the Eagle's window."
* **Date created / centre:**  / JSC
* **Keywords (verbatim):** ["APOLLO 11 FLIGHT","MOON","LUNAR SURFACE","LUNAR BASES","LUNAR MODULE","EXTRAVEHICULAR ACIVITY"]
* **File:** 4000x4000 jpeg, 9945389 bytes (9.48 MB),
  aspect 1.0000:1, 16 MP, `orig` variant.
  Download: `https://images-assets.nasa.gov/image/as11-40-5881/as11-40-5881~orig.jpg` - source page: https://images.nasa.gov/details/as11-40-5881
* **Source frames:** single frame (1 frames)
* **Kind:** `single-frame` &nbsp; **estimated FOV:** 50 deg
  &nbsp; **isFull360:** false
* **wrapRatio:** 2.966 (ratio vs visual judgement: **n/a**)
* **What I saw:** One square Hasselblad frame (4000x4000): the Sea of Tranquility surface and part of the horizon crater rim, black sky in the top ~22%, reseau crosses. NASA's own description calls it the first of a multi-framed panorama - so this asset is one frame of that pan, not the pan.
* **Wrap / closure:** Ratio 2.966 for a single frame - meaningless by construction.
* **How verified:** metadata.json + /asset/<id>; ~orig.jpg downloaded; full frame viewed; wrap-test.py (ratio recorded only).
* **Uncertainty:** Useful as a calibration frame (square 70 mm format) and as the first frame of the pan that jsc2007e045375 stitches, but it is not itself browsable panoramic imagery.

