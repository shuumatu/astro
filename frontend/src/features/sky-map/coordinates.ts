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
import { selectLocalizedName } from './localizedName'
import { SkyMapError, SOLAR_SYSTEM_BODY_IDS } from './types'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const MAS_TO_RAD = DEG_TO_RAD / 3_600_000
const JULIAN_YEAR_MILLISECONDS = 365.25 * 86_400_000
const J2000_MILLISECONDS = Date.UTC(2000, 0, 1, 12)
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

export function calculateSkyFrame(
  catalog: SkyCatalog,
  culture: SkyCulturePack,
  featuredPatternPack: FeaturedPatternPack,
  parameters: SkyCalculationParameters,
): SkyFrame {
  const date = validateParameters(parameters, catalog.visualMagnitudeLimit)
  const targetYear = julianYear(date)
  const observer = new Observer(
    parameters.observer.latitudeDeg,
    parameters.observer.longitudeDeg,
    parameters.observer.elevationMeters,
  )
  const rotation = Rotation_EQJ_HOR(date, observer).rot
  const starsById = new Map(catalog.stars.map((star) => [star.id, star]))
  const coordinatesById = new Map<string, HorizontalCoordinate>()
  const coordinateForObject = (objectId: string): HorizontalCoordinate | null => {
    const cached = coordinatesById.get(objectId)
    if (cached) return cached
    const star = starsById.get(objectId)
    if (!star) return null
    const coordinate = toHorizontal(
      propagateIcrs(star, targetYear),
      rotation,
      parameters.applyRefraction,
    )
    coordinatesById.set(objectId, coordinate)
    return coordinate
  }

  const stars: ComputedStar[] = catalog.stars
    .filter((star) => star.visualMagnitude <= parameters.magnitudeLimit)
    .map((star) => ({
      star,
      coordinate: coordinateForObject(star.id)!,
    }))
    .filter(({ coordinate }) => coordinate.altitudeDeg >= parameters.minimumAltitudeDeg)
    .map(({ star, coordinate }) => ({
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
    }))

  const cultureFigures = calculateCultureFigures(culture, parameters.interfaceLanguage, coordinateForObject)
  const cultureRegions = calculateCultureRegions(
    culture,
    parameters.interfaceLanguage,
    rotation,
    parameters.applyRefraction,
  )
  const starLabels = calculateStarLabels(culture, parameters.interfaceLanguage, stars)
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
  culture: SkyCulturePack,
  interfaceLanguage: string,
  coordinateForObject: (objectId: string) => HorizontalCoordinate | null,
): ComputedCultureFigure[] {
  return culture.figures.map((figure) => ({
    id: figure.id,
    type: figure.type,
    name: selectLocalizedName(figure.names, interfaceLanguage, culture.defaultLanguage),
    rank: figure.rank,
    labelPosition: coordinateForObject(figure.labelAnchor.objectId),
    lines: figure.paths.flatMap((path) => splitResolvedPath(path, coordinateForObject)),
  }))
}

function calculateCultureRegions(
  culture: SkyCulturePack,
  interfaceLanguage: string,
  rotation: number[][],
  applyRefraction: boolean,
): ComputedCultureRegion[] {
  return culture.regions.map((region) => ({
    id: region.id,
    figureId: region.figureId,
    name: selectLocalizedName(region.names, interfaceLanguage, culture.defaultLanguage),
    rings: region.geometry.coordinates.flatMap((polygon) => polygon.map((ring) =>
      ring.map((coordinate) => toHorizontal(
        equatorialToVector(coordinate),
        rotation,
        applyRefraction,
      )),
    )),
  }))
}

function calculateStarLabels(
  culture: SkyCulturePack,
  interfaceLanguage: string,
  stars: ComputedStar[],
): ComputedStarLabel[] {
  const visibleStars = new Map(stars.map((star) => [star.id, star]))
  return culture.starNames.flatMap((record): ComputedStarLabel[] => {
    const star = visibleStars.get(record.objectId)
    if (!star) return []
    return [{
      objectId: record.objectId,
      name: selectLocalizedName(record.names, interfaceLanguage, culture.defaultLanguage),
      labelPriority: record.labelPriority,
      visualMagnitude: star.visualMagnitude,
      azimuthDeg: star.azimuthDeg,
      altitudeDeg: star.altitudeDeg,
    }]
  })
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
  const north = rotation[0][0] * vector.x + rotation[1][0] * vector.y + rotation[2][0] * vector.z
  const west = rotation[0][1] * vector.x + rotation[1][1] * vector.y + rotation[2][1] * vector.z
  const zenith = rotation[0][2] * vector.x + rotation[1][2] * vector.y + rotation[2][2] * vector.z
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
