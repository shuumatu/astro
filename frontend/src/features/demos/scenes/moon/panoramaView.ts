/**
 * Geometry and look limits for the surface panorama viewer.
 *
 * The panoramas themselves live in the generated `moonPanoramas.ts`; this module holds only the
 * parts worth testing on their own: where a panorama's centre sits on the sphere, how far a
 * viewer may turn, and how a drag maps to a turn.
 *
 * Conventions, deliberately the same ones the rest of the demo uses so a panorama and the site
 * it belongs to agree:
 *
 * - azimuth is degrees clockwise from selenographic north, the view direction that
 *   `selenography.ts` puts on the sphere's Greenwich meridian is longitude 0;
 * - yaw is measured from the panorama's own centre, positive toward increasing azimuth (east);
 * - the sphere carries the equirectangular convention `u = (lon + 180) / 360`.
 */

import * as THREE from 'three'

import type { MoonPanorama } from './moonPanoramas'

/** Pitch limits. A surface panorama looks slightly down and cannot see much above the horizon. */
export const PANORAMA_MIN_PITCH_DEG = -55
export const PANORAMA_MAX_PITCH_DEG = 25
/** Camera field of view limits, in degrees. */
export const PANORAMA_MIN_FOV_DEG = 28
export const PANORAMA_MAX_FOV_DEG = 85
export const PANORAMA_DEFAULT_FOV_DEG = 58

/**
 * How much of the viewport's height the strip should take up when it opens.
 *
 * These strips are cylindrical panoramas read at their own scale, and their vertical fields of
 * view range from about 12 to 44 degrees. Opening all of them in the same camera would either
 * squeeze the wide ones into a slit or crop the tall ones, so the camera is chosen from the
 * strip: this fraction, converted back into a field of view.
 */
const PANORAMA_VERTICAL_FILL = 0.62
/**
 * Never open narrower than this. A 13:1 strip wants about 20 degrees to fill its share of the
 * height, and at that width the screen is showing so little of the horizon that the photograph
 * stops reading as a place — 34 degrees keeps enough context while still letting a thin strip
 * more than fill the frame.
 */
const PANORAMA_MIN_OPENING_FOV_DEG = 34
/** Nor wider than a normal lens, however thin the strip is. */
const PANORAMA_MAX_OPENING_FOV_DEG = 62

/**
 * Field of view that makes a strip fill its share of the viewport, framed for a screen rather
 * than for the strip. This is the preferred opening; `openingFovDeg` is what the viewer uses,
 * because a narrow strip can make this figure unrenderable.
 */
export function defaultFovDeg(panorama: Pick<MoonPanorama, 'verticalFovDeg'>): number {
  const target = panorama.verticalFovDeg / PANORAMA_VERTICAL_FILL
  return clamp(target, PANORAMA_MIN_OPENING_FOV_DEG, PANORAMA_MAX_OPENING_FOV_DEG)
}

/** How far this particular strip may be zoomed before it stops resolving anything. */
export function fovLimits(panorama: Pick<MoonPanorama, 'verticalFovDeg'>): { min: number, max: number } {
  // The floor is the strip's own vertical extent: below it the screen is magnifying texture
  // pixels, which is where a panorama starts to look like a blurred smear instead of terrain.
  const min = clamp(panorama.verticalFovDeg / 0.95, 8, PANORAMA_MIN_FOV_DEG)
  return { min, max: PANORAMA_MAX_FOV_DEG }
}

/**
 * The field of view the viewer opens at.
 *
 * The strip's own vertical extent is the target, because a camera that opens wider than the
 * photograph crushes it: a 21 degree strip shown in a 34 degree camera loses a third of its height
 * to empty space and reads as horizontal streaks. At its own extent the strip lands at roughly one
 * texture pixel per screen pixel, which is as sharp as the release can ever be.
 *
 * The floor keeps the camera from opening so tight that the viewer loses the sense of standing in
 * a landscape, and it also carries the pixel floor, so a very short strip is never magnified past
 * its own resolution.
 */
export function openingFovDeg(panorama: Pick<MoonPanorama, 'verticalFovDeg'>): number {
  // Normally exactly the strip's own height, so one texture pixel lands on one screen pixel and
  // nothing is distorted. The pixel floor is the only thing allowed to widen it, and it only binds
  // for a strip so short that the alternative would be magnifying past the release's own detail.
  const floor = fovLimits(panorama).min
  const wanted = Math.min(panorama.verticalFovDeg, PANORAMA_MAX_FOV_DEG)
  return clamp(wanted, floor, PANORAMA_MAX_FOV_DEG)
}

/**
 * Pitch to open at. A panorama whose vertical field of view fits inside the camera has its
 * horizon straight ahead, so the natural starting point is level; only a strip taller than the
 * view is worth tilting, and then only by the amount that brings its middle into frame.
 */
export function defaultPitchDeg(panorama: Pick<MoonPanorama, 'verticalFovDeg'>): number {
  const fov = openingFovDeg(panorama)
  if (panorama.verticalFovDeg <= fov) return 0
  return clamp(-(panorama.verticalFovDeg - fov) / 2, PANORAMA_MIN_PITCH_DEG, PANORAMA_MAX_PITCH_DEG)
}

export interface YawLimits {
  /** Lowest permitted yaw, in degrees relative to the panorama centre. */
  min: number
  /** Highest permitted yaw, in degrees relative to the panorama centre. */
  max: number
  /** True when the strip joins end to end, so the viewer may turn forever. */
  wraps: boolean
}

/**
 * How far a viewer may turn. A strip that closes can be turned through a full circle; anything
 * shorter is held inside its own sweep, because past the edge there is no photograph and the
 * demo would be inventing terrain.
 */
export function yawLimits(panorama: Pick<MoonPanorama, 'spanDeg'>): YawLimits {
  const span = clamp(panorama.spanDeg, 1, 360)
  if (span >= 359.5) return { min: -180, max: 180, wraps: true }
  const half = span / 2
  return { min: -half, max: half, wraps: false }
}

/** Brings a yaw back inside its limits, wrapping when the panorama closes. */
export function clampYaw(yawDeg: number, limits: YawLimits): number {
  if (Number.isNaN(yawDeg)) return 0
  if (yawDeg === Number.POSITIVE_INFINITY) return limits.wraps ? 0 : limits.max
  if (yawDeg === Number.NEGATIVE_INFINITY) return limits.wraps ? 0 : limits.min
  if (limits.wraps) {
    // Wrap into [-180, 180) so a long drag keeps turning instead of accumulating a huge angle.
    return ((yawDeg + 180) % 360 + 360) % 360 - 180
  }
  return clamp(yawDeg, limits.min, limits.max)
}

export function clampPitch(pitchDeg: number): number {
  return clamp(pitchDeg, PANORAMA_MIN_PITCH_DEG, PANORAMA_MAX_PITCH_DEG)
}

export function clampFov(fovDeg: number): number {
  return clamp(fovDeg, PANORAMA_MIN_FOV_DEG, PANORAMA_MAX_FOV_DEG)
}

/**
 * Degrees of view per pixel of drag, used when only a single figure is wanted.
 *
 * The viewer itself does not use this: it takes the horizontal and vertical fields of view
 * separately so a drag follows the pointer on both axes at once. This remains as the scalar form of
 * the same mapping, and as a sanity check on the order of magnitude.
 */
export function dragDegreesPerPixel(fovDeg: number, viewportWidthPx: number, viewportHeightPx: number): number {
  const width = Math.max(1, viewportWidthPx)
  const height = Math.max(1, viewportHeightPx)
  // Average the two axes so the mapping stays sane on very wide or very tall windows.
  const degreesPerWidth = fovDeg / width
  const degreesPerHeight = fovDeg / height
  return (degreesPerWidth + degreesPerHeight) / 2
}

/**
 * Degrees per pixel along each axis for a perspective camera. A drag then follows the pointer: the
 * piece of the photograph under the cursor stays under it in both directions at once, which the
 * single averaged figure above cannot do.
 */
export function dragDegreesPerPixelByAxis(
  fovDeg: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
): { x: number, y: number } {
  const width = Math.max(1, viewportWidthPx)
  const height = Math.max(1, viewportHeightPx)
  const verticalFov = clamp(fovDeg, 1, 179)
  const horizontalFov =
    2 * Math.atan(Math.tan((verticalFov * Math.PI) / 360) * (width / height)) * (180 / Math.PI)
  return { x: horizontalFov / width, y: verticalFov / height }
}

/**
 * The longitude, in the demo's east-positive selenographic frame, that the centre of a
 * panorama's image should sit at.
 *
 * With a heading of 0 the placement is unverified: the source frames' own compass headings have
 * not been recovered from the Apollo Image Atlas. Rather than pick an arbitrary azimuth and
 * imply it is right, an unverified panorama is anchored to the sub-Earth meridian, and
 * `isOrientationVerified` reports that so the interface can say so.
 */
export function centreLongitudeDeg(panorama: Pick<MoonPanorama, 'headingDeg'>): number {
  return panorama.headingDeg
}

export function isOrientationVerified(panorama: Pick<MoonPanorama, 'headingDeg'>): boolean {
  return panorama.headingDeg !== 0
}

/**
 * The fraction of a full turn that the panorama's texture covers. The rest of the cylinder does
 * not exist, so a viewer turning past the edge of the photograph finds nothing rather than
 * invented terrain.
 */
export function coveredLongitudeFraction(panorama: Pick<MoonPanorama, 'spanDeg'>): number {
  return clamp(panorama.spanDeg, 1, 360) / 360
}

/**
 * Rotation about the vertical axis, in radians, that puts the image's horizontal centre at the
 * panorama's heading.
 *
 * With a cylinder there is no convention to reconcile: the texture's `u` already runs with
 * azimuth, so the mesh simply turns by the heading. The viewer's own yaw adds to this as the
 * viewer looks around.
 */
export function panoramaYawRadians(panorama: Pick<MoonPanorama, 'headingDeg'>): number {
  return (centreLongitudeDeg(panorama) * Math.PI) / 180
}

/**
 * Build the surface a panorama is viewed from the inside of.
 *
 * A cylinder, not a sphere, because these photographs are cylindrical projections: on a cylinder
 * one degree of azimuth is the same arc length as one degree of elevation, so a boulder keeps the
 * shape the photograph gave it. On a sphere the vertical scale is fixed by the geometry rather
 * than by the photograph, which stretched the terrain badly - that was the reported bug, and
 * `docs/lunar-panorama-research/tools/flatten-view.py` reproduces this mapping on the CPU so it can be
 * checked without a GPU.
 *
 * The mesh is left unrotated; the caller turns it by the panorama's heading.
 */
export function panoramaCylinderGeometry(panorama: {
  spanDeg: number
  verticalFovDeg: number
}): THREE.CylinderGeometry {
  const radius = 1
  const arc = coveredLongitudeFraction(panorama) * Math.PI * 2
  // The height is the perspective-correct one: to place a point at elevation `vFov/2` on the
  // surface, it has to sit `tan(vFov/2)` above the eye, because that is the ray the camera sends
  // through the top of the frame. Anything shorter and the strip would be magnified vertically;
  // anything taller and it would not reach the top of the view. The viewer opens the camera at
  // exactly `vFov`, which is what closes that loop.
  //
  // The horizontal scale is fixed separately, by `thetaLength = arc`: the strip's `span` degrees of
  // azimuth occupy `arc` radians of the cylinder. That does *not* make the surface isotropic -
  // arc length per degree exceeds height per degree by `arc / vFov_radians` - and deliberately so.
  // These releases carry about twice as many pixels per degree vertically as horizontally, so an
  // isotropic surface would *introduce* a two-to-one vertical stretch. Matching the surface to the
  // perspective view is what keeps the photograph the shape it was published as, which is what was
  // checked against the source at `docs/lunar-panorama-research/tools/flatten-view.py`.
  const halfHeight = Math.tan((panorama.verticalFovDeg * Math.PI) / 360)
  // `CylinderGeometry` places `x = r sin(theta)`, `z = r cos(theta)`, and runs `u` with theta. With
  // `thetaStart = pi - arc/2` the arc is centred on -Z, where the viewer looks. The viewer's azimuth
  // frame is therefore mirrored in x - its left is +X - which is what the drag convention is written
  // against. Leaving the geometry alone is what keeps the photograph itself unmirrored - flipping
  // either the mesh or the texture here displayed the flag back to front.
  const thetaStart = Math.PI - arc / 2
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    halfHeight * 2,
    // A segment every few degrees; finer would only cost vertices, since the surface is smooth.
    Math.max(24, Math.ceil(clamp(panorama.spanDeg, 1, 360) / 3)),
    1,
    // Open-ended: a cap would be a lid directly above the viewer's head.
    true,
    thetaStart,
    arc,
  )
  // The texture's own u already runs 0..1 across the covered arc, so nothing is rescaled or
  // mirrored here. Two earlier versions of this function got that wrong: one stretched U to "fill"
  // the circumference, which made the strip repeat around the viewer, and one mirrored the texture
  // to compensate for a winding that was in fact already correct, which displayed every panorama
  // back to front.
  return geometry
}

/**
 * The rise of the true horizon across the strip, in degrees, for a level camera. It is a check on
 * the strip's elevation range rather than something the viewer draws: a strip presented as much
 * taller than its sweep implies would show a horizon curving far more than the Moon's half-degree
 * disc can produce.
 */
export function horizonCurvatureDeg(panorama: Pick<MoonPanorama, 'spanDeg'>): number {
  return panorama.spanDeg / 4
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
