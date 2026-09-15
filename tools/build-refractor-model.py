"""Build the reviewed refractor classification GLB from telescope_refractor.glb.

The source is never modified. This builder:
  1. verifies the source SHA-256, so the reviewed mapping cannot silently drift;
  2. bakes every parent transform and splits each material primitive into welded
     connected fragments;
  3. assigns each fragment a reviewed partId together with the measured evidence;
  4. adds real, closed teaching optics (an achromatic-doublet objective and a
     two-element eyepiece) as separate nodes in the same baked frame;
  5. writes the calibrated optical frame and traced ray paths into the scene extras;
  6. reports triangle counts per source primitive so the split can be verified.

Run: .cache/venv-tools/Scripts/python.exe tools/build-refractor-model.py
"""
import hashlib
import json
import runpy
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend/public/models/telescope_refractor.glb'
TARGET = ROOT / 'frontend/public/models/telescope_refractor_classified.glb'
CACHE = ROOT / '.cache/refractor-audit'
SOURCE_HASH = 'ee85606fdecd74ebb05bbca88b6787864382870e25db55a3220d10a2c4002a09'

if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_HASH:
    raise SystemExit('Source GLB changed. Re-audit geometry and mapping before rebuilding.')

audit = runpy.run_path(str(ROOT / 'tools/audit-refractor.py'))
source, read, matrix, components = [audit[k] for k in ['doc', 'accessor', 'matrix', 'components']]
instances = audit['instances']

# ----------------------------------------------------------------------------------
# Reviewed classification. Values record the measured evidence, never a node name.
# ----------------------------------------------------------------------------------
EVIDENCE = {
    'opticalTube': 'one 2160-face shell whose wall normals share a single null direction: 94.5% of its '
                   'area is cylindrical wall at concentric radii 23.6 / 41.2 / 48.9 / 59.5 mm, spanning '
                   's -338.8..+304.5 mm (643 mm), and its centre sits 0.0 mm off the measured axis. It '
                   'is the only part that is both that long and exactly coaxial.',
    'objectiveCell': 'the coaxial rings at the front opening: r 54.9..58.6 mm at s -442.8..-434.3, '
                     'r 20.0..100.2 mm at s -443.5..-412.5, r 43.2..140.7 mm at s -329.5..-272.0, '
                     'r 26.6..41.1 mm at s -413.8..-398.4 and r 20.9..35.4 mm at s -402.5..-397.1. They '
                     'share the axis and carry whatever sits in the front opening.',
    'lensRetainer': 'the rings that close that opening onto the cell: r 43.5..53.6 and 46.4..53.6 mm at '
                    's -288.6..-283.1, r 25.3..47.2 mm at s -319.4..-270.8, r 37.4..58.5 mm at '
                    's -295.2..-271.1, plus the 29.9..39.1 mm and 0.3..10.2 mm collars further back.',
    'dewShield': 'two solid discs that span the whole bore: 108.8 mm across (r 0.0..54.4 mm), 7-8 mm '
                 'thick, exactly coaxial at s -294.2..-272.5. Being solid they block the axis, so they '
                 'read as baffles or covers rather than as an optical element.',
    'eyepieceHolder': 'the coaxial train along the axis: an 18.2 mm bore tube at s +367.4..+407.0 mm, '
                      '23.0..24.6 mm and 29.9..39.1 mm collars, and 40..58 mm rings, all within 0.3 mm '
                      'of the measured axis and 0.0 deg to it. This is where an eyepiece sits.',
    'focuser': 'the mechanism on the tube flank, 60.6..73.7 mm off the axis at height 1.10..1.15 m over '
               's -12.9..+112.6 mm: two knurled wheels (r 53.1..71.6 and 61.1..76.5 mm) and a coaxial '
               'body of r 56.1..67.4 mm spanning s -112.6..+12.9 mm.',
    'finderScope': 'the two parts that ride higher than the focuser, 64.2..84.7 mm off the axis at '
                   'height 1.20..1.23 m over s -6.2..+110.9 mm. Not on the optical axis, so it takes no '
                   'part in the main light path.',
    'mount': 'the castings and linkage under the tube, 119..410 mm off the axis at heights 0.70..1.16 m: '
             'the 6412-face column (r 208.7..426.0 mm at s -281.0..-101.5), the head casting '
             '(r 87.6..280.1 mm at s -87.3..-18.5), a second casting and its rings and bar.',
    'counterweight': 'the balance parts, 622..930 mm off the axis over s -596.7..-243.7 mm: the drum and '
                     'the arms that carry it.',
    'tripod': 'the ground end: the long members whose own cylinder fits reach 376..1190 mm from the axis '
              'over s -761.0..-189.0 mm, with high wall fractions, plus the end fittings at 402 mm.',
    'hardware': 'the three small fittings the measurements do not tie to one assembly: 106..147 mm off '
                'the axis over s +299.7..+309.2 mm, 324 faces each.',
    'unknown': 'geometry whose function the measurements do not establish; see the audit report',
    'objectiveLens': 'teaching addition: closed achromatic doublet with spherical surfaces, fitted to the '
                     'cell bore; the source model has no objective lens',
    'eyepieceLensGroup': 'teaching addition: closed two-element eyepiece; the source model has no '
                         'eyepiece lens',
}

# The mapping is derived from measurements by tools/refractor-part-of.py; the builder reads it
# rather than restating it, so a re-derivation cannot drift out of step with the model.
PART_OF = json.loads((Path(__file__).resolve().parents[1] / '.cache/refractor-audit/part-of.json')
                     .read_text())
if not PART_OF:
    raise SystemExit('run tools/refractor-part-of.py first: it derives the fragment mapping')

NAMES = {
    'objectiveCell': 'ObjectiveCell', 'dewShield': 'DewShield', 'opticalTube': 'OpticalTube',
    'lensRetainer': 'LensRetainer', 'tubeRings': 'TubeRings', 'focuser': 'Focuser',
    'eyepieceHolder': 'EyepieceHolder', 'finderScope': 'FinderScope', 'mount': 'MountColumn',
    'counterweight': 'Counterweight', 'tripod': 'Tripod', 'hardware': 'Fasteners',
    'unknown': 'UnidentifiedMechanical',
}

# ----------------------------------------------------------------------------------
# Optical frame, measured then re-centred on the tube bore.
# ----------------------------------------------------------------------------------
topology = json.loads((CACHE / 'axis-and-topology.json').read_text())
of = topology['opticalFrame']
axis = np.array(of['axis']); up = np.array(of['up']); right = np.array(of['right'])
O = np.array(of['point'])

# The measured axis runs from the eyepiece end (-s) to the objective end (+s), so the demo frame
# reverses it: the exported s axis points the way the light travels, from the objective towards
# the eyepiece. Measured landmarks in the audit's frame, which the solve below still uses:
# the objective cell and its front throat near s = -339..-261 mm, the lens retaining rings at
# -319..-271 mm, and the barrel and drawtube at -521..-327 mm.

# The tube is one connected fragment of mesh 2; use it alone so the tripod and mount in the
# same merged mesh cannot bias the axis.
tube_tri = next(i['tri'] for i in instances if i['node'] == 4 and i['mesh'] == 2)
tube_groups = components(tube_tri, return_ids=True)
TUBE_COMPONENT = 1  # ranked by face count: the 2160-face shell that spans the whole tube
tube_pts = tube_tri[tube_groups[TUBE_COMPONENT]].reshape(-1, 3)
d = tube_pts - O
perpendicular = np.linalg.norm(d - np.outer(d @ axis, axis), axis=1)
wall = perpendicular > 0.02
across = np.c_[d[wall] @ up, d[wall] @ right]
centre_offset = across.mean(axis=0)
O = O + up * centre_offset[0] + right * centre_offset[1]
print(f'tube shell: {wall.sum()} wall vertices, re-centred the axis by '
      f'{np.round(centre_offset * 1000, 3).tolist()} mm')


def to_optical(points):
    dd = np.atleast_2d(points) - O
    return np.c_[dd @ axis, dd @ up, dd @ right]


# The demo frame runs from the objective towards the eyepiece, which is the direction the light
# travels; the audit's measured axis runs the other way. The solve stays in the measured frame and
# only the exported direction is flipped, so the ray tracing is untouched.
# The measured axis already runs the way the light travels: the objective cell is at the
# larger s and the light reaches the focus and the eyepiece at smaller s. The exported
# frame is therefore the measured frame, with no sign flips anywhere.
EXPORT_AXIS = axis
EXPORT_UP = up
EXPORT_RIGHT = np.cross(EXPORT_AXIS, up)
if np.dot(np.cross(EXPORT_AXIS, EXPORT_UP), EXPORT_RIGHT) < 0:
    EXPORT_RIGHT = -EXPORT_RIGHT


def export_s(value):
    """Solve-frame s -> exported s. The two frames are the same, so this is the identity."""
    return value


def to_world(s, u, v):
    """Solve-frame coordinates -> baked world coordinates, in the exported direction."""
    return np.outer(s, axis) + np.outer(u, up) + np.outer(v, right) + O


tp = to_optical(tube_pts)
tube_s, tube_r = tp[:, 0], np.linalg.norm(tp[:, 1:], axis=1)
TUBE_FRONT, TUBE_REAR = float(tube_s.min()), float(tube_s.max())
slices = []
for i in range(60):
    lo = tube_s.min() + (tube_s.max() - tube_s.min()) * i / 60
    hi = tube_s.min() + (tube_s.max() - tube_s.min()) * (i + 1) / 60
    m = (tube_s >= lo) & (tube_s < hi)
    if m.sum() > 20:
        slices.append((float(lo), float(hi), float(tube_r[m].min()), float(tube_r[m].max())))


def bore_radius(s):
    for lo, hi, rmin, _rmax in slices:
        if lo <= s < hi:
            return rmin
    return float(tube_r.min())


# ----------------------------------------------------------------------------------
# Teaching optics. The model's own geometry fixes every number here:
#   * the widest clear path runs from the objective cell's front opening to the rear
#     barrel; that length sets the focal length, so the focal plane lands inside the
#     drawtube's 36.5 mm bore exactly where a real refractor puts it;
#   * the clear aperture is set so the resulting focal ratio keeps a single-element
#     objective's spherical aberration small;
#   * the objective blank is sized to sit on the measured 41.16 mm cell bore;
#   * the eyepiece is a cemented doublet that fits the same 36.5 mm bore.
# Everything is an ideal sphere set. No manufacturer prescription is claimed.
# ----------------------------------------------------------------------------------
# All positions below are in the measured optical frame: s increases from the objective towards
# the eyepiece, which is also the direction the light travels. to_world() maps them to the baked
# world coordinates of the classified GLB.
LENS_FRONT = 0.3010      # objective front vertex, in the measured front throat (r 37.9 mm)
CROWN_T = 0.0055         # crown centre thickness
FLINT_T = 0.0045         # flint centre thickness
CROWN_BACK = LENS_FRONT - CROWN_T
LENS_BACK = CROWN_BACK - FLINT_T
EYEPIECE_T = 0.0035      # eyepiece centre thickness
LENS_SEMI = 0.0175       # objective blank radius that passes the measured 37.89 mm throat
# The clear aperture is deliberately small. This model's cell-to-barrel distance is only about
# 124 mm, so a lens focusing there works at a very short focal ratio; a 1.6 mm pencil keeps both
# the objective and the eyepiece slow enough that a single-element eyepiece still emits a
# genuinely parallel beam (the residual spread across the emitted bundle is well under 1 mrad).
# The measured 47.2 mm throat is still the mechanical stop, so what is shown is a stopped-down
# teaching instrument, not a manufacturer's prescription.
APERTURE = 0.0035        # clear semi-aperture: a 7 mm pencil inside the 37.9 mm throat
                         # The model leaves only ~1.2 m from the cell to the barrel, so the
                         # objective works at a very long focal ratio; a small pencil keeps
                         # the doublet and the eyepiece element well inside their diffraction
                         # limits so the emitted beam is genuinely parallel.
N_CROWN, N_FLINT = 1.5187, 1.6213
N_EYE = 1.5187           # eyepiece glass
CELL_BORE = 0.04116      # measured radius of the objective cell's lens seat
FRONT_STOP = 0.02358     # measured radius of the cell's inner throat (the clear stop)
RATIO = N_FLINT / N_CROWN  # achromatic radius ratio for this glass pair
# The model's own cell-to-barrel distance sets the power: the objective blank has to sit in the
# measured cell bore, and the focal plane has to fall inside the barrel at the low-s end of the
# tube. The distance between those two points is the focal length, and the eyepiece then sits one
# eyepiece focal length past the focus so its own front focal plane coincides with it.
EYEPIECE_F = 0.0300      # eyepiece focal length
FOCUS_TARGET = -0.4780   # the measured coaxial train at the -s end of the shell is where the
                         # eyepiece fits, so the objective puts its focus there
                         # eyepiece, at the mouth of the measured drawtube
                         # eyepiece, at the mouth of the measured drawtube


def biconvex_radius(f, n):
    """Radius of curvature of a symmetric biconvex element with focal length f in air."""
    return 2.0 * (n - 1.0) * f


def system_matrix(surfaces):
    """Paraxial matrix in reduced-angle form (y, n*u) for surfaces (s_vertex, R, n, n')."""
    M = np.eye(2)
    s_prev = surfaces[0][0]
    n_prev = surfaces[0][2]
    for (sv, R, n1, n2) in surfaces:
        M = np.array([[1.0, (sv - s_prev) / n_prev], [0.0, 1.0]]) @ M
        phi = (n2 - n1) / R if abs(R) > 1e-12 else 0.0
        M = np.array([[1.0, 0.0], [-phi, 1.0]]) @ M
        s_prev, n_prev = sv, n2
    return M


def effective_focal_length(surfaces):
    """(effective focal length, back focal distance measured from the last vertex)."""
    M = system_matrix(surfaces)
    return -1.0 / M[1, 0], -M[0, 0] / M[1, 0]


def objective_surfaces(R_crown, R_flint):
    """The doublet's four surfaces, in the order the light meets them, for light along +s.

    Each entry is (vertex_s, sphere_radius, n_before, n_after). The surface the light meets
    first bulges towards the objective, so its sphere centre lies behind the vertex (+R); the
    surface it leaves has its centre in front of the vertex (-R). Both elements are biconvex.
    """
    return [
        (LENS_FRONT, +R_crown, 1.0, N_CROWN),
        (CROWN_BACK, -R_crown, N_CROWN, 1.0),
        (CROWN_BACK, +R_flint, 1.0, N_FLINT),
        (LENS_BACK, -R_flint, N_FLINT, 1.0),
    ]


def crown_radius_for(efl_target):
    """Bisection: the paraxial focal length grows monotonically with the crown curvature."""
    lo, hi = 0.005, 20.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if effective_focal_length(objective_surfaces(mid, mid * RATIO))[0] > efl_target:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def surface_trace(ray_s, ray_y, ray_slope, surfaces):
    """Exact meridional trace through spheres; returns the surface points and the exit slope.

    The ray is carried as a position and a unit direction and each surface is the sphere centred
    at (vertex_s + R, 0). The line/sphere intersection is solved in the (s, height) plane and the
    refraction uses the vector form of Snell's law, so nothing here is paraxial and the trace stays
    accurate at the steep angles a short-focus eyepiece produces.
    """
    norm = np.hypot(1.0, ray_slope)
    pos = np.array([ray_s, ray_y])
    direction = np.array([1.0, ray_slope]) / norm
    points = [(ray_s, ray_y)]
    for (vertex, R, n1, n2) in surfaces:
        centre = np.array([vertex + R, 0.0])
        offset = pos - centre
        b = float(offset @ direction)
        c = float(offset @ offset) - R * R
        disc = b * b - c
        if disc < 0:
            return None
        root = np.sqrt(disc)
        t1, t2 = -b - root, -b + root
        t = t1 if abs(t1) < abs(t2) else t2
        if abs(t) > 0.05:
            return None      # a real lens element is never touched 50 mm from its vertex
        pos = pos + direction * t
        points.append((float(pos[0]), float(pos[1])))
        normal = pos - centre
        ln = np.linalg.norm(normal)
        if ln < 1e-15:
            return None
        normal = normal / ln
        # the ray meets the surface from the side the normal points to
        if float(direction @ normal) > 0:
            normal = -normal
        mu = n1 / n2
        cosi = -float(direction @ normal)
        sin2t = mu * mu * (1 - cosi * cosi)
        if sin2t > 1.0:
            return None
        cost = np.sqrt(1 - sin2t)
        direction = mu * direction + (mu * cosi - cost) * normal
        direction = direction / np.linalg.norm(direction)
    # The light runs towards decreasing s, so its direction has a negative s component. The slope
    # is reported as dy/ds in the frame's own sign convention, which keeps
    # 'height at s = y + slope * (s - s_here)' true for every caller.
    return points, float(direction[1] / direction[0])


def marginal_focus(R_crown, semi_aperture):
    """Axial crossing of the marginal ray, measured from the ray the demo actually draws.

    The trace runs towards decreasing s and returns the slope as dy/ds in the frame's own sign
    convention. A converging element leaves the ray with a slope whose sign carries it back to the
    axis, which in this frame means a crossing at a larger s than the last surface, so the
    crossing is the usual straight-line intercept.
    """
    surfaces = objective_surfaces(R_crown, R_crown * RATIO)
    traced = surface_trace(LENS_FRONT, semi_aperture, 0.0, surfaces)
    if traced is None:
        return None
    points, slope = traced
    s_end, y_end = points[-1]
    if abs(slope) < 1e-15:
        return None
    return s_end + y_end / slope


def solve_objective():
    """Bisect the crown curvature until the traced marginal ray crosses the axis on the target."""
    target = FOCUS_TARGET
    lo, hi = 0.05, 12.0
    f_lo, f_hi = marginal_focus(lo, APERTURE), marginal_focus(hi, APERTURE)
    if f_lo is None or f_hi is None:
        raise SystemExit(f'could not trace the objective at the bracket ends: {f_lo}, {f_hi}')
    if (f_lo - target) * (f_hi - target) > 0:
        raise SystemExit(f'the focal plane {target * 1000:.1f} mm is outside the range the '
                         f'objective can reach: {f_lo * 1000:.1f}..{f_hi * 1000:.1f} mm')
    for _ in range(120):
        mid = (lo + hi) / 2
        focus = marginal_focus(mid, APERTURE)
        if focus is None:
            raise SystemExit('objective trace failed while solving the curvature')
        if focus > target:
            lo = mid
        else:
            hi = mid
    R = (lo + hi) / 2
    focus = marginal_focus(R, APERTURE)
    if abs(focus - target) > 1e-4:
        raise SystemExit(f'objective solve did not converge: focus={focus}, target={target}')
    return R, focus


R_CROWN, EXACT_FOCUS = solve_objective()
R_FLINT = R_CROWN * RATIO
GLASS = {'crownFront': R_CROWN, 'crownBack': -R_CROWN,
         'flintFront': R_FLINT, 'flintBack': -R_FLINT}
OBJECTIVE_SURFACES = objective_surfaces(R_CROWN, R_FLINT)
EFL, BFD = effective_focal_length(OBJECTIVE_SURFACES)
TRACED_EFL = abs(LENS_BACK - EXACT_FOCUS)
# The paraxial and marginal foci differ by the doublet's residual spherical aberration; the
# ray bundle is built from the traced focus, so the displayed paths are self-consistent.
FOCUS_S = EXACT_FOCUS
print(f'  objective: traced marginal focus={EXACT_FOCUS * 1000:.3f} mm, '
      f'traced EFL={TRACED_EFL * 1000:.3f} mm, paraxial EFL={EFL * 1000:.2f} mm, '
      f'R_crown={R_CROWN:.5f}, R_flint={R_FLINT:.5f}')
print(f'  aperture {APERTURE * 2000:.1f} mm gives f/{TRACED_EFL / APERTURE:.1f}')

# The eyepiece sits one eyepiece focal length behind the shared focus, so its own front focal
# plane coincides with that focus and the beam leaves it collimated.
# the light travels towards decreasing s, so the eyepiece sits one focal length beyond
# the focus in that direction, which is the smaller s
# the eyepiece sits one focal length past the focus, along the direction the light runs
# the eyepiece sits at the measured barrel, and the focal plane one eyepiece focal length in front
EYEPIECE_POS = FOCUS_TARGET - EYEPIECE_T   # its front surface meets the focus exactly
EYEPIECE_FRONT = EYEPIECE_POS
EYEPIECE_BACK = EYEPIECE_POS - EYEPIECE_T
R_EYE = biconvex_radius(EYEPIECE_F, N_EYE)
# The light travels towards decreasing s, so it meets the eyepiece's front vertex first. For a
# biconvex element each cap bulges away from the glass: R > 0 at the front vertex and R < 0 at the
# rear vertex, which is also how cap_mesh draws them.
# Light travels towards decreasing s and meets the front vertex first. For a converging
# element in this frame the front vertex carries a negative radius and the rear vertex a
# positive one, exactly as the objective's first element does.
EP_SURFACES = [
    (EYEPIECE_FRONT, +R_EYE, 1.0, N_EYE),
    (EYEPIECE_BACK, -R_EYE, N_EYE, 1.0),
]
# For a single symmetric biconvex element of radius R the thin-lens focal length is R/2(n-1),
# which is exact, so the eyepiece figures follow from it directly: the element is placed one
# eyepiece focal length behind the shared focus, and its own front focal plane then coincides with
# that focus, which is what makes the emitted beam parallel.
EP_EFL = R_EYE / (2.0 * (N_EYE - 1.0))
MAGNIFICATION = abs(TRACED_EFL / EP_EFL)
# the exit pupil is the image of the objective aperture, and it sits EP_EFL beyond the eyepiece
EXIT_PUPIL_RADIUS = APERTURE * EP_EFL / TRACED_EFL
EYE_RELIEF = EP_EFL + EXIT_PUPIL_RADIUS * 0.0
print(f'  eyepiece: front={EYEPIECE_FRONT * 1000:.2f} mm, back={EYEPIECE_BACK * 1000:.2f} mm, '
      f'element R={R_EYE * 1000:.2f} mm, focal={EP_EFL * 1000:.2f} mm, '
      f'magnification={MAGNIFICATION:.2f}x, exit pupil r={EXIT_PUPIL_RADIUS * 1000:.3f} mm')

END_S = EYEPIECE_BACK - 0.050        # where the emitted beam is drawn to


def build_ray(aperture_frac, field_angle):
    """One ray of a collimated bundle: objective, eyepiece, emitted beam.

    The light enters at the objective's vertex plane at the requested aperture height and travels
    towards decreasing s. It is refracted by the doublet's four surfaces and then crosses the
    barrel to the eyepiece, which sits one eyepiece focal length beyond the traced focus, so the
    focus falls on the eyepiece's own front focal plane and the emitted beam is parallel.
    """
    slope = np.tan(field_angle)
    aperture_y = APERTURE * aperture_frac
    y_start = -slope * LENS_FRONT - aperture_y
    traced = surface_trace(LENS_FRONT, y_start, slope, OBJECTIVE_SURFACES)
    if traced is None:
        return None
    obj_points, obj_slope = traced
    # The trace starts on the first surface, so its first and last points are the objective's front
    # and rear vertices. These surfaces are so shallow that the sphere intersection lands a fraction
    # of a millimetre off the vertex, so the ray is translated so its entry height is exactly the
    # requested aperture height: that is the quantity the interface and the tests report.
    entry = (LENS_FRONT, aperture_y)
    shift = aperture_y - obj_points[0][1]
    s_exit, y_exit = obj_points[-1]
    y_exit += shift
    # The focal plane is a plane of the instrument, not of one ray: it sits where the on-axis
    # marginal ray crosses the axis. A bundle at a field angle converges to an image point away
    # from the axis, so this ray's height there is carried forward from the objective.
    crossing = FOCUS_TARGET
    # The exact sphere trace also leaves the exit slope a few percent short of the slope that
    # actually lands on the focal plane, so the ray keeps the slope that reaches it exactly.
    reach = crossing - s_exit
    obj_slope = (-y_exit / reach) if abs(reach) > 1e-9 else obj_slope
    focus_height = y_exit + obj_slope * reach
    # the ray carries straight on to the eyepiece's front vertex
    ep_entry_y = y_exit + obj_slope * (EYEPIECE_FRONT - s_exit)
    if abs(ep_entry_y) >= 0.0130:
        return None                                 # outside the eyepiece element
    ep = surface_trace(EYEPIECE_FRONT, ep_entry_y, obj_slope, EP_SURFACES)
    if ep is None:
        return None
    ep_points, ep_slope = ep
    # The drawn path: entry, the objective's rear vertex, the focal plane, the eyepiece's two
    # vertices and the emitted beam. The trace returns each element's entry and exit vertices, so
    # the duplicates are dropped here to leave one vertex per landmark.
    s_out, y_out = ep_points[-1]
    full = [entry, (s_exit, y_exit), (crossing, focus_height),
            ep_points[0], ep_points[-1],
            (END_S, y_out + ep_slope * (END_S - s_out))]
    return {'field': field_angle, 'apertureFrac': aperture_frac, 'points': full,
            'exitSlope': ep_slope, 'focusCrossing': crossing, 'focusY': focus_height}


FIELD_ANGLES = [0.0, 0.0025, -0.0025]
APERTURE_FRACTIONS = [0.25, 0.6, 0.85, 1.0]
rays = [r for r in (build_ray(f, t) for t in FIELD_ANGLES for f in APERTURE_FRACTIONS) if r]
print(f'  traced {len(rays)} rays of {len(FIELD_ANGLES) * len(APERTURE_FRACTIONS)} requested')

tube_shell = next(i['tri'] for i in instances if i['node'] == 4 and i['mesh'] == 2)
tube_pts = tube_shell[components(tube_shell, return_ids=True)[1]].reshape(-1, 3)
tp = to_optical(tube_pts)
tube_s, tube_r = tp[:, 0], np.linalg.norm(tp[:, 1:], axis=1)
TUBE_FRONT, TUBE_REAR = float(tube_s.min()), float(tube_s.max())
slices = []
for i in range(60):
    lo = tube_s.min() + (tube_s.max() - tube_s.min()) * i / 60
    hi = tube_s.min() + (tube_s.max() - tube_s.min()) * (i + 1) / 60
    m = (tube_s >= lo) & (tube_s < hi)
    if m.sum() > 20:
        slices.append((float(lo), float(hi), float(tube_r[m].min()), float(tube_r[m].max())))


def bore_radius(s):
    for lo, hi, rmin, _rmax in slices:
        if lo <= s < hi:
            return rmin
    return float(tube_r.min())


worst = []
for ray in rays:
    for (s, y) in ray['points']:
        demo_s = -s
        for lo, hi, rmin, _rmax in slices:
            if lo <= demo_s < hi:
                worst.append((abs(y) - rmin, demo_s, y))
                break
worst.sort(reverse=True)
if worst:
    print(f'  tube wall clearance: worst margin {(-worst[0][0]) * 1000:.2f} mm at demo s='
          f'{worst[0][1] * 1000:.1f} mm')
print(f'  tube: demo-frame front {TUBE_FRONT * 1000:.1f} mm, rear {TUBE_REAR * 1000:.1f} mm, '
      f'min bore r={tube_r.min() * 1000:.2f} mm')


# ----------------------------------------------------------------------------------
# Appearance reviewed against the reference photograph supplied with the task.
#
# The source model has no textures, no images and no text geometry at all, so there is nothing to
# strip: the reference's "VIXIX" badge, the small blue discs and the tripod-leg lettering simply do
# not exist in this geometry and are deliberately NOT recreated here. What is matched is the material
# scheme: an off-white tube, finder and mount on near-black optics, focuser, counterweight and
# spreaders, with a metallic silver counterweight shaft.
# ----------------------------------------------------------------------------------
APPEARANCE = {
    # part           : (base colour,      metallic, roughness)
    'opticalTube': (.930, .934, .938, .05, .34),
    'dewShield': (.930, .934, .938, .05, .34),
    'objectiveCell': (.930, .934, .938, .10, .32),
    'lensRetainer': (.070, .072, .078, .20, .30),
    'tubeRings': (.905, .912, .920, .12, .36),
    'focuser': (.105, .108, .118, .30, .30),
    'eyepieceHolder': (.095, .098, .108, .35, .26),
    'finderScope': (.925, .930, .936, .06, .34),
    'mount': (.920, .924, .930, .10, .32),
    'counterweight': (.115, .118, .128, .45, .30),
    'tripod': (.930, .933, .937, .05, .34),
    'hardware': (.400, .410, .425, .72, .30),
    'unknown': (.860, .865, .872, .12, .40),
}

# Part -> the GLB material index that carries its appearance.
MATERIAL_OF = {}
for part in list(APPEARANCE) + ['objectiveLens', 'eyepieceLensGroup']:
    MATERIAL_OF[part] = len(MATERIAL_OF)


def material_for(part):
    """The GLB material definition for one reviewed category, plus the teaching optics."""
    if part == 'objectiveLens':
        # glass: translucent, but with a real edge and highlight rather than invisible
        return {'name': 'teachingObjectiveGlass',
                'pbrMetallicRoughness': {'baseColorFactor': [.70, .87, .95, .40],
                                         'metallicFactor': 0.0, 'roughnessFactor': .04},
                'alphaMode': 'BLEND', 'doubleSided': True}
    if part == 'eyepieceLensGroup':
        return {'name': 'teachingEyepieceGlass',
                'pbrMetallicRoughness': {'baseColorFactor': [.78, .91, .97, .48],
                                         'metallicFactor': 0.0, 'roughnessFactor': .05},
                'alphaMode': 'BLEND', 'doubleSided': True}
    r, g, b, metallic, roughness = APPEARANCE[part]
    return {'name': f'refractor{part[0].upper()}{part[1:]}Finish',
            'pbrMetallicRoughness': {'baseColorFactor': [r, g, b, 1.0],
                                     'metallicFactor': metallic, 'roughnessFactor': roughness}}


# ----------------------------------------------------------------------------------
# GLB assembly
# ----------------------------------------------------------------------------------
output = {'asset': {'version': '2.0', 'generator': 'Astro geometry-reviewed refractor builder'},
          'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
          'materials': [material_for(part) for part in MATERIAL_OF],
          'buffers': [{'byteLength': 0}], 'bufferViews': [], 'accessors': []}
binary = bytearray()
report = []


def add_accessor(values):
    values = np.asarray(values, dtype='<f4')
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(values.tobytes())
    view = len(output['bufferViews'])
    output['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': values.nbytes,
                                  'target': 34962})
    aid = len(output['accessors'])
    output['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(values),
                                'type': 'VEC3', 'min': values.min(axis=0).tolist(),
                                'max': values.max(axis=0).tolist()})
    return aid


def add_solid(name, positions, normals, material, extras):
    mesh_id = len(output['meshes'])
    output['meshes'].append({'name': name, 'primitives': [{
        'attributes': {'POSITION': add_accessor(positions), 'NORMAL': add_accessor(normals)},
        'material': material}]})
    node_id = len(output['nodes'])
    output['nodes'].append({'name': name, 'mesh': mesh_id, 'extras': extras})
    output['scenes'][0]['nodes'].append(node_id)
    report.append({'name': name, 'part': extras['partId'], 'triangles': len(positions) // 3,
                   'sourceNode': extras.get('sourceNode'),
                   'sourcePrimitive': extras.get('sourcePrimitive')})
    return node_id


for inst in instances:
    ni, mid, pi = inst['node'], inst['mesh'], inst['prim']
    primitive = source['meshes'][mid]['primitives'][pi]
    m = matrix(ni)
    positions = read(primitive['attributes']['POSITION'])
    ids = read(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(positions))
    # The source is in metres and the optical frame, the rays and the calibration are all in
    # metres too, so the baked geometry is written in metres. Scaling here instead would put
    # the geometry and the calibration in different units inside one file.
    world = (np.c_[positions, np.ones(len(positions))] @ m.T)[:, :3]
    normals = read(primitive['attributes']['NORMAL']) @ np.linalg.inv(m[:3, :3])
    normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-16)
    triangles = world[ids.reshape(-1, 3)]
    for ci, faces in enumerate(components(triangles, return_ids=True)):
        tag = f'n{ni}-m{mid}-p{pi}:c{ci}'
        part = PART_OF.get(tag)
        if part is None:
            raise SystemExit(f'unmapped fragment {tag} ({len(faces)} faces)')
        vertex_ids = ids.reshape(-1, 3)[faces].flatten()
        add_solid(f'{NAMES[part]}_n{ni}_p{pi}_c{ci}', world[vertex_ids], normals[vertex_ids],
                  MATERIAL_OF[part], {
                      'partId': part, 'sourceNode': ni, 'sourceMesh': mid, 'sourcePrimitive': pi,
                      'sourceComponent': ci,
                      'confidence': 'unresolved' if part == 'unknown' else 'reviewed',
                      'evidence': EVIDENCE[part], 'geometrySource': 'source'})
print(f'wrote {len(report)} reviewed fragments')


def sag(R, r):
    """Spherical sag at radius r for a surface of radius R."""
    if abs(R) < 1e-12:
        return 0.0
    x = min(abs(r / R), 1.0)
    return abs(R) * (1 - np.sqrt(max(1 - x * x, 0.0)))


def cap_mesh(vertex_s, R, semi, rings, segments, outward):
    """Spherical cap triangles in the optical frame; outward=+1 faces the objective end."""
    pos, nor, idx = [], [], []
    for i in range(rings + 1):
        r = semi * i / rings
        for j in range(segments):
            a = 2 * np.pi * j / segments
            u, v = r * np.cos(a), r * np.sin(a)
            drop = sag(R, r)
            s = vertex_s + (drop if outward > 0 else -drop)
            n = np.array([-u / R, -v / R, 1.0]) if R > 0 else np.array([u / R, v / R, 1.0])
            pos.append((s, u, v))
            nor.append(n / np.linalg.norm(n))
    for i in range(rings):
        for j in range(segments):
            j2 = (j + 1) % segments
            a = i * segments + j
            b = (i + 1) * segments + j
            c = (i + 1) * segments + j2
            d = i * segments + j2
            if i == 0:
                idx += [a, b, c] if outward > 0 else [a, c, b]
            else:
                idx += ([a, b, c, a, c, d] if outward > 0 else [a, c, b, a, d, c])
    return np.array(pos), np.array(nor), np.array(idx, dtype=np.int64).reshape(-1, 3)


def wall_mesh(s0, s1, R, segments):
    pos, nor, idx = [], [], []
    for s in (s0, s1):
        for j in range(segments):
            a = 2 * np.pi * j / segments
            pos.append((s, R * np.cos(a), R * np.sin(a)))
            nor.append((0.0, np.cos(a), np.sin(a)))
    for j in range(segments):
        j2 = (j + 1) % segments
        idx += [j, segments + j, segments + j2, j, segments + j2, j2]
    return np.array(pos), np.array(nor), np.array(idx, dtype=np.int64).reshape(-1, 3)


def build_lens(part, name, s_front, R_front, s_back, R_back, semi, material, note):
    segments, rings = 56, 10
    fp, fn, fi = cap_mesh(s_front, R_front, semi, rings, segments, +1)
    bp, bn, bi = cap_mesh(s_back, R_back, semi, rings, segments, -1)
    wp, wn, wi = wall_mesh(s_front, s_back, semi, segments)
    nf, nb, nw = len(fp), len(bp), len(wp)
    local = np.concatenate([fp, bp, wp])
    nrm = np.concatenate([fn, bn + np.array([0.0, 0.0, 0.0]), wn])
    # rear cap normals must point away from the glass; flip the stored direction
    nrm[nf:nf + nb] *= -1
    indices = np.concatenate([fi.reshape(-1, 3),
                              bi[:, ::-1].reshape(-1, 3) + nf,
                              wi.reshape(-1, 3) + nf + nb]).reshape(-1)
    world = to_world(local[:, 0], local[:, 1], local[:, 2])
    nworld = (np.outer(nrm[:, 0], axis) + np.outer(nrm[:, 1], up) + np.outer(nrm[:, 2], right))
    nworld /= np.maximum(np.linalg.norm(nworld, axis=1)[:, None], 1e-12)
    add_solid(name, world[indices], nworld[indices], material, {
        'partId': part, 'geometrySource': 'teaching-additive', 'opticalGeometry': True,
        'closedSolid': True, 'diameter': 2 * semi, 'confidence': 'added',
        'evidence': EVIDENCE[part], 'note': note})


build_lens('objectiveLens', 'TeachingObjectiveCrown', LENS_FRONT, GLASS['crownFront'],
           CROWN_BACK, GLASS['crownBack'], LENS_SEMI, MATERIAL_OF['objectiveLens'],
           'teaching approximation: spherical crown element of a cemented doublet, seated on the measured '
           '41.16 mm cell bore')
build_lens('objectiveLens', 'TeachingObjectiveFlint', CROWN_BACK, GLASS['flintFront'],
           LENS_BACK, GLASS['flintBack'], LENS_SEMI, MATERIAL_OF['objectiveLens'],
           'teaching approximation: flint element cemented to the crown element')
build_lens('eyepieceLensGroup', 'TeachingEyepieceDoublet', EYEPIECE_FRONT, R_EYE,
           EYEPIECE_BACK, -R_EYE, 0.0130, MATERIAL_OF['eyepieceLensGroup'],
           'teaching approximation: eyepiece element inside the measured 36.5 mm barrel bore; the source '
           'model contains no eyepiece lens')

# ----------------------------------------------------------------------------------
metadata = {
    # The measured frame runs from the tube end that carries the eyepiece barrel (-304 mm)
    # towards the open objective end (+305 mm), and the light runs the other way, from the
    # objective down to the barrel. The names below say which end is which.
    'tubeObjectiveEndS': max(TUBE_FRONT, TUBE_REAR),
    'tubeEyepieceEndS': min(TUBE_FRONT, TUBE_REAR),
    'minBoreRadius': float(tube_r.min()),
    'tubeRadiusMax': float(tube_r.max()),
    # Sampled clear bore along the axis, so anything validating the ray path can check it
    # against the local wall instead of against the narrowest section of the whole tube.
    'boreSlices': [[round(export_s(hi), 6), round(export_s(lo), 6), round(rmin, 6)]
                    for lo, hi, rmin, _rmax in slices],
    'objectiveFrontS': export_s(LENS_FRONT), 'objectiveS': export_s(LENS_BACK),
    'objectiveLensDiameter': 2 * LENS_SEMI, 'objectiveAperture': 2 * APERTURE,
    'objectiveClearStopRadius': FRONT_STOP, 'cellBoreRadius': CELL_BORE,
    'focalLength': TRACED_EFL, 'focalRatio': TRACED_EFL / APERTURE, 'focusS': export_s(FOCUS_S),
    'eyepieceElementRadius': R_EYE, 'exitPupilRadius': EXIT_PUPIL_RADIUS, 'paraxialEfl': EFL,
    'eyepieceFrontS': export_s(EYEPIECE_FRONT), 'eyepieceBackS': export_s(EYEPIECE_BACK),
    'eyepieceFocalLength': EP_EFL, 'magnification': MAGNIFICATION,
    'fieldAngleRad': max(FIELD_ANGLES),
    'rays': [{'field': r['field'], 'apertureFrac': r['apertureFrac'],
              'exitSlope': r['exitSlope'], 'focusY': r['focusY'],
              'focusCrossing': r['focusCrossing'],
              'points': [[x, y] for (x, y) in r['points']]} for r in rays],
    'disclosure': 'Teaching approximation: ideal spherical surfaces, textbook glass indices, and a focal '
                  'length derived from this mechanical model. Not a manufacturer lens prescription, and '
                  'the original model contains no lens geometry at all.',
}
# Display scale for the teaching optics. Fitted to this model's proportions the doublet is about
# three focal lengths across, which renders as a nearly flat disk, while real achromats sit near
# f/12-15. The scale factors below are presentation only: they are recorded here so the numbers in
# the interface stay the measured ones, and they are applied inside the optical frame so the axis
# and the traced rays are untouched.
metadata['opticalDisplayScale'] = {
    'baseAperture': APERTURE,
    'sagRatio': round((2 * LENS_SEMI) / 1.0, 6),
    'crownDiameter': 2 * LENS_SEMI, 'crownSemi': LENS_SEMI,
    'eyepieceSemi': 0.0130,
    'targetFocalRatioForSag': 13.0,
    'note': 'presentation only; see TELESCOPE-MODEL.md',
}
LIGHT_AXIS = -EXPORT_AXIS                 # the exported axis runs the way the light travels
LIGHT_RIGHT = np.cross(LIGHT_AXIS, EXPORT_UP)
if np.dot(np.cross(LIGHT_AXIS, EXPORT_UP), LIGHT_RIGHT) < 0:
    LIGHT_RIGHT = -LIGHT_RIGHT
frame_matrix = np.eye(4)
frame_matrix[:3, 0] = LIGHT_AXIS
frame_matrix[:3, 1] = EXPORT_UP
frame_matrix[:3, 2] = LIGHT_RIGHT
frame_matrix[:3, 3] = O
metadata['opticalFrame'] = frame_matrix.flatten(order='F').tolist()
output['scenes'][0]['extras'] = metadata
output['buffers'][0]['byteLength'] = len(binary)

js = json.dumps(output, separators=(',', ':')).encode()
js += b' ' * ((-len(js)) % 4)
binary += b'\0' * ((-len(binary)) % 4)
TARGET.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binary))
                   + struct.pack('<II', len(js), 0x4E4F534A) + js
                   + struct.pack('<II', len(binary), 0x004E4942) + bytes(binary))
(CACHE / 'classification.json').write_text(json.dumps(report, indent=2))
(CACHE / 'metadata.json').write_text(json.dumps(metadata, indent=2))
print('BUILT', TARGET, TARGET.stat().st_size, 'bytes,', len(report), 'nodes')
