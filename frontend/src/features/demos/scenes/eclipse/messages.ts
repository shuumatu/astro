import type { EclipseEventKind, EclipseSection, EclipseViewMode } from './types'

/**
 * Every locale key the eclipse demo renders, in one place.
 *
 * The panel reads its strings from here and `registry.test.ts` resolves this same list against both
 * bundles, so a renamed key cannot quietly degrade into a raw key on screen - which is exactly the
 * failure mode the registry's locale test exists to catch, extended to a demo that brings its own
 * control surface rather than borrowing the shared chips.
 */
const BASE = 'demos.items.eclipses'

export const ECLIPSE_KEYS = {
  title: `${BASE}.title`,
  summary: `${BASE}.summary`,
  hint: `${BASE}.hint`,
  credit: `${BASE}.credit`,
  speedValue: `${BASE}.speedValue`,

  scaleNote: `${BASE}.panel.scaleNote`,
  panelTitle: `${BASE}.panel.title`,
  collapse: `${BASE}.panel.collapse`,
  expand: `${BASE}.panel.expand`,
  section: `${BASE}.panel.section`,
  view: `${BASE}.panel.view`,
  events: `${BASE}.panel.events`,
  time: `${BASE}.panel.time`,
  observer: `${BASE}.panel.observer`,
  display: `${BASE}.panel.display`,
  readings: `${BASE}.panel.readings`,
  glossary: `${BASE}.panel.glossary`,

  shadows: `${BASE}.panel.shadows`,
  labels: `${BASE}.panel.labels`,
  plane: `${BASE}.panel.plane`,
  teaching: `${BASE}.panel.teaching`,
  teachingNote: `${BASE}.panel.teachingNote`,
  scrubAria: `${BASE}.panel.scrubAria`,
  presetGreatest: `${BASE}.panel.presetGreatest`,
  presetCentral: `${BASE}.panel.presetCentral`,
  presetOffPath: `${BASE}.panel.presetOffPath`,
  legendAria: `${BASE}.panel.legendAria`,
  offsetLat: `${BASE}.panel.offsetLat`,
  offsetLon: `${BASE}.panel.offsetLon`,
  peakPoint: `${BASE}.panel.peakPoint`,
  sunBelow: `${BASE}.panel.sunBelow`,
  solarTotalityNote: `${BASE}.panel.solarTotalityNote`,
  lunarTotalityNote: `${BASE}.panel.lunarTotalityNote`,
  solarSafetyNote: `${BASE}.panel.solarSafetyNote`,
  solarImageCredit: `${BASE}.panel.solarImageCredit`,
  lunarImageCredit: `${BASE}.panel.lunarImageCredit`,
  lunarSkyNote: `${BASE}.panel.lunarSkyNote`,
  solarSkyAria: `${BASE}.panel.solarSkyAria`,
  lunarSkyAria: `${BASE}.panel.lunarSkyAria`,
  skyUmbra: `${BASE}.panel.skyUmbra`,
  skyPenumbra: `${BASE}.panel.skyPenumbra`,
  skySun: `${BASE}.panel.skySun`,
  skyMoon: `${BASE}.panel.skyMoon`,

  readingSeparation: `${BASE}.readings.separation`,
  readingSunDiameter: `${BASE}.readings.sunDiameter`,
  readingMoonDiameter: `${BASE}.readings.moonDiameter`,
  readingObscuration: `${BASE}.readings.obscuration`,
  readingUmbraCoverage: `${BASE}.readings.umbraCoverage`,
  readingUmbraAngular: `${BASE}.readings.umbraAngular`,
  readingPenumbraAngular: `${BASE}.readings.penumbraAngular`,
  readingUmbraLength: `${BASE}.readings.umbraLength`,
  readingUmbraRadius: `${BASE}.readings.umbraRadius`,
  readingAntumbraRadius: `${BASE}.readings.antumbraRadius`,
  readingPenumbraRadius: `${BASE}.readings.penumbraRadius`,
  readingCasterDistance: `${BASE}.readings.casterDistance`,
  readingInclination: `${BASE}.readings.inclination`,
  readingNode: `${BASE}.readings.node`,
  readingMoonLatitude: `${BASE}.readings.moonLatitude`,
  readingSunAltitude: `${BASE}.readings.sunAltitude`,
} as const

/** The two sections, as switch labels. */
export const ECLIPSE_SECTION_KEYS: Record<EclipseSection, string> = {
  solar: `${BASE}.sections.solar`,
  lunar: `${BASE}.sections.lunar`,
}

/** The two view modes, as switch labels. */
export const ECLIPSE_VIEW_KEYS: Record<EclipseViewMode, string> = {
  system: `${BASE}.views.system`,
  observer: `${BASE}.views.observer`,
}

/**
 * What is happening at the current instant.
 *
 * One key per kind, and `none` is a real answer rather than a placeholder: an eclipse's window is
 * padded past its first and last contact, so the scrubber can genuinely sit outside the eclipse.
 */
export const ECLIPSE_KIND_KEYS: Record<EclipseEventKind, string> = {
  none: `${BASE}.kinds.none`,
  penumbral: `${BASE}.kinds.penumbral`,
  partial: `${BASE}.kinds.partial`,
  total: `${BASE}.kinds.total`,
  annular: `${BASE}.kinds.annular`,
}

/** The one-line readout under the stage, one key per kind so the scene never needs a translator. */
export const ECLIPSE_READOUT_KEYS: Record<EclipseEventKind, string> = {
  none: `${BASE}.readout.none`,
  penumbral: `${BASE}.readout.penumbral`,
  partial: `${BASE}.readout.partial`,
  total: `${BASE}.readout.total`,
  annular: `${BASE}.readout.annular`,
}

/**
 * Labels the scene publishes as DOM anchors, keyed by the id it publishes them under.
 *
 * Each carries an explanation as well as a name. The explanation is what the shell shows when the
 * viewer points at the label, and it exists because half of these words are terms of art: "umbra"
 * and "antumbra" mean nothing to someone who has not met them, and "ascending node" is worse. The
 * names that are self-evident - the Sun, the Earth - get one anyway, because a tooltip that appears
 * on some labels and not others reads as a bug.
 */
export interface EclipseLabelCopy {
  textKey: string
  descriptionKey: string
}

export const ECLIPSE_LABELS: Record<string, EclipseLabelCopy> = {
  sun: { textKey: `${BASE}.labels.sun`, descriptionKey: `${BASE}.labels.sunAbout` },
  earth: { textKey: `${BASE}.labels.earth`, descriptionKey: `${BASE}.labels.earthAbout` },
  moon: { textKey: `${BASE}.labels.moon`, descriptionKey: `${BASE}.labels.moonAbout` },
  umbra: { textKey: `${BASE}.labels.umbra`, descriptionKey: `${BASE}.labels.umbraAbout` },
  penumbra: { textKey: `${BASE}.labels.penumbra`, descriptionKey: `${BASE}.labels.penumbraAbout` },
  antumbra: { textKey: `${BASE}.labels.antumbra`, descriptionKey: `${BASE}.labels.antumbraAbout` },
  ascendingNode: {
    textKey: `${BASE}.labels.ascendingNode`,
    descriptionKey: `${BASE}.labels.ascendingNodeAbout`,
  },
  descendingNode: {
    textKey: `${BASE}.labels.descendingNode`,
    descriptionKey: `${BASE}.labels.descendingNodeAbout`,
  },
  eclipticPlane: {
    textKey: `${BASE}.labels.eclipticPlane`,
    descriptionKey: `${BASE}.labels.eclipticPlaneAbout`,
  },
  lunarPlane: {
    textKey: `${BASE}.labels.lunarPlane`,
    descriptionKey: `${BASE}.labels.lunarPlaneAbout`,
  },
  peak: { textKey: `${BASE}.labels.peak`, descriptionKey: `${BASE}.labels.peakAbout` },
  observer: { textKey: `${BASE}.labels.observer`, descriptionKey: `${BASE}.labels.observerAbout` },
}

/** The whole set, for the locale test to resolve against both bundles. */
export const ECLIPSE_LOCALE_KEYS: readonly string[] = [
  ...Object.values(ECLIPSE_KEYS),
  ...Object.values(ECLIPSE_SECTION_KEYS),
  ...Object.values(ECLIPSE_VIEW_KEYS),
  ...Object.values(ECLIPSE_KIND_KEYS),
  ...Object.values(ECLIPSE_READOUT_KEYS),
  ...Object.values(ECLIPSE_LABELS).flatMap((label) => [label.textKey, label.descriptionKey]),
]
