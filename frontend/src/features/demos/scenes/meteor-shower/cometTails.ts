import * as THREE from 'three'

/**
 * The two tails of a comet differ because they are pushed in different ways.
 *
 * - The ion tail is plasma dragged by the solar wind, so it points straight along the
 *   anti-solar direction, is narrow and bluish, and is a little longer.
 * - The dust tail is made of grains that keep following their own orbits, so they lag behind
 *   the nucleus and the tail curves towards the trailing direction. It is broader, warmer in
 *   colour and shorter.
 */

export interface CometTailOptions {
  ionLength: number
  ionBaseRadius: number
  ionTipRadius: number
  dustLength: number
  dustBaseRadius: number
  dustTipRadius: number
  dustBendDeg: number
}

interface TailSpec {
  geometry: THREE.BufferGeometry
  positions: Float32Array
  colors: Float32Array
  length: number
  baseRadius: number
  tipRadius: number
  bendRadians: number
  color: THREE.Color
  opacity: number
}

const SECTIONS = 26
const RADIAL = 10
const DEGREES_TO_RADIANS = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)

export class CometTails {
  readonly group = new THREE.Group()

  private readonly ionTail: TailSpec
  private readonly dustTail: TailSpec
  private readonly spine: THREE.Vector3[] = Array.from({ length: SECTIONS + 1 }, () => new THREE.Vector3())
  private readonly tangent = new THREE.Vector3()
  private readonly normalA = new THREE.Vector3()
  private readonly normalB = new THREE.Vector3()
  private readonly trailing = new THREE.Vector3()

  constructor(options: CometTailOptions) {
    this.ionTail = this.createTail(0x9ecdff, 0.5, options.ionLength, options.ionBaseRadius, options.ionTipRadius, 0)
    this.dustTail = this.createTail(
      0xffd9a0,
      0.7,
      options.dustLength,
      options.dustBaseRadius,
      options.dustTipRadius,
      options.dustBendDeg * DEGREES_TO_RADIANS,
    )
    this.group.add(new THREE.Mesh(this.ionTail.geometry, this.materialFor(this.ionTail)))
    this.group.add(new THREE.Mesh(this.dustTail.geometry, this.materialFor(this.dustTail)))
  }

  /**
   * @param antiSolar   unit vector from the Sun towards the comet
   * @param antiVelocity unit vector opposite the comet's motion
   * @param activity    how active the comet is; tails grow near perihelion
   */
  update(antiSolar: THREE.Vector3, antiVelocity: THREE.Vector3, activity: number): void {
    // The dust lags in the plane spanned by the two directions, so only the component of the
    // trailing direction perpendicular to the anti-solar axis bends the tail.
    this.trailing
      .copy(antiVelocity)
      .addScaledVector(antiSolar, -antiVelocity.dot(antiSolar))
    if (this.trailing.lengthSq() < 1e-8) {
      this.trailing.set(0, 1, 0).cross(antiSolar)
    }
    this.trailing.normalize()

    const scale = Math.min(1.5, Math.max(0.45, activity))
    this.writeTail(this.ionTail, antiSolar, this.trailing, scale)
    this.writeTail(this.dustTail, antiSolar, this.trailing, scale)
  }

  private createTail(
    color: number,
    opacity: number,
    length: number,
    baseRadius: number,
    tipRadius: number,
    bendRadians: number,
  ): TailSpec {
    const ringCount = SECTIONS + 1
    const vertexCount = ringCount * RADIAL
    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 4)
    const indices: number[] = []

    for (let section = 0; section < SECTIONS; section += 1) {
      for (let radial = 0; radial < RADIAL; radial += 1) {
        const next = (radial + 1) % RADIAL
        const a = section * RADIAL + radial
        const b = section * RADIAL + next
        const c = (section + 1) * RADIAL + next
        const d = (section + 1) * RADIAL + radial
        indices.push(a, b, c, a, c, d)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    geometry.setIndex(indices)
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), length * 1.2)

    return {
      geometry,
      positions,
      colors,
      length,
      baseRadius,
      tipRadius,
      bendRadians,
      color: new THREE.Color(color),
      opacity,
    }
  }

  private materialFor(spec: TailSpec): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }

  private writeTail(
    spec: TailSpec,
    antiSolar: THREE.Vector3,
    side: THREE.Vector3,
    scale: number,
  ): void {
    for (let section = 0; section <= SECTIONS; section += 1) {
      const t = section / SECTIONS
      const angle = spec.bendRadians * t * t
      this.spine[section]
        .copy(antiSolar)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(side, Math.sin(angle))
        .multiplyScalar(spec.length * scale * t)
    }

    const positions = spec.positions
    const colors = spec.colors

    for (let section = 0; section <= SECTIONS; section += 1) {
      const t = section / SECTIONS
      const center = this.spine[section]
      const before = this.spine[Math.max(0, section - 1)]
      const after = this.spine[Math.min(SECTIONS, section + 1)]

      this.tangent.copy(after).sub(before)
      if (this.tangent.lengthSq() < 1e-10) this.tangent.copy(antiSolar)
      this.tangent.normalize()
      this.normalA.crossVectors(this.tangent, UP)
      if (this.normalA.lengthSq() < 1e-8) this.normalA.set(1, 0, 0).cross(this.tangent)
      this.normalA.normalize()
      this.normalB.crossVectors(this.tangent, this.normalA).normalize()

      // Staying narrow for most of the length and flaring near the tip reads as a tail;
      // growing immediately just reads as a blob.
      const radius = spec.baseRadius + (spec.tipRadius - spec.baseRadius) * t ** 1.8
      const alpha = Math.min(1, Math.pow(1 - t, 0.9) * 1.1)

      for (let radial = 0; radial < RADIAL; radial += 1) {
        const phi = (radial / RADIAL) * Math.PI * 2
        const cosPhi = Math.cos(phi)
        const sinPhi = Math.sin(phi)
        const index = section * RADIAL + radial
        positions[index * 3] = center.x + (this.normalA.x * cosPhi + this.normalB.x * sinPhi) * radius
        positions[index * 3 + 1] = center.y + (this.normalA.y * cosPhi + this.normalB.y * sinPhi) * radius
        positions[index * 3 + 2] = center.z + (this.normalA.z * cosPhi + this.normalB.z * sinPhi) * radius
        colors[index * 4] = spec.color.r
        colors[index * 4 + 1] = spec.color.g
        colors[index * 4 + 2] = spec.color.b
        colors[index * 4 + 3] = alpha
      }
    }

    spec.geometry.getAttribute('position').needsUpdate = true
    spec.geometry.getAttribute('color').needsUpdate = true
  }
}
