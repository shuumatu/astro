import * as THREE from 'three'

export interface ShadowVolumeOptions {
  /** How many facets the cone is drawn with. */
  segments?: number
  color: number
  opacity: number
  /** Colour of the ring drawn around the far end, which is what makes the boundary read. */
  rimColor: number
  rimOpacity: number
  blending?: THREE.Blending
  depthWrite?: boolean
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * A truncated cone whose end radii and length are rewritten in place every frame.
 *
 * The shadow cones change shape continuously as the Moon moves, and a fresh `CylinderGeometry`
 * sixty times a second would churn thousands of vertices and leak a GPU buffer each frame if any
 * were missed. One ring of vertices per end, updated in place, costs nothing, keeps the mesh count
 * fixed, and makes disposal a single call.
 *
 * The far end carries its own bright ring. Against a dark sky a translucent volume on its own has
 * no edge, and an umbra without a visible edge is not a diagram of anything.
 */
export class ShadowVolume {
  readonly group = new THREE.Group()
  private readonly positions: Float32Array
  private readonly rimPositions: Float32Array
  private readonly edgePositions: Float32Array
  private readonly geometry: THREE.BufferGeometry
  private readonly rimGeometry: THREE.BufferGeometry
  private readonly edgeGeometry: THREE.BufferGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly rimMaterial: THREE.LineBasicMaterial
  private readonly edgeMaterial: THREE.LineBasicMaterial
  private readonly edges: THREE.LineSegments
  private readonly baseOpacity: number
  private readonly baseRimOpacity: number
  private readonly segments: number

  constructor(options: ShadowVolumeOptions) {
    this.baseOpacity = options.opacity
    this.baseRimOpacity = options.rimOpacity
    this.segments = Math.max(3, options.segments ?? 72)
    const vertices = (this.segments + 1) * 2
    this.positions = new Float32Array(vertices * 3)
    this.rimPositions = new Float32Array((this.segments + 1) * 3)
    this.edgePositions = new Float32Array(8 * 2 * 3)

    const indices: number[] = []
    for (let step = 0; step < this.segments; step += 1) {
      const base = step * 2
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2)
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setIndex(indices)
    // The volume is a stylised shape rather than a lit surface, so it is drawn unlit and double
    // sided: the viewer is as likely to be inside the cone as outside it.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

    this.material = new THREE.MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: options.opacity,
      side: THREE.DoubleSide,
      depthWrite: options.depthWrite ?? false,
      blending: options.blending ?? THREE.NormalBlending,
    })

    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.frustumCulled = false

    this.rimGeometry = new THREE.BufferGeometry()
    this.rimGeometry.setAttribute('position', new THREE.BufferAttribute(this.rimPositions, 3))
    this.rimGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    this.rimMaterial = new THREE.LineBasicMaterial({
      color: options.rimColor,
      transparent: true,
      opacity: options.rimOpacity,
      depthWrite: false,
    })
    const rim = new THREE.LineLoop(this.rimGeometry, this.rimMaterial)
    rim.frustumCulled = false

    this.edgeGeometry = new THREE.BufferGeometry()
    this.edgeGeometry.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3))
    this.edgeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: options.rimColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial)
    this.edges.frustumCulled = false
    this.edges.visible = false

    this.group.add(mesh, rim, this.edges)
    this.update(new THREE.Vector3(), UP, 1, 1, 1)
  }

  /**
   * Places the volume with its base at `origin` and its axis along `axis`.
   *
   * `length` is measured along the axis from the base, so a cone that has closed is passed a far
   * radius of zero and reads as a point rather than as a cylinder.
   */
  update(
    origin: THREE.Vector3,
    axis: THREE.Vector3,
    baseRadius: number,
    farRadius: number,
    length: number,
  ): void {
    this.group.position.copy(origin)
    if (axis.lengthSq() > 0) {
      this.group.quaternion.setFromUnitVectors(UP, axis.clone().normalize())
    }

    const positions = this.positions
    const rimPositions = this.rimPositions
    for (let step = 0; step <= this.segments; step += 1) {
      const angle = (step / this.segments) * Math.PI * 2
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)
      const base = step * 6
      positions[base] = cosine * baseRadius
      positions[base + 1] = 0
      positions[base + 2] = sine * baseRadius
      positions[base + 3] = cosine * farRadius
      positions[base + 4] = length
      positions[base + 5] = sine * farRadius
      rimPositions[step * 3] = cosine * farRadius
      rimPositions[step * 3 + 1] = length
      rimPositions[step * 3 + 2] = sine * farRadius
    }

    for (let edge = 0; edge < 8; edge += 1) {
      const angle = (edge / 8) * Math.PI * 2
      const cosine = Math.cos(angle)
      const sine = Math.sin(angle)
      const offset = edge * 6
      this.edgePositions[offset] = cosine * baseRadius
      this.edgePositions[offset + 1] = 0
      this.edgePositions[offset + 2] = sine * baseRadius
      this.edgePositions[offset + 3] = cosine * farRadius
      this.edgePositions[offset + 4] = length
      this.edgePositions[offset + 5] = sine * farRadius
    }

    this.geometry.getAttribute('position').needsUpdate = true
    this.rimGeometry.getAttribute('position').needsUpdate = true
    this.edgeGeometry.getAttribute('position').needsUpdate = true
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  setOpacity(opacity: number): void {
    this.material.opacity = opacity
  }

  setEmphasis(strength: number): void {
    this.material.opacity = Math.min(0.72, this.baseOpacity * (1 + strength * 1.5))
    this.rimMaterial.opacity = Math.min(1, this.baseRimOpacity + strength * 0.28)
    this.edges.visible = strength > 0
    this.edgeMaterial.opacity = strength * 0.55
  }

  dispose(): void {
    this.geometry.dispose()
    this.rimGeometry.dispose()
    this.edgeGeometry.dispose()
    this.material.dispose()
    this.rimMaterial.dispose()
    this.edgeMaterial.dispose()
  }
}
