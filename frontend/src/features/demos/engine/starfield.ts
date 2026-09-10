import * as THREE from 'three'
import { createRandom } from './random'

export interface StarfieldOptions {
  radius?: number
  count?: number
  pixelRatio?: number
  seed?: number
}

export function createStarfield(options: StarfieldOptions = {}): THREE.Group {
  const radius = options.radius ?? 600
  const count = options.count ?? 1800
  const pixelRatio = options.pixelRatio ?? 1
  const randomNumber = createRandom(options.seed ?? 20260910)
  const group = new THREE.Group()
  group.name = 'starfield'
  group.add(createLayer(radius, Math.round(count * 0.78), 1.5 * pixelRatio, 0.62, randomNumber))
  group.add(createLayer(radius * 0.97, Math.round(count * 0.22), 2.4 * pixelRatio, 0.92, randomNumber))
  return group
}

function createLayer(
  radius: number,
  count: number,
  size: number,
  opacity: number,
  randomNumber: () => number,
): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()

  for (let index = 0; index < count; index += 1) {
    const direction = randomDirection(randomNumber)
    const distance = radius * (1 + (randomNumber() - 0.5) * 0.06)
    const base = index * 3
    positions[base] = direction.x * distance
    positions[base + 1] = direction.y * distance
    positions[base + 2] = direction.z * distance

    const brightness = 0.55 + randomNumber() * 0.45
    const warmth = (randomNumber() - 0.5) * 0.18
    color.setRGB(
      Math.min(1, brightness * (1 + warmth)),
      Math.min(1, brightness),
      Math.min(1, brightness * (1 - warmth * 0.9)),
    )
    colors[base] = color.r
    colors[base + 1] = color.g
    colors[base + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return points
}

function randomDirection(randomNumber: () => number): THREE.Vector3 {
  const z = randomNumber() * 2 - 1
  const angle = randomNumber() * Math.PI * 2
  const radius = Math.sqrt(Math.max(0, 1 - z * z))
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius)
}
