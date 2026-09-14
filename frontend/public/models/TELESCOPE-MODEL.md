# Telescope geometry review

## Source and reproducibility

`telescope_newtonian_reflector.glb` is retained unchanged by the geometry-splitting builder.
The source has opaque/previously assigned names, 15 meshes, and repeated mesh instances.
In particular, mesh 0 is the mount base; mesh 1 combines the tube, finder, focuser,
mount, counterweights, and internal structures. Neither a mesh name nor one material
is a reliable functional classification.

Run `python tools/build-telescope-model.py` from the repository root with NumPy and
Pillow installed. The builder checks the source SHA-256 before using its reviewed
mapping, bakes the full parent transforms, and splits material primitives into welded
connected fragments. Tube interior structures require additional triangle-level splits.
It writes `telescope_newtonian_classified.glb`; it does not overwrite the source.

Each output node has a descriptive name and `extras.partId`, `sourceNode`,
`sourceMesh`, `sourcePrimitive`, and `sourceComponent` for traceability. Fragment
counts are not counts of independently manufactured parts. Automated tests check
that every source primitive retains its original triangle count.

## Reviewed categories

| ID | Geometric evidence |
| --- | --- |
| tube | Long cylindrical shell, front opening rings and curved shell patches |
| spider | Thin cross and central hub at the front, near positive tube-axis X |
| mirrorCell | Rear ring, cross and central support near negative tube-axis X |
| internalDisk | Thick circular disk with a central hole inside the middle of the tube |
| finder | Small independent telescope above the main tube and its stalk/base |
| focuser | Side barrel, eyepiece housing, double handwheels and curved mounting base |
| rings | Two circumferential rings, clamp screws and connecting saddle |
| mount | Equatorial-axis housings, base and adjustment handles |
| counterweight | Long shaft and four stacked circular weights |
| tripod | Three long legs and central tie rod |
| tray | Perforated accessory tray and radial braces |
| hardware | Small bolts, hexagonal nuts/caps and fastening knobs |

These are visual/positional identifications, not a manufacturer-supplied parts list.
The internal disk's exact intended function is not established. In particular, its
central hole and flat surfaces are not evidence of a correct Newtonian primary.

## Optical teaching geometry

`scenes[0].extras.opticalFrame` transforms the source tube frame into baked model
coordinates. `optics.ts` uses this frame for all mirrors, rays and focal geometry;
normalizing the model cannot scale the optical overlays a second time.

The added primary is an ideal paraboloid. The elliptical flat secondary uses the
bisector normal of the incident and folded axes. The ray segments are computed from
the paraboloid to its unfolded focus, intersected with the secondary plane, then
folded to the focal point in the side focuser. Tests verify both reflection laws
and that every displayed ray intersects the rendered secondary ellipse.

The original internal disk would obstruct these rays. It is explicitly hidden in
optics mode, with a visible teaching-model disclosure; it remains intact and
selectable in mechanical mode. This is **not** evidence that the supplied mechanical
model forms a working telescope. No focal ratio, optical coating, or eyepiece lens
prescription is asserted to match a real product.

To inspect geometry offline, run `node frontend/scripts/export-telescope-audit.mjs`
(Node 24+) and `python tools/render-telescope-projection.py`. Classification atlases
and optical projections are generated under `.cache/telescope-audit/`. These images
are geometric QA aids, not browser screenshots.
