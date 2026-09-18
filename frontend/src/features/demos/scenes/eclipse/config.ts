import type { EclipseEventKind, EclipseSection } from './types'

/**
 * The demo runs on two scales at once, and keeping them apart is the whole design.
 *
 * `BODY_RADIUS_KM`, `MOON_ORBIT_KM` and everything in `ephemeris.ts` are real. They decide what
 * eclipse you are looking at, how much of a disc is covered, and whether an umbra reaches.
 *
 * `DISPLAY_*` and `SCENE` are a diagram. They decide how big things look and nothing else. No
 * classification, no obscuration and no event time is ever read off them.
 */

/** Real body radii, in kilometres. Every shadow cone is built from these. */
export const BODY_RADIUS_KM = {
  sun: 695700,
  /**
   * The mean radius. The umbra is cast from the whole sunlit hemisphere, whose cross-section varies
   * between the polar and equatorial radii by 0.1%, so the mean is the honest single number.
   */
  earth: 6371,
  moon: 1737.4,
} as const

/** Real mean Earth-Moon distance, kilometres. Only used to express the display compression. */
export const MOON_ORBIT_KM = 384400

/**
 * Display radii, in scene units.
 *
 * The Sun is drawn about a hundred thousand times smaller than life so that it and the Earth fit in
 * one frame, and that single exaggeration is what forces every other one: a true-to-scale Sun at a
 * true-to-scale distance would leave the Earth and Moon as a single dark pixel.
 *
 * Two ratios are deliberately kept exact even so:
 *
 * - Earth to Moon is the real 3.67, because the umbra and penumbra this demo is about are sized by
 *   it - at the Moon's distance the Earth's umbra is 2.65 Moon radii across, and that number is not
 *   a display choice;
 * - the Sun is drawn as large as the framing can afford, so that it reads as the star it is rather
 *   than as a slightly larger planet. Nothing else depends on its drawn size: every shadow cone is
 *   built from the real radii and the real distances and then scaled, so the Sun's drawn radius
 *   cannot affect the physics.
 */
export const DISPLAY_RADIUS = {
  sun: 1.5,
  earth: 0.88,
  moon: (0.88 * BODY_RADIUS_KM.moon) / BODY_RADIUS_KM.earth,
} as const

/**
 * Display distance from the Earth to the Sun, in scene units.
 *
 * The frame is anchored on the Earth rather than on the Sun: what the demo has to show is which
 * body's shadow falls on which, and that happens in the Earth-Moon system. The Sun is placed along
 * the real Sun direction at this fixed distance, so its *bearing* is real even though its distance
 * is not - the real one is 389 times the Moon's orbit, which would put it off any screen that can
 * also show the Moon.
 */
export const DISPLAY_SUN_DISTANCE = 10.5

/**
 * Display radius of the Moon's orbit around the Earth, in scene units.
 *
 * Compressed from 384 400 km, but far less than the Earth's orbit is: the two compressions differ by
 * a factor of about eighty. A Moon drawn true to scale against the Sun's distance would be a
 * fraction of a pixel from a pixel-wide Earth, and there would be nothing to look at. At this radius
 * the Moon's orbit is 5.2 Earth radii across, against a real 60 - still an exaggeration, but one
 * that leaves the Earth and Moon as separate bodies with a visible gap between them.
 */
export const DISPLAY_MOON_ORBIT = 4.6

/** Display radius of the discs that stand in for the two orbital planes. */
export const DISPLAY_PLANE_RADIUS = { ecliptic: 5.9, lunar: 5.2 } as const

/**
 * The real inclination of the Moon's orbit to the ecliptic, in degrees.
 *
 * This single number is why eclipses are rare. The Moon crosses the ecliptic twice a month, at the
 * nodes; an eclipse needs a node and a new or full Moon to fall on the same day. `SEARCH_NODE_*`
 * in `ephemeris.ts` finds where the crossings actually are.
 */
export const MOON_ORBIT_INCLINATION_DEG = 5.145

/**
 * What each section is about, as data.
 *
 * The section picks which body casts the shadow, which disc the viewer is watching being covered,
 * and which end of the alignment is interesting - so switching sections cannot leave the scene
 * pointing a cone the wrong way.
 */
export interface EclipseSectionModel {
  /** The body whose shadow does the covering. */
  caster: 'earth' | 'moon'
  /** The body whose disc is covered, as seen from the observer. */
  subject: 'sun' | 'moon'
  /** Real radius of the casting body, kilometres. */
  casterRadiusKm: number
  /** Real radius of the body the shadow falls on, kilometres. */
  targetRadiusKm: number
  /** The three bodies in the order the section lines them up. */
  alignment: readonly ['sun' | 'earth' | 'moon', 'sun' | 'earth' | 'moon', 'sun' | 'earth' | 'moon']
  /** Greatest eclipse kind this section can reach, for the copy and the tests. */
  kinds: readonly EclipseEventKind[]
}

export const SECTION_MODEL: Record<EclipseSection, EclipseSectionModel> = {
  solar: {
    caster: 'moon',
    subject: 'sun',
    casterRadiusKm: BODY_RADIUS_KM.moon,
    targetRadiusKm: BODY_RADIUS_KM.earth,
    alignment: ['sun', 'moon', 'earth'],
    kinds: ['partial', 'total', 'annular'],
  },
  lunar: {
    caster: 'earth',
    subject: 'moon',
    casterRadiusKm: BODY_RADIUS_KM.earth,
    targetRadiusKm: BODY_RADIUS_KM.moon,
    alignment: ['sun', 'earth', 'moon'],
    kinds: ['penumbral', 'partial', 'total'],
  },
}

export const COLOURS = {
  sun: 0xfff2cf,
  sunGlow: 0xffcf85,
  earth: 0x6f9fe0,
  moon: 0xd8dde6,
  /** The umbra reads as a near-black blue so it stays legible against a dark sky. */
  umbra: 0x18243c,
  umbraEdge: 0x7ea6dd,
  penumbra: 0x86b0e0,
  /** Beyond the umbra's apex the Moon only covers the Sun's middle: the antumbra, which is annularity. */
  antumbra: 0xd8a75c,
  eclipticPlane: 0x4d7fb0,
  lunarPlane: 0xb08cff,
  node: 0xffb457,
  moonOrbit: 0x9fb4cf,
  peakMarker: 0x8fe3e6,
  observerMarker: 0xffb457,
  /**
   * A totally eclipsed Moon. Not black: sunlight refracted and scattered by the Earth's atmosphere
   * still reaches it, reddened because the blue end is scattered away along that long grazing path.
   * The copy says this is an approximation of that effect rather than a measurement.
   */
  totality: 0xb4522a,
} as const

export const SCENE = {
  /** Content is authored with +Z toward ecliptic north; this turns that into the renderer's y-up world. */
  eclipticPlaneRotationXDeg: -90,
  cameraElevationDeg: 24,
  cameraFieldOfViewDeg: 42,
  /** Fraction of the viewport the framed system is fitted into. */
  cameraFramingFill: 0.94,
  /**
   * Scene units of clearance left around the framed bodies. A full Sun radius would waste a fifth of
   * the frame on empty sky; the Sun's glow reaching the edge looks deliberate, so a little of it is
   * allowed to.
   */
  framingMargin: 0.6,
  minCameraDistance: 2.5,
  maxCameraDistance: 60,
  /** Sprite sizes, as multiples of the Sun's drawn radius. */
  sunGlowScale: 3.6,
  sunStarburstScale: 5,
  /** How often the scene pushes state to its control panel, in seconds. */
  stateIntervalSeconds: 1 / 30,
  /** The scrubber extends this far past the event's own first and last contact. */
  windowPaddingSeconds: 1800,
  /**
   * Playback is set so that an eclipse plays out in about this long, whatever its own length.
   *
   * The events in the picker run from under two hours to over six, so one fixed speed would either
   * rush the short ones past or leave the viewer waiting through the long ones. The speed is
   * reported back to the shell, so the transport's readout shows the value actually in use.
   */
  targetPlaybackSeconds: 45,
  minutesPerSecond: { min: 0.1, max: 20, step: 0.1 },
  /**
   * How far the observer may be moved from the event's peak point. Moving off the central path is
   * how a total eclipse becomes a partial one, so the range has to be wide enough to leave the path.
   */
  observerOffsetLimitDeg: 20,
  observerOffsetStepDeg: 0.5,
  /** Clear space kept between the measured boxes of two labels. */
  labelGapPx: { x: 8, y: 6 },
  /** The label stylesheet is one line tall; kept here so scene-side collision tests match it. */
  labelHeightPx: 22,
  /**
   * Where the two plane labels sit along the anti-solar direction, as fractions of their disc's
   * radius, plus how far the lunar one is lifted off its disc.
   *
   * One clearly inside the lunar disc and one out at the ecliptic's rim, so that even though the two
   * rims run only about twenty pixels apart, each label is unambiguous. See `placePlaneLabels`.
   */
  lunarPlaneLabelRadius: 0.78,
  lunarPlaneLabelLift: 0.16,
  eclipticPlaneLabelRadius: 1,
  /** How far the cone labels sit off their cone's axis, in scene units, plus a share of its width. */
  labelLateralOffset: 0.9,
  labelLateralPerRadius: 0.9,
} as const
