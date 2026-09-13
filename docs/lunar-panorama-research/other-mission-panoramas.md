# Non-Apollo, non-Chang'e lunar surface panoramas

Reconstructed by the parent agent after the "other missions" research subagent **failed before writing
its deliverables**. Everything below is split into what **I verified myself with a probe** and what is
**subagent-reported and not re-measured** — I have not presented the latter as established fact.

Proxy note for every command here: Node 24 only honours `HTTP_PROXY`/`HTTPS_PROXY` when
`NODE_USE_ENV_PROXY=1` is also set. Proven with `.agents/proxy-audit.mjs`.

## Verified by me

| # | mission / site | what it is | measured | projection / coverage | licence | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Surveyor 7** | NSSDC scan of an original Surveyor 7 television data printout, mosaic sheet | **3790 x 1954 JPEG, 1,013,393 B** | not a seamless 360°; stepped-survey frames, film edges and greyscale wedges in frame | NASA-produced, public domain | **Best non-Apollo NASA option.** Usable as a "browse the historic survey" plate, but it is a scan of a printout, not a clean panorama |
| 2 | **Artemis II** | "Earthset" from Orion — *not a panorama* | **3819 x 5092 JPEG, 15,048,599 B** | single frame, portrait | NASA, public domain | Listed to correct the record: this is the strongest Artemis-era asset, and it is not a surface panorama |
| 3 | **Luna 9 / Luna 13 / Lunokhod 1 / Lunokhod 2** | Don P. Mitchell's re-processed Soviet panoramas | pages reachable (200) | horizontal camera pans | **"Copyright © 2003,2004 Don P. Mitchell. All rights reserved."** — quoted from the page itself | **Do not redistribute.** Link out with credit, or exclude |
| 4 | **Lunokhod 2** | planetary.org image page | page 200 | — | credited "Roscosmos / Russian Academy of Sciences" | The hosted file is only ~720 x 144, useless as a viewer asset |

URLs for 1–3:

- Surveyor 7: `http://nssdc.gsfc.nasa.gov/planetary/image/surveyor/surveyor7_01_mos_0712.jpg`
- Artemis II Earthset: `https://images-assets.nasa.gov/image/KSC-20260410-PH-JNV01_0001/KSC-20260410-PH-JNV01_0001~orig.jpg`
- Soviet panorama catalogue: `http://www.mentallandscape.com/C_CatalogMoon.htm`
- Lunokhod 2 page: `https://www.planetary.org/space-images/lunokhod-2-panorama`

## Subagent-reported, NOT re-measured by me

Treat these as leads requiring a probe before use:

- **Surveyor 7 set**: 16 large scans, ~3802 x 1924, 15.7 MB total. The hand-written catalogue headers inside
  the scans distinguish 25 mm wide-angle "W/A Panorama" tiles from 100 mm stepped surveys with printed azimuth
  ranges (Survey 050 Seg 1 = −213…−194; Survey 052 Seg 3 = −69…0; Survey 054 Seg 5 = 63…126; Survey 053 Seg 4 =
  3…60). The union of printed ranges is ~227°, and the sequence wraps through 0 — so a full circle is covered,
  but **as separate stepped-survey frames, not one seamless image**.
- Also reported: a Surveyor 6 panorama GIF (767 x 330) and a Surveyor 7 mosaic JPEG (625 x 480).
- **Lunokhod geometry**, per a citable paper (ISPRS XL-4 121, 2014): horizontal cameras are 30° vertical by
  slightly more than 180° horizontal, 500 samples x 3000 lines, optical axis tilted 15° down; two cameras on
  opposite sides give full 360° coverage, but **each file is a ~180° strip**, so `coverageDeg` per file must be
  ~180, not 360.
- **Lunokhod counts**: Lunokhod 1 (Luna 17) 42 horizontal pans up to 3687 x 600 plus 9 vertical; Lunokhod 2
  (Luna 21, the demo's existing `luna-21` site) 17 horizontal up to 4314 x 600 plus one vertical at 4665 x 600.
  Landing sites: Luna 17 / Lunokhod 1 at 38.28 N, 325.00 E (Mare Imbrium); Luna 21 / Lunokhod 2 at
  25.85 N, 30.45 E (Le Monnier).
- **Luna 9** up to 5997 x 537 and **Luna 13** up to 5628 x 538 (4–5 frames each, partial sweeps, not 360°).
- **Luna 16 / 20 / 24 have essentially no published surface panoramas** — sample photographs only.
- **ISRO / JAXA / ESA produce no genuine 360° lunar surface panorama.** `www.isro.gov.in` returned
  Cloudflare 403 on every path and User-Agent tried, so no ISRO image could be verified at all. SLIM's best real
  mosaic is 1000 x 842 and **explicitly half-terminated** ("the scan was terminated at the half-way point"),
  and JAXA's terms prohibit cropping, resizing and stitching, so no derivative panorama is permitted. Kaguya was
  orbital only. ESA has never landed; its panorama-shaped lunar images are artist's impressions.
- **`planetology.ru`** is a DNS failure (EAI_AGAIN) and **`web.archive.org`** times out, so no archived LPI or
  Wikimedia copies could be recovered as substitutes.

## Consequence for the demo

There is **no openly licensed, high-resolution, true-360° lunar surface panorama from any mission other than
Apollo and Chang'e 4**. For `luna-21` the honest options are: link out to the Soviet material with credit, or
show "no panorama available". The Surveyor 7 scans are the one defensible NASA addition, and they should be
labelled as historic printout scans rather than panoramas.
