import type { StageId } from './types'

/** Observations and scientific visualisations that informed the procedural models. */
export const VISUAL_REFERENCES: Record<StageId, { label: string, url: string }> = {
  'molecular-cloud': { label: 'NASA · L1527 / Webb', url: 'https://science.nasa.gov/missions/webb/nasas-webb-catches-fiery-hourglass-as-new-star-forms/' },
  protostar: { label: 'NASA · L1527 / Webb', url: 'https://science.nasa.gov/missions/webb/nasas-webb-catches-fiery-hourglass-as-new-star-forms/' },
  'main-sequence': { label: 'NASA · Stars', url: 'https://science.nasa.gov/universe/stars/types/' },
  'red-giant': { label: 'ESO · R Doradus / ALMA', url: 'https://www.eso.org/public/news/eso2412/' },
  'planetary-nebula': { label: 'NASA SVS · Ring Nebula', url: 'https://svs.gsfc.nasa.gov/31045' },
  'white-dwarf': { label: 'NASA · White dwarfs', url: 'https://science.nasa.gov/universe/stars/types/' },
  supernova: { label: 'NASA · Cassiopeia A / Webb', url: 'https://science.nasa.gov/missions/webb/nasas-webb-stuns-with-new-high-definition-look-at-exploded-star/' },
  'neutron-star': { label: 'NASA · Neutron stars', url: 'https://science.nasa.gov/universe/stars/types/' },
  'black-hole': { label: 'NASA · Black hole visualization', url: 'https://www.nasa.gov/universe/nasa-visualization-shows-a-black-holes-warped-world/' },
}
