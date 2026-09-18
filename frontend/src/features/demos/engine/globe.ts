import * as THREE from 'three'

/**
 * Textured globes for the demos, and the rotation that points one at the sky.
 *
 * A globe carrying an equirectangular map comes with a body-fixed frame whether or not the caller
 * wants one: the map's top row is the north pole, which three.js puts on the sphere's own +Y, and
 * the map's centre column is the prime meridian, which lands on the sphere's own +X. Two demos need
 * that frame in different ways - the meteor shower only needs the pole to be right, the eclipse demo
 * needs the prime meridian too because it marks places on the surface - so both the bare sphere and
 * the orientation are exported here.
 */

const DEGREES_TO_RADIANS = Math.PI / 180

export interface GlobeOptions {
  radius: number
  material: THREE.Material
}

/**
 * A bare textured sphere in its body-fixed frame: local +Y is the map's north pole, local +X is its
 * prime meridian. A caller that cares where those point should set the quaternion with
 * {@link globeQuaternion}; one that does not can leave it alone.
 */
export function createGlobe(options: GlobeOptions): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(options.radius, 48, 32), options.material)
}

/**
 * The rotation that puts a globe's pole and prime meridian where they really are.
 *
 * Built from the two directions rather than from a pair of Euler angles, and that is the whole
 * point. The Earth's obliquity was applied here as a positive rotation about x for a long time, and
 * the sign of a tilt about x is not self-evidently the sign of anything: it looked right and put the
 * pole at the December solstice instead of the June one, inverting the seasons. "The pole points
 * here" is a statement that can be checked against the ephemeris, so it is the one this takes.
 *
 * The directions must be perpendicular, which they are for any body: a prime meridian lies in the
 * equator.
 */
export function globeQuaternion(pole: THREE.Vector3, primeMeridian: THREE.Vector3): THREE.Quaternion {
  const yAxis = pole.clone().normalize()
  const xAxis = primeMeridian.clone()
  // Re-orthogonalise, so a caller passing a direction that is only nearly equatorial still gets a
  // proper rotation rather than a shear.
  xAxis.addScaledVector(yAxis, -xAxis.dot(yAxis))
  if (xAxis.lengthSq() < 1e-12) {
    xAxis.copy(new THREE.Vector3(1, 0, 0).addScaledVector(yAxis, -yAxis.x))
  }
  xAxis.normalize()
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
}

export interface EarthGlobeOptions {
  radius: number
  /** Axial tilt away from the ecliptic normal, in degrees. */
  obliquityDeg: number
  material: THREE.Material
}

/**
 * The Earth as the meteor shower draws it: the pole at the real obliquity, the spin not modelled.
 *
 * Two rotations are needed and it is easy to get both wrong. The photograph-style texture puts the
 * north pole at the sphere's own +Y, but a scene authored in ecliptic coordinates has +Z as ecliptic
 * north - so an unrotated globe has its axis lying *inside* the orbital plane, and it ends up
 * pointing at or away from the Sun as the Earth travels round its orbit. The first rotation lifts
 * the pole onto ecliptic north.
 *
 * The second applies the real obliquity, and its sign is the part that is easy to get wrong. In the
 * ecliptic frame the Earth's north pole is at `(0, +sin e, +cos e)`: the tilt is towards ecliptic
 * longitude 90 degrees, the June solstice. So the rotation about x has to be *negative*.
 * `globe.test.ts` pins the direction rather than the angle, because the angle is the same either
 * way.
 *
 * A scene that needs the sub-solar point, or a place on the surface, has to model the spin as well,
 * and should use {@link createGlobe} with {@link globeQuaternion} instead of this.
 */
export function createEarthGlobe(options: EarthGlobeOptions): THREE.Group {
  const globe = createGlobe({ radius: options.radius, material: options.material })
  globe.rotation.x = Math.PI / 2

  const axialTilt = new THREE.Group()
  axialTilt.rotation.x = -options.obliquityDeg * DEGREES_TO_RADIANS
  axialTilt.add(globe)

  return axialTilt
}
