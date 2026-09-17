# Refractor telescope geometry review

## Reference vocabulary

The classification follows the component diagrams in Sky-Watcher's official equatorial refractor
manuals. They identify the optical-tube assembly as sun shade, objective lens, main body, tube
rings, finder and bracket, focus tube/knob, diagonal and eyepiece; the support assembly is split into
equatorial mount, controls/locks, counterweight rod and weight, tripod and accessory-tray/spreader
parts.

- [EQ3-2 / EQ5 telescope parts diagram](https://inter-static.skywatcher.com/upfiles/en_download_caty01316546576.pdf)
- [HEQ5 refractor parts diagram](https://inter-static.skywatcher.com/upfiles/en_download_caty01316546253.pdf)
- [Equatorial-mount assembly guide](https://inter-static.skywatcher.com/upfiles/en_download_caty01461887945.pdf)

These references provide the vocabulary. The assignments themselves come from the source model's
shape and assembled position, not from resemblance to one particular commercial product.

## Source and review method

`telescope_refractor.glb` remains unchanged. It has 16 nodes, 8 meshes, 87 connected fragments and
57,480 triangles. Its generated `Obj3d66-632255-*` names and six `fallback Material` entries carry no
functional information, so names and materials are deliberately excluded from classification.

The review uses four kinds of geometric evidence:

1. relation to the main optical axis;
2. order from the large objective end to the small eyepiece end;
3. repeated shape, such as three legs, two tube rings or paired focus knobs;
4. physical connection to neighbouring parts in the complete assembly.

Run the reproducible pipeline with:

| Command | Purpose |
| --- | --- |
| `tools/audit-refractor.py` | bake transforms, split connected fragments and produce review renders |
| `tools/refractor-measure-parts.py` | record axial/radial measurements for every fragment |
| `tools/refractor-classify.py` | validate a one-to-one assignment for all 87 fragments |
| `tools/build-refractor-model.py` | write `telescope_refractor_classified.glb` with reviewed `partId` values |

The builder verifies the source SHA-256 and stops if the original geometry changes. The part renderer
shows each selected fragment in assembly context and fits the camera to the full model, which avoids
mistaking a small knob for a large standalone part.

## Corrected orientation

The objective is the large-aperture end. It contains two 108.8 mm convex, coaxial optical blanks
inside a large stepped cell and sun shade. The opposite end contains the drawtube, paired focus
controls, an angled diagonal and the small eyepiece lens. The teaching frame is fitted from these
source landmarks, so its positive direction always runs from the objective towards the viewing end.

The off-axis optical train above the tube contains two small glass lenses and three radial alignment screws,
so it is the finder. Beneath the tube, two large split rings and longitudinal plates form the tube-ring
and dovetail assembly. The intersecting castings below that are the equatorial head. A long shaft runs
from its declination axis to one circular weight. Three repeated two-section legs, three spreader rods
and a central polygonal hub form the tripod.

## Reviewed categories

| ID | Fragments | Shape and position evidence |
| --- | ---: | --- |
| `opticalTube` | 1 | 643 mm continuous coaxial shell; enlarged objective end also forms the sun shade |
| `objectiveCell` | 1 | stepped coaxial collar directly around the objective pair |
| `objectiveLens` | 2 | two large convex coaxial elements at s −294.2…−272.5 mm |
| `tubeRings` | 5 | two split rings, curved saddle and dovetail plates |
| `fasteners` | 24 | screws, nut-like thumb fasteners, clamping knobs and one locking lever |
| `finderScope` | 7 | parallel off-axis mini-telescope with two lenses, barrel, bracket and tube-mounted shoe |
| `focuser` | 6 | rear coaxial tube/body and paired focus wheels |
| `diagonal` | 3 | angled housing and oblique reflecting surface |
| `eyepieceLensGroup` | 2 | small convex lens and its separate black barrel at the viewing end |
| `mount` | 9 | equatorial-axis castings and adjustment structures |
| `counterweight` | 2 | circular weight and long shaft |
| `tripod` | 25 | six leg sections, feet, three spreaders, connectors and central hub |

All 87 source fragments belong to one of these 12 categories. There is no residual `unknown` bucket.
The reviewed fasteners form their own mechanical category so they can be selected and isolated as a
single group in structure mode.

## Optical roles and fastener classification

The two source fragments in `eyepieceLensGroup` have distinct roles. `Eyepiece_n12_p0_c3` is the
transparent eyepiece glass. `Eyepiece_n14_p0_c4` is its opaque outer barrel and therefore uses the
black hardware finish. `FinderScope_n14_p0_c3` and `FinderScope_n14_p0_c7` are also barrel sections,
not finder glass, and use the same black finish.

`FinderScope_n12_p0_c2` and `FinderScope_n12_p0_c5` are the two finder lenses. They use a separate
blue-green translucent glass material so the finder optics read as glass while the finder barrel and
alignment hardware remain opaque.

Fasteners use `partId: fasteners`, `hardwareClass: fastener` and a reviewed `fastenerType`:

| Fastener type | Fragments | Typical location |
| --- | ---: | --- |
| `screw` | 10 | finder alignment, tube-ring clamp, focuser and diagonal retention |
| `clampingKnob` | 13 | finder bracket, mount, tube rings, counterweight and tripod leg clamps |
| `lockLever` | 1 | tripod spreader / central lock |

All 24 fasteners use the opaque black hardware material. `FinderScope_n14_p0_c6` is included as a
finder-bracket clamping knob.

## Teaching optics

The source objective, finder optics, diagonal surface and eyepiece remain part of the structural
classification. The ray lesson also contains three generated closed solids for its idealised
spherical objective/eyepiece calculation. These generated meshes carry
`geometrySource: teaching-additive` and are excluded from the structure-mode part index; they appear
only in optics mode. Their prescription is a teaching approximation and does not claim to reproduce a
manufacturer design.

The published optical frame follows the physical light direction: `s` increases from the source
objective front and rear vertices, through the focal plane, to the source eyepiece. The lesson draws
18 calibrated rays, checks aperture,
focus residual, exit parallelism and tube-wall clearance, and reports those values in the panel.
The teaching blank is anchored to the reviewed objective and uses a 72 mm representative clear stop,
which keeps the displayed ray fan proportional to the reviewed objective instead of collapsing it into
an axial line.
Structure mode also exposes the shared geometry-diagnostics overlay used by the Newtonian demo;
it lists source nodes and the three teaching meshes with bounds in model coordinates.
