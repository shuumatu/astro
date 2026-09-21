import { STAGES } from './stages'
import type { StageCategory, StageTrack } from './types'

/**
 * Every locale key the stellar-evolution demo renders, in one place.
 *
 * The panel reads its strings from here and `registry.test.ts` resolves this same list against both
 * bundles, so a renamed key cannot quietly degrade into a raw key on screen. That is the same
 * arrangement the eclipse demo uses, and it matters more here: the demo is mostly text - nine stage
 * cards, twenty-eight labels with explanations, and a data card about the Sun - so a missing string
 * would be a hole in the middle of the science rather than a cosmetic slip.
 */
const BASE = 'demos.items.stellarEvolution'

/** Chrome around the demo: title, hint, and the panel's own headings and buttons. */
export const STELLAR_EVOLUTION_KEYS = {
  title: `${BASE}.title`,
  summary: `${BASE}.summary`,
  hint: `${BASE}.hint`,
  credit: `${BASE}.credit`,

  panelTitle: `${BASE}.panel.title`,
  panelCollapse: `${BASE}.panel.collapse`,
  panelExpand: `${BASE}.panel.expand`,
  panelTimelineAria: `${BASE}.panel.timelineAria`,
  panelPrevious: `${BASE}.panel.previous`,
  panelNext: `${BASE}.panel.next`,
  panelPlay: `${BASE}.panel.play`,
  panelPause: `${BASE}.panel.pause`,
  panelRestart: `${BASE}.panel.restart`,
  panelStageCounter: `${BASE}.panel.stageCounter`,
  panelProgressAria: `${BASE}.panel.progressAria`,
  panelKeyFeatures: `${BASE}.panel.keyFeatures`,
  panelSunNote: `${BASE}.panel.sunNote`,
  panelFacts: `${BASE}.panel.facts`,
  panelTrack: `${BASE}.panel.track`,
  panelSharedPath: `${BASE}.panel.sharedPath`,
  panelForkTitle: `${BASE}.panel.forkTitle`,
  panelForkHint: `${BASE}.panel.forkHint`,
  panelSolarBranch: `${BASE}.panel.solarBranch`,
  panelMassiveBranch: `${BASE}.panel.massiveBranch`,
  panelRemnantFork: `${BASE}.panel.remnantFork`,
  panelBranchCurrent: `${BASE}.panel.branchCurrent`,
  panelScaleNote: `${BASE}.panel.scaleNote`,
  appearanceTitle: `${BASE}.appearance.title`,
  appearanceSource: `${BASE}.appearance.source`,
  panelAutoplayNote: `${BASE}.panel.autoplayNote`,
  panelSunCurrent: `${BASE}.panel.sunCurrent`,

  factRadius: `${BASE}.panel.fact.radius`,
  factTemperature: `${BASE}.panel.fact.temperature`,
  factDuration: `${BASE}.panel.fact.duration`,
  factMass: `${BASE}.panel.fact.mass`,
  factMassRemnant: `${BASE}.panel.fact.massRemnant`,
  factNoSurface: `${BASE}.panel.fact.noSurface`,
  factOngoing: `${BASE}.panel.fact.ongoing`,
  factCloudTemperature: `${BASE}.panel.fact.cloudTemperature`,
  factShockTemperature: `${BASE}.panel.fact.shockTemperature`,
  factRemnantDuration: `${BASE}.panel.fact.remnantDuration`,
  unitYears: `${BASE}.panel.unitYears`,

  sunCardTitle: `${BASE}.sun.title`,
  sunCardMass: `${BASE}.sun.mass`,
  sunCardMassValue: `${BASE}.sun.massValue`,
  sunCardAge: `${BASE}.sun.age`,
  sunCardAgeValue: `${BASE}.sun.ageValue`,
  sunCardTemperature: `${BASE}.sun.temperature`,
  sunCardTemperatureValue: `${BASE}.sun.temperatureValue`,
  sunCardDiameter: `${BASE}.sun.diameter`,
  sunCardDiameterValue: `${BASE}.sun.diameterValue`,
  sunCardLifetime: `${BASE}.sun.lifetime`,
  sunCardLifetimeValue: `${BASE}.sun.lifetimeValue`,
  sunCardSpectralType: `${BASE}.sun.spectralType`,
  sunCardSpectralTypeValue: `${BASE}.sun.spectralTypeValue`,
  sunCardCoreTemperature: `${BASE}.sun.coreTemperature`,
  sunCardCoreTemperatureValue: `${BASE}.sun.coreTemperatureValue`,

  tracksTitle: `${BASE}.tracks.title`,
  tracksSolar: `${BASE}.tracks.solar`,
  tracksSolarRange: `${BASE}.tracks.solarRange`,
  tracksSolarEnding: `${BASE}.tracks.solarEnding`,
  tracksMassive: `${BASE}.tracks.massive`,
  tracksMassiveRange: `${BASE}.tracks.massiveRange`,
  tracksMassiveEnding: `${BASE}.tracks.massiveEnding`,
  tracksSunNeverSupernova: `${BASE}.tracks.sunNeverSupernova`,
} as const

/** The two tracks, as the comparison block names them. */
export const TRACK_KEYS: Record<StageTrack, string> = {
  solar: `${BASE}.tracks.solarShort`,
  massive: `${BASE}.tracks.massiveShort`,
}

/** The four life phases, as the timeline groups them. */
export const CATEGORY_KEYS: Record<StageCategory, string> = {
  birth: `${BASE}.categories.birth`,
  main: `${BASE}.categories.main`,
  late: `${BASE}.categories.late`,
  remnant: `${BASE}.categories.remnant`,
}

/**
 * The labels the scene publishes as DOM anchors, keyed by the id it publishes them under.
 *
 * Each carries an explanation as well as a name. The explanation is what the shell shows when the
 * viewer points at the label, and it earns its place here because most of these words are terms of
 * art - "简并压", "光子环", "行星状星云" (which has nothing to do with planets) - and the two that
 * are not, the Sun and the white dwarf, get one anyway so the tooltip does not appear on some
 * labels and not others.
 */
export interface StellarEvolutionLabelCopy {
  textKey: string
  descriptionKey: string
}

const LABEL_BASE = `${BASE}.labels`

function labelCopy(id: string): StellarEvolutionLabelCopy {
  return { textKey: `${LABEL_BASE}.${id}`, descriptionKey: `${LABEL_BASE}.${id}About` }
}

export const STELLAR_EVOLUTION_LABELS: Record<string, StellarEvolutionLabelCopy> = Object.fromEntries(
  [
    'molecularCloud', 'dustGrains', 'gravitationalCollapse',
    'protostar', 'protostarDisk', 'bipolarOutflow', 'dustEnvelope',
    'sun', 'coreFusion', 'photosphere', 'referenceCircle',
    'redGiant', 'expandingEnvelope', 'heliumCore',
    'centralStar', 'ionisedShell', 'planetaryNebulaMisnomer',
    'whiteDwarf', 'degeneracyPressure',
    'shockFront', 'ironCoreCollapse', 'luminositySpike',
    'neutronStar', 'pulsarBeams', 'magneticField',
    'eventHorizon', 'blackHoleShadow', 'blackHoleDisk', 'photonRing',
  ].map((id) => [id, labelCopy(id)]),
)

/**
 * Every stage card key, in stage order.
 *
 * Derived from `STAGES` rather than written out again, so the card a stage shows and the string the
 * locale test resolves cannot drift apart.
 */
export const STAGE_CARD_KEYS: readonly string[] = STAGES.flatMap((stage) => [
  stage.nameKey,
  stage.taglineKey,
  stage.bodyKey,
  ...stage.featureKeys,
  stage.sunKey,
  stage.readoutKey,
])

/** The whole set, for the locale test to resolve against both bundles. */
export const STELLAR_EVOLUTION_LOCALE_KEYS: readonly string[] = [
  ...new Set([
    ...Object.values(STELLAR_EVOLUTION_KEYS),
    ...Object.values(TRACK_KEYS),
    ...Object.values(CATEGORY_KEYS),
    ...STAGE_CARD_KEYS,
    ...STAGES.map((stage) => `${BASE}.appearance.${stage.id}`),
    ...Object.values(STELLAR_EVOLUTION_LABELS).flatMap((label) => [
      label.textKey,
      label.descriptionKey,
    ]),
  ]),
]
