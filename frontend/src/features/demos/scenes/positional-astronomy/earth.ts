import * as THREE from 'three'
import { globeQuaternion } from '../../engine/globe'
import { DEG, precessionPole, spherical, type AstronomyState, type Vec } from './model'

export const EARTH_RADIUS = 1.12
/** Fixed celestial frame: +X = equinox, +Y = north celestial pole. */
export const celestialVector = ([x, y, z]: Vec) => new THREE.Vector3(x, z, -y)

export function observerFrame(latitude: number, siderealHours: number) {
  const theta = siderealHours * 15 * DEG, phi = latitude * DEG
  const up = celestialVector(spherical(siderealHours * 15, latitude))
  const east = celestialVector([-Math.sin(theta), Math.cos(theta), 0])
  const north = celestialVector([-Math.sin(phi) * Math.cos(theta), -Math.sin(phi) * Math.sin(theta), Math.cos(phi)])
  return { position: up.clone().multiplyScalar(EARTH_RADIUS), up, east, north }
}

export function earthOrientation(state: AstronomyState): THREE.Quaternion {
  const pole = celestialVector(state.chapter === 'precession' ? precessionPole(state.years) : [0, 0, 1])
  // The selected teaching site has longitude zero. Its local sidereal time fixes the
  // prime meridian relative to the equinox; this is a geometric model, not civil time.
  const spin = globeQuaternion(new THREE.Vector3(0, 1, 0), celestialVector(spherical(state.lst * 15, 0)))
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole).multiply(spin)
}

export function createTeachingEarth() {
  const root = new THREE.Group()
  root.name = 'teaching-earth'
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 8, emissive: 0x182735, emissiveIntensity: .45 })
  const globe = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 40), material)
  root.add(globe)
  // A real surface ring follows the globe's tilted equator, including during precession.
  const equator = new THREE.Mesh(new THREE.TorusGeometry(EARTH_RADIUS + .012, .012, 8, 128), new THREE.MeshBasicMaterial({ color: 0x78acff }))
  equator.rotation.x = Math.PI / 2
  root.add(equator)
  let disposed = false
  let textureStatus: 'loading' | 'ready' | 'fallback' = 'loading'
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}demos/meteor-shower/earth-day.jpg`, texture => {
    if (disposed) { texture.dispose(); return }
    textureStatus = 'ready'
  }, undefined, () => {
    if (disposed) return
    textureStatus = 'fallback'
    material.map = null; material.color.setHex(0x397eaf); material.needsUpdate = true
  })
  texture.colorSpace = THREE.SRGBColorSpace
  material.map = texture
  return { root, status: () => textureStatus, dispose() { disposed = true; texture.dispose() } }
}
