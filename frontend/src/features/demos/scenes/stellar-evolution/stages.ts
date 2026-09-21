import { MASS_LIMITS, STAGE_DURATION_YEARS, STAGE_DWELL_MS, STAGE_RADIUS_SOLAR } from './config'
import type { StageCategory, StageId, StageLabel, StageLabelAnchor, StageTrack } from './types'

/**
 * One stage of a star's life, as the demo tells it.
 *
 * Real quantities and presentation choices sit side by side here and are named so they cannot be
 * confused: `radiusSolar`, `temperatureK`, `durationYears` and `massSolar` are published values,
 * while `dwellMs` is how long autoplay lingers so the card can be read. The drawn radius is not
 * here at all - it is derived in `visuals.ts` from `radiusSolar`, so nothing that is a measurement
 * can be quietly overwritten by something that is a drawing.
 */
export interface StageDefinition {
  id: StageId
  track: StageTrack
  category: StageCategory
  /** Locale keys for the card. */
  nameKey: string
  taglineKey: string
  bodyKey: string
  /** Short "what to look at" lines, in order. */
  featureKeys: readonly string[]
  /** What this stage means for the Sun specifically, or why it never happens to it. */
  sunKey: string
  /** The one-line readout the shell shows under the stage. */
  readoutKey: string
  /** Real radius of the stage's body in solar radii, or null when it is not one star. */
  radiusSolar: number | null
  /** Real effective temperature of the stage's visible surface, K, or null when it has none. */
  temperatureK: number | null
  /** Real duration of the stage, years. Null means it does not end. */
  durationYears: number | null
  /**
   * Real mass of the body the stage is about, solar masses: the star for the stellar stages, the
   * remnant for the remnants. The two massive-track remnants are the only entries that are not the
   * mass of a whole star, which is exactly the point of that track.
   */
  massSolar: number
  /** Autoplay dwell, milliseconds. A presentation choice, not a measurement. */
  dwellMs: number
  /** Labels the scene publishes while this stage is on screen. */
  labels: readonly StageLabel[]
}

const BASE = 'demos.items.stellarEvolution'

/** The six locale keys every stage card needs, derived from one short name. */
function keysFor(short: string): Pick<
  StageDefinition,
  'nameKey' | 'taglineKey' | 'bodyKey' | 'featureKeys' | 'sunKey' | 'readoutKey'
> {
  const base = `${BASE}.stages.${short}`
  return {
    nameKey: `${base}.name`,
    taglineKey: `${base}.tagline`,
    bodyKey: `${base}.body`,
    featureKeys: [`${base}.feature1`, `${base}.feature2`, `${base}.feature3`],
    sunKey: `${base}.sun`,
    readoutKey: `${base}.readout`,
  }
}

function label(id: string, anchor: StageLabelAnchor): StageLabel {
  return {
    id,
    anchor,
    textKey: `${BASE}.labels.${id}`,
    descriptionKey: `${BASE}.labels.${id}About`,
  }
}

/**
 * The nine stages, in the order the timeline plays them.
 *
 * The order is a narrative rather than a single star's life: stages 1-6 are the path of a star like
 * the Sun, and stages 7-9 are the path of a star massive enough to do something else. `track` marks
 * the fork, and `TRACK_BRANCH_AFTER_INDEX` says where the timeline should draw it.
 */
export const STAGES: readonly StageDefinition[] = [
  {
    id: 'molecular-cloud',
    track: 'solar',
    category: 'birth',
    ...keysFor('molecularCloud'),
    radiusSolar: STAGE_RADIUS_SOLAR['molecular-cloud'],
    // Cold molecular gas: 10-20 K, with dust as the only solid. This is the temperature of the
    // cloud, not of a photosphere, which is why the card labels the row "介质温度" here.
    temperatureK: 15,
    durationYears: STAGE_DURATION_YEARS['molecular-cloud'],
    massSolar: 1,
    dwellMs: STAGE_DWELL_MS['molecular-cloud'],
    labels: [
      label('molecularCloud', 'shell-above'),
      label('dustGrains', 'shell-left'),
      label('gravitationalCollapse', 'shell-right'),
    ],
  },
  {
    id: 'protostar',
    track: 'solar',
    category: 'birth',
    ...keysFor('protostar'),
    radiusSolar: STAGE_RADIUS_SOLAR.protostar,
    temperatureK: 3500,
    durationYears: STAGE_DURATION_YEARS.protostar,
    massSolar: 1,
    dwellMs: STAGE_DWELL_MS.protostar,
    labels: [
      label('protostar', 'core-above'),
      label('protostarDisk', 'disk-right'),
      label('bipolarOutflow', 'beam-above'),
      // To the side rather than above: the protostar, the jets and the envelope all resolve to
      // points near the top of the frame, and three captions stacked up there read as one block.
      label('dustEnvelope', 'shell-left'),
    ],
  },
  {
    id: 'main-sequence',
    track: 'solar',
    category: 'main',
    ...keysFor('mainSequence'),
    radiusSolar: STAGE_RADIUS_SOLAR['main-sequence'],
    temperatureK: 5772,
    durationYears: STAGE_DURATION_YEARS['main-sequence'],
    massSolar: 1,
    dwellMs: STAGE_DWELL_MS['main-sequence'],
    labels: [
      label('sun', 'core-above'),
      label('coreFusion', 'core-right'),
      label('photosphere', 'core-left'),
      label('referenceCircle', 'frame-right'),
    ],
  },
  {
    id: 'red-giant',
    track: 'solar',
    category: 'late',
    ...keysFor('redGiant'),
    radiusSolar: STAGE_RADIUS_SOLAR['red-giant'],
    // A red giant's photosphere is cool, a little over 3000 K, which is why it is red: the same
    // physics that makes an iron bar glow red rather than white as it cools.
    temperatureK: 3300,
    durationYears: STAGE_DURATION_YEARS['red-giant'],
    massSolar: 1,
    dwellMs: STAGE_DWELL_MS['red-giant'],
    labels: [
      label('redGiant', 'core-above'),
      label('expandingEnvelope', 'core-right'),
      label('heliumCore', 'core-left'),
      label('referenceCircle', 'frame-right'),
    ],
  },
  {
    id: 'planetary-nebula',
    track: 'solar',
    category: 'late',
    ...keysFor('planetaryNebula'),
    radiusSolar: STAGE_RADIUS_SOLAR['planetary-nebula'],
    // The exposed core is hot enough to ionise the shell it has just shed.
    temperatureK: 30_000,
    durationYears: STAGE_DURATION_YEARS['planetary-nebula'],
    massSolar: 1,
    dwellMs: STAGE_DWELL_MS['planetary-nebula'],
    labels: [
      label('centralStar', 'core-above'),
      label('ionisedShell', 'shell-above'),
      label('planetaryNebulaMisnomer', 'shell-right'),
      label('referenceCircle', 'frame-left'),
    ],
  },
  {
    id: 'white-dwarf',
    track: 'solar',
    category: 'remnant',
    ...keysFor('whiteDwarf'),
    radiusSolar: STAGE_RADIUS_SOLAR['white-dwarf'],
    // A typical hydrogen-atmosphere white dwarf, cooling down from hotter beginnings.
    temperatureK: 12_000,
    durationYears: STAGE_DURATION_YEARS['white-dwarf'],
    massSolar: 0.55,
    dwellMs: STAGE_DWELL_MS['white-dwarf'],
    labels: [
      label('whiteDwarf', 'core-above'),
      label('degeneracyPressure', 'core-right'),
      label('referenceCircle', 'frame-right'),
    ],
  },
  {
    id: 'supernova',
    track: 'massive',
    category: 'late',
    ...keysFor('supernova'),
    radiusSolar: STAGE_RADIUS_SOLAR.supernova,
    // Temperature of the shock front, not of a photosphere: the envelope is gone.
    temperatureK: 1e9,
    durationYears: STAGE_DURATION_YEARS.supernova,
    massSolar: 20,
    dwellMs: STAGE_DWELL_MS.supernova,
    labels: [
      label('shockFront', 'shell-above'),
      label('ironCoreCollapse', 'core-above'),
      label('luminositySpike', 'shell-right'),
    ],
  },
  {
    id: 'neutron-star',
    track: 'massive',
    category: 'remnant',
    ...keysFor('neutronStar'),
    radiusSolar: STAGE_RADIUS_SOLAR['neutron-star'],
    // A young pulsar's surface: about half a million kelvin, still cooling.
    temperatureK: 6e5,
    durationYears: STAGE_DURATION_YEARS['neutron-star'],
    massSolar: 1.4,
    dwellMs: STAGE_DWELL_MS['neutron-star'],
    labels: [
      label('neutronStar', 'core-above'),
      label('pulsarBeams', 'beam-above'),
      label('magneticField', 'core-right'),
    ],
  },
  {
    id: 'black-hole',
    track: 'massive',
    category: 'remnant',
    ...keysFor('blackHole'),
    radiusSolar: STAGE_RADIUS_SOLAR['black-hole'],
    // An event horizon has no surface to have a temperature. The accretion disk around it does,
    // and that is a separate number the card states in words rather than in this field.
    temperatureK: null,
    durationYears: STAGE_DURATION_YEARS['black-hole'],
    massSolar: 10,
    dwellMs: STAGE_DWELL_MS['black-hole'],
    labels: [
      label('blackHoleShadow', 'core-above'),
      label('blackHoleDisk', 'disk-right'),
      label('photonRing', 'core-right'),
    ],
  },
]

/** The stage order, for anything that only needs the ids. */
export const STAGE_ORDER: readonly StageId[] = STAGES.map((stage) => stage.id)

/**
 * The index the two tracks part company at.
 *
 * Up to and including the main sequence a star's life is much the same whatever its mass; what
 * happens next is decided by whether it can build an iron core. The timeline draws its fork here,
 * and the panel groups the stages around it.
 */
export const TRACK_BRANCH_AFTER_INDEX = STAGE_ORDER.indexOf('main-sequence')

export function stageCount(): number {
  return STAGES.length
}

/** Clamps an index into the timeline, so a stray command cannot point past either end. */
export function clampStageIndex(index: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.min(STAGES.length - 1, Math.max(0, Math.round(index)))
}

export function stageAt(index: number): StageDefinition {
  return STAGES[clampStageIndex(index)]!
}

export function stageIndex(id: StageId): number {
  return STAGE_ORDER.indexOf(id)
}

export function stageById(id: StageId): StageDefinition {
  return STAGES[stageIndex(id)]!
}

/** The stages the Sun itself goes through, which is exactly the solar track. */
export function solarTrackStages(): readonly StageDefinition[] {
  return STAGES.filter((stage) => stage.track === 'solar')
}

/** The stages only a massive star reaches. */
export function massiveTrackStages(): readonly StageDefinition[] {
  return STAGES.filter((stage) => stage.track === 'massive')
}

/**
 * The mass below which a star ends as a white dwarf rather than a supernova, solar masses.
 *
 * Re-exported from the config so the panel and the tests read the same number the science text
 * quotes, instead of each carrying its own copy.
 */
export const SUPERNOVA_MASS_THRESHOLD_SOLAR = MASS_LIMITS.coreCollapseSupernovaSolar

/** Every label id the scene can publish. */
export const STAGE_LABEL_IDS: readonly string[] = STAGES
  .flatMap((stage) => stage.labels)
  .map((entry) => entry.id)
