import * as THREE from 'three'

export interface EarthGlobeOptions {
  radius: number
  /** Axial tilt away from the ecliptic normal, in degrees. */
  obliquityDeg: number
  material: THREE.Material
}

const DEGREES_TO_RADIANS = Math.PI / 180

/**
 * Builds the Earth as a textured globe with the axis pointing the right way.
 *
 * Two rotations are needed and it is easy to forget both. The photograph-style texture puts
 * the north pole at the sphere's own +Y, but this scene lives in ecliptic coordinates where
 * +Z is ecliptic north — so an unrotated globe has its axis lying *inside* the orbital plane,
 * and it ends up pointing at or away from the Sun as the Earth travels round its orbit. The
 * first rotation lifts the pole onto ecliptic north; the second applies the real obliquity,
 * fixed in inertial space so the sub-solar point drifts and the seasons follow.
 */
export function createEarthGlobe(options: EarthGlobeOptions): THREE.Group {
  const globe = new THREE.Mesh(new THREE.SphereGeometry(options.radius, 48, 32), options.material)
  globe.rotation.x = Math.PI / 2

  const axialTilt = new THREE.Group()
  axialTilt.rotation.x = options.obliquityDeg * DEGREES_TO_RADIANS
  axialTilt.add(globe)

  return axialTilt
}
