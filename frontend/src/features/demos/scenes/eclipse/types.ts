/**
 * The eclipse demo's own vocabulary.
 *
 * These types are shared by exactly two files - `scene.ts` and `EclipseControlPanel.vue` - and are
 * deliberately not part of the shared demo shell. The shell carries a state snapshot and a command
 * across without reading either; see `DemoDefinition.controlPanel` in `registry.ts`.
 */

/** Which pair of bodies the demo is lining up. */
export type EclipseSection = 'solar' | 'lunar'

/** The arrangement in space, or the sky as seen from a chosen point. */
export type EclipseViewMode = 'system' | 'observer'

/**
 * What the geometry says is happening at one instant.
 *
 * `none` is not one of astronomy-engine's eclipse kinds: it is what the discs say when they are
 * clear of each other, which is most of the time even inside an eclipse's own window.
 */
export type EclipseEventKind = 'none' | 'penumbral' | 'partial' | 'total' | 'annular'

/** One eclipse the viewer can jump to, as the picker needs to see it. */
export interface EclipseEventSummary {
  kind: EclipseEventKind
  /** Instant of greatest eclipse, epoch milliseconds. */
  peakMs: number
  /**
   * Geographic point where the eclipse is greatest, for solar eclipses that have one.
   * astronomy-engine publishes these only for total and annular eclipses; lunar eclipses have none.
   */
  latitudeDeg: number | null
  longitudeDeg: number | null
}

/** A point in the sky plane, in degrees, with the covered body's centre at the origin. */
export interface EclipseSkyOffset {
  x: number
  y: number
}

/** One phase of the selected eclipse, as a span of the scrubber. */
export interface EclipsePhaseBand {
  kind: EclipseEventKind
  startMs: number
  endMs: number
}

/**
 * Everything the control panel draws.
 *
 * Two kinds of number live here and they are not interchangeable. The `*Deg` and `*Km` fields are
 * real measurements that come straight from the ephemeris; the scene's display scale never touches
 * them. The scene's own geometry is schematic and stays inside `scene.ts`.
 */
export interface EclipseSceneState {
  section: EclipseSection
  view: EclipseViewMode
  showShadows: boolean
  showLabels: boolean
  showPlane: boolean
  /** True while the demo is drawing the zero-inclination teaching assumption. */
  teachingZeroInclination: boolean
  playing: boolean
  /** Cue effects are visual guidance only; they never alter eclipse classification. */
  guideCue: string | null
  guideProgress: number

  /** Simulated instant, epoch milliseconds. */
  timeMs: number
  /** Scrubber bounds: the selected event's own window, padded a little. */
  windowStartMs: number
  windowEndMs: number
  /** The selected event's peak, epoch milliseconds. */
  peakMs: number
  /** What the geometry says is happening at `timeMs`. */
  kind: EclipseEventKind
  /** The greatest kind the selected event reaches. */
  eventKind: EclipseEventKind

  /** Apparent angular radius of the Sun, degrees. */
  sunAngularRadiusDeg: number
  /** Apparent angular radius of the Moon, degrees. */
  moonAngularRadiusDeg: number
  /** Angle between the centres of the two discs the section is about, degrees. */
  separationDeg: number
  /** Fraction of the covered disc that is hidden, 0-1. */
  obscuration: number
  /** Where the Moon's centre sits relative to the other disc's centre, degrees. */
  skyOffsetDeg: EclipseSkyOffset
  /** Apparent angular radius of the Earth's umbra at the Moon, degrees. */
  umbraAngularRadiusDeg: number
  /** Apparent angular radius of the Earth's penumbra at the Moon, degrees. */
  penumbraAngularRadiusDeg: number
  /** Fraction of the Moon's disc that is inside the Earth's umbra, 0-1. */
  umbraCoverage: number
  /** Height of the Sun above the observer's horizon, degrees. Negative means night. */
  sunAltitudeDeg: number
  /** Distance from the Moon's centre to the axis of the Earth's shadow, km. */
  axisDistanceKm: number

  /** Real distance from the shadow caster's centre to the target's centre, km. */
  casterToTargetKm: number
  /** Real length of the caster's umbra, km. */
  umbraLengthKm: number
  /** Radius of the caster's umbra where the target's centre sits, km. Negative past the apex. */
  umbraRadiusAtTargetKm: number
  /** Radius of the caster's penumbra where the target's centre sits, km. */
  penumbraRadiusAtTargetKm: number

  /** Inclination actually being drawn, degrees: the real value, or zero under the lesson switch. */
  inclinationDeg: number
  /** Ecliptic longitude of the ascending node, degrees. */
  nodeLongitudeDeg: number
  /** The Moon's ecliptic latitude at `timeMs`, degrees. Near zero during an eclipse. */
  moonEclipticLatitudeDeg: number

  events: EclipseEventSummary[]
  selectedEventIndex: number
  /** The selected event's phases, in order, for the scrubber's bands. */
  phaseBands: EclipsePhaseBand[]

  /** Geographic point the observer stands on, degrees. */
  observerLatitudeDeg: number
  observerLongitudeDeg: number
  /** How far the observer has been moved from the selected event's peak point, degrees. */
  observerOffsetLatDeg: number
  observerOffsetLonDeg: number
  /** The selected event's published peak point, or null when astronomy-engine has none. */
  peakLatitudeDeg: number | null
  peakLongitudeDeg: number | null
}

/** What the panel can ask the scene to do. */
export type EclipseCommand =
  | { type: 'section', section: EclipseSection }
  | { type: 'view', view: EclipseViewMode }
  | { type: 'toggle', control: 'shadows' | 'labels' | 'plane' }
  | { type: 'teaching', enabled: boolean }
  | { type: 'scrub', timeMs: number }
  | { type: 'event', index: number }
  | { type: 'observer', latitudeOffsetDeg: number, longitudeOffsetDeg: number }
  /** Jumps the timeline to greatest eclipse, which is where the picture is worth looking at. */
  | { type: 'scrub-to-peak' }
  /**
   * Moves the observer to a place with a known kind of eclipse: on the central path, or off it
   * where the eclipse is partial. A partial eclipse is a property of where you stand rather than of
   * the event, so it cannot be offered as an event to pick - it has to be found.
   */
  | { type: 'observer-preset', preset: 'central' | 'off-path' }
  | { type: 'reset' }

/**
 * Narrows a value the shell carried across from the panel.
 *
 * The shell hands `runCommand` an `unknown`, because naming a command there would defeat the point
 * of the channel. This is where the demo puts its own shape back on it.
 */
export function isEclipseCommand(value: unknown): value is EclipseCommand {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return type === 'section' || type === 'view' || type === 'toggle' || type === 'teaching'
    || type === 'scrub' || type === 'event' || type === 'observer' || type === 'scrub-to-peak'
    || type === 'observer-preset' || type === 'reset'
}
