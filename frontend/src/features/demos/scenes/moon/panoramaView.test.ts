import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { findFeature, MOON_FEATURES } from './hotspots'
import { findPanorama, MOON_PANORAMAS, panoramasForSite } from './moonPanoramas'
import {
  centreLongitudeDeg,
  clampFov,
  clampPitch,
  clampYaw,
  defaultFovDeg,
  defaultPitchDeg,
  coveredLongitudeFraction,
  dragDegreesPerPixel,
  dragDegreesPerPixelByAxis,
  fovLimits,
  isOrientationVerified,
  openingFovDeg,
  panoramaCylinderGeometry,
  panoramaYawRadians,
  PANORAMA_DEFAULT_FOV_DEG,
  PANORAMA_MAX_FOV_DEG,
  PANORAMA_MAX_PITCH_DEG,
  PANORAMA_MIN_FOV_DEG,
  PANORAMA_MIN_PITCH_DEG,
  yawLimits,
} from './panoramaView'

describe('panorama catalogue', () => {
  it('has unique ids', () => {
    const ids = MOON_PANORAMAS.map((panorama) => panorama.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only points at sites the demo can actually fly to', () => {
    // A panorama whose siteId is not in MOON_FEATURES would be unreachable: the panel is built
    // from that list, so the entry would ship megabytes of texture nobody could ever open.
    for (const panorama of MOON_PANORAMAS) {
      expect(findFeature(panorama.siteId), `${panorama.id} targets unknown site ${panorama.siteId}`).not.toBeNull()
    }
  })

  it('covers every landing site the demo publishes with a panorama', () => {
    // Every site that has a panorama is also a focusable feature with terrain to fly into, so
    // opening one from the card always has somewhere to arrive. All six Apollo sites qualify.
    const sites = new Set(MOON_PANORAMAS.map((panorama) => panorama.siteId))
    for (const id of ['apollo-11', 'apollo-12', 'apollo-14', 'apollo-15', 'apollo-16', 'apollo-17', 'change-4']) {
      expect(sites.has(id), `no panorama for ${id}`).toBe(true)
    }
    // The sites with no shippable panorama are named, so adding one is a deliberate act: Chang'e 3
    // and 5 have no openly licensed strip, and the Lunokhod pans are all rights reserved.
    for (const id of ['change-3', 'change-5', 'luna-21']) {
      expect(sites.has(id), `${id} has no shippable panorama`).toBe(false)
    }
  })

  it('declares a sane span and a non-empty attribution for every entry', () => {
    for (const panorama of MOON_PANORAMAS) {
      expect(panorama.spanDeg, panorama.id).toBeGreaterThan(0)
      expect(panorama.spanDeg, panorama.id).toBeLessThanOrEqual(360)
      expect(panorama.verticalFovDeg, panorama.id).toBeGreaterThan(0)
      expect(panorama.verticalFovDeg, panorama.id).toBeLessThan(90)
      expect(panorama.width, panorama.id).toBeGreaterThan(0)
      expect(panorama.height, panorama.id).toBeGreaterThan(0)
      expect(panorama.file.startsWith('/demos/moon/panoramas/'), panorama.id).toBe(true)
      // Every image needs a credit line: two different licences are in play across this set.
      expect(panorama.credit.length, panorama.id).toBeGreaterThan(0)
      expect(panorama.licence.length, panorama.id).toBeGreaterThan(0)
      expect(panorama.title.length, panorama.id).toBeGreaterThan(0)
      expect(panorama.caption.length, panorama.id).toBeGreaterThan(0)
    }
  })

  it('marks how each span is known', () => {
    for (const panorama of MOON_PANORAMAS) {
      expect(['documented', 'closes', 'modelled']).toContain(panorama.spanSource)
      if (panorama.spanSource === 'closes') expect(panorama.spanDeg, panorama.id).toBe(360)
    }
  })

  it('keeps non-NASA imagery distinct so the licence is not mislabelled', () => {
    // The Chang'e 4 strip is CC BY 4.0 and needs a different credit from the NASA material. If a
    // rebuild ever drops the licence string, this catches it.
    const change4 = panoramasForSite('change-4')
    expect(change4.length).toBeGreaterThan(0)
    for (const panorama of change4) expect(panorama.licence).toContain('CC BY')
    for (const panorama of panoramasForSite('apollo-11')) {
      expect(panorama.licence).toContain('public domain')
    }
  })

  it('finds panoramas by site and by id', () => {
    expect(panoramasForSite('apollo-17').length).toBeGreaterThanOrEqual(2)
    expect(panoramasForSite('no-such-site')).toEqual([])
    expect(findPanorama(MOON_PANORAMAS[0].id)).toBe(MOON_PANORAMAS[0])
    expect(findPanorama('no-such-panorama')).toBeNull()
  })

  it('maps every panorama onto a feature the demo knows', () => {
    const ids = new Set(MOON_FEATURES.map((feature) => feature.id))
    for (const panorama of MOON_PANORAMAS) expect(ids.has(panorama.siteId)).toBe(true)
  })
})

describe('yaw limits', () => {
  it('lets a closed strip turn through a full circle', () => {
    const limits = yawLimits({ spanDeg: 360 })
    expect(limits.wraps).toBe(true)
    expect(clampYaw(0, limits)).toBe(0)
    expect(clampYaw(179, limits)).toBe(179)
    // Wraps rather than clamping, so a long drag keeps turning.
    expect(clampYaw(190, limits)).toBeCloseTo(-170)
    expect(clampYaw(-190, limits)).toBeCloseTo(170)
    expect(clampYaw(540, limits)).toBeCloseTo(-180)
  })

  it('holds a partial strip inside its own sweep', () => {
    const limits = yawLimits({ spanDeg: 130 })
    expect(limits.wraps).toBe(false)
    expect(limits.min).toBeCloseTo(-65)
    expect(limits.max).toBeCloseTo(65)
    expect(clampYaw(0, limits)).toBe(0)
    expect(clampYaw(40, limits)).toBe(40)
    expect(clampYaw(1000, limits)).toBe(65)
    expect(clampYaw(-1000, limits)).toBe(-65)
  })

  it('never divides a sweep into a nonsense range', () => {
    expect(yawLimits({ spanDeg: 0 }).wraps).toBe(false)
    expect(yawLimits({ spanDeg: -5 }).wraps).toBe(false)
    expect(Number.isFinite(yawLimits({ spanDeg: 0 }).min)).toBe(true)
  })

  it('survives a non-finite yaw', () => {
    const limits = yawLimits({ spanDeg: 130 })
    expect(clampYaw(Number.NaN, limits)).toBe(0)
    expect(clampYaw(Number.POSITIVE_INFINITY, limits)).toBe(65)
  })
})

describe('pitch and field of view limits', () => {
  it('clamps pitch to the range a surface panorama can show', () => {
    expect(clampPitch(0)).toBe(0)
    expect(clampPitch(-10)).toBe(-10)
    expect(clampPitch(-1000)).toBe(PANORAMA_MIN_PITCH_DEG)
    expect(clampPitch(1000)).toBe(PANORAMA_MAX_PITCH_DEG)
  })

  it('clamps the camera field of view', () => {
    expect(clampFov(58)).toBe(58)
    expect(clampFov(1)).toBe(PANORAMA_MIN_FOV_DEG)
    expect(clampFov(500)).toBe(PANORAMA_MAX_FOV_DEG)
  })

  /**
   * Dragging has to follow the pointer on both axes at once, which needs the horizontal and
   * vertical scales separately: a landscape viewport is wider than it is tall, so a single averaged
   * figure would make a drag pull away from the cursor.
   */
  it('scales a drag correctly on each axis', () => {
    const fov = 60
    const width = 1600
    const height = 800
    const perPixel = dragDegreesPerPixelByAxis(fov, width, height)
    // Vertically the viewport shows exactly the field of view.
    expect(perPixel.y).toBeCloseTo(fov / height, 9)
    // Horizontally it shows more, in proportion to the aspect ratio after the tangent: a wide
    // viewport covers a wider angle, so each pixel covers *fewer* degrees than on the short axis.
    const expectedHorizontal = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (width / height)) * (180 / Math.PI)
    expect(expectedHorizontal).toBeGreaterThan(fov)
    expect(perPixel.x).toBeCloseTo(expectedHorizontal / width, 9)
    expect(perPixel.x).toBeLessThan(perPixel.y)
    // A full-width drag turns through the whole horizontal field of view, and a full-height one
    // through the vertical field: the two together are what make the drag follow the pointer.
    expect(perPixel.x * width).toBeCloseTo(expectedHorizontal, 9)
    expect(perPixel.y * height).toBeCloseTo(fov, 9)
    // A square viewport is the one case where the axes agree, and at a small field of view the
    // tangent's curvature vanishes, so there the averaged helper is a good approximation.
    const square = dragDegreesPerPixelByAxis(10, 1000, 1000)
    expect(square.x).toBeCloseTo(square.y, 9)
    expect(square.y).toBeCloseTo(dragDegreesPerPixel(10, 1000, 1000), 3)
  })

  it('survives degenerate viewports and fields of view', () => {
    for (const [w, h, f] of [[0, 0, 60], [1600, 0, 60], [0, 800, 60], [1600, 800, 0], [1600, 800, 200]]) {
      const perPixel = dragDegreesPerPixelByAxis(f, w, h)
      expect(Number.isFinite(perPixel.x), `${w}x${h} fov ${f}`).toBe(true)
      expect(Number.isFinite(perPixel.y), `${w}x${h} fov ${f}`).toBe(true)
      expect(perPixel.x).toBeGreaterThan(0)
      expect(perPixel.y).toBeGreaterThan(0)
    }
  })

  /**
   * The strips run from about 12 to 44 degrees tall. One camera setting for all of them would
   * either squeeze the wide ones into a slit or overshoot the thin ones, so the opening field of
   * view has to follow the strip - this is the regression that made the first Apollo 11 view a
   * magnified smear.
   */
  it('opens a thin strip with a narrow camera and a tall one with a wider camera', () => {
    const thin = defaultFovDeg({ verticalFovDeg: 12.3 })
    const tall = defaultFovDeg({ verticalFovDeg: 44.2 })
    expect(thin).toBeLessThan(tall)
    // The thin strip is the one that was unusable at a fixed 58 degrees.
    expect(thin).toBeLessThan(PANORAMA_DEFAULT_FOV_DEG)
    // A tall strip must not push the camera past a normal lens.
    expect(tall).toBeLessThanOrEqual(62)
  })

  it('keeps the opening field of view inside its own bounds', () => {
    for (const verticalFovDeg of [1, 5, 12.3, 25, 37, 44.2, 90]) {
      const fov = defaultFovDeg({ verticalFovDeg })
      expect(fov, String(verticalFovDeg)).toBeGreaterThanOrEqual(34)
      expect(fov, String(verticalFovDeg)).toBeLessThanOrEqual(62)
    }
  })

  it('stops zooming a tall strip sooner than a thin one', () => {
    const thin = fovLimits({ verticalFovDeg: 12.3 })
    const tall = fovLimits({ verticalFovDeg: 44.2 })
    // The floor is roughly the strip's own vertical extent, so a 44 degree strip stops zooming
    // while a 12 degree one can still be looked into. Getting this backwards would let a tall
    // strip be magnified until its texture turns to mush.
    expect(thin.min).toBeLessThan(tall.min)
    for (const bounds of [thin, tall]) {
      expect(bounds.min).toBeGreaterThan(0)
      expect(bounds.max).toBe(PANORAMA_MAX_FOV_DEG)
      expect(bounds.min).toBeLessThan(bounds.max)
    }
    expect(thin.min).toBeGreaterThanOrEqual(12.3 / 0.95 - 1e-9)
    // The floor sits a shade inside the strip's own height, so a viewer can magnify it by about
    // five per cent before the texture stops being worth looking at.
    expect(thin.min).toBeLessThanOrEqual(12.3 / 0.9)
    expect(tall.min).toBeLessThanOrEqual(44.2)
  })

  it('opens at the strip\'s own height, so nothing is distorted', () => {
    // Opening at exactly the strip's vertical extent puts one texture pixel on one screen pixel.
    // Opening wider compresses the photograph vertically - a 21 degree strip in a 34 degree
    // camera loses a third of its height and reads as horizontal streaking - so this is the
    // property that keeps the whole viewer honest.
    for (const verticalFovDeg of [30, 37, 44.2, 60, 77.4]) {
      expect(openingFovDeg({ verticalFovDeg }), String(verticalFovDeg)).toBeCloseTo(verticalFovDeg, 6)
    }
    // The one shipped strip short enough for the floor to bind is Apollo 11's 21.6 degree pano,
    // and the floor only widens it by the 5 per cent margin the pixel limit allows.
    const thin = openingFovDeg({ verticalFovDeg: 21.6 })
    expect(thin / 21.6).toBeLessThan(1.06)
    // A strip taller than the widest sensible camera is cropped rather than opened to a fisheye.
    expect(openingFovDeg({ verticalFovDeg: 120 })).toBe(PANORAMA_MAX_FOV_DEG)
    // The pixel floor is the only thing allowed to widen the camera beyond the strip.
    for (const verticalFovDeg of [1, 5, 12.3, 21.6, 44.2, 120]) {
      const opening = openingFovDeg({ verticalFovDeg })
      expect(opening, String(verticalFovDeg)).toBeGreaterThanOrEqual(fovLimits({ verticalFovDeg }).min - 1e-9)
      expect(opening, String(verticalFovDeg)).toBeLessThanOrEqual(PANORAMA_MAX_FOV_DEG)
    }
  })

  it('starts level when the whole strip fits, and tilts only when it does not', () => {
    expect(defaultPitchDeg({ verticalFovDeg: 12.3 })).toBe(0)
    expect(defaultPitchDeg({ verticalFovDeg: 30 })).toBe(0)
    // The camera is allowed to open as wide as the strip, so only a strip wider than the camera
    // can ever be cropped, and that is the only case worth tilting for.
    const pitch = defaultPitchDeg({ verticalFovDeg: 150 })
    expect(pitch).toBeLessThan(0)
    expect(pitch).toBeGreaterThanOrEqual(PANORAMA_MIN_PITCH_DEG)
  })
})

describe('placement on the sphere', () => {
  it('anchors an unverified panorama to the sub-Earth meridian and says so', () => {
    const unverified = { headingDeg: 0 }
    expect(centreLongitudeDeg(unverified)).toBe(0)
    expect(isOrientationVerified(unverified)).toBe(false)
    expect(isOrientationVerified({ headingDeg: 45 })).toBe(true)
  })

  it('covers a fraction of the full turn matching the sweep', () => {
    expect(coveredLongitudeFraction({ spanDeg: 360 })).toBeCloseTo(1)
    expect(coveredLongitudeFraction({ spanDeg: 180 })).toBeCloseTo(0.5)
    expect(coveredLongitudeFraction({ spanDeg: 90 })).toBeCloseTo(0.25)
    // Out-of-range values are contained rather than producing a negative or oversized patch.
    expect(coveredLongitudeFraction({ spanDeg: -10 })).toBeGreaterThan(0)
    expect(coveredLongitudeFraction({ spanDeg: 1000 })).toBeCloseTo(1)
  })

  it('turns the mesh by the panorama heading', () => {
    expect(panoramaYawRadians({ headingDeg: 0 })).toBe(0)
    expect(panoramaYawRadians({ headingDeg: 90 })).toBeCloseTo(Math.PI / 2)
    expect(panoramaYawRadians({ headingDeg: -90 })).toBeCloseTo(-Math.PI / 2)
    // The viewer's own yaw shares this convention, so a heading and a yaw of the same size point
    // the same way; getting this backwards would mirror the whole panorama.
    expect(Math.sign(panoramaYawRadians({ headingDeg: 45 }))).toBe(1)
  })
})

/**
 * The cylinder is the fix for the reported stretching, so these tests pin down the two properties
 * that make it correct: the covered arc matches the sweep, and the texture is laid across that arc
 * rather than wrapped around the whole circumference.
 */
describe('panorama cylinder', () => {
  /**
   * The viewer's own azimuth frame, recovered from a vertex. The build puts the arc's left edge at
   * the larger azimuth, so the frame is mirrored in x: the viewer's left is +X. This is what the
   * drag convention is written against, and it is why nothing about the texture is flipped.
   */
  function azimuthOf(x: number, z: number): number {
    return (Math.atan2(-x, -z) * 180) / Math.PI
  }

  it('covers only the sweep the photograph has, and keeps it in front of the viewer', () => {
    const geometry = panoramaCylinderGeometry({ spanDeg: 180, verticalFovDeg: 40 })
    const positions = geometry.attributes.position as THREE.BufferAttribute
    // Every vertex has to lie within the covered half: the cylinder must not exist behind the
    // photograph, or a viewer turning past the edge would find black geometry.
    for (let index = 0; index < positions.count; index += 1) {
      const azimuth = azimuthOf(positions.getX(index), positions.getZ(index))
      expect(Math.abs(azimuth), `vertex ${index}`).toBeLessThanOrEqual(90.0001)
    }
  })

  it('lays the texture once across the covered arc', () => {
    const geometry = panoramaCylinderGeometry({ spanDeg: 120, verticalFovDeg: 30 })
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let index = 0; index < uv.count; index += 1) {
      min = Math.min(min, uv.getX(index))
      max = Math.max(max, uv.getX(index))
    }
    // The image must appear exactly once: U has to stay inside 0..1 across the whole arc. A
    // 120 degree strip is a third of a turn, and rescaling U to "fill" the other two thirds is the
    // bug that made the strip repeat three times around the viewer.
    expect(min).toBeCloseTo(0, 5)
    expect(max).toBeCloseTo(1, 5)
  })

  /**
   * The image has to run left to right with the azimuth and be the right way round. Two separate
   * mistakes lived here: the arc started behind the viewer (a black screen) and the texture was
   * mirrored to compensate for a winding that was already correct (the flag flew backwards).
   */
  it('runs the image left to right, with the centre straight ahead', () => {
    const geometry = panoramaCylinderGeometry({ spanDeg: 360, verticalFovDeg: 40 })
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    /** Azimuth of the vertex whose U is nearest `target`. */
    function azimuthNearU(target: number): number {
      let best = { distance: Infinity, azimuth: 999 }
      for (let index = 0; index < positions.count; index += 1) {
        const distance = Math.abs(uv.getX(index) - target)
        if (distance < best.distance) {
          best = { distance, azimuth: azimuthOf(positions.getX(index), positions.getZ(index)) }
        }
      }
      return best.azimuth
    }
    // A quarter in from each end: the left edge of the image is the negative side, the right edge
    // positive, and the middle faces the viewer.
    expect(azimuthNearU(0.25)).toBeLessThan(0)
    expect(azimuthNearU(0.75)).toBeGreaterThan(0)
    expect(Math.abs(azimuthNearU(0.5))).toBeLessThan(4)
  })

  it('puts the middle of the image straight ahead', () => {
    const geometry = panoramaCylinderGeometry({ spanDeg: 360, verticalFovDeg: 40 })
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    let best = { distance: Infinity, azimuth: 999 }
    for (let index = 0; index < positions.count; index += 1) {
      const distance = Math.abs(uv.getX(index) - 0.5)
      if (distance < best.distance) {
        best = { distance, azimuth: azimuthOf(positions.getX(index), positions.getZ(index)) }
      }
    }
    // u = 0.5 is the centre of the photograph, and it must land on the view direction at yaw 0.
    expect(Math.abs(best.azimuth)).toBeLessThan(4)
  })

  it('reaches the top of the camera frame, so the strip is not magnified', () => {
    // The perspective constraint: to place a point at elevation vFov/2 on the surface it has to sit
    // `tan(vFov/2)` above the eye, because that is the ray the camera sends through the top of the
    // frame. A shorter cylinder would be magnified vertically; a taller one would float out of view.
    // This is the check that pins the height, and it is deliberately not an isotropy check: these
    // strips are not isotropic pictures, so matching the surface to the view is what keeps them the
    // shape they were published as.
    for (const [spanDeg, vFovDeg] of [[160, 21.6], [240, 44.5], [360, 74.6], [130, 64.9]]) {
      const geometry = panoramaCylinderGeometry({ spanDeg, verticalFovDeg: vFovDeg })
      const positions = geometry.attributes.position as THREE.BufferAttribute
      let maxY = 0
      for (let index = 0; index < positions.count; index += 1) {
        maxY = Math.max(maxY, Math.abs(positions.getY(index)))
      }
      expect(Math.atan(maxY) * (180 / Math.PI), `span ${spanDeg}`).toBeCloseTo(vFovDeg / 2, 4)
    }
  })

  /**
   * The image has to cover the arc exactly once, in the right order, with its middle straight ahead.
   */
  it('lays the texture once across the arc, centred on the view', () => {
    for (const spanDeg of [110, 160, 240, 360]) {
      const geometry = panoramaCylinderGeometry({ spanDeg, verticalFovDeg: 40 })
      const uv = geometry.attributes.uv as THREE.BufferAttribute
      let minU = Number.POSITIVE_INFINITY
      let maxU = Number.NEGATIVE_INFINITY
      for (let index = 0; index < uv.count; index += 1) {
        minU = Math.min(minU, uv.getX(index))
        maxU = Math.max(maxU, uv.getX(index))
      }
      // Exactly 0..1: rescaling U to "fill" the rest of the circumference would repeat the picture.
      expect(minU, `span ${spanDeg}`).toBeCloseTo(0, 5)
      expect(maxU, `span ${spanDeg}`).toBeCloseTo(1, 5)
    }
  })

  it('runs the image left to right, with the centre straight ahead', () => {
    const geometry = panoramaCylinderGeometry({ spanDeg: 360, verticalFovDeg: 40 })
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    /** Azimuth of the vertex whose U is nearest `target`. */
    function azimuthNearU(target: number): number {
      let best = { distance: Infinity, azimuth: 999 }
      for (let index = 0; index < positions.count; index += 1) {
        const distance = Math.abs(uv.getX(index) - target)
        if (distance < best.distance) {
          best = { distance, azimuth: azimuthOf(positions.getX(index), positions.getZ(index)) }
        }
      }
      return best.azimuth
    }
    // A quarter in from each end: the left edge of the image is the negative side, the right edge
    // positive, and the middle faces the viewer. Mirrored output would invert these two.
    expect(azimuthNearU(0.25)).toBeLessThan(0)
    expect(azimuthNearU(0.75)).toBeGreaterThan(0)
    expect(Math.abs(azimuthNearU(0.5))).toBeLessThan(4)
  })

  it('opens the camera at the strip\'s own extent', () => {
    for (const panorama of MOON_PANORAMAS) {
      const opening = openingFovDeg(panorama)
      const floor = fovLimits(panorama).min
      const wanted = Math.max(Math.min(panorama.verticalFovDeg, PANORAMA_MAX_FOV_DEG), floor)
      expect(opening, panorama.id).toBeCloseTo(wanted, 6)
      // The pixel floor is the only thing allowed to widen the camera beyond the strip, and only by
      // the small margin that limit carries.
      expect(opening / panorama.verticalFovDeg, panorama.id).toBeLessThanOrEqual(1.06)
    }
  })

  /**
   * The catalogue's fields of view are the calibrated ones, and the calibration is a measured
   * constant rather than a derived one. This does not assert the constant - that lives in the tool
   * and in ATTRIBUTION.md - but it does catch a field of view that has drifted back to the naive
   * `span / aspect` derivation, because the two differ by the calibrated factor.
   */
  it('keeps every catalogued field of view in the calibrated band, not the naive one', () => {
    for (const panorama of MOON_PANORAMAS) {
      const naive = panorama.spanDeg / (panorama.width / panorama.height)
      expect(panorama.verticalFovDeg, `${panorama.id} looks like the uncalibrated derivation`)
        .toBeGreaterThan(naive * 1.5)
      // And still a plausible vertical field of view for a hand-held camera.
      expect(panorama.verticalFovDeg, panorama.id).toBeGreaterThan(10)
      expect(panorama.verticalFovDeg, panorama.id).toBeLessThan(85)
    }
  })

  it('spends vertices in proportion to the sweep', () => {
    const wide = panoramaCylinderGeometry({ spanDeg: 360, verticalFovDeg: 40 })
    const narrow = panoramaCylinderGeometry({ spanDeg: 110, verticalFovDeg: 40 })
    expect(wide.attributes.position.count).toBeGreaterThan(narrow.attributes.position.count)
    // Even a narrow strip keeps enough segments to look smooth.
    expect(narrow.attributes.position.count).toBeGreaterThan(24 * 2)
  })
})
