/**
 * The features the Moon demo can fly to.
 *
 * Positions are selenographic (IAU, east-positive) and were checked against the coordinates
 * published for each feature; diameters are the standard IAU values. Everything the demo
 * labels or focuses comes from this list, so adding a feature means adding an entry here plus
 * its two locale strings.
 */

export type MoonFeatureCategory = 'mare' | 'crater' | 'basin' | 'landingSite'

export interface MoonFeature {
  id: string
  category: MoonFeatureCategory
  latDeg: number
  lonDeg: number
  /** Physical size, shown on the info card. Landing sites have no diameter. */
  diameterKm?: number
  /**
   * Altitude the camera settles at above the feature when the viewer drills in. Large, smooth
   * features want a wide shot; small craters want to fill the frame. Nothing here goes below
   * roughly 300 km, because that is where the global atlas runs out of detail — the scene also
   * clamps to whatever the loaded atlas can actually resolve.
   */
  focusAltitudeKm: number
}

export const MOON_FEATURES: MoonFeature[] = [
  // Maria and the two great basins, ordered west to east around the near side.
  {
    id: 'oceanus-procellarum',
    category: 'mare',
    latDeg: 18.4,
    lonDeg: -57.4,
    diameterKm: 2592,
    focusAltitudeKm: 1400,
  },
  {
    id: 'mare-imbrium',
    category: 'mare',
    latDeg: 32.8,
    lonDeg: -15.6,
    diameterKm: 1145,
    focusAltitudeKm: 800,
  },
  {
    id: 'mare-ser-enitatis',
    category: 'mare',
    latDeg: 28.0,
    lonDeg: 17.5,
    diameterKm: 707,
    focusAltitudeKm: 700,
  },
  {
    id: 'mare-tranquillitatis',
    category: 'mare',
    latDeg: 8.5,
    lonDeg: 31.4,
    diameterKm: 873,
    focusAltitudeKm: 700,
  },
  {
    id: 'mare-crisium',
    category: 'mare',
    latDeg: 17.0,
    lonDeg: 59.1,
    diameterKm: 555,
    focusAltitudeKm: 600,
  },
  {
    id: 'mare-orientale',
    category: 'basin',
    latDeg: -19.4,
    lonDeg: -92.8,
    diameterKm: 930,
    focusAltitudeKm: 800,
  },
  {
    id: 'south-pole-aitken',
    category: 'basin',
    latDeg: -53.0,
    lonDeg: -169.0,
    diameterKm: 2500,
    focusAltitudeKm: 1600,
  },
  // Craters with very different stories: young and bright, old and flooded, or on the far side.
  {
    id: 'tycho',
    category: 'crater',
    latDeg: -43.31,
    lonDeg: -11.36,
    diameterKm: 85,
    focusAltitudeKm: 320,
  },
  {
    id: 'copernicus',
    category: 'crater',
    latDeg: 9.62,
    lonDeg: -20.08,
    diameterKm: 93,
    focusAltitudeKm: 320,
  },
  {
    id: 'aristarchus',
    category: 'crater',
    latDeg: 23.7,
    lonDeg: -47.4,
    diameterKm: 40,
    focusAltitudeKm: 320,
  },
  {
    id: 'clavius',
    category: 'crater',
    latDeg: -58.4,
    lonDeg: -14.4,
    diameterKm: 231,
    focusAltitudeKm: 340,
  },
  {
    id: 'tsiolkovskiy',
    category: 'crater',
    latDeg: -20.38,
    lonDeg: 128.97,
    diameterKm: 184,
    focusAltitudeKm: 320,
  },
  {
    id: 'shackleton',
    category: 'crater',
    latDeg: -89.9,
    lonDeg: 0,
    diameterKm: 21,
    focusAltitudeKm: 320,
  },
  // Landing sites: everything humanity has left on the surface that the public asks about.
  {
    id: 'apollo-11',
    category: 'landingSite',
    latDeg: 0.688,
    lonDeg: 23.433,
    focusAltitudeKm: 320,
  },
  {
    id: 'apollo-17',
    category: 'landingSite',
    latDeg: 20.19,
    lonDeg: 30.77,
    focusAltitudeKm: 320,
  },
  {
    id: 'change-3',
    category: 'landingSite',
    latDeg: 44.121,
    lonDeg: -19.512,
    focusAltitudeKm: 320,
  },
  {
    id: 'change-4',
    category: 'landingSite',
    latDeg: -45.444,
    lonDeg: 177.599,
    focusAltitudeKm: 320,
  },
  {
    id: 'change-5',
    category: 'landingSite',
    latDeg: 43.058,
    lonDeg: -51.916,
    focusAltitudeKm: 320,
  },
  {
    id: 'luna-21',
    category: 'landingSite',
    latDeg: 25.85,
    lonDeg: 30.45,
    focusAltitudeKm: 320,
  },
]

export const MOON_FEATURE_CATEGORIES: MoonFeatureCategory[] = [
  'mare',
  'basin',
  'crater',
  'landingSite',
]

export function featureTitleKey(id: string): string {
  return `demos.items.moon.hotspots.${id}.title`
}

export function featureBodyKey(id: string): string {
  return `demos.items.moon.hotspots.${id}.body`
}

export function featureCategoryKey(category: MoonFeatureCategory): string {
  return `demos.items.moon.categories.${category}`
}

export function findFeature(id: string): MoonFeature | null {
  return MOON_FEATURES.find((feature) => feature.id === id) ?? null
}
