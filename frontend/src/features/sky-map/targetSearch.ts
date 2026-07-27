import { SOLAR_SYSTEM_BODY_IDS } from './types'
import type {
  SkySearchIndex,
  SkySearchIndexEntry,
  SkySearchMatchType,
  SkySearchParameters,
  SkySearchResult,
  SkySearchSuggestion,
  SkyCulturePack,
  SolarSystemBodyId,
} from './types'

export type ParsedSkyTarget =
  | { kind: 'star'; hipId: number }
  | { kind: 'solarSystemBody'; id: SolarSystemBodyId }
  | { kind: 'invalid' }

export function parseSkyTargetQuery(
  query: string,
  localizedBodyName: (id: SolarSystemBodyId) => string,
): ParsedSkyTarget {
  const normalized = normalizeSkyTargetSearchTerm(query)
  if (!normalized) return { kind: 'invalid' }

  const bodyId = SOLAR_SYSTEM_BODY_IDS.find((id) => (
    normalized === normalizeSkyTargetSearchTerm(id)
    || normalized === normalizeSkyTargetSearchTerm(localizedBodyName(id))
  ))
  if (bodyId) return { kind: 'solarSystemBody', id: bodyId }

  const hipMatch = query.trim().match(/^(?:HIP\s*:?\s*)?([0-9]+)$/i)
  if (!hipMatch) return { kind: 'invalid' }
  const hipId = Number(hipMatch[1])
  return Number.isSafeInteger(hipId) && hipId > 0
    ? { kind: 'star', hipId }
    : { kind: 'invalid' }
}

export function searchSkyNames(
  index: SkySearchIndex,
  parameters: SkySearchParameters,
  catalogObjectIds: ReadonlySet<string>,
  culture?: SkyCulturePack,
): SkySearchResult {
  const normalizedQuery = normalizeSkyTargetSearchTerm(parameters.query)
  if (!normalizedQuery || parameters.limit <= 0) {
    return { query: parameters.query, normalizedQuery, suggestions: [] }
  }

  const directHipId = parseHipId(parameters.query)
  if (directHipId !== null) {
    const objectId = `HIP:${directHipId}`
    return {
      query: parameters.query,
      normalizedQuery,
      suggestions: [{
        targetType: 'star',
        objectId,
        hipId: directHipId,
        term: `HIP ${directHipId}`,
        cultureId: parameters.cultureId,
        language: 'und',
        nameType: 'identifier',
        matchType: 'exact',
        availableInCatalog: catalogObjectIds.has(objectId),
      }],
    }
  }

  const ranked = index.entries.flatMap((entry) => {
    const matchType = classifyMatch(entry.normalizedTerm, normalizedQuery)
    return matchType ? [{ entry, matchType }] : []
  })
  ranked.sort((left, right) => compareSearchMatches(left, right, parameters))

  const suggestions: SkySearchSuggestion[] = []
  const seenObjects = new Set<string>()
  for (const { entry, matchType } of ranked) {
    if (seenObjects.has(entry.objectId)) continue
    seenObjects.add(entry.objectId)
    suggestions.push({
      targetType: 'star',
      objectId: entry.objectId,
      hipId: Number(entry.objectId.slice(4)),
      term: entry.term,
      cultureId: entry.cultureId,
      language: entry.language,
      nameType: entry.nameType,
      matchType,
      availableInCatalog: catalogObjectIds.has(entry.objectId),
    })
    if (suggestions.length >= parameters.limit) break
  }
  const localSuggestions = searchLocalTargets(parameters, normalizedQuery, culture)
  return {
    query: parameters.query,
    normalizedQuery,
    suggestions: [...localSuggestions, ...suggestions]
      .sort((left, right) => matchRank(left.matchType) - matchRank(right.matchType))
      .filter((suggestion, index, all) => all.findIndex((item) => item.objectId === suggestion.objectId) === index)
      .slice(0, parameters.limit),
  }
}

function searchLocalTargets(
  parameters: SkySearchParameters,
  normalizedQuery: string,
  culture?: SkyCulturePack,
): SkySearchSuggestion[] {
  const matches: SkySearchSuggestion[] = []
  for (const body of parameters.solarSystemBodies ?? []) {
    const match = bestTermMatch(body.names, normalizedQuery)
    if (!match) continue
    matches.push({
      targetType: 'solarSystemBody',
      objectId: `solar-system:${body.id}`,
      term: match.term,
      cultureId: parameters.cultureId,
      language: parameters.interfaceLanguage,
      nameType: 'official',
      matchType: match.matchType,
      availableInCatalog: true,
    })
  }
  for (const figure of culture?.figures ?? []) {
    const searchableNames = figure.names.filter((name) => name.searchable)
    const terms = [...searchableNames.map((name) => name.value), figure.id, ...(figure.iauCode ? [figure.iauCode] : [])]
    const match = bestTermMatch(terms, normalizedQuery)
    if (!match) continue
    const matchedName = searchableNames.find((name) => name.value === match.term)
    matches.push({
      targetType: 'cultureFigure',
      objectId: `culture:${culture!.id}:${figure.id}`,
      term: match.term,
      cultureId: culture!.id,
      language: matchedName?.language ?? 'und',
      nameType: matchedName?.type ?? 'identifier',
      matchType: match.matchType,
      availableInCatalog: true,
    })
  }
  return matches
}

function bestTermMatch(terms: string[], normalizedQuery: string): { term: string; matchType: SkySearchMatchType } | null {
  return terms
    .map((term) => ({ term, matchType: classifyMatch(normalizeSkyTargetSearchTerm(term), normalizedQuery) }))
    .filter((match): match is { term: string; matchType: SkySearchMatchType } => match.matchType !== null)
    .sort((left, right) => matchRank(left.matchType) - matchRank(right.matchType))[0] ?? null
}

export function normalizeSkyTargetSearchTerm(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[\p{P}\p{S}\s]+/gu, '')
}

function parseHipId(query: string): number | null {
  const match = query.trim().match(/^(?:HIP\s*:?\s*)?([0-9]+)$/i)
  if (!match) return null
  const hipId = Number(match[1])
  return Number.isSafeInteger(hipId) && hipId > 0 ? hipId : null
}

function classifyMatch(term: string, query: string): SkySearchMatchType | null {
  if (term === query) return 'exact'
  if (term.startsWith(query)) return 'prefix'
  return term.includes(query) ? 'contains' : null
}

function compareSearchMatches(
  left: { entry: SkySearchIndexEntry; matchType: SkySearchMatchType },
  right: { entry: SkySearchIndexEntry; matchType: SkySearchMatchType },
  parameters: SkySearchParameters,
): number {
  return matchRank(left.matchType) - matchRank(right.matchType)
    || cultureRank(left.entry.cultureId, parameters.cultureId)
      - cultureRank(right.entry.cultureId, parameters.cultureId)
    || languageRank(left.entry.language, parameters.interfaceLanguage)
      - languageRank(right.entry.language, parameters.interfaceLanguage)
    || Number(right.entry.preferred) - Number(left.entry.preferred)
    || right.entry.labelPriority - left.entry.labelPriority
    || left.entry.term.localeCompare(right.entry.term, parameters.interfaceLanguage)
    || left.entry.objectId.localeCompare(right.entry.objectId)
}

function matchRank(matchType: SkySearchMatchType): number {
  return matchType === 'exact' ? 0 : matchType === 'prefix' ? 1 : 2
}

function cultureRank(cultureId: string, currentCultureId: string): number {
  if (cultureId === currentCultureId) return 0
  if (cultureId === 'western-iau') return 1
  return 2
}

function languageRank(language: string, interfaceLanguage: string): number {
  const normalizedLanguage = language.toLowerCase()
  const normalizedInterfaceLanguage = interfaceLanguage.toLowerCase()
  if (normalizedLanguage === normalizedInterfaceLanguage) return 0
  if (normalizedLanguage === normalizedInterfaceLanguage.split('-')[0]) return 1
  if (normalizedLanguage === 'en') return 2
  return 3
}
