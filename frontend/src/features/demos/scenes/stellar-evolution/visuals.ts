import { compressRadius, SCENE, STAGE_RADIUS_SOLAR } from './config'
import { stageAt } from './stages'
import type { StageId } from './types'

/**
 * How one stage is drawn.
 *
 * Every number here is a display quantity. None of them is a measurement, and none of them is
 * allowed to travel back into `stages.ts`: the real radius, temperature and duration live there and
 * the panel prints those. What this module does is turn a real radius into a drawn one through the
 * documented compression in `config.ts`, so the picture keeps the ordering of the truth even though
 * it cannot keep its scale.
 *
 * Colours are 0xRRGGBB integers rather than `THREE.Color` so the whole module stays free of the
 * renderer and can be unit-tested, and so a transition is a plain numeric interpolation.
 */
export interface StageVisual {
  /** Whether the central body is drawn at all: a molecular cloud has no star in it yet. */
  coreVisible: boolean
  /** Drawn radius of the central body, scene units. Compressed - see `compressRadius`. */
  coreRadius: number
  coreColor: number
  /** Opacity of a dark shell drawn over the core: a protostar's dust, not a black hole's shadow. */
  occluderOpacity: number
  occluderRadius: number
  /** Soft halo around the core, in scene units. */
  haloScale: number
  haloColor: number
  haloOpacity: number
  /** Particle shell: cold cloud, stellar wind, ionised nebula, supernova remnant. */
  cloudRadius: number
  cloudColor: number
  cloudOpacity: number
  /**
   * Opacity of the hollow shell that shares the cloud's every other property.
   *
   * A cloud is filled through its volume; a planetary nebula and a supernova remnant are shells, and
   * a filled one reads as a scattered field rather than as a ring around the star. The demo builds
   * one buffer of each shape and the stage says which of them it wants.
   */
  cloudShellOpacity: number
  /** Ellipsoidal compression: shells retain their three-dimensional depth. */
  cloudFlatten: number
  /**
   * Drawn size of one particle, scene units.
   *
   * A cold cloud wants large soft blobs that merge into a haze; a supernova remnant wants finer
   * points so its shell reads as a shell. One particle buffer is reused for all of them, so the
   * size is the only thing that distinguishes them.
   */
  cloudSize: number
  /**
   * Tilt of the shell out of the horizontal, radians.
   *
   * The camera sits barely above the equatorial plane, so a flattened shell left untilted is seen
   * almost edge on and reads as a band across the frame rather than as a ring around the star. The
   * planetary nebula and the supernova remnant both need to face the viewer to look like what they
   * are.
   */
  cloudTilt: number
  /** Circumstellar or accretion disk. */
  diskRadius: number
  diskColor: number
  diskOpacity: number
  /** Bipolar outflow from a protostar, or a pulsar's lighthouse beams. */
  beamColor: number
  beamOpacity: number
  /**
   * Drawn length of those beams, as a multiple of the shape's own.
   *
   * A protostar's outflow genuinely reaches far past the star; a pulsar's beams belong to a body
   * twelve kilometres across, and drawn at the same size they swamp the frame and hide how small
   * the star is - which is the one thing that stage has to say.
   */
  beamScale: number
  /** Thin bright ring hugging the core: the photon sphere of a black hole. */
  photonRingColor: number
  photonRingOpacity: number
  /** The starburst sprite, used for the supernova's flash and nothing else. */
  flashOpacity: number
  /** The fixed circle marking the Sun's main-sequence radius, for the size comparison. */
  referenceOpacity: number
  /** Angular speed of the core's surface, radians per second. */
  spinRate: number
  /** Fractional brightness swing, 0 for a steady star. */
  pulseDepth: number
  /** Pulsation rate, radians per second. */
  pulseRate: number
}

/** The drawn radius of a stage that is a single star, straight from its real radius. */
function drawnRadius(id: StageId): number {
  const radiusSolar = STAGE_RADIUS_SOLAR[id]
  if (radiusSolar === null) return 0.06
  return compressRadius(radiusSolar)
}

/**
 * The nine looks.
 *
 * The colours are what the body would actually look like at the temperature `stages.ts` states:
 * the protostar and the red giant are orange because a 3000-3500 K surface glows mostly in the red,
 * the planetary nebula's core and the white dwarf are blue-white because they are far hotter, and
 * the molecular cloud is brown because it is cold dust seen against the sky.
 */
export const STAGE_VISUALS: Record<StageId, StageVisual> = {
  'molecular-cloud': {
    coreVisible: false,
    coreRadius: drawnRadius('molecular-cloud'),
    coreColor: 0x000000,
    occluderOpacity: 0,
    occluderRadius: 0.06,
    haloScale: 0.4,
    haloColor: 0x2a1c14,
    haloOpacity: 0.16,
    cloudRadius: 3.15,
    cloudColor: 0x8e827b,
    cloudOpacity: 0.64,
    cloudShellOpacity: 0,
    cloudFlatten: 0.12,
    cloudSize: 0.68,
    cloudTilt: 0.15,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0,
    spinRate: 0.02,
    pulseDepth: 0,
    pulseRate: 0,
  },
  'protostar': {
    coreVisible: true,
    coreRadius: drawnRadius('protostar'),
    coreColor: 0xffbd85,
    // Still buried: most of the protostar's light is absorbed by its own dust envelope and
    // re-emitted in the infrared, which is why it is dim and red rather than bright.
    occluderOpacity: 0.46,
    occluderRadius: 1.43,
    haloScale: 3.5,
    haloColor: 0xff8a4a,
    haloOpacity: 0.3,
    cloudRadius: 2.7,
    cloudColor: 0x857566,
    cloudOpacity: 0.15,
    cloudShellOpacity: 0,
    cloudFlatten: 0.64,
    cloudSize: 0.5,
    cloudTilt: 0.5,
    diskRadius: 2.6,
    diskColor: 0xffd4aa,
    diskOpacity: 0.68,
    beamColor: 0xc4b4a0,
    beamOpacity: 0.4,
    beamScale: 1.35,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0.16,
    spinRate: 0.45,
    pulseDepth: 0.05,
    pulseRate: 1.4,
  },
  'main-sequence': {
    coreVisible: true,
    coreRadius: drawnRadius('main-sequence'),
    coreColor: 0xfff5e9,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 3.6,
    haloColor: 0xffe8cc,
    haloOpacity: 0.36,
    cloudRadius: 0,
    cloudColor: 0x000000,
    cloudOpacity: 0,
    cloudShellOpacity: 0,
    cloudFlatten: 0,
    cloudSize: 0.12,
    cloudTilt: 0,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    // The stage the reference circle is named for, so it is not drawn here - the body is the
    // reference. Showing a ring exactly on its limb would only look like an artefact.
    referenceOpacity: 0,
    spinRate: 0.065,
    pulseDepth: 0,
    pulseRate: 0,
  },
  'red-giant': {
    coreVisible: true,
    coreRadius: drawnRadius('red-giant'),
    coreColor: 0xffb679,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 7.3,
    haloColor: 0xffad6e,
    haloOpacity: 0.28,
    cloudRadius: 3.15,
    cloudColor: 0x8c4a2c,
    cloudOpacity: 0.035,
    cloudShellOpacity: 0,
    cloudFlatten: 0.2,
    cloudSize: 0.42,
    cloudTilt: 0.25,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0.5,
    spinRate: 0.028,
    // A late-stage red giant is a pulsating variable: its envelope breathes, so its brightness
    // genuinely swings by a few per cent over weeks to years.
    pulseDepth: 0.025,
    pulseRate: 0.8,
  },
  'planetary-nebula': {
    coreVisible: true,
    coreRadius: drawnRadius('planetary-nebula'),
    coreColor: 0xd9e6ff,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 1.45,
    haloColor: 0xd6e6ff,
    haloOpacity: 0.3,
    cloudRadius: 2.55,
    cloudColor: 0x7ac3cb,
    cloudOpacity: 0,
    cloudShellOpacity: 0.9,
    // A projected bright rim comes from shell depth, not flattening the gas into a disk.
    cloudFlatten: 0.18,
    cloudSize: 0.055,
    cloudTilt: 1.05,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0.4,
    spinRate: 0.02,
    pulseDepth: 0,
    pulseRate: 0,
  },
  'white-dwarf': {
    coreVisible: true,
    coreRadius: drawnRadius('white-dwarf'),
    coreColor: 0xe6edff,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 1.5,
    haloColor: 0xd4e5ff,
    haloOpacity: 0.25,
    cloudRadius: 0,
    cloudColor: 0x000000,
    cloudOpacity: 0,
    cloudShellOpacity: 0,
    cloudFlatten: 0,
    cloudSize: 0.12,
    cloudTilt: 0,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0.24,
    spinRate: 0.08,
    pulseDepth: 0,
    pulseRate: 0,
  },
  'supernova': {
    coreVisible: true,
    coreRadius: 0.18,
    coreColor: 0xffffff,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 4.6,
    haloColor: 0xfff0d0,
    haloOpacity: 0.65,
    cloudRadius: 2.7,
    cloudColor: 0x9fd0ff,
    cloudOpacity: 0,
    cloudShellOpacity: 0.9,
    cloudFlatten: 0.06,
    cloudSize: 0.055,
    cloudTilt: 0.7,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0.9,
    referenceOpacity: 0,
    spinRate: 0.04,
    pulseDepth: 0,
    pulseRate: 3.4,
  },
  'neutron-star': {
    coreVisible: true,
    coreRadius: drawnRadius('neutron-star'),
    coreColor: 0xd8ecff,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 0.65,
    haloColor: 0xa8d0ff,
    haloOpacity: 0.4,
    cloudRadius: 0,
    cloudColor: 0x000000,
    cloudOpacity: 0,
    cloudShellOpacity: 0,
    cloudFlatten: 0,
    cloudSize: 0.12,
    cloudTilt: 0,
    diskRadius: 0,
    diskColor: 0x000000,
    diskOpacity: 0,
    beamColor: 0xb4daed,
    beamOpacity: 0.5,
    beamScale: 0.85,
    photonRingColor: 0x000000,
    photonRingOpacity: 0,
    flashOpacity: 0,
    referenceOpacity: 0,
    // A millisecond pulsar turns hundreds of times a second; the drawing cannot show that, so it
    // turns fast enough to read as a lighthouse and the card gives the real figure.
    spinRate: 2.6,
    pulseDepth: 0.18,
    pulseRate: 5,
  },
  'black-hole': {
    coreVisible: true,
    coreRadius: drawnRadius('black-hole'),
    // The shadow: not a surface, an absence. Nothing else in the demo is drawn pure black.
    coreColor: 0x000000,
    occluderOpacity: 0,
    occluderRadius: 0,
    haloScale: 0.5,
    haloColor: 0x000000,
    haloOpacity: 0,
    cloudRadius: 0,
    cloudColor: 0x000000,
    cloudOpacity: 0,
    cloudShellOpacity: 0,
    cloudFlatten: 0,
    cloudSize: 0.12,
    cloudTilt: 0,
    diskRadius: 1.8,
    diskColor: 0xffc98c,
    diskOpacity: 0.92,
    beamColor: 0x000000,
    beamOpacity: 0,
    beamScale: 1,
    photonRingColor: 0xffd9a0,
    photonRingOpacity: 0.95,
    flashOpacity: 0,
    referenceOpacity: 0,
    spinRate: 0.3,
    pulseDepth: 0,
    pulseRate: 0,
  },
}

/** The look of a stage by id. */
export function stageVisual(id: StageId): StageVisual {
  return STAGE_VISUALS[id]
}

/** The look of whatever stage is at an index. `stageAt` clamps, so any number is safe here. */
export function stageVisualAt(index: number): StageVisual {
  return STAGE_VISUALS[stageAt(index).id]
}

/** Smooth start and end, so a stage change accelerates and settles instead of snapping. */
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - ((-2 * clamped + 2) ** 3) / 2
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** Channel-wise interpolation of two 0xRRGGBB colours. */
export function lerpColor(from: number, to: number, t: number): number {
  const red = Math.round(mix((from >> 16) & 0xff, (to >> 16) & 0xff, t))
  const green = Math.round(mix((from >> 8) & 0xff, (to >> 8) & 0xff, t))
  const blue = Math.round(mix(from & 0xff, to & 0xff, t))
  return (red << 16) | (green << 8) | blue
}

/**
 * Interpolates two looks.
 *
 * A stage change is a morph of the whole drawing rather than a cut, which is what makes the red
 * giant visibly swell out of the main sequence and the white dwarf visibly shrink into a dot. The
 * booleans are not interpolated - the core is drawn when either end of the transition draws it, and
 * its opacity carries the change.
 */
export function lerpVisual(from: StageVisual, to: StageVisual, t: number): StageVisual {
  if (t <= 0) return from
  if (t >= 1) return to
  return {
    // The one field that cannot be interpolated. In the middle of a morph the core is drawn if
    // either end draws it, which is what lets a protostar's core swell into existence out of the
    // cloud it is condensing from; at the two ends the answer is exact.
    coreVisible: t >= 1 ? to.coreVisible : t <= 0 ? from.coreVisible : true,
    coreRadius: mix(from.coreRadius, to.coreRadius, t),
    coreColor: lerpColor(from.coreColor, to.coreColor, t),
    occluderOpacity: mix(from.occluderOpacity, to.occluderOpacity, t),
    occluderRadius: mix(from.occluderRadius, to.occluderRadius, t),
    haloScale: mix(from.haloScale, to.haloScale, t),
    haloColor: lerpColor(from.haloColor, to.haloColor, t),
    haloOpacity: mix(from.haloOpacity, to.haloOpacity, t),
    cloudRadius: mix(from.cloudRadius, to.cloudRadius, t),
    cloudColor: lerpColor(from.cloudColor, to.cloudColor, t),
    cloudOpacity: mix(from.cloudOpacity, to.cloudOpacity, t),
    cloudShellOpacity: mix(from.cloudShellOpacity, to.cloudShellOpacity, t),
    cloudFlatten: mix(from.cloudFlatten, to.cloudFlatten, t),
    cloudSize: mix(from.cloudSize, to.cloudSize, t),
    cloudTilt: mix(from.cloudTilt, to.cloudTilt, t),
    diskRadius: mix(from.diskRadius, to.diskRadius, t),
    diskColor: lerpColor(from.diskColor, to.diskColor, t),
    diskOpacity: mix(from.diskOpacity, to.diskOpacity, t),
    beamColor: lerpColor(from.beamColor, to.beamColor, t),
    beamOpacity: mix(from.beamOpacity, to.beamOpacity, t),
    beamScale: mix(from.beamScale, to.beamScale, t),
    photonRingColor: lerpColor(from.photonRingColor, to.photonRingColor, t),
    photonRingOpacity: mix(from.photonRingOpacity, to.photonRingOpacity, t),
    flashOpacity: mix(from.flashOpacity, to.flashOpacity, t),
    referenceOpacity: mix(from.referenceOpacity, to.referenceOpacity, t),
    spinRate: mix(from.spinRate, to.spinRate, t),
    pulseDepth: mix(from.pulseDepth, to.pulseDepth, t),
    pulseRate: mix(from.pulseRate, to.pulseRate, t),
  }
}

/** The reference circle's radius in scene units: the Sun on the main sequence. */
export const REFERENCE_RADIUS = SCENE.referenceRadius
