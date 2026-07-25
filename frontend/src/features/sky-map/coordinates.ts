import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Observer,
  Refraction,
  Rotation_EQJ_HOR,
} from 'astronomy-engine'
import type {
  ComputedCultureFigure,
  ComputedCultureRegion,
  ComputedFeaturedPattern,
  ComputedSolarSystemBody,
  ComputedStar,
  ComputedStarLabel,
  EquatorialCoordinate,
  FeaturedPatternPack,
  HorizontalCoordinate,
  SkyCulturePack,
  SolarSystemBodyId,
  SkyCalculationParameters,
  SkyCatalog,
  SkyFrame,
  StarRecord,
} from './types'
import { selectInterfaceLanguageName, selectLocalizedName } from './localizedName'
import { SkyMapError, SOLAR_SYSTEM_BODY_IDS } from './types'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const MAS_TO_RAD = DEG_TO_RAD / 3_600_000
const JULIAN_YEAR_MILLISECONDS = 365.25 * 86_400_000
const J2000_MILLISECONDS = Date.UTC(2000, 0, 1, 12)
const PREPARED_STAR_STRIDE = 7
const POSITION_X_OFFSET = 0
const POSITION_Y_OFFSET = 1
const POSITION_Z_OFFSET = 2
const MOTION_X_OFFSET = 3
const MOTION_Y_OFFSET = 4
const MOTION_Z_OFFSET = 5
const EPOCH_YEAR_OFFSET = 6
const ASTRONOMY_BODY_BY_ID: Record<SolarSystemBodyId, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
}

export interface CartesianVector {
  x: number
  y: number
  z: number
}

interface PreparedSkyCatalog {
  catalog: SkyCatalog
  starIndexById: ReadonlyMap<string, number>
  astrometry: Float64Array
}

interface LocalizedSkyCulture {
  figureNames: string[]
  regionNames: string[]
  starNames: Array<string | null>
}

interface PreparedSkyCulture {
  culture: SkyCulturePack
  regionVectors: CartesianVector[][][]
  starIndexes: Int32Array
  localizedByLanguage: Map<string, LocalizedSkyCulture>
}

export class SkyFrameCalculator {
  private readonly preparedCatalog: PreparedSkyCatalog
  private readonly preparedCultures = new WeakMap<SkyCulturePack, PreparedSkyCulture>()

  constructor(
    catalog: SkyCatalog,
    private readonly featuredPatternPack: FeaturedPatternPack,
  ) {
    this.preparedCatalog = prepareSkyCatalog(catalog)
  }

  calculate(culture: SkyCulturePack, parameters: SkyCalculationParameters): SkyFrame {
    let preparedCulture = this.preparedCultures.get(culture)
    if (!preparedCulture) {
      preparedCulture = prepareSkyCulture(culture, this.preparedCatalog)
      this.preparedCultures.set(culture, preparedCulture)
    }
    return calculatePreparedSkyFrame(
      this.preparedCatalog,
      preparedCulture,
      this.featuredPatternPack,
      parameters,
    )
  }
}

function prepareSkyCatalog(catalog: SkyCatalog): PreparedSkyCatalog {
  const starIndexById = new Map<string, number>()
  const astrometry = new Float64Array(catalog.stars.length * PREPARED_STAR_STRIDE)
  for (let starIndex = 0; starIndex < catalog.stars.length; starIndex += 1) {
    const star = catalog.stars[starIndex]
    starIndexById.set(star.id, starIndex)

    const rightAscension = star.raDeg * DEG_TO_RAD
    const declination = star.decDeg * DEG_TO_RAD
    const cosRa = Math.cos(rightAscension)
    const sinRa = Math.sin(rightAscension)
    const cosDec = Math.cos(declination)
    const sinDec = Math.sin(declination)
    const offset = starIndex * PREPARED_STAR_STRIDE
    astrometry[offset + POSITION_X_OFFSET] = cosDec * cosRa
    astrometry[offset + POSITION_Y_OFFSET] = cosDec * sinRa
    astrometry[offset + POSITION_Z_OFFSET] = sinDec

    const motionRa = (star.pmRaMasPerYear ?? 0) * MAS_TO_RAD
    const motionDec = (star.pmDecMasPerYear ?? 0) * MAS_TO_RAD
    astrometry[offset + MOTION_X_OFFSET] = motionRa * -sinRa + motionDec * -cosRa * sinDec
    astrometry[offset + MOTION_Y_OFFSET] = motionRa * cosRa + motionDec * -sinRa * sinDec
    astrometry[offset + MOTION_Z_OFFSET] = motionDec * cosDec
    astrometry[offset + EPOCH_YEAR_OFFSET] = star.epochYear
  }
  return { catalog, starIndexById, astrometry }
}

function prepareSkyCulture(
  culture: SkyCulturePack,
  preparedCatalog: PreparedSkyCatalog,
): PreparedSkyCulture {
  const starIndexes = new Int32Array(culture.starNames.length)
  starIndexes.fill(-1)
  for (let recordIndex = 0; recordIndex < culture.starNames.length; recordIndex += 1) {
    starIndexes[recordIndex] = preparedCatalog.starIndexById.get(
      culture.starNames[recordIndex].objectId,
    ) ?? -1
  }
  return {
    culture,
    regionVectors: culture.regions.map((region) => region.geometry.coordinates.flatMap((polygon) =>
      polygon.map((ring) => ring.map(equatorialToVector)),
    )),
    starIndexes,
    localizedByLanguage: new Map(),
  }
}

function localizedSkyCulture(
  preparedCulture: PreparedSkyCulture,
  interfaceLanguage: string,
): LocalizedSkyCulture {
  const cached = preparedCulture.localizedByLanguage.get(interfaceLanguage)
  if (cached) return cached
  const { culture } = preparedCulture
  const localized: LocalizedSkyCulture = {
    figureNames: culture.figures.map((figure) =>
      selectLocalizedName(figure.names, interfaceLanguage, culture.defaultLanguage),
    ),
    regionNames: culture.regions.map((region) =>
      selectLocalizedName(region.names, interfaceLanguage, culture.defaultLanguage),
    ),
    starNames: culture.starNames.map((record) =>
      selectInterfaceLanguageName(record.names, interfaceLanguage) ?? null,
    ),
  }
  preparedCulture.localizedByLanguage.set(interfaceLanguage, localized)
  return localized
}

export function calculateSkyFrame(
  catalog: SkyCatalog,
  culture: SkyCulturePack,
  featuredPatternPack: FeaturedPatternPack,
  parameters: SkyCalculationParameters,
): SkyFrame {
  return new SkyFrameCalculator(catalog, featuredPatternPack).calculate(culture, parameters)
}

function calculatePreparedSkyFrame(
  preparedCatalog: PreparedSkyCatalog,
  preparedCulture: PreparedSkyCulture,
  featuredPatternPack: FeaturedPatternPack,
  parameters: SkyCalculationParameters,
): SkyFrame {
  const { catalog } = preparedCatalog
  const { culture } = preparedCulture
  const date = validateParameters(parameters, catalog.visualMagnitudeLimit)
  const targetYear = julianYear(date)
  const observer = new Observer(
    parameters.observer.latitudeDeg,
    parameters.observer.longitudeDeg,
    parameters.observer.elevationMeters,
  )
  const rotation = Rotation_EQJ_HOR(date, observer).rot
  const coordinatesByIndex = new Array<HorizontalCoordinate | undefined>(catalog.stars.length)
  const coordinateForIndex = (starIndex: number): HorizontalCoordinate => {
    const cached = coordinatesByIndex[starIndex]
    if (cached) return cached
    const coordinate = preparedStarToHorizontal(
      preparedCatalog.astrometry,
      starIndex,
      targetYear,
      rotation,
      parameters.applyRefraction,
    )
    coordinatesByIndex[starIndex] = coordinate
    return coordinate
  }
  const coordinateForObject = (objectId: string): HorizontalCoordinate | null => {
    const starIndex = preparedCatalog.starIndexById.get(objectId)
    return starIndex === undefined ? null : coordinateForIndex(starIndex)
  }

  const stars: ComputedStar[] = []
  const visibleStarsByIndex = new Array<ComputedStar | undefined>(catalog.stars.length)
  for (let starIndex = 0; starIndex < catalog.stars.length; starIndex += 1) {
    const star = catalog.stars[starIndex]
    if (star.visualMagnitude > parameters.magnitudeLimit) continue
    const coordinate = coordinateForIndex(starIndex)
    if (coordinate.altitudeDeg < parameters.minimumAltitudeDeg) continue
    const computedStar: ComputedStar = {
      id: star.id,
      hipId: star.hipId,
      gaiaDr3Id: star.gaiaDr3Id,
      tycho2Id: star.tycho2Id,
      hdId: star.hdId,
      visualMagnitude: star.visualMagnitude,
      colorIndex: star.colorIndex,
      spectralType: star.spectralType,
      astrometrySource: star.astrometrySource,
      ...coordinate,
    }
    stars.push(computedStar)
    visibleStarsByIndex[starIndex] = computedStar
  }

  const cultureFigures = calculateCultureFigures(
    preparedCulture,
    parameters.interfaceLanguage,
    coordinateForObject,
  )
  const cultureRegions = calculateCultureRegions(
    preparedCulture,
    parameters.interfaceLanguage,
    rotation,
    parameters.applyRefraction,
  )
  const starLabels = calculateStarLabels(
    preparedCulture,
    parameters.interfaceLanguage,
    visibleStarsByIndex,
  )
  const featuredPatterns = calculateFeaturedPatterns(
    featuredPatternPack,
    parameters,
    coordinateForObject,
  )

  const solarSystemBodies = calculateSolarSystemBodies(
    date,
    observer,
    parameters.minimumAltitudeDeg,
    parameters.applyRefraction,
  )

  return {
    observedAt: date.toISOString(),
    observer: { ...parameters.observer },
    cultureId: culture.id,
    interfaceLanguage: parameters.interfaceLanguage,
    stars,
    cultureFigures,
    cultureRegions,
    starLabels,
    featuredPatterns,
    solarSystemBodies,
  }
}

function calculateCultureFigures(
  preparedCulture: PreparedSkyCulture,
  interfaceLanguage: string,
  coordinateForObject: (objectId: string) => HorizontalCoordinate | null,
): ComputedCultureFigure[] {
  const { culture } = preparedCulture
  const localized = localizedSkyCulture(preparedCulture, interfaceLanguage)
  return culture.figures.map((figure, figureIndex) => ({
    id: figure.id,
    type: figure.type,
    name: localized.figureNames[figureIndex],
    rank: figure.rank,
    labelPosition: coordinateForObject(figure.labelAnchor.objectId),
    lines: figure.paths.flatMap((path) => splitResolvedPath(path, coordinateForObject)),
  }))
}

function calculateCultureRegions(
  preparedCulture: PreparedSkyCulture,
  interfaceLanguage: string,
  rotation: number[][],
  applyRefraction: boolean,
): ComputedCultureRegion[] {
  const { culture } = preparedCulture
  const localized = localizedSkyCulture(preparedCulture, interfaceLanguage)
  return culture.regions.map((region, regionIndex) => ({
    id: region.id,
    figureId: region.figureId,
    name: localized.regionNames[regionIndex],
    rings: preparedCulture.regionVectors[regionIndex].map((ring) =>
      ring.map((vector) => toHorizontal(
        vector,
        rotation,
        applyRefraction,
      )),
    ),
  }))
}

function calculateStarLabels(
  preparedCulture: PreparedSkyCulture,
  interfaceLanguage: string,
  visibleStarsByIndex: Array<ComputedStar | undefined>,
): ComputedStarLabel[] {
  const localized = localizedSkyCulture(preparedCulture, interfaceLanguage)
  const labels: ComputedStarLabel[] = []
  for (let recordIndex = 0; recordIndex < preparedCulture.culture.starNames.length; recordIndex += 1) {
    const starIndex = preparedCulture.starIndexes[recordIndex]
    if (starIndex < 0) continue
    const star = visibleStarsByIndex[starIndex]
    const name = localized.starNames[recordIndex]
    if (!star || !name) continue
    const record = preparedCulture.culture.starNames[recordIndex]
    labels.push({
      objectId: record.objectId,
      name,
      labelPriority: record.labelPriority,
      visualMagnitude: star.visualMagnitude,
      azimuthDeg: star.azimuthDeg,
      altitudeDeg: star.altitudeDeg,
    })
  }
  return labels
}

function calculateFeaturedPatterns(
  pack: FeaturedPatternPack,
  parameters: SkyCalculationParameters,
  coordinateForObject: (objectId: string) => HorizontalCoordinate | null,
): ComputedFeaturedPattern[] {
  const enabledIds = new Set(parameters.enabledFeaturedPatternIds)
  return pack.patterns
    .filter((pattern) => enabledIds.has(pattern.id) && pattern.cultureIds.includes(parameters.cultureId))
    .map((pattern) => ({
      id: pattern.id,
      name: selectLocalizedName(pattern.names, parameters.interfaceLanguage, 'en'),
      memberObjectIds: [...pattern.memberObjectIds],
      labelPosition: coordinateForObject(pattern.labelAnchor.objectId),
      lines: pattern.paths.flatMap((path) => splitResolvedPath(path, coordinateForObject)),
    }))
}

function splitResolvedPath(
  objectIds: string[],
  coordinateForObject: (objectId: string) => HorizontalCoordinate | null,
): HorizontalCoordinate[][] {
  const lines: HorizontalCoordinate[][] = []
  let current: HorizontalCoordinate[] = []
  const flush = () => {
    if (current.length >= 2) lines.push(current)
    current = []
  }
  for (const objectId of objectIds) {
    const coordinate = coordinateForObject(objectId)
    if (coordinate) current.push(coordinate)
    else flush()
  }
  flush()
  return lines
}

function calculateSolarSystemBodies(
  date: Date,
  observer: Observer,
  minimumAltitudeDeg: number,
  applyRefraction: boolean,
): ComputedSolarSystemBody[] {
  return SOLAR_SYSTEM_BODY_IDS
    .map((id): ComputedSolarSystemBody => {
      const body = ASTRONOMY_BODY_BY_ID[id]
      const equatorial = Equator(body, date, observer, true, true)
      const horizontal = Horizon(
        date,
        observer,
        equatorial.ra,
        equatorial.dec,
        applyRefraction ? 'normal' : '',
      )
      const illumination = Illumination(body, date)

      return {
        id,
        azimuthDeg: horizontal.azimuth,
        altitudeDeg: horizontal.altitude,
        rightAscensionHours: equatorial.ra,
        declinationDeg: equatorial.dec,
        visualMagnitude: illumination.mag,
        phaseAngleDeg: illumination.phase_angle,
        phaseFraction: illumination.phase_fraction,
        distanceAu: equatorial.dist,
        ringTiltDeg: illumination.ring_tilt ?? null,
      }
    })
    .filter((body) => body.altitudeDeg >= minimumAltitudeDeg)
}

export function propagateIcrs(star: StarRecord, targetYear: number): CartesianVector {
  const rightAscension = star.raDeg * DEG_TO_RAD
  const declination = star.decDeg * DEG_TO_RAD
  const cosRa = Math.cos(rightAscension)
  const sinRa = Math.sin(rightAscension)
  const cosDec = Math.cos(declination)
  const sinDec = Math.sin(declination)
  const position = {
    x: cosDec * cosRa,
    y: cosDec * sinRa,
    z: sinDec,
  }
  const years = targetYear - star.epochYear
  const motionRa = (star.pmRaMasPerYear ?? 0) * MAS_TO_RAD * years
  const motionDec = (star.pmDecMasPerYear ?? 0) * MAS_TO_RAD * years

  const x = position.x + motionRa * -sinRa + motionDec * -cosRa * sinDec
  const y = position.y + motionRa * cosRa + motionDec * -sinRa * sinDec
  const z = position.z + motionDec * cosDec
  const length = Math.hypot(x, y, z)
  return { x: x / length, y: y / length, z: z / length }
}

export function julianYear(date: Date): number {
  return 2000 + (date.getTime() - J2000_MILLISECONDS) / JULIAN_YEAR_MILLISECONDS
}

function preparedStarToHorizontal(
  astrometry: Float64Array,
  starIndex: number,
  targetYear: number,
  rotation: number[][],
  applyRefraction: boolean,
): HorizontalCoordinate {
  const offset = starIndex * PREPARED_STAR_STRIDE
  const years = targetYear - astrometry[offset + EPOCH_YEAR_OFFSET]
  const x = astrometry[offset + POSITION_X_OFFSET] + astrometry[offset + MOTION_X_OFFSET] * years
  const y = astrometry[offset + POSITION_Y_OFFSET] + astrometry[offset + MOTION_Y_OFFSET] * years
  const z = astrometry[offset + POSITION_Z_OFFSET] + astrometry[offset + MOTION_Z_OFFSET] * years
  const length = Math.hypot(x, y, z)
  return toHorizontalComponents(x / length, y / length, z / length, rotation, applyRefraction)
}

function equatorialToVector([raDeg, decDeg]: EquatorialCoordinate): CartesianVector {
  const rightAscension = raDeg * DEG_TO_RAD
  const declination = decDeg * DEG_TO_RAD
  const cosDec = Math.cos(declination)
  return {
    x: cosDec * Math.cos(rightAscension),
    y: cosDec * Math.sin(rightAscension),
    z: Math.sin(declination),
  }
}

function toHorizontal(
  vector: CartesianVector,
  rotation: number[][],
  applyRefraction: boolean,
): HorizontalCoordinate {
  return toHorizontalComponents(vector.x, vector.y, vector.z, rotation, applyRefraction)
}

function toHorizontalComponents(
  x: number,
  y: number,
  z: number,
  rotation: number[][],
  applyRefraction: boolean,
): HorizontalCoordinate {
  const north = rotation[0][0] * x + rotation[1][0] * y + rotation[2][0] * z
  const west = rotation[0][1] * x + rotation[1][1] * y + rotation[2][1] * z
  const zenith = rotation[0][2] * x + rotation[1][2] * y + rotation[2][2] * z
  const geometricAltitude = Math.asin(clamp(zenith, -1, 1)) * RAD_TO_DEG
  const altitude = applyRefraction
    ? geometricAltitude + Refraction('normal', geometricAltitude)
    : geometricAltitude
  return {
    azimuthDeg: normalizeDegrees(Math.atan2(-west, north) * RAD_TO_DEG),
    altitudeDeg: altitude,
  }
}

function validateParameters(parameters: SkyCalculationParameters, catalogMagnitudeLimit: number): Date {
  const date = new Date(parameters.observedAt)
  if (Number.isNaN(date.getTime())) invalid('observedAt must be a valid ISO date-time')
  const year = julianYear(date)
  if (year < 1800 || year > 2200) invalid('observedAt must be between Julian years 1800 and 2200')
  requireRange(parameters.observer.latitudeDeg, 'latitudeDeg', -90, 90)
  requireRange(parameters.observer.longitudeDeg, 'longitudeDeg', -180, 180)
  requireRange(parameters.observer.elevationMeters, 'elevationMeters', -500, 10_000)
  requireRange(parameters.magnitudeLimit, 'magnitudeLimit', -10, catalogMagnitudeLimit)
  requireRange(parameters.minimumAltitudeDeg, 'minimumAltitudeDeg', -90, 90)
  if (typeof parameters.applyRefraction !== 'boolean') invalid('applyRefraction must be boolean')
  if (!parameters.cultureId) invalid('cultureId must not be empty')
  if (!parameters.interfaceLanguage) invalid('interfaceLanguage must not be empty')
  if (!Array.isArray(parameters.enabledFeaturedPatternIds)) {
    invalid('enabledFeaturedPatternIds must be an array')
  }
  return date
}

function requireRange(value: number, label: string, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    invalid(`${label} must be between ${minimum} and ${maximum}`)
  }
}

function invalid(message: string): never {
  throw new SkyMapError('INVALID_PARAMETERS', message)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
