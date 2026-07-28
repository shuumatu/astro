import { sha256Hex } from './catalog'
import type {
  FeaturedPatternPack,
  SkyContentAsset,
  SkyContentAssetDescriptor,
  SkyContentManifest,
  SkyCulturePack,
  SkyName,
  SkySearchIndex,
} from './types'
import { SkyMapError } from './types'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const OBJECT_ID_PATTERN = /^HIP:[1-9][0-9]*$/
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const NAME_TYPES = [
  'native', 'official', 'translation', 'transliteration', 'alias', 'bayer', 'flamsteed',
]
const FIGURE_TYPES = ['constellation', 'asterism', 'enclosure-wall', 'lunar-mansion']

export async function loadSkyContentManifest(
  manifestUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SkyContentManifest> {
  const response = await fetchResponse(fetcher, manifestUrl)
  return validateSkyContentManifest(await readJson(response, 'sky-content manifest'))
}

export async function loadSkyContentAsset(
  manifest: SkyContentManifest,
  manifestUrl: string,
  assetId: string,
  fetcher: typeof fetch = fetch,
): Promise<SkyContentAsset> {
  const descriptor = manifest.assets.find((asset) => asset.assetId === assetId)
  if (!descriptor) invalid(`Unknown sky-content asset: ${assetId}`)
  const downloadUrl = resolveSkyContentDownloadUrl(descriptor.downloadUrl, manifestUrl)
  const response = await fetchResponse(fetcher, downloadUrl)
  const decodedBytes = new Uint8Array(await response.arrayBuffer())

  if (decodedBytes.byteLength !== descriptor.decodedContentLength) {
    integrity(
      `Decoded ${assetId} length ${decodedBytes.byteLength} does not match ${descriptor.decodedContentLength}`,
    )
  }
  if (await sha256Hex(decodedBytes) !== descriptor.decodedSha256) {
    integrity(`Decoded ${assetId} checksum does not match its manifest`)
  }

  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodedBytes))
  } catch (error) {
    invalid(`${assetId} JSON cannot be decoded: ${errorMessage(error)}`)
  }
  return validateSkyContentAsset(value, descriptor)
}

export function validateSkyContentManifest(value: unknown): SkyContentManifest {
  const manifest = requireRecord(value, 'manifest')
  requireEqual(manifest.schemaVersion, 1, 'manifest.schemaVersion')
  requireEqual(manifest.catalogId, 'sky-content', 'manifest.catalogId')
  requireString(manifest.version, 'manifest.version', VERSION_PATTERN)
  const defaultCultureId = requireString(manifest.defaultCultureId, 'manifest.defaultCultureId', ID_PATTERN)
  const cultureIds = requireUniqueStrings(manifest.cultureIds, 'manifest.cultureIds', ID_PATTERN, 1)
  if (!cultureIds.includes(defaultCultureId)) invalid('manifest.defaultCultureId is not listed in cultureIds')
  const searchIndexAssetId = requireString(
    manifest.searchIndexAssetId,
    'manifest.searchIndexAssetId',
    ID_PATTERN,
  )
  const featuredPatternsAssetId = requireString(
    manifest.featuredPatternsAssetId,
    'manifest.featuredPatternsAssetId',
    ID_PATTERN,
  )
  requireUniqueStrings(manifest.nameFallbackOrder, 'manifest.nameFallbackOrder', undefined, 1)
  const assets = requireArray(manifest.assets, 'manifest.assets', 1)
  const assetIds = new Set<string>()
  const cultureAssetIds = new Set<string>()
  for (const [index, value] of assets.entries()) {
    const asset = validateAssetDescriptor(value, index)
    if (assetIds.has(asset.assetId)) invalid(`manifest.assets[${index}].assetId is duplicated`)
    assetIds.add(asset.assetId)
    if (asset.assetType === 'culture') {
      if (!asset.cultureId || !cultureIds.includes(asset.cultureId)) {
        invalid(`manifest.assets[${index}].cultureId is invalid`)
      }
      cultureAssetIds.add(asset.cultureId)
    }
  }
  if (cultureAssetIds.size !== cultureIds.length) invalid('manifest culture assets do not match cultureIds')
  const searchDescriptor = assets.find((value) => isAsset(value, searchIndexAssetId))
  const patternsDescriptor = assets.find((value) => isAsset(value, featuredPatternsAssetId))
  if (!searchDescriptor || searchDescriptor.assetType !== 'search-index') {
    invalid('manifest.searchIndexAssetId does not reference a search-index asset')
  }
  if (!patternsDescriptor || patternsDescriptor.assetType !== 'featured-patterns') {
    invalid('manifest.featuredPatternsAssetId does not reference a featured-patterns asset')
  }
  requireIsoDate(manifest.publishedAt, 'manifest.publishedAt')
  return manifest as unknown as SkyContentManifest
}

function validateSkyContentAsset(
  value: unknown,
  descriptor: SkyContentAssetDescriptor,
): SkyContentAsset {
  if (descriptor.assetType === 'culture') return validateCulturePack(value, descriptor)
  if (descriptor.assetType === 'search-index') return validateSearchIndex(value, descriptor)
  return validateFeaturedPatterns(value, descriptor)
}

function validateCulturePack(
  value: unknown,
  descriptor: SkyContentAssetDescriptor,
): SkyCulturePack {
  const pack = requireRecord(value, descriptor.assetId)
  requireEqual(pack.schemaVersion, 1, `${descriptor.assetId}.schemaVersion`)
  requireEqual(pack.id, descriptor.cultureId, `${descriptor.assetId}.id`)
  requireEqual(pack.version, descriptor.version, `${descriptor.assetId}.version`)
  validateNames(pack.names, `${descriptor.assetId}.names`)
  requireString(pack.defaultLanguage, `${descriptor.assetId}.defaultLanguage`, LANGUAGE_PATTERN)
  validateLocalizedTexts(pack.descriptions, `${descriptor.assetId}.descriptions`)
  validateSources(pack.sources, `${descriptor.assetId}.sources`)

  const starNames = requireArray(pack.starNames, `${descriptor.assetId}.starNames`)
  requireRecordCount(descriptor, 'starNameRecords', starNames.length)
  const namedObjects = new Set<string>()
  for (const [index, value] of starNames.entries()) {
    const label = `${descriptor.assetId}.starNames[${index}]`
    const record = requireRecord(value, label)
    const objectId = requireString(record.objectId, `${label}.objectId`, OBJECT_ID_PATTERN)
    if (namedObjects.has(objectId)) invalid(`${label}.objectId is duplicated`)
    namedObjects.add(objectId)
    requireIntegerRange(record.labelPriority, `${label}.labelPriority`, 0, 1000)
    validateNames(record.names, `${label}.names`)
  }

  const figures = requireArray(pack.figures, `${descriptor.assetId}.figures`)
  requireRecordCount(descriptor, 'figures', figures.length)
  const figureIds = new Set<string>()
  for (const [index, value] of figures.entries()) {
    const label = `${descriptor.assetId}.figures[${index}]`
    const figure = requireRecord(value, label)
    const id = requireString(figure.id, `${label}.id`, ID_PATTERN)
    if (figureIds.has(id)) invalid(`${label}.id is duplicated`)
    figureIds.add(id)
    if (!FIGURE_TYPES.includes(figure.type as string)) invalid(`${label}.type is invalid`)
    if (figure.iauCode !== undefined) requireString(figure.iauCode, `${label}.iauCode`, /^[A-Z][A-Za-z]{2}$/)
    validateNames(figure.names, `${label}.names`)
    validateObjectPaths(figure.paths, `${label}.paths`, 1)
    validateObjectAnchor(figure.labelAnchor, `${label}.labelAnchor`)
    requireIntegerRange(figure.rank, `${label}.rank`, 1, 3)
    requireUniqueStrings(figure.groupIds, `${label}.groupIds`, ID_PATTERN)
    requireUniqueStrings(figure.sourceIds, `${label}.sourceIds`, ID_PATTERN, 1)
  }

  const groups = requireArray(pack.groups, `${descriptor.assetId}.groups`)
  requireRecordCount(descriptor, 'groups', groups.length)
  for (const [index, value] of groups.entries()) validateGroup(value, `${descriptor.assetId}.groups[${index}]`)

  const regions = requireArray(pack.regions, `${descriptor.assetId}.regions`)
  requireRecordCount(descriptor, 'regions', regions.length)
  for (const [index, value] of regions.entries()) {
    validateRegion(value, `${descriptor.assetId}.regions[${index}]`, figureIds)
  }
  return pack as unknown as SkyCulturePack
}

function validateSearchIndex(
  value: unknown,
  descriptor: SkyContentAssetDescriptor,
): SkySearchIndex {
  const index = requireRecord(value, descriptor.assetId)
  requireEqual(index.schemaVersion, 1, `${descriptor.assetId}.schemaVersion`)
  requireEqual(index.id, 'sky-search-index', `${descriptor.assetId}.id`)
  requireEqual(index.version, descriptor.version, `${descriptor.assetId}.version`)
  requireString(index.normalization, `${descriptor.assetId}.normalization`)
  const entries = requireArray(index.entries, `${descriptor.assetId}.entries`)
  requireRecordCount(descriptor, 'entries', entries.length)
  for (const [entryIndex, value] of entries.entries()) {
    const label = `${descriptor.assetId}.entries[${entryIndex}]`
    const entry = requireRecord(value, label)
    requireString(entry.term, `${label}.term`)
    requireString(entry.normalizedTerm, `${label}.normalizedTerm`)
    requireString(entry.objectId, `${label}.objectId`, OBJECT_ID_PATTERN)
    requireString(entry.cultureId, `${label}.cultureId`, ID_PATTERN)
    requireString(entry.language, `${label}.language`, LANGUAGE_PATTERN)
    if (![...NAME_TYPES, 'identifier'].includes(entry.nameType as string)) {
      invalid(`${label}.nameType is invalid`)
    }
    requireBoolean(entry.preferred, `${label}.preferred`)
    requireIntegerRange(entry.labelPriority, `${label}.labelPriority`, 0, 1000)
    if (entry.sourceId !== null) requireString(entry.sourceId, `${label}.sourceId`, ID_PATTERN)
  }
  const collisions = requireArray(index.collisions, `${descriptor.assetId}.collisions`)
  requireRecordCount(descriptor, 'collisions', collisions.length)
  for (const [collisionIndex, value] of collisions.entries()) {
    const label = `${descriptor.assetId}.collisions[${collisionIndex}]`
    const collision = requireRecord(value, label)
    requireString(collision.normalizedTerm, `${label}.normalizedTerm`)
    requireUniqueStrings(collision.objectIds, `${label}.objectIds`, OBJECT_ID_PATTERN, 2)
  }
  return index as unknown as SkySearchIndex
}

function validateFeaturedPatterns(
  value: unknown,
  descriptor: SkyContentAssetDescriptor,
): FeaturedPatternPack {
  const pack = requireRecord(value, descriptor.assetId)
  requireEqual(pack.schemaVersion, 1, `${descriptor.assetId}.schemaVersion`)
  requireEqual(pack.id, 'featured-patterns', `${descriptor.assetId}.id`)
  requireEqual(pack.version, descriptor.version, `${descriptor.assetId}.version`)
  validateSources(pack.sources, `${descriptor.assetId}.sources`)
  const patterns = requireArray(pack.patterns, `${descriptor.assetId}.patterns`, 1)
  requireRecordCount(descriptor, 'patterns', patterns.length)
  const ids = new Set<string>()
  for (const [index, value] of patterns.entries()) {
    const label = `${descriptor.assetId}.patterns[${index}]`
    const pattern = requireRecord(value, label)
    const id = requireString(pattern.id, `${label}.id`, ID_PATTERN)
    if (ids.has(id)) invalid(`${label}.id is duplicated`)
    ids.add(id)
    validateNames(pattern.names, `${label}.names`)
    requireUniqueStrings(pattern.memberObjectIds, `${label}.memberObjectIds`, OBJECT_ID_PATTERN, 3)
    validateObjectPaths(pattern.paths, `${label}.paths`, 4)
    validateObjectAnchor(pattern.labelAnchor, `${label}.labelAnchor`)
    requireUniqueStrings(pattern.cultureIds, `${label}.cultureIds`, ID_PATTERN, 1)
    requireUniqueStrings(pattern.sourceIds, `${label}.sourceIds`, ID_PATTERN, 1)
  }
  return pack as unknown as FeaturedPatternPack
}

function validateAssetDescriptor(value: unknown, index: number): SkyContentAssetDescriptor {
  const label = `manifest.assets[${index}]`
  const asset = requireRecord(value, label)
  requireString(asset.assetId, `${label}.assetId`, ID_PATTERN)
  if (!['culture', 'search-index', 'featured-patterns'].includes(asset.assetType as string)) {
    invalid(`${label}.assetType is invalid`)
  }
  if (asset.cultureId !== undefined && asset.cultureId !== null) {
    requireString(asset.cultureId, `${label}.cultureId`, ID_PATTERN)
  }
  requireString(asset.version, `${label}.version`, VERSION_PATTERN)
  requireString(asset.downloadUrl, `${label}.downloadUrl`)
  requireEqual(asset.mediaType, 'application/json', `${label}.mediaType`)
  requireEqual(asset.contentEncoding, 'gzip', `${label}.contentEncoding`)
  requireString(asset.sha256, `${label}.sha256`, SHA256_PATTERN)
  requirePositiveInteger(asset.contentLength, `${label}.contentLength`)
  requireString(asset.decodedSha256, `${label}.decodedSha256`, SHA256_PATTERN)
  requirePositiveInteger(asset.decodedContentLength, `${label}.decodedContentLength`)
  const counts = requireRecord(asset.recordCounts, `${label}.recordCounts`)
  if (Object.keys(counts).length === 0) invalid(`${label}.recordCounts must not be empty`)
  for (const [key, count] of Object.entries(counts)) requireNonNegativeInteger(count, `${label}.recordCounts.${key}`)
  return asset as unknown as SkyContentAssetDescriptor
}

function validateNames(value: unknown, label: string): void {
  const names = requireArray(value, label, 1)
  for (const [index, value] of names.entries()) {
    const nameLabel = `${label}[${index}]`
    const name = requireRecord(value, nameLabel)
    requireString(name.language, `${nameLabel}.language`, LANGUAGE_PATTERN)
    requireString(name.value, `${nameLabel}.value`)
    if (!NAME_TYPES.includes(name.type as string)) invalid(`${nameLabel}.type is invalid`)
    requireBoolean(name.preferred, `${nameLabel}.preferred`)
    requireBoolean(name.searchable, `${nameLabel}.searchable`)
    requireString(name.sourceId, `${nameLabel}.sourceId`, ID_PATTERN)
  }
}

function validateLocalizedTexts(value: unknown, label: string): void {
  const texts = requireArray(value, label, 1)
  for (const [index, value] of texts.entries()) {
    const itemLabel = `${label}[${index}]`
    const item = requireRecord(value, itemLabel)
    requireString(item.language, `${itemLabel}.language`, LANGUAGE_PATTERN)
    requireString(item.value, `${itemLabel}.value`)
    requireString(item.sourceId, `${itemLabel}.sourceId`, ID_PATTERN)
  }
}

function validateSources(value: unknown, label: string): void {
  const sources = requireArray(value, label, 1)
  const ids = new Set<string>()
  for (const [index, value] of sources.entries()) {
    const sourceLabel = `${label}[${index}]`
    const source = requireRecord(value, sourceLabel)
    const id = requireString(source.id, `${sourceLabel}.id`, ID_PATTERN)
    if (ids.has(id)) invalid(`${sourceLabel}.id is duplicated`)
    ids.add(id)
    requireString(source.title, `${sourceLabel}.title`)
    requireUniqueStrings(source.authors, `${sourceLabel}.authors`, undefined, 1)
    requireString(source.url, `${sourceLabel}.url`)
    requireString(source.version, `${sourceLabel}.version`)
    requireString(source.license, `${sourceLabel}.license`)
    requireString(source.attribution, `${sourceLabel}.attribution`)
  }
}

function validateObjectPaths(value: unknown, label: string, minimumPathLength: number): void {
  const paths = requireArray(value, label, 1)
  for (const [index, path] of paths.entries()) {
    requireStringList(path, `${label}[${index}]`, OBJECT_ID_PATTERN, minimumPathLength)
  }
}

function validateObjectAnchor(value: unknown, label: string): void {
  const anchor = requireRecord(value, label)
  requireString(anchor.objectId, `${label}.objectId`, OBJECT_ID_PATTERN)
}

function validateGroup(value: unknown, label: string): void {
  const group = requireRecord(value, label)
  requireString(group.id, `${label}.id`, ID_PATTERN)
  if (!['system', 'enclosure', 'lunar-mansions', 'constellation-set'].includes(group.type as string)) {
    invalid(`${label}.type is invalid`)
  }
  validateNames(group.names, `${label}.names`)
  const members = requireArray(group.members, `${label}.members`, 1)
  for (const [index, value] of members.entries()) {
    const memberLabel = `${label}.members[${index}]`
    const member = requireRecord(value, memberLabel)
    if (!['figure', 'group'].includes(member.type as string)) invalid(`${memberLabel}.type is invalid`)
    requireString(member.id, `${memberLabel}.id`, ID_PATTERN)
  }
  requireUniqueStrings(group.sourceIds, `${label}.sourceIds`, ID_PATTERN, 1)
}

function validateRegion(value: unknown, label: string, figureIds: Set<string>): void {
  const region = requireRecord(value, label)
  requireString(region.id, `${label}.id`, ID_PATTERN)
  const figureId = requireString(region.figureId, `${label}.figureId`, ID_PATTERN)
  if (!figureIds.has(figureId)) invalid(`${label}.figureId does not reference a figure`)
  validateNames(region.names, `${label}.names`)
  requireEqual(region.referenceFrame, 'ICRS', `${label}.referenceFrame`)
  const geometry = requireRecord(region.geometry, `${label}.geometry`)
  requireEqual(geometry.type, 'MultiPolygon', `${label}.geometry.type`)
  const polygons = requireArray(geometry.coordinates, `${label}.geometry.coordinates`, 1)
  for (const [polygonIndex, polygonValue] of polygons.entries()) {
    const rings = requireArray(polygonValue, `${label}.geometry.coordinates[${polygonIndex}]`, 1)
    for (const [ringIndex, ringValue] of rings.entries()) {
      const ringLabel = `${label}.geometry.coordinates[${polygonIndex}][${ringIndex}]`
      const positions = requireArray(ringValue, ringLabel, 4)
      for (const [positionIndex, positionValue] of positions.entries()) {
        const position = requireArray(positionValue, `${ringLabel}[${positionIndex}]`, 2)
        if (position.length !== 2) invalid(`${ringLabel}[${positionIndex}] must contain two coordinates`)
        requireRange(position[0], `${ringLabel}[${positionIndex}][0]`, -180, 180)
        requireRange(position[1], `${ringLabel}[${positionIndex}][1]`, -90, 90)
      }
    }
  }
  requireUniqueStrings(region.sourceIds, `${label}.sourceIds`, ID_PATTERN, 1)
}

function requireRecordCount(
  descriptor: SkyContentAssetDescriptor,
  key: string,
  actual: number,
): void {
  if (descriptor.recordCounts[key] !== actual) {
    invalid(`${descriptor.assetId} ${key} count ${actual} does not match ${descriptor.recordCounts[key]}`)
  }
}

function isAsset(value: unknown, assetId: string): value is SkyContentAssetDescriptor {
  return typeof value === 'object' && value !== null && (value as { assetId?: unknown }).assetId === assetId
}

async function fetchResponse(fetcher: typeof fetch, url: string): Promise<Response> {
  let response: Response
  try {
    response = await fetcher(url, { headers: { Accept: 'application/json' } })
  } catch (error) {
    throw new SkyMapError('SKY_CONTENT_FETCH_FAILED', `Sky-content request failed: ${errorMessage(error)}`)
  }
  if (!response.ok) {
    throw new SkyMapError('SKY_CONTENT_FETCH_FAILED', `Sky-content request returned HTTP ${response.status}`)
  }
  return response
}

async function readJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    invalid(`The ${label} is not valid JSON: ${errorMessage(error)}`)
  }
}

export function resolveSkyContentDownloadUrl(
  downloadUrl: string,
  manifestUrl: string,
  currentUrl = globalThis.location?.href,
): string {
  try {
    const absoluteManifestUrl = currentUrl ? new URL(manifestUrl, currentUrl).toString() : manifestUrl
    return new URL(downloadUrl, absoluteManifestUrl).toString()
  } catch (error) {
    invalid(`Sky-content download URL is invalid: ${errorMessage(error)}`)
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(`${label} must be an object`)
  return value as Record<string, unknown>
}

function requireArray(value: unknown, label: string, minimumLength = 0): unknown[] {
  if (!Array.isArray(value) || value.length < minimumLength) {
    invalid(`${label} must contain at least ${minimumLength} items`)
  }
  return value
}

function requireString(value: unknown, label: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    invalid(`${label} is invalid`)
  }
  return value
}

function requireStringList(
  value: unknown,
  label: string,
  pattern?: RegExp,
  minimumLength = 0,
): string[] {
  const values = requireArray(value, label, minimumLength)
  return values.map((item, index) => requireString(item, `${label}[${index}]`, pattern))
}

function requireUniqueStrings(
  value: unknown,
  label: string,
  pattern?: RegExp,
  minimumLength = 0,
): string[] {
  const values = requireStringList(value, label, pattern, minimumLength)
  if (new Set(values).size !== values.length) invalid(`${label} must contain unique values`)
  return values
}

function requireBoolean(value: unknown, label: string): void {
  if (typeof value !== 'boolean') invalid(`${label} must be boolean`)
}

function requirePositiveInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) invalid(`${label} must be a positive integer`)
}

function requireNonNegativeInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) invalid(`${label} must be a non-negative integer`)
}

function requireIntegerRange(value: unknown, label: string, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid(`${label} must be an integer between ${minimum} and ${maximum}`)
  }
}

function requireRange(value: unknown, label: string, minimum: number, maximum: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalid(`${label} must be between ${minimum} and ${maximum}`)
  }
}

function requireIsoDate(value: unknown, label: string): void {
  const date = requireString(value, label)
  if (Number.isNaN(Date.parse(date))) invalid(`${label} must be an ISO date-time`)
}

function requireEqual(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) invalid(`${label} must equal ${String(expected)}`)
}

function integrity(message: string): never {
  throw new SkyMapError('SKY_CONTENT_INTEGRITY_FAILED', message)
}

function invalid(message: string): never {
  throw new SkyMapError('SKY_CONTENT_INVALID', message)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
