export const DEG = Math.PI / 180
export type Vec = [number, number, number]
export const CHAPTERS = ['horizon', 'equatorial', 'daily', 'ecliptic', 'galactic', 'precession'] as const
export type Chapter = typeof CHAPTERS[number]
export interface AstronomyState {
  chapter: Chapter
  latitude: number
  ra: number
  dec: number
  lst: number
  years: number
  playing: boolean
  speed: number
  step: number
  grid: boolean
  perspective: 'earth' | 'observer'
}
export const INITIAL: AstronomyState = { chapter: 'horizon', latitude: 40, ra: 6, dec: 20, lst: 4, years: 0, playing: false, speed: 1, step: 0, grid: false, perspective: 'earth' }
export const wrap = (n: number, period = 360) => ((n % period) + period) % period
export function spherical(lon: number, lat: number): Vec {
  return [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)]
}
export function angles(v: Vec) {
  const lon = wrap(Math.atan2(v[1], v[0]) / DEG)
  const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / DEG
  // Rounded rotation matrices leave tiny residues at coordinate origins. Do not turn
  // a zero-length measurement into an almost-360-degree arc or a negative-zero readout.
  return { lon: lon > 360 - 1e-7 || lon < 1e-7 ? 0 : lon, lat: Math.abs(lat) < 1e-7 ? 0 : lat }
}
/** Equatorial Cartesian → local east, up, north. LST and RA are in hours. */
export function local(v: Vec, latitude: number, lst: number): Vec {
  const p = latitude * DEG, t = lst * 15 * DEG
  const meridian = v[0] * Math.cos(t) + v[1] * Math.sin(t)
  return [-v[0] * Math.sin(t) + v[1] * Math.cos(t), meridian * Math.cos(p) + v[2] * Math.sin(p), -meridian * Math.sin(p) + v[2] * Math.cos(p)]
}
export function horizontal(ra: number, dec: number, latitude: number, lst: number) {
  const [east, up, north] = local(spherical(ra * 15, dec), latitude, lst)
  return { altitude: Math.atan2(up, Math.hypot(east, north)) / DEG, azimuth: Math.hypot(east, north) < 1e-10 ? null : wrap(Math.atan2(east, north) / DEG) }
}
/** Inverse of local(): lets beginners move a star with azimuth/altitude directly. */
export function fromHorizontal(azimuth: number, altitude: number, latitude: number, lst: number) {
  const a = azimuth * DEG, h = altitude * DEG, p = latitude * DEG, t = lst * 15 * DEG
  const east = Math.cos(h) * Math.sin(a), north = Math.cos(h) * Math.cos(a), up = Math.sin(h)
  const meridian = up * Math.cos(p) - north * Math.sin(p)
  const equatorial = angles([meridian * Math.cos(t) - east * Math.sin(t), meridian * Math.sin(t) + east * Math.cos(t), up * Math.sin(p) + north * Math.cos(p)])
  return { ra: equatorial.lon / 15, dec: equatorial.lat }
}

export const EXAMPLES = ['southeast', 'transit', 'circumpolar', 'southern', 'solstice', 'galacticCenter', 'halfCycle'] as const
export type Example = typeof EXAMPLES[number]
export function exampleState(example: Example): AstronomyState {
  const base = { ...INITIAL, step: 2 }
  switch (example) {
    case 'southeast': return { ...base, perspective: 'observer', ...fromHorizontal(135, 35, 40, 4) }
    case 'transit': return { ...base, chapter: 'equatorial', lst: 6 }
    case 'circumpolar': return { ...base, chapter: 'daily', dec: 60 }
    case 'southern': return { ...base, chapter: 'daily', latitude: -40, dec: -60 }
    case 'solstice': return { ...base, chapter: 'ecliptic', dec: 23.43928 }
    case 'galacticCenter': {
      const center = angles(galacticToEquatorial([1, 0, 0]))
      return { ...base, chapter: 'galactic', ra: center.lon / 15, dec: center.lat }
    }
    case 'halfCycle': return { ...base, chapter: 'precession', years: 13000 }
  }
}
export function visibility(latitude: number, dec: number) {
  const a = Math.sin(latitude * DEG) * Math.sin(dec * DEG)
  const b = Math.abs(Math.cos(latitude * DEG) * Math.cos(dec * DEG))
  if (a - b > 1e-10) return 'circumpolar'
  if (a + b < -1e-10) return 'never'
  if (Math.abs(a - b) < 1e-10 || Math.abs(a + b) < 1e-10) return 'grazing'
  return 'rises'
}
export const OBLIQUITY = 23.43928 * DEG
export function eclipticToEquatorial([x, y, z]: Vec): Vec {
  return [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)]
}
export function equatorialToEcliptic([x, y, z]: Vec): Vec {
  return [x, y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY), -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)]
}
// ICRS → Galactic rotation (Hipparcos / Astropy convention).
const G = [[-.0548755604, -.8734370902, -.4838350155], [.4941094279, -.4448296300, .7469822445], [-.8676661490, -.1980763734, .4559837762]]
export function equatorialToGalactic(v: Vec): Vec { return G.map(row => row.reduce((s, n, i) => s + n * v[i]!, 0)) as Vec }
export function galacticToEquatorial(v: Vec): Vec { return [0, 1, 2].map(i => G.reduce((s, row, j) => s + row[i]! * v[j]!, 0)) as Vec }
/** Constant-obliquity, 26,000-year cone: a teaching model, not an ephemeris. */
export const PRECESSION_PERIOD = 26000
export function precessionPole(years: number): Vec {
  const phase = -years / PRECESSION_PERIOD * Math.PI * 2
  return eclipticToEquatorial([-Math.sin(OBLIQUITY) * Math.sin(phase), Math.sin(OBLIQUITY) * Math.cos(phase), Math.cos(OBLIQUITY)])
}
