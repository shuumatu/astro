/**
 * Collect the per-frame camera azimuth LPI's Apollo Image Atlas publishes, for every frame that
 * makes up the panoramas the demo ships.
 *
 * The atlas prints, on each frame page, lines like:
 *   Latitude / Longitude: | 20.4° N / 31.6° E |
 *   Camera Azimuth:       | 298 |
 *   Camera Elevation:     | 12 |
 * so a stitched strip's overall heading and its azimuth span can be read straight off its frames
 * rather than guessed.
 *
 * Usage: node docs/lunar-panorama-research/tools/fetch-frame-azimuth.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; moon-demo-research/1.0; contact: repo maintainer)' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Each shipped panorama with the frames its NASA description names.
const PANORAMAS = [
  { id: 'apollo-11-tranquility-base', magazine: 40, first: 5881, last: 5891 },
  { id: 'apollo-11-armstrong-crater', magazine: 40, first: 5954, last: 5961 },
  { id: 'apollo-12-surveyor-crater', magazine: 47, first: 6982, last: 7006 },
  { id: 'apollo-14-fra-mauro', magazine: 66, first: 9271, last: 9293 },
  { id: 'apollo-15-hadley-rille', magazine: 85, first: 11448, last: 11453 },
  { id: 'apollo-16-station-1', magazine: 114, first: 18416, last: 18431 },
  { id: 'apollo-17-station-2', magazine: 138, first: 21053, last: 21073 },
  { id: 'apollo-17-station-5', magazine: 145, first: 22159, last: 22181 },
]

function parseFrame(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  const numbers = (label) => {
    const match = text.match(new RegExp(`${label}\\s*:?\\s*\\|?\\s*(-?[0-9.]+)`, 'i'))
    return match ? Number(match[1]) : null
  }
  const latLon = text.match(/Latitude\s*\/\s*Longitude\s*:?\s*\|?\s*(-?[0-9.]+)\s*°?\s*([NS])?\s*\/\s*(-?[0-9.]+)\s*°?\s*([EW])?/i)
  return {
    azimuthDeg: numbers('Camera Azimuth'),
    elevationDeg: numbers('Camera Elevation'),
    latitudeDeg: latLon ? Number(latLon[1]) * (latLon[2]?.toUpperCase() === 'S' ? -1 : 1) : null,
    longitudeDeg: latLon ? Number(latLon[3]) * (latLon[4]?.toUpperCase() === 'W' ? -1 : 1) : null,
    feature: (text.match(/Feature\(s\)\s*:?\s*\|?\s*([^|]{0,120})/i) || [])[1]?.trim() ?? null,
  }
}

const results = {}
for (const pano of PANORAMAS) {
  const prefix = pano.id.startsWith('apollo-11') ? 'AS11'
    : pano.id.startsWith('apollo-12') ? 'AS12'
      : pano.id.startsWith('apollo-14') ? 'AS14'
        : pano.id.startsWith('apollo-15') ? 'AS15'
          : pano.id.startsWith('apollo-16') ? 'AS16' : 'AS17'
  const frames = []
  for (let frame = pano.first; frame <= pano.last; frame += 1) {
    const id = `${prefix}-${pano.magazine}-${frame}`
    const url = `https://www.lpi.usra.edu/resources/apollo/frame/?${id}`
    let parsed = null
    for (let attempt = 1; attempt <= 3 && !parsed; attempt += 1) {
      try {
        const res = await fetch(url, { headers: UA })
        if (!res.ok) {
          await sleep(3000 * attempt)
          continue
        }
        parsed = parseFrame(await res.text())
      } catch {
        await sleep(3000 * attempt)
      }
    }
    frames.push({ id, ...(parsed ?? { azimuthDeg: null, elevationDeg: null, latitudeDeg: null, longitudeDeg: null, feature: null }) })
    process.stdout.write(`${id}:${parsed?.azimuthDeg ?? '—'} `)
    await sleep(1200)
  }
  const azimuths = frames.map((f) => f.azimuthDeg).filter((a) => a !== null)
  results[pano.id] = {
    frames,
    azimuthCount: azimuths.length,
    frameCount: frames.length,
    firstAzimuth: azimuths[0] ?? null,
    lastAzimuth: azimuths[azimuths.length - 1] ?? null,
  }
  console.log(`\n  ${pano.id}: ${azimuths.length}/${frames.length} frames carry an azimuth`)
}

mkdirSync('.cache/research', { recursive: true })
writeFileSync('.cache/research/frame-azimuths.json', JSON.stringify(results, null, 2))
console.log('\nwrote .cache/research/frame-azimuths.json')
