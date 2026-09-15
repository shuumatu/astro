# Refractor telescope geometry review

## Source and reproducibility

`telescope_refractor.glb` is retained unchanged. The file was supplied with a `.glb.log` that is an
Autodesk ATF translation log, which is where the `Obj3d66-632255-*` node names and the six
`fallback Material` entries come from: no node name and no material carries a functional meaning.
The source has 16 nodes, 8 meshes, one primitive per mesh, and every node transform is a matrix. It
contains **no textures, no images and no text geometry at all** - the only material property is a
base colour - so there is nothing to strip out of it, and the lettering and badges visible in the
reference photograph are deliberately not recreated.

Run the pipeline in this order:

| Step | Command | Output |
| --- | --- | --- |
| 1 | `tools/audit-refractor.py` | hierarchy, baked transforms, fragment metrics, rendered atlases |
| 2 | `tools/build-refractor-model.py` | `telescope_refractor_classified.glb` |
| 3 | `tools/refractor-measure-parts.py` | `fragments-measured.json` |
| 4 | `tools/refractor-classify.py` | `part-of.json`, which step 2 reads |

Steps 2 and 4 depend on each other in one direction only: step 2 bakes the geometry, and step 4
measures that baked geometry about the published optical frame and writes the mapping back. The
builder refuses to run if the source SHA-256 changes. The geometry scripts need NumPy and Pillow;
the review used a throwaway virtual environment at `.cache/venv-tools`, which is not committed.

## Frame and measured layout

Every transform is baked before any measurement. The optical frame is the one the builder publishes
in `scenes[0].extras.opticalFrame`: `s` runs along the tube, `s` decreasing in the direction the
light travels, and the two perpendicular axes give the radial distance. The tube's own wall normals
recover that axis to 0.000 deg, and the shell's centre sits 0.0 mm off it.

| Landmark | Measured |
| --- | --- |
| Tube shell | one 2160-face fragment, s −338.8 .. +304.5 mm, concentric radii 23.6 / 41.2 / 48.9 / 59.5 mm |
| Front opening | throat r 23.6 mm at s +322.7 .. +338.8, cell rings r 25.3 .. 58.5 mm at s +270.8 .. +325.1 |
| Solid discs | two 108.8 mm discs, 7–8 mm thick, exactly coaxial at s −294.2 .. −272.5 |
| Coaxial train | 18.2 mm bore tube at s +367.4 .. +407.0, 23.0–24.6 mm and 29.9–41.1 mm collars further out |
| Focuser | off-axis 60.6–73.7 mm at height 1.10–1.15 m, wheels r 53.1–71.6 and 61.1–76.5 mm, body r 56.1–67.4 mm |
| Finder | off-axis 64.2–84.7 mm at height 1.20–1.23 m, i.e. the cluster that rides above the focuser |
| Mount | 31 fragments off-axis 119–410 mm, the largest a 6412-face column |
| Balance | 11 fragments 622–930 mm off-axis |
| Ground end | 9 fragments, own cylinder fits 376–1190 mm from the axis |

## Reference-matched appearance

The classified GLB carries one material per reviewed category, painted to the reference photograph:
an off-white tube, cell, rings, finder and mount; near-black optics, focuser, counterweight and
retainer rings; a metallic silver finish for the small fittings; and translucent glass for the two
teaching lenses. The scene reads those materials straight from the file and never repaints them, so
the model looks the same in the demo as it does in any other viewer. `highlight` colours in
`parts.ts` are used only for the selection glow and the list swatches.

## Reviewed categories

| ID | Measured evidence |
| --- | --- |
| opticalTube | one shell, 94.5% cylindrical wall, concentric radii 23.6/41.2/48.9/59.5 mm over 643 mm, 0.0 mm off the axis |
| objectiveCell | the coaxial rings at the front opening, r 20.0–140.7 mm |
| lensRetainer | the rings whose bore is 6–30 mm smaller than the cell bore, so they overhang it |
| dewShield | the two solid discs that span the whole bore, so they read as baffles or covers |
| eyepieceHolder | the coaxial train: an 18.2 mm bore tube with 23.0–41.1 mm collars, all within 0.3 mm of the axis |
| focuser | two knurled wheel pairs plus a coaxial r 56.1–67.4 mm body, 60.6–73.7 mm off the axis |
| finderScope | the two parts riding 31 mm higher than the focuser, out of the light path |
| mount | 30 castings and linkages 119–410 mm off the axis |
| counterweight | 11 parts 622–930 mm off the axis |
| tripod | 9 long members reaching 376–1190 mm from the axis at the ground end |
| hardware | 3 small fittings the measurements do not tie to one assembly |
| unknown | the 6412-face column: 321 mm off the axis, and its bore does not match the tube, so its function is not established |

The one unresolved part is 6412 of 57480 triangles, 11.2% of the face count.

## Optical teaching geometry

**The source contains no optical elements at all.** No fragment has a spherical-cap pair and none is
a two-faced blank with an edge wall, so there is no candidate objective, eyepiece, diagonal or
corrector anywhere. That is recorded as "missing in the original" and the missing elements were
added as separate nodes:

- `objectiveLens`: a cemented doublet, 35 mm blank, 10 mm centre thickness, in the measured front
  throat.
- `eyepieceLensGroup`: a 26 mm biconvex element, 3.5 mm centre thickness, 30 mm focal length.

Both are closed solids with a front surface, a rear surface and an edge wall, centred on the measured
tube axis to better than 2 µm.

The model's own landmarks fix the prescription: the objective has to sit in the front throat and the
eyepiece on the measured coaxial train at the far end, which puts the focal length at 769 mm. The
builder bisects a real meridional sphere trace until the marginal ray crosses the axis on that
plane, then places the eyepiece one eyepiece focal length further along the light path.

| Quantity | Value |
| --- | --- |
| Objective front vertex | s +301.0 mm |
| Focal plane | s −478.0 mm |
| Eyepiece | s −481.5 .. −485.0 mm |
| Focal length | 769 mm |
| Clear semi-aperture | 3.5 mm |
| Magnification | 25.6× |
| Emitted-beam spread inside one bundle | 3.9 mrad |

Known limitations, stated in the interface as well:

- The lens curvature is drawn deeper than the solved one. Fitted to this model the doublet is so
  shallow that it would render as a flat disk, which is the failure the brief warns about. Only the
  drawn surface changes: the aperture, the axis, the focal length and every traced ray keep the
  solved values.
- The two solid discs span the whole bore at s −294..−272 mm. They are kept as measured and labelled
  as baffles or covers, because a solid disc cannot be an optical element.
- The instrument is small: a 7 mm clear aperture on a 769 mm focal length is far slower than any real
  refractor, which is what this model's own proportions allow.
- The eyepiece is a single element, so the emitted beam is parallel to a few milliradians rather
  than perfectly.

No focal ratio, coating or lens prescription is asserted to match any real product.
