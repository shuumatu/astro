import type { EllipticalOrbit } from './orbit'

/**
 * Scene units are stylised rather than to scale: the Sun and the bodies are drawn
 * far larger than reality so that the geometry of the orbit crossing stays legible.
 * Relative orbital shape and period, however, follow Kepler's laws.
 */
export const EARTH_ORBIT_RADIUS = 6

/**
 * The Earth orbit is treated as circular. Its real eccentricity is 0.0167, and ignoring
 * it keeps the stream intersection exact without changing the explanation.
 */
export const EARTH_ORBIT: EllipticalOrbit = {
  semiMajorAxis: EARTH_ORBIT_RADIUS,
  eccentricity: 0,
  inclinationDeg: 0,
  ascendingNodeDeg: 0,
  argumentOfPeriapsisDeg: 0,
}

const COMET_SEMI_MAJOR_AXIS = 15
/** Chosen so perihelion falls exactly on the Earth orbital radius. */
const COMET_ECCENTRICITY = 1 - EARTH_ORBIT_RADIUS / COMET_SEMI_MAJOR_AXIS

/**
 * Modelled on the comets that actually produce long-lived showers. Their perihelia cluster
 * between 0.6 and 1.0 AU — Swift-Tuttle 0.96, Tempel-Tuttle 0.98, Giacobini-Zinner 1.01 —
 * and in every case the stream's node sits near perihelion, so the comet is closest to the
 * Sun exactly where it crosses the Earth's orbit, and that is where it sheds most dust.
 *
 * So here the perihelion is put on the descending node, one Earth orbital radius from the
 * Sun: it just reaches 1 AU instead of diving far inside our orbit. Only the descending node
 * can meet the Earth orbit; the ascending node is out at aphelion and cannot.
 */
export const COMET_ORBIT: EllipticalOrbit = {
  semiMajorAxis: COMET_SEMI_MAJOR_AXIS,
  eccentricity: COMET_ECCENTRICITY,
  inclinationDeg: 34,
  ascendingNodeDeg: 24,
  argumentOfPeriapsisDeg: 180,
}

export const SCENE = {
  eclipticPlaneRotationXDeg: -90,
  /**
   * View angles chosen so the two orbits stay apart on screen instead of collapsing into
   * edge-on lines: the comet orbit projects to about three times the size of the Earth
   * orbit, its ellipse stays open (0.46 of its major axis) and runs diagonally across the
   * frame, matching the reference diagram.
   */
  systemAzimuthDeg: -50,
  sunRadius: 1.1,
  /** Sprite sizes are absolute rather than radius multiples so they stay sane up close. */
  sunGlowSize: 5.6,
  sunStarburstSize: 8.5,
  earthRadius: 0.55,
  /** Real obliquity, so the globe leans off the ecliptic normal instead of lying in it. */
  earthObliquityDeg: 23.44,
  cometRadius: 0.22,
  /**
   * The ion tail is dragged by the solar wind and runs straight anti-sunward; the dust tail
   * lags on its own orbit, so it curves towards the trailing direction and spreads out.
   */
  ionTailLength: 4.4,
  ionTailBaseRadius: 0.07,
  ionTailTipRadius: 0.3,
  dustTailLength: 4.2,
  dustTailBaseRadius: 0.1,
  dustTailTipRadius: 0.8,
  dustTailBendDeg: 42,
  orbitTubeRadius: 0.024,
  dustBandRadius: 0.055,
  /**
   * The pool has to outlast one full comet orbit: emission is a constant rate per year, so a
   * pool smaller than dustPerYear x the comet period would be recycled before the comet has
   * been round once, draining the part of the orbit it has not recently travelled through.
   * Real streams persist for centuries, so the band must never develop a gap.
   */
  dustCount: 9000,
  dustPerYear: 1500,
  maxDustPerFrame: 240,
  /** Meteors drawn in 3D during the descent, all travelling away from the radiant. */
  meteorCount: 70,
  meteorsPerSecond: 20,
  /** Fraction of the descent that must elapse before meteors start appearing. */
  meteorStartProgress: 0.5,
  /**
   * The comet starts part-way round its orbit rather than at perihelion, so it does not sit
   * on top of the shower marker on the first frame. This is just the simulation's epoch.
   */
  cometEpochOffset: 0.42,
  cameraElevationDeg: 15,
  cameraAzimuthDeg: 0,
  cameraFieldOfViewDeg: 45,
  /** Fraction of the viewport that the widest projected orbit is fitted into. */
  cameraFramingFill: 0.92,
  /** Lens angle the descent pushes in to; the planet is unreadable at orbital scale without it. */
  descentFieldOfViewDeg: 30,
  /**
   * Where the descent stops, in Earth radii from the Earth's centre. Standing right on the
   * surface would push the horizon far below the frame, so the shot stops high enough that
   * the planet's limb reads as a horizon across the lower third of the view.
   */
  descentRadiusFactor: 5.8,
  /** How far below the radiant the arrival view looks, so the radiant sits high in frame. */
  descentRadiantOffsetDeg: 8,
  /**
   * Altitude the radiant is given at the observing site. The site is chosen to make this
   * true, so the radiant lands in the part of the sky the photograph actually shows.
   */
  observationRadiantAltitudeDeg: 20,
  minCameraDistance: 10,
  maxCameraDistance: 160,
} as const
