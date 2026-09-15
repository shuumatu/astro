import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createStage, type Stage } from '../../engine/stage'
import type { DemoScene, DemoSceneOptions, DemoSceneSettings } from '../../types'
import { isPartId, REFRACTOR_PARTS, type PartId } from './parts'
import {
  exaggerateLensSag,
  isRefractorMetadata,
  lensSagScale,
  opticalAxis,
  raySegments,
  validateRays,
  type RayValidation,
  type RefractorMetadata,
} from './optics'

type ViewMode = 'structure' | 'optics'

/** The four teaching phases. The third entry is the line shown in the status area. */
export const REFRACTOR_STEPS = [
  ['平行光入射', '远处天体的光进入物镜', '星光来自远处，可以看作平行光。黄色光线从前方平行进入镜筒，高度都在物镜有效口径之内。'],
  ['物镜折射与会聚', '物镜前后面各折射一次', '凸透镜把平行光折向光轴：光线先在物镜前表面折射，再在后表面折射，两条边界都画在图上。光束后来回会聚。'],
  ['焦平面成像', '焦平面上形成倒立实像', '各条光线在物镜焦平面附近交于一点，形成倒立的实像。白色焦点标记光轴上的像点，虚线标出焦平面。'],
  ['目镜放大与出射', '目镜把实像再次放大', '目镜位于物镜焦平面附近，把实像作为物体再次放大，射出接近平行的光束，进入观察者的眼睛。'],
] as const

/** Colour per teaching phase, shared by the lines and the legend. */
const STEP_COLORS = [0xffd975, 0x77dbc9, 0xffffff, 0xb1a0ff] as const

export class RefractorScene implements DemoScene {
  private readonly stage: Stage
  private readonly panel: HTMLDivElement
  private readonly parts = new Map<PartId, THREE.Mesh[]>()
  private readonly baseMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  private readonly fadedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  /** The translucent set used in optics mode, so the mechanical shell never hides the light path. */
  private readonly opticsMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  private readonly ownedMaterials = new Set<THREE.Material>()
  /** One reusable emissive material per category: clicking never allocates. */
  private readonly glowMaterials = new Map<PartId, THREE.MeshStandardMaterial>()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private model: THREE.Group | null = null
  private optics: THREE.Group | null = null
  private metadata: RefractorMetadata | null = null
  private validation: RayValidation | null = null
  private selected: PartId | null = null
  private mode: ViewMode = 'structure'
  private isolated = false
  private rayVisible = true
  private lessonStep = 0
  private disposed = false
  private downPoint: { x: number; y: number } | null = null

  constructor(container: HTMLElement, private readonly options: DemoSceneOptions = {}) {
    this.stage = createStage(container, {
      cameraPosition: new THREE.Vector3(7, 3, 9), target: new THREE.Vector3(),
      minDistance: .3, maxDistance: 25, near: .01, background: 0x111923,
    })
    this.stage.scene.add(new THREE.HemisphereLight(0xdcefff, 0x42546b, 2.2))
    const key = new THREE.DirectionalLight(0xffffff, 3.2)
    key.position.set(5, 8, 6)
    const rim = new THREE.DirectionalLight(0x8ed6ff, 1.8)
    rim.position.set(-6, 3, -4)
    this.stage.scene.add(key, rim)
    this.stage.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.stage.renderer.toneMappingExposure = 1.25
    for (const part of REFRACTOR_PARTS) {
      // One reusable highlight material per category. It is always applied whole (never blended
      // with the model's own colours), so a single material per category is enough and clicking
      // never allocates.
      const material = new THREE.MeshStandardMaterial({
        color: part.highlight, emissive: part.highlight, emissiveIntensity: .8,
        metalness: .1, roughness: .35, side: THREE.DoubleSide,
      })
      this.glowMaterials.set(part.id, material)
      this.ownedMaterials.add(material)
    }
    this.panel = this.createControls(container)
    const canvas = this.stage.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    this.stage.setFrameHandler((_delta, elapsed) => {
      if (this.selected) {
        const material = this.glowMaterials.get(this.selected)!
        // Smooth pulsing highlight; a viewer who asked for reduced motion gets a static one.
        material.emissiveIntensity = this.reducedMotion ? 1.1 : .55 + (1 + Math.sin(elapsed * 4)) * .7
      }
    })
    this.stage.start()
    void this.loadModel()
  }

  applySettings(_settings: Partial<DemoSceneSettings>): void {}
  setSuspended(suspended: boolean): void { if (suspended) this.stage.stop(); else this.stage.start() }

  resetView(): void {
    this.selected = null
    this.isolated = false
    this.lessonStep = 0
    this.rayVisible = true
    this.setViewMode('structure')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const canvas = this.stage.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    this.panel.remove()
    this.stage.dispose()
    this.ownedMaterials.forEach((material) => material.dispose())
  }

  /** Measured facts about the model and the traced light path, for tests and for the panel. */
  get calibration(): { metadata: RefractorMetadata | null; validation: RayValidation | null } {
    return { metadata: this.metadata, validation: this.validation }
  }

  /** The meshes of one category, for tests and for anything that needs to inspect them. */
  visibleMeshes(id: PartId): THREE.Mesh[] {
    return this.parts.get(id) ?? []
  }

  private async loadModel(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/models/telescope_refractor_classified.glb?v=1')
      if (this.disposed) {
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        })
        return
      }
      this.model = gltf.scene
      this.model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const id: unknown = object.userData.partId
        if (!isPartId(id)) throw new Error(`Missing reviewed partId: ${object.name}`)
        const members = this.parts.get(id) ?? []
        members.push(object)
        this.parts.set(id, members)
        // The appearance comes from the classified GLB, which the builder colours to match the
        // reference photograph. The scene deliberately does not repaint it: overriding the colour
        // here is exactly what would stop the model looking like the photograph.
        const sources = Array.isArray(object.material) ? object.material : [object.material]
        const base = sources.map((source) => {
          const material = (source as THREE.MeshStandardMaterial).clone()
          material.side = THREE.DoubleSide
          this.ownedMaterials.add(material)
          return material
        })
        const fade = (opacity: number) => base.map((material) => {
          const clone = material.clone()
          clone.transparent = true
          clone.opacity = opacity
          clone.depthWrite = false
          this.ownedMaterials.add(clone)
          return clone
        })
        const faded = fade(.10)
        const translucent = fade(.16)
        this.baseMaterials.set(object, Array.isArray(object.material) ? base : base[0]!)
        this.fadedMaterials.set(object, Array.isArray(object.material) ? faded : faded[0]!)
        this.opticsMaterials.set(object, Array.isArray(object.material) ? translucent : translucent[0]!)
        object.material = this.baseMaterials.get(object)!
      })

      const frame = new THREE.Matrix4().fromArray(gltf.scene.userData.opticalFrame as number[])
      const metadata: unknown = gltf.scene.userData
      if (!isRefractorMetadata(metadata)) throw new Error('Missing calibrated refractor metadata')
      this.metadata = metadata
      this.validation = validateRays(metadata)

      const box = new THREE.Box3().setFromObject(this.model)
      const scale = 7 / box.getSize(new THREE.Vector3()).length()
      this.model.scale.setScalar(scale)
      this.model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale)

      this.deepenLensCurvature(frame, metadata)
      this.optics = this.buildOptics(frame, metadata)
      this.model.add(this.optics)
      this.stage.scene.add(this.model)

      this.options.onLabels?.([])
      this.options.onReadout?.({
        key: 'demos.items.refractor.readout',
        params: {
          parts: this.parts.size,
          aperture: (metadata.objectiveAperture * 1000).toFixed(1),
          focal: (metadata.focalLength * 1000).toFixed(0),
          magnification: metadata.magnification.toFixed(1),
        },
      })
      this.setViewMode(this.mode)
      this.setRayCheck()
    } catch (error) {      console.error('Failed to load reviewed refractor model', error)
      this.setStatus('模型加载失败，请检查分类 GLB 与光学标定数据；可刷新页面重试。')
    }
  }

  /** Deepen the drawn lens sag only; the solved surfaces and every ray stay untouched. */
  private deepenLensCurvature(frame: THREE.Matrix4, metadata: RefractorMetadata): void {
    const scale = lensSagScale(metadata)
    for (const [vertexS, id] of [[metadata.objectiveFrontS, 'objectiveLens'],
                                 [metadata.eyepieceFrontS, 'eyepieceLensGroup']] as const) {
      for (const mesh of this.parts.get(id) ?? []) exaggerateLensSag(mesh, vertexS, frame, scale)
    }
  }

  private buildOptics(frame: THREE.Matrix4, metadata: RefractorMetadata): THREE.Group {
    const group = new THREE.Group()
    group.name = 'TeachingOptics'
    const segments = raySegments(metadata, frame)
    const byStep = new Map<number, THREE.Vector3[][]>()
    for (const segment of segments) {
      const list = byStep.get(segment.step) ?? []
      list.push([segment.start, segment.end])
      byStep.set(segment.step, list)
    }
    for (const [step, lines] of byStep) {
      const geometry = new THREE.BufferGeometry().setFromPoints(lines.flat())
      const material = new THREE.LineBasicMaterial({
        color: STEP_COLORS[step] ?? 0xffffff, transparent: true, opacity: .92,
      })
      this.ownedMaterials.add(material)
      const line = new THREE.LineSegments(geometry, material)
      line.userData.lessonStep = step
      group.add(line)
    }
    const focusPoint = new THREE.Mesh(
      new THREE.SphereGeometry(.006, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }))
    this.ownedMaterials.add(focusPoint.material as THREE.Material)
    focusPoint.position.copy(this.opticalPoint(frame, metadata.focusS, 0))
    focusPoint.name = 'FocalPoint'
    focusPoint.userData.lessonStep = 2
    group.add(focusPoint)

    // the focal plane, drawn as a thin ring so it reads as a surface rather than a line
    const axis = opticalAxis(frame)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.020, .0215, 64),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .55, side: THREE.DoubleSide }))
    this.ownedMaterials.add(ring.material as THREE.Material)
    ring.position.copy(this.opticalPoint(frame, metadata.focusS, 0))
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
    ring.name = 'FocalPlane'
    ring.userData.lessonStep = 2
    group.add(ring)
    return group
  }

  private opticalPoint(frame: THREE.Matrix4, s: number, height: number): THREE.Vector3 {
    const e = frame.elements
    return new THREE.Vector3(
      e[0]! * s + e[4]! * height + e[12]!,
      e[1]! * s + e[5]! * height + e[13]!,
      e[2]! * s + e[6]! * height + e[14]!,
    )
  }

  private updateAppearance(): void {
    for (const [id, meshes] of this.parts) {
      for (const mesh of meshes) {
        const lenses = Boolean(mesh.userData.opticalGeometry)
        mesh.visible = !(this.mode === 'structure' && this.isolated && this.selected && id !== this.selected)
        if (this.mode === 'structure' && id === this.selected) {
          mesh.material = this.glowMaterials.get(id)!
        } else if (lenses) {
          // The teaching optics keep their readable material in both modes: they are the subject of
          // the light-path view, so they are never faded out of it.
          mesh.material = this.baseMaterials.get(mesh)!
        } else if (this.mode === 'optics') {
          // The mechanical structure goes translucent rather than disappearing, so the rays stay in
          // context and a tube never blocks the whole path.
          mesh.material = this.opticsMaterials.get(mesh)!
        } else if (this.selected) {
          mesh.material = this.fadedMaterials.get(mesh)!
        } else {
          mesh.material = this.baseMaterials.get(mesh)!
        }
      }
    }
    if (this.optics) {
      this.optics.visible = this.mode === 'optics'
      for (const child of this.optics.children) {
        if (typeof child.userData.lessonStep === 'number') {
          child.visible = this.rayVisible && child.userData.lessonStep <= this.lessonStep
        }
      }
    }
    this.panel.dataset.mode = this.mode
    this.panel.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
      const active = button.dataset.view === this.mode
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
    this.panel.querySelectorAll<HTMLButtonElement>('[data-part]').forEach((button) => {
      const active = button.dataset.part === this.selected
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
      button.disabled = !this.parts.has(button.dataset.part as PartId)
    })
    this.panel.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => {
      const active = Number(button.dataset.step) === this.lessonStep
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
    const isolate = this.panel.querySelector<HTMLButtonElement>('[data-isolate]')!
    isolate.disabled = !this.selected
    isolate.textContent = this.isolated ? '显示完整模型' : '只看选中部件'
    isolate.setAttribute('aria-pressed', String(this.isolated))
    const rays = this.panel.querySelector<HTMLButtonElement>('[data-rays]')!
    rays.textContent = this.rayVisible ? '隐藏光线' : '显示光线'
    rays.setAttribute('aria-pressed', String(this.rayVisible))
  }

  private setViewMode(mode: ViewMode): void {
    this.mode = mode
    this.isolated = false
    this.updateAppearance()
    this.stage.resetView()
    if (mode === 'optics' && this.optics) {
      // Look along a direction perpendicular to the optical axis, so the whole path is readable.
      const view = this.sideViewDirection() ?? new THREE.Vector3(0, 0, 1)
      this.focusObject(this.optics, 2.4)
      const distance = this.stage.camera.position.distanceTo(this.stage.controls.target)
      this.stage.camera.position.copy(this.stage.controls.target).addScaledVector(view, distance)
      this.stage.controls.update()
    }
    this.setStatus(mode === 'optics' ? REFRACTOR_STEPS[this.lessonStep]![2] : this.structureHint())
  }

  /** A direction perpendicular to the measured optical axis, or null before the model loads. */
  sideViewDirection(): THREE.Vector3 | null {
    if (!this.model) return null
    const frame = new THREE.Matrix4().fromArray(this.model.userData.opticalFrame as number[])
    const axis = opticalAxis(frame)
    const up = new THREE.Vector3(0, 1, 0)
    const view = new THREE.Vector3().crossVectors(axis, up)
    return view.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, 1) : view.normalize()
  }

  private structureHint(): string {
    const counts = new Map<PartId, number>()
    for (const [id, meshes] of this.parts) counts.set(id, meshes.length)
    const confirmed = REFRACTOR_PARTS.filter((part) => part.kind === 'mechanical'
      && (counts.get(part.id) ?? 0) > 0).length
    return `点击模型或列表：选中部件呼吸发光，其他部件淡化。可单独显示以核对形状。`
      + `当前已确认机械类别 ${confirmed} 类，教学补建光学件 2 类。`
  }

  private selectPart(id: PartId | null): void {
    this.selected = id
    if (!id) this.isolated = false
    this.updateAppearance()
    const definition = REFRACTOR_PARTS.find((part) => part.id === id)
    this.setStatus(definition ? `${definition.label}：${definition.description}` : this.structureHint())
    if (this.isolated) this.focusSelection()
  }

  private focusObject(object: THREE.Object3D, distanceFactor: number): void {
    object.updateWorldMatrix(true, true)
    this.focusBox(new THREE.Box3().setFromObject(object), distanceFactor)
  }

  private focusBox(box: THREE.Box3, distanceFactor = 1.8): void {
    if (box.isEmpty()) return
    const target = box.getCenter(new THREE.Vector3())
    const direction = this.stage.camera.position.clone().sub(this.stage.controls.target).normalize()
    const distance = Math.max(.6, box.getSize(new THREE.Vector3()).length() * distanceFactor)
    this.stage.controls.target.copy(target)
    this.stage.camera.position.copy(target).addScaledVector(direction, distance)
    this.stage.controls.update()
  }

  private focusSelection(): void {
    this.model?.updateMatrixWorld(true)
    const box = new THREE.Box3()
    if (this.selected) this.parts.get(this.selected)?.forEach((mesh) => box.expandByObject(mesh))
    this.focusBox(box)
  }

  private createControls(container: HTMLElement): HTMLDivElement {
    const panel = document.createElement('div')
    panel.className = 'telescope-controls'
    panel.dataset.mode = 'structure'
    panel.innerHTML = `
      <div class="telescope-controls-title">折射式望远镜</div>
      <div class="telescope-controls-subtitle">按几何拆分分类 · 保持装配位置</div>
      <div class="telescope-view-switch" role="group" aria-label="演示视图">
        <button type="button" data-view="structure" class="active" aria-pressed="true">机械结构</button>
        <button type="button" data-view="optics" aria-pressed="false">光路原理</button>
      </div>
      <div class="telescope-model-note">教学近似：物镜与目镜为本项目补建的理想球面双胶合镜片，焦距由本模型的镜室到后端筒长度反推，镜片曲率按可视需要画深；不代表任何厂家镜片处方。原始模型内没有任何镜片几何。</div>
      <div class="telescope-lesson" aria-label="光路讲解步骤">
        <div class="telescope-lesson-heading">镜筒内光路 · 外壳半透明显示</div>
        <div class="telescope-step-list"></div>
        <button type="button" class="telescope-ray-toggle" data-rays aria-pressed="true">隐藏光线</button>
        <p class="telescope-ray-check" role="status"></p>
      </div>
      <div class="telescope-parts-heading">机械结构 · 已确认类别</div>
      <div class="telescope-structure-actions">
        <button type="button" data-isolate disabled>只看选中部件</button>
        <button type="button" data-clear>取消选择</button>
      </div>
      <div class="telescope-part-list"></div>
      <p class="telescope-status" role="status">正在载入分类模型…</p>`
    REFRACTOR_STEPS.forEach(([title, detail], index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'telescope-step'
      button.dataset.step = String(index)
      button.innerHTML = `<span class="telescope-step-number">${index + 1}</span>`
        + `<span><strong>${title}</strong><small>${detail}</small></span>`
      button.addEventListener('click', () => {
        this.lessonStep = index
        this.rayVisible = true
        this.updateAppearance()
        this.setStatus(REFRACTOR_STEPS[index]![2])
      })
      panel.querySelector('.telescope-step-list')!.appendChild(button)
    })
    for (const part of REFRACTOR_PARTS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.part = part.id
      button.dataset.kind = part.kind
      button.disabled = true
      const tag = part.kind === 'teaching' ? '（教学补建）'
        : part.kind === 'unresolved' ? '（未确认）' : ''
      button.innerHTML = `<span class="telescope-dot" style="background:${new THREE.Color(part.highlight).getStyle()}"></span>${part.label}${tag}`
      button.addEventListener('click', () => this.selectPart(part.id))
      panel.querySelector('.telescope-part-list')!.appendChild(button)
    }
    panel.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
      button.addEventListener('click', () => this.setViewMode(button.dataset.view as ViewMode))
    })
    panel.querySelector('[data-rays]')!.addEventListener('click', () => {
      this.rayVisible = !this.rayVisible
      this.updateAppearance()
    })
    panel.querySelector('[data-isolate]')!.addEventListener('click', () => {
      this.isolated = !this.isolated
      this.updateAppearance()
      if (this.isolated) this.focusSelection(); else this.stage.resetView()
    })
    panel.querySelector('[data-clear]')!.addEventListener('click', () => {
      this.selectPart(null)
      this.stage.resetView()
    })
    container.appendChild(panel)
    return panel
  }

  private setStatus(message: string): void {
    this.panel.querySelector<HTMLElement>('.telescope-status')!.textContent = message
  }

  /** Show the numeric checks the interface relies on, so the claims are auditable. */
  private setRayCheck(): void {
    const v = this.validation
    const m = this.metadata
    const target = this.panel.querySelector<HTMLElement>('.telescope-ray-check')
    if (!target || !v || !m) return
    target.textContent = `数值自检：入射高度上限 ${(v.entryRadiusMax * 1000).toFixed(2)} mm `
      + `（口径 ${(m.objectiveAperture * 1000).toFixed(1)} mm，${v.entryWithinAperture ? '在口径内' : '超出口径'}）；`
      + `轴上焦点残差 ${(v.focusResidualMax * 1e6).toFixed(1)} µm；`
      + `出射光平行度 ${(v.exitBundleSpreadRad * 1e3).toFixed(3)} mrad；`
      + `筒壁最小余量 ${(v.wallClearanceMin * 1000).toFixed(2)} mm。`
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.downPoint = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.downPoint
    this.downPoint = null
    if (this.mode !== 'structure' || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    const rect = this.stage.renderer.domElement.getBoundingClientRect()
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.stage.camera)
    const meshes = [...this.parts.values()].flat().filter((mesh) => mesh.visible)
    const id: unknown = this.raycaster.intersectObjects(meshes, false)[0]?.object.userData.partId
    this.selectPart(isPartId(id) ? id : null)
  }
}
