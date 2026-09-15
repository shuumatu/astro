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

Each source-derived output node has a descriptive name and `extras.partId`, `sourceNode`,
`sourceMesh`, `sourcePrimitive`, and `sourceComponent` for traceability. Fragment
counts are not counts of independently manufactured parts. Automated tests check
that every source primitive retains its original triangle count.
Newly modeled pieces instead carry `generatedGeometry: true`; they are not misrepresented as original source parts.

## Reviewed categories

| ID | Geometric evidence |
| --- | --- |
| tube | Long cylindrical shell, front opening rings and curved shell patches |
| spider | Thin cross and central hub at the front, near positive tube-axis X |
| mirrorCell | Rear ring, cross and central support near negative tube-axis X |
| primaryMirror | Added concave parabolic optical surface at the rear of the tube |
| secondaryMirror | Added thin flat elliptical optical surface at the Newtonian diagonal |
| secondaryHolder | Added inclined oval mirror cup, coaxial rear shell, rounded triangular collimation plate, central pull stem/nut, and three push-screw + spring + washer/socket sets; each adjuster spans the plate and spider hub |
| finder | Small independent telescope above the main tube and its stalk/base |
| focuser | Side barrel, eyepiece housing, double handwheels and curved mounting base |
| rings | Two circumferential rings, clamp screws and connecting saddle |
| mount | Equatorial-axis housings, base and adjustment handles |
| counterweight | Long shaft and four stacked circular weights |
| tripod | Three long legs and central tie rod |
| tray | Perforated accessory tray and radial braces |
| hardware | Small bolts, hexagonal nuts/caps and fastening knobs |

These are visual/positional identifications, not a manufacturer-supplied parts list.
The former internal perforated disk was removed from the classified output because
its function was unverified and it obstructed the teaching light path.

## Optical teaching geometry

`scenes[0].extras.opticalFrame` transforms the source tube frame into baked model
coordinates. `optics.ts` uses this frame for all mirrors, rays and focal geometry;
normalizing the model cannot scale the optical overlays a second time.

The added primary is an ideal paraboloid. The elliptical flat secondary uses the
bisector normal of the incident and folded axes. The ray segments are computed from
the paraboloid to its unfolded focus, intersected with the secondary plane, then
folded to the focal point in the side focuser. Tests verify both reflection laws
and that every displayed ray intersects the rendered secondary ellipse.

The supplied model is now free of that obstruction. This is **not** evidence that
the supplied mechanical model forms a working telescope. No focal ratio, optical coating, or eyepiece lens
prescription is asserted to match a real product.

The two optical surfaces are also real, closed, non-zero-thickness solid nodes in `telescope_newtonian_classified.glb`
(`extras.partId` is `primaryMirror` or `secondaryMirror`), so they can be selected
and isolated in mechanical mode. Both application views now use these **same GLB
solids**; the optics layer adds rays/arrows only, not duplicate mirror surfaces.

`optical-spec.json` is the single prescription consumed by the Python solid builder
and TypeScript ray tracer, and copied into GLB extras for a stale-asset check.
The secondary's reflecting face is exactly at `secondary`; the entire mirror blank
extends behind that plane, toward its holder. The normal bisects the +X incident
axis and direction toward `focus`. This also corrects the previous builder's
incorrect focus X=0 and independently hard-coded primary focal length.

The holder architecture is informed by public Newtonian holder references including [Protostar's installation guide](https://www.fpi-protostar.com/ftp/instman.pdf)
and [holder/spider FAQ](https://www.fpi-protostar.com/sv-faq.htm): a central connection,
three-point collimation and a mirror-holding body. This implementation is a separate
custom teaching model, not a Celestron or Protostar product replica. The mirror cup
follows the diagonal face; it starts about 0.2 mm behind the mirror's rear plane and is slightly
smaller than the optical blank, leaving the glass edge visible. The rear shell is now a
constant-diameter cylinder with a true oblique (slanted) front cut, rather than a cone or
flat-ended cylinder, preventing intersection with the glass. Its front and rear circular
rims use identical Y/Z points; only X changes at the oblique cut, so every cylindrical
generator is exactly parallel to the incoming +X light. The rounded triangular
adjustment plate, central pull stem and spider hub are
coaxial with the tube. Each of the three push/pull screws
has a visible spring and terminates inside the hub collar, so no screw is suspended or
blocked by a spider vane. Screws are static teaching geometry, not functional CAD
constraints. Body chamfers, cap thickness and washers are modeled; manufacturing
screw threads and adhesive deformation are not simulated.

I also searched public model indexes and repository search results for downloadable
Newtonian secondary-holder STL/STEP/OBJ assets. The results were either unavailable,
unclear-license product renders, or holder designs with incompatible tube diameters;
none could be safely imported as a verified real part. Therefore the current holder
is intentionally an independently authored model with explicit mechanical semantics,
not an invented attribution to another product.

Regression tests raycast against the actual GLB mirror faces, compare their normals
to the ray prescription, check all eight displayed beams clear the added holder,
and validate closed, consistently wound triangle topology for every generated solid.

To inspect geometry offline, run `node frontend/scripts/export-telescope-audit.mjs`
(Node 24+) and `python tools/render-telescope-projection.py`. Classification atlases
and optical projections are generated under `.cache/telescope-audit/`. These images
are geometric QA aids, not browser screenshots.
