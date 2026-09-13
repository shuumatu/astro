# Lunar panorama research

The source survey behind the Moon demo's browsable surface panoramas: which imagery exists, what its
licence actually is, and which of it is not good enough to ship. This is the working record for
`tools/moon-textures/moon_panoramas.py` and `frontend/public/demos/moon/ATTRIBUTION.md`, kept because
most of the conclusions are negative findings that would otherwise be re-derived from scratch.

It was produced by one research session that ran six parallel sweeps and then verified their claims
against the sources. Where a claim in here disagrees with an earlier version of itself, the correction
is recorded rather than tidied away - several of the wrong turns are the useful part.

## Start here

| File | What it settles |
| --- | --- |
| `lunar-panorama-sources.md` | The whole picture: network method, the Apollo findings, the Chang'e findings, the per-site verdict table, the wrap tests, and the per-frame heading investigation |
| `verify-apollo.md` / `.json` | Per-asset verification of all 29 Apollo panorama candidates: true dimensions, coverage, licensing, and which are not what their titles claim |
| `apollo-surface-panoramas.json` | The 18 shippable Apollo panoramas with verified sizes, direct URLs and credits |
| `change-panoramas.md` / `.json` | Chang'e 3/4/5/6: what exists, at what resolution, and the licence conflict over the GRAS archive |
| `other-mission-panoramas.md` / `.json` | Luna/Lunokhod, Surveyor, Chandrayaan-3, SLIM and the CLPS landers |
| `orbital-lunar-panoramas.md` / `.json` | Orbital and whole-Moon products usable as sphere textures |
| `kaguya-selene.md`, `partial-*.md`, `notes-*.md` | The sub-sweeps that fed the above, left in place so their evidence can be checked |
| `frame-azimuths.json` | The per-frame camera-azimuth query behind the conclusion that no usable heading data is published |

## The three conclusions that matter most

1. **The Apollo surface panoramas are the backbone.** NASA's Image and Video Library holds large
   continuous stitches (up to 30000 px wide, 5001 px tall), public domain, already sky-masked. They are
   *not* 360-degree sweeps.
2. **No strip closes end to end.** Every candidate was checked by placing its two edges side by side.
   Three earlier claims to the contrary - Apollo 17 Station 5, Apollo 14 and Chang'e 4 - were wrong, and
   the viewer was corrected as a result.
3. **Per-frame headings are not obtainable.** LPI's Apollo Image Atlas publishes a camera azimuth on only
   a small minority of frames - none of them the frames the shipped panoramas are stitched from - and the
   Apollo Lunar Surface Journal warns that its own per-frame azimuths "may have errors of 3° or more".

## Evidence

`evidence/` holds the images the conclusions rest on, kept small on purpose:

- `corner-*.jpg` - full-resolution corners proving the GRAS copies carry a baked-in CLEP/GRAS watermark
  and the IAU copy does not;
- `*-wrap-test.jpg` - each strip's two ends side by side, which is how the no-closure finding was made;
- `change4-iau1901a.jpg` and `ce4-s1-cyl.jpg` - the two Chang'e 4 candidates, the first unwatermarked.

The bulk material - downloaded originals, PDS listings, sub-agent scratch - was deleted rather than
committed: it ran to roughly 780 MB and every item is either re-downloadable from a URL recorded in these
reports or was an intermediate.

## Tools

`tools/` holds the scripts the reports refer to. **Run them from the repository root**, not from this
directory: they resolve `tools/moon-textures` manifest paths and write their output to `.cache/` relative
to the working directory. `.cache/` is disposable and is not committed. The two worth knowing:

- **`flatten-view.py`** reproduces the viewer's *original sphere* projection on the CPU. It is a
  historical diagnostic rather than a live check - that sphere mapping was the stretching bug, and the
  viewer now uses a cylinder - but it is how the 1.75 vertical calibration was found. Its own header
  says so, and its span table predates the wrap tests. Kept because the next person to touch the
  framing will want to see how the last one was arrived at.
- **`measure-drag.mjs`** drives the real viewer through Chrome DevTools Protocol, drags in each axis and
  aligns the before/after screenshots to report which way the picture actually moved. It exists because
  the drag's pitch sign was reasoned about wrongly twice and is now settled by measurement.

Everything else in here is a self-contained URL tool: it takes its arguments on the command line, writes
to `.cache/`, and needs nothing from the deleted scratch directories.

**The reports under `evidence/` and the `.md` files here are snapshots and still cite the paths they were
written under** (`.agents/research/...`, `.cache/moon-panoramas/...`). They were produced in a working
tree laid out that way, and they are kept verbatim so their evidence can be checked; the live paths are
`docs/lunar-panorama-research/tools/` and the tool's own `--work` directory. Their downloaded originals
and sub-agent scratch - about 780 MB - were deleted when this folder was created.

Network scripts need the local proxy, and Node needs `NODE_USE_ENV_PROXY=1` as well as `HTTP_PROXY` or it
silently goes direct - the trap that produced a wrong finding in the first place. See the network section
of `lunar-panorama-sources.md`.
