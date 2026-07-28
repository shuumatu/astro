import type {
  SkySearchIndex,
  SkySearchIndexEntry,
  StarNamePresentation,
  StarNamePresentationParameters,
} from './types'

const DESIGNATION_TYPES = new Set<SkySearchIndexEntry['nameType']>(['bayer', 'flamsteed'])

export function resolveStarNamePresentation(
  index: SkySearchIndex,
  parameters: StarNamePresentationParameters,
): StarNamePresentation {
  const candidates = index.entries
    .filter((entry) => isDisplayName(entry, parameters))
    .sort((left, right) => compareNames(left, right, parameters))

  const uniqueNames: SkySearchIndexEntry[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = candidate.term.normalize('NFKC').toLocaleLowerCase('und')
    if (seen.has(key)) continue
    seen.add(key)
    uniqueNames.push(candidate)
  }

  const primary = uniqueNames[0]?.term ?? parameters.objectId.replace(':', ' ')
  const aliases = uniqueNames
    .slice(1)
    .sort((left, right) => compareAliases(left, right, parameters))
    .map((entry) => entry.term)
  return {
    objectId: parameters.objectId,
    primaryName: primary,
    aliases,
  }
}

function isDisplayName(
  entry: SkySearchIndexEntry,
  parameters: StarNamePresentationParameters,
): boolean {
  if (entry.objectId !== parameters.objectId || entry.nameType === 'identifier') return false
  if (!DESIGNATION_TYPES.has(entry.nameType) && entry.cultureId !== parameters.cultureId) return false

  const language = entry.language.toLowerCase()
  const interfaceLanguage = parameters.interfaceLanguage.toLowerCase()
  const interfaceBaseLanguage = interfaceLanguage.split('-')[0]
  const entryBaseLanguage = language.split('-')[0]
  return language === 'und'
    || language === 'en'
    || language === interfaceLanguage
    || entryBaseLanguage === interfaceBaseLanguage
}

function compareNames(
  left: SkySearchIndexEntry,
  right: SkySearchIndexEntry,
  parameters: StarNamePresentationParameters,
): number {
  return nameGroup(left) - nameGroup(right)
    || cultureRank(left.cultureId, parameters.cultureId)
      - cultureRank(right.cultureId, parameters.cultureId)
    || languageRank(left.language, parameters.interfaceLanguage)
      - languageRank(right.language, parameters.interfaceLanguage)
    || Number(right.preferred) - Number(left.preferred)
    || nameTypeRank(left.nameType) - nameTypeRank(right.nameType)
    || right.labelPriority - left.labelPriority
    || left.term.localeCompare(right.term, parameters.interfaceLanguage)
}

function nameGroup(entry: SkySearchIndexEntry): number {
  if (!DESIGNATION_TYPES.has(entry.nameType)) return 0
  return entry.nameType === 'bayer' ? 1 : 2
}

function compareAliases(
  left: SkySearchIndexEntry,
  right: SkySearchIndexEntry,
  parameters: StarNamePresentationParameters,
): number {
  return aliasGroup(left) - aliasGroup(right)
    || compareNames(left, right, parameters)
}

function aliasGroup(entry: SkySearchIndexEntry): number {
  if (!DESIGNATION_TYPES.has(entry.nameType) && entry.preferred) return 0
  if (entry.nameType === 'bayer') return 1
  if (entry.nameType === 'flamsteed') return 2
  return 3
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
  if (normalizedLanguage === 'und') return 3
  return 4
}

function nameTypeRank(nameType: SkySearchIndexEntry['nameType']): number {
  return {
    native: 0,
    official: 1,
    translation: 2,
    alias: 3,
    transliteration: 4,
    bayer: 5,
    flamsteed: 6,
    identifier: 7,
  }[nameType]
}
