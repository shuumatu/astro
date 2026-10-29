import { selectLocalizedName } from '../sky-map/localizedName'
import type { FeaturedPatternPack, SkyCatalog, SkyCulturePack, SolarSystemBodyId } from '../sky-map/types'
import type { TonightTargetType } from './types'

export interface ObservingCandidate {
  id: string
  type: TonightTargetType
  name: string
  memberIds: string[]
  requiredIds: string[]
  bodyId?: SolarSystemBodyId
  anchorId?: string
  anchorName?: string
  magnitude: number | null
}

// Curated recognition cores reference existing physical HIP identities. These are
// main patterns, not assertions that the entire IAU constellation is visible.
export const RECOGNITION_CORES: Record<string, { members: number[]; anchors: number[] }> = {
  Ori: { members: [26727, 26311, 25930, 27989, 24436, 25336, 27366], anchors: [26727, 26311, 25930, 27989, 24436] },
  Cas: { members: [8886, 6686, 4427, 3179, 746], anchors: [8886, 4427, 746] },
  Cyg: { members: [102098, 100453, 97165, 102488, 95947], anchors: [102098, 100453, 95947] },
  Lyr: { members: [91262, 91971, 92420, 93194, 92791], anchors: [91262, 91971, 92420, 93194, 92791] },
  Aql: { members: [98036, 97649, 97278, 95501, 93747, 99473], anchors: [98036, 97649, 97278] },
  Leo: { members: [49669, 49583, 50583, 50335, 48455, 47908, 54872, 57632], anchors: [49669, 50583, 57632] },
  Sco: { members: [80763, 78401, 78820, 82396, 82514, 84143, 86228, 87073, 86670, 85927], anchors: [80763, 85927, 86228] },
  Tau: { members: [21421, 20889, 20894, 20205, 20455, 25428, 26451], anchors: [21421, 20889, 20205] },
  Gem: { members: [37826, 36850, 35550, 32246, 30343, 31681], anchors: [37826, 36850, 30343, 31681] },
  Aur: { members: [28380, 28360, 24608, 23453, 23015, 25428], anchors: [24608, 28360, 23015] },
  Boo: { members: [69673, 72105, 74666, 73555, 71075, 71053], anchors: [69673, 73555, 71075] },
  Peg: { members: [677, 1067, 113963, 113881], anchors: [677, 1067, 113963, 113881] },
  And: { members: [677, 3092, 5447, 9640], anchors: [677, 5447, 9640] },
  Cru: { members: [61084, 60718, 62434, 59747], anchors: [61084, 60718, 62434, 59747] },
  CMa: { members: [32349, 30324, 33579, 34444, 35904], anchors: [32349, 33579, 34444] },
  CMi: { members: [37279, 36188], anchors: [37279, 36188] },
  Sgr: { members: [89931, 90496, 90185, 88635, 93506, 92041, 93864, 92855], anchors: [90185, 88635, 92855, 93506] },
}

const BODY_NAMES: Record<string, [string, string]> = {
  moon: ['月球', 'Moon'], mercury: ['水星', 'Mercury'], venus: ['金星', 'Venus'],
  mars: ['火星', 'Mars'], jupiter: ['木星', 'Jupiter'], saturn: ['土星', 'Saturn'],
}

export function buildCandidates(catalog: SkyCatalog, culture: SkyCulturePack, patterns: FeaturedPatternPack, language: string): ObservingCandidate[] {
  const stars = new Map(catalog.stars.map((star) => [star.id, star]))
  const names = new Map(culture.starNames.map((entry) => [entry.objectId, entry.names]))
  const starName = (id: string) => names.has(id) ? selectLocalizedName(names.get(id)!, language, culture.defaultLanguage) : id
  const result: ObservingCandidate[] = Object.entries(BODY_NAMES).map(([id, labels]) => ({
    id, type: id === 'moon' ? 'moon' : 'planet', bodyId: id as SolarSystemBodyId,
    name: labels[language.startsWith('zh') ? 0 : 1], memberIds: [], requiredIds: [], magnitude: null,
  }))
  const brightStars = catalog.stars.filter((star) => star.visualMagnitude <= 2.5 || star.hipId === 11767)
    .sort((a, b) => a.visualMagnitude - b.visualMagnitude || a.hipId - b.hipId).slice(0, 70)
  for (const star of brightStars) result.push({ id: star.id, type: 'star', name: starName(star.id), memberIds: [star.id], requiredIds: [star.id], anchorId: star.id, magnitude: star.visualMagnitude })

  for (const figure of culture.figures) {
    const core = figure.iauCode && RECOGNITION_CORES[figure.iauCode]
    if (!core) continue
    const memberIds = core.members.map((id) => `HIP:${id}`)
    if (!memberIds.every((id) => stars.has(id))) continue
    const anchorId = memberIds.reduce((best, id) => stars.get(id)!.visualMagnitude < stars.get(best)!.visualMagnitude ? id : best)
    result.push({ id: figure.id, type: 'constellation', name: selectLocalizedName(figure.names, language, culture.defaultLanguage), memberIds, requiredIds: core.anchors.map((id) => `HIP:${id}`), anchorId, anchorName: starName(anchorId), magnitude: null })
  }
  for (const pattern of patterns.patterns) {
    if (!pattern.cultureIds.includes(culture.id) || !pattern.memberObjectIds.every((id) => stars.has(id))) continue
    result.push({ id: pattern.id, type: 'asterism', name: selectLocalizedName(pattern.names, language, culture.defaultLanguage), memberIds: [...pattern.memberObjectIds], requiredIds: [...pattern.memberObjectIds], anchorId: pattern.labelAnchor.objectId, anchorName: starName(pattern.labelAnchor.objectId), magnitude: null })
  }
  return result
}
