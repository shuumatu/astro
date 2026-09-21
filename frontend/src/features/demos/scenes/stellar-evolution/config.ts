import type { StageId } from './types'

/**
 * Constants for the stellar-evolution demo, split into the two kinds that must never be confused.
 *
 * `SUN`, `MASS_LIMITS`, `REMNANT_RADIUS_KM`, `STAGE_RADIUS_SOLAR` and the `*_YEARS` figures are
 * **real measured or published values**: kilograms, kilometres, kelvin, years. Nothing in the
 * scene's rendering may change them.
 *
 * `SCENE` and `compressRadius` are **display machinery**. They exist because a single frame cannot
 * honestly show a 100-fold range of stellar radii and a 10^18-fold range of densities at the same
 * time, so the demo compresses size and says so on screen. Which is which is stated at every
 * declaration, and the panel prints the real number beside the drawing of it.
 */

/** The Sun, as modern values have it. Sources: IAU 2015 nominal values, NASA Sun Fact Sheet. */
export const SUN = {
  /** Nominal solar mass, kg. */
  massKg: 1.9885e30,
  massSolar: 1,
  /** Nominal solar radius, km. */
  radiusKm: 695_700,
  radiusSolar: 1,
  /** Effective (photospheric) temperature, K. */
  effectiveTemperatureK: 5772,
  /** Temperature at the centre, K. */
  coreTemperatureK: 1.57e7,
  /** Bolometric luminosity, W. */
  luminosityW: 3.828e26,
  /** Present age, years. */
  ageYears: 4.6e9,
  /** Total main-sequence lifetime for 1 solar mass, years. */
  mainSequenceLifetimeYears: 1.0e10,
  /** IAU spectral classification. */
  spectralType: 'G2V',
  /** Present-day surface mass fraction of elements heavier than helium. */
  metallicity: 0.0122,
} as const

/** Years the Sun still has on the main sequence: the difference of the two figures above. */
export const SUN_REMAINING_MAIN_SEQUENCE_YEARS =
  SUN.mainSequenceLifetimeYears - SUN.ageYears

/**
 * The masses that decide how a star dies.
 *
 * These are the boundaries the demo's two-track story turns on, and they are the reason the Sun
 * cannot end as a supernova: it will never reach the first of them.
 */
export const MASS_LIMITS = {
  /**
   * Minimum mass for a core-collapse supernova, solar masses.
   *
   * Below roughly this mass a star never builds an iron core massive enough to collapse; it sheds
   * its envelope as a planetary nebula instead. The exact boundary is around 8-9 solar masses
   * depending on metallicity and rotation, which is why the demo says "about 8".
   */
  coreCollapseSupernovaSolar: 8,
  /** Above roughly this mass the remnant is expected to be a black hole rather than a neutron star. */
  blackHoleRemnantSolar: 20,
  /** Chandrasekhar limit: the most mass a white dwarf can support, solar masses. */
  chandrasekharSolar: 1.4,
} as const

/** Characteristic radii of the compact remnants, in kilometres. Real values. */
export const REMNANT_RADIUS_KM = {
  /** A typical white dwarf: Earth-sized, about 0.012 solar radii. */
  whiteDwarf: 8_400,
  /** A 1.4 solar-mass neutron star. */
  neutronStar: 12,
  /** Schwarzschild radius of a 10 solar-mass black hole, 2GM/c^2. */
  blackHoleTenSolar: 29.5,
} as const

/**
 * Real radii of the stages that are a single star, in solar radii.
 *
 * `null` marks a stage that is not characterised by one stellar radius: a molecular cloud is a
 * region hundreds of thousands of astronomical units across, and a supernova is an expanding
 * envelope rather than a body with a surface. Those are drawn to their own scale and are excluded
 * from the size-ordering the tests check.
 */
export const STAGE_RADIUS_SOLAR: Record<StageId, number | null> = {
  'molecular-cloud': null,
  protostar: 4,
  'main-sequence': 1,
  'red-giant': 100,
  'planetary-nebula': 0.03,
  'white-dwarf': 0.012,
  supernova: null,
  'neutron-star': 1.7e-5,
  'black-hole': 4.2e-5,
}

/**
 * Display constants for the stage itself.
 *
 * The camera sits on +Z with a small lift, looking at the origin, so scene +X reads as screen right
 * and scene +Y as screen up. That is the only reason labels can be placed by a plain offset: this
 * scene has no orbital plane to rotate into, unlike the eclipse demo.
 */
export const SCENE = {
  cameraPosition: [0, 1.8, 10.5] as const,
  target: [0, 0, 0] as const,
  fieldOfView: 45,
  near: 0.02,
  far: 4000,
  minDistance: 2.4,
  maxDistance: 26,
  /** Half-height at the origin; extra room keeps giant envelopes clear of the side panels. */
  frameHalfHeight: 4.41,
  /** Radius of the fixed reference circle: the Sun's main-sequence radius. */
  referenceRadius: 1,
  /**
   * Horizontal band the captions are kept inside, as a fraction of the stage width.
   *
   * The demo's two panels sit over the stage, and a caption behind a panel is no caption at all.
   * These fractions mirror the panel widths in `StellarEvolutionControlPanel.vue` - a narrow column
   * on the left for the timeline and a wider one on the right for the reading matter, both capped
   * in `vw` - and are chosen to clear them at the narrowest viewport that still uses the two-column
   * layout. If those widths change, these change with them.
   */
  labelSafeBand: { left: 0.3, right: 0.66 },
  /**
   * Exponent of the size compression. `R_sun ^ 0.21` keeps the ordering and the direction of every
   * comparison while fitting the extremes into one picture: the red giant lands at 2.63 units and
   * the neutron star at 0.10, against 1.00 for the Sun.
   */
  sizeExponent: 0.21,
  /** Milliseconds a stage transition takes to morph the drawing from one stage's look to the next. */
  transitionMs: 1100,
} as const

/**
 * Turns a real radius in solar radii into a drawn one, in scene units.
 *
 * Exposed as a function so the tests can check that the drawing preserves the ordering of the real
 * values - which is the property that makes the compression honest rather than decorative.
 */
export function compressRadius(radiusSolar: number): number {
  return radiusSolar ** SCENE.sizeExponent
}

/**
 * Real durations of the stages, in years, for the mass the stage is written for.
 *
 * The solar track is a 1 solar-mass star and the massive track a 20 solar-mass one, because that is
 * the star whose numbers the demo quotes for the supernova. `null` means the stage does not end.
 */
export const STAGE_DURATION_YEARS: Record<StageId, number | null> = {
  'molecular-cloud': 1e6,
  protostar: 1e5,
  'main-sequence': 1e10,
  'red-giant': 1e8,
  'planetary-nebula': 1e4,
  'white-dwarf': 1e10,
  supernova: 1e5,
  'neutron-star': 1e10,
  'black-hole': null,
}

/**
 * Autoplay dwell per stage, in milliseconds.
 *
 * This is a presentation choice, not a physical one: the real durations span fourteen orders of
 * magnitude, so a timeline that ran at one rate would either flash past the main sequence or sit
 * still for the age of the universe. Each stage gets long enough to read its card.
 */
export const STAGE_DWELL_MS: Record<StageId, number> = {
  'molecular-cloud': 9000,
  protostar: 9000,
  'main-sequence': 13000,
  'red-giant': 11000,
  'planetary-nebula': 10000,
  'white-dwarf': 10000,
  supernova: 11000,
  'neutron-star': 9000,
  'black-hole': 12000,
}
