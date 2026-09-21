import * as THREE from 'three'
import { createRandom } from '../../engine/random'
import { addDustExtinction, createAccretionMaterial, createPhotosphereMaterial } from './materials'

/**
 * The handful of shapes the stellar-evolution demo is drawn from.
 *
 * One set of primitives is reused by every stage and driven by the numbers in `visuals.ts`, rather
 * than nine separate models: that is what lets a stage change be a continuous morph instead of a
 * cut, and it keeps the whole picture in one place. Nothing here knows which stage is showing.
 *
 * Textures are generated on a canvas and cached at module level. The stage's teardown disposes
 * everything it finds in the scene graph, which frees the GPU copy; three.js re-uploads a disposed
 * texture on its next use, so a second visit to the page still gets its surface.
 */

let softParticleTexture: THREE.CanvasTexture | null = null
let beamTexture: THREE.CanvasTexture | null = null

/** A sphere the size of the drawn body. Unit radius, so the caller scales it. */
export function createCore(segments = 64): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.66))
  const material = createPhotosphereMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'core'
  return mesh
}

/**
 * The translucent veil in front of a protostar's core.
 *
 * A protostar at 3500 K is intrinsically dim and buried in the dust it is still falling through,
 * so what is visible is mostly the envelope's glow rather than the star. Drawn as the front
 * hemisphere of a larger sphere so it sits between the camera and the core.
 */
export function createOccluder(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, 40, 24)
  const material = new THREE.MeshBasicMaterial({
    color: 0x150c05,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  addDustExtinction(material)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'occluder'
  return mesh
}

/**
 * A cloud of particles, unit radius, to be scaled into a dust cloud, a stellar wind, an ionised
 * nebula or a supernova remnant.
 *
 * `hollow` decides the radial distribution: a molecular cloud is filled through its volume, while a
 * planetary nebula and a supernova remnant are shells and look wrong when they have a middle. The
 * demo builds one of each and shows whichever the stage calls for, so the two share every other
 * property - colour, size, flattening, tilt - and differ only in where their particles sit.
 */
export function createParticleShell(options: {
  count?: number
  hollow?: boolean
  seed?: number
  size?: number
  name?: string
} = {}): THREE.Points {
  const count = options.count ?? 4800
  const hollow = options.hollow ?? false
  const random = createRandom(options.seed ?? 20260919)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()

  for (let index = 0; index < count; index += 1) {
    const base = index * 3
    // Uniform directions on the sphere, then a radius: the cube root makes a filled ball evenly
    // dense rather than concentrated at the centre.
    const z = random() * 2 - 1
    const angle = random() * Math.PI * 2
    const ring = Math.sqrt(Math.max(0, 1 - z * z))
    const radius = hollow
      ? 0.86 + random() * 0.14
      : 0.34 + Math.cbrt(random()) * 0.66
    if (hollow) {
      const ripple = 1 + .06 * Math.sin(angle * 9 + z * 12)
      positions[base] = Math.cos(angle) * ring * radius * ripple
      positions[base + 1] = z * radius
      positions[base + 2] = Math.sin(angle) * ring * radius * ripple
    } else {
      // Overlapping knots along three bent filaments, not a uniformly filled sphere.
      const branch = index % 3
      const t = random() * 2 - 1
      const width = .1 + .16 * (1 - Math.abs(t))
      positions[base] = t * .88 + Math.cos(angle) * ring * width
      positions[base + 1] = Math.sin(t * 3.2 + branch * 2.1) * .3 + z * width
      positions[base + 2] = Math.cos(t * 4 + branch * 2.1) * .25 + Math.sin(angle) * ring * width
    }

    // Per-particle brightness and a slight hue spread, so the shell has depth rather than reading
    // as a flat ring of identical dots.
    const brightness = 0.26 + random() * 0.54
    const warmth = (random() - 0.5) * 0.65
    color.setRGB(
      Math.min(1, brightness * (1 + warmth)),
      Math.min(1, brightness * (1 - Math.abs(warmth) * 0.25)),
      Math.min(1, brightness * (1 - warmth)),
    )
    colors[base] = color.r
    colors[base + 1] = color.g
    colors[base + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: options.size ?? 0.09,
    map: getSoftParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: hollow ? THREE.AdditiveBlending : THREE.NormalBlending,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)
  points.name = options.name ?? 'cloud'
  points.frustumCulled = false
  return points
}

/**
 * A flat annulus, unit outer radius, to be scaled into an accretion disk.
 *
 * Tilted out of the equatorial plane by `DISK_TILT` so the camera sees it as an ellipse rather than
 * a line. Both the protostar's disk and the black hole's are this one shape.
 */
export const DISK_TILT = -Math.PI / 2 + 0.18

export function createDisk(innerFraction = 0.56): THREE.Mesh {
  const geometry = new THREE.RingGeometry(innerFraction, 1, 128, 1)
  const material = createAccretionMaterial(innerFraction)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'disk'
  mesh.rotation.x = DISK_TILT
  return mesh
}

/**
 * Two opposed cones with their apexes at the star: a protostar's bipolar outflow, or a pulsar's
 * lighthouse beams.
 *
 * The group is tilted away from the spin axis, which is what makes a pulsar flash: the beams sweep
 * past the observer rather than pointing at them the whole time.
 */
export function createBeams(options: { length?: number, spread?: number } = {}): THREE.Group {
  const length = options.length ?? 2.4
  const spread = options.spread ?? 0.5
  const group = new THREE.Group()
  group.name = 'beams'
  for (const direction of [1, -1]) {
    const geometry = new THREE.ConeGeometry(spread, length, 40, 1, true)
    const material = new THREE.MeshBasicMaterial({
      map: getBeamTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const cone = new THREE.Mesh(geometry, material)
    // ConeGeometry puts the apex at +height/2, so shifting by half the length puts it on the star.
    cone.position.y = direction * length * 0.5
    if (direction > 0) cone.rotation.z = Math.PI
    group.add(cone)
  }
  group.rotation.z = 0.42
  return group
}

/**
 * The fixed circle marking the Sun's main-sequence radius.
 *
 * The size compression means the drawing cannot be to scale, and a picture whose scale changes
 * silently teaches nothing. A ring that never moves gives the viewer something to measure against:
 * the red giant swallows it, the white dwarf shrinks well inside it.
 *
 * It is drawn with depth testing off, because the one place it matters most is the one place it
 * would otherwise be invisible: inside the red giant, where the ring is behind a hundred solar
 * radii of opaque photosphere.
 */
export function createReferenceRing(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.988, 1.012, 192, 1)
  const material = new THREE.MeshBasicMaterial({
    color: 0xa8c4e0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'referenceRing'
  mesh.renderOrder = 10
  // Square on to the camera, which sits on +Z with a small lift, so it reads as a circle.
  mesh.rotation.x = -Math.atan(1.5 / 7.6)
  return mesh
}

// ------------------------------------------------------------------ textures

/** A soft round dot for the particle shells. */
function getSoftParticleTexture(): THREE.CanvasTexture {
  if (softParticleTexture) return softParticleTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const centre = size / 2
    const gradient = context.createRadialGradient(centre, centre, 0, centre, centre, centre)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.32)')
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  softParticleTexture = new THREE.CanvasTexture(canvas)
  softParticleTexture.colorSpace = THREE.SRGBColorSpace
  return softParticleTexture
}

/**
 * A cone's lengthwise falloff: brightest where it leaves the star, gone by the far end.
 *
 * CylinderGeometry places the apex at uv.y = 1. Canvas row zero maps to v = 1,
 * so the top is brightest; the widening end fades away.
 */
function getBeamTexture(): THREE.CanvasTexture {
  if (beamTexture) return beamTexture
  const width = 8
  const height = 128
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.35)')
    gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.08)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  }
  beamTexture = new THREE.CanvasTexture(canvas)
  beamTexture.colorSpace = THREE.SRGBColorSpace
  return beamTexture
}
