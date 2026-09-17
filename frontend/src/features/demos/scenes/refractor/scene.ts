import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createStage, type Stage } from '../../engine/stage'
import type { DemoScene, DemoSceneOptions, DemoSceneSettings } from '../../types'
import { isPartId, REFRACTOR_PARTS, type PartId } from './parts'
import { GeometryDiagnostics } from '../../engine/geometryDiagnostics'
import {
  isRefractorMetadata,
  OPTICAL_REVISION,
  opticalPoint,
  validateSourceAlignment,
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
  ['物镜折射与会聚', '大口径物镜组收集并会聚光线', '光从大口径物镜端进入，经过物镜组后向焦平面会聚。这里用等效薄透镜展示近轴光路，绿色箭头表示传播方向。'],
  ['焦平面成像', '焦平面上形成倒立实像', '同一方向的平行光会聚在焦平面的同一像点。开启离轴光束，可看到不同方向的星光在焦平面形成不同像点；环线标记焦平面。'],
  ['目镜放大与出射', '目镜把实像再次放大', '目镜位于物镜焦平面附近，把实像作为物体再次放大，射出接近平行的光束，进入观察者的眼睛。'],
] as const

/** Colour per teaching phase, shared by the lines and the legend. */
const STEP_COLORS = [0xffd975, 0x77dbc9, 0xffffff, 0xb1a0ff] as const

export class RefractorScene implements DemoScene {
  private readonly stage: Stage
  private readonly panel: HTMLDivElement
  private readonly parts = new Map<PartId, THREE.Mesh[]>()
  /** Ray-lesson overlays are kept out of the source-part index used by structure mode. */
  private readonly teachingMeshes: THREE.Mesh[] = []
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
  private readonly diagnostics: GeometryDiagnostics
  private model: THREE.Group | null = null
  private optics: THREE.Group | null = null
  private metadata: RefractorMetadata | null = null
  private validation: RayValidation | null = null
  private selected: PartId | null = null
  private mode: ViewMode = 'structure'
  private isolated = false
  private rayVisible = true
  private lessonStep = 3
  private showFields = false
  private showLabels = true
  private disposed = false
  private downPoint: { x: number; y: number } | null = null

  constructor(private readonly container: HTMLElement, private readonly options: DemoSceneOptions = {}) {
    this.stage = createStage(container, {
      cameraPosition: new THREE.Vector3(7, 3, 9), target: new THREE.Vector3(),
      minDistance: .3, maxDistance: 25, near: .01, background: 0x111923,
    })
    this.stage.scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.6))
    const key = new THREE.DirectionalLight(0xffffff, 3.8)
    key.position.set(5, 8, 6)
    const rim = new THREE.DirectionalLight(0xffffff, 1.4)
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
    this.diagnostics = new GeometryDiagnostics(container)
    const canvas = this.stage.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    this.stage.setFrameHandler((_delta, elapsed) => {
      if (this.selected) {
        const material = this.glowMaterials.get(this.selected)!
        // Smooth pulsing highlight; a viewer who asked for reduced motion gets a static one.
        material.emissiveIntensity = this.reducedMotion ? 1.1 : .55 + (1 + Math.sin(elapsed * 4)) * .7
      }
      this.updateLabels()
    })
    this.stage.start()
    void this.loadModel()
  }

  applySettings(settings: Partial<DemoSceneSettings>): void {
    if (settings.showLabels !== undefined) this.showLabels = settings.showLabels
    this.updateLabels()
  }
  setSuspended(suspended: boolean): void { if (suspended) this.stage.stop(); else this.stage.start() }

  resetView(): void {
    this.selected = null
    this.isolated = false
    this.lessonStep = 3
    this.showFields = false
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
    this.diagnostics.dispose()
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
      const gltf = await new GLTFLoader().loadAsync(`/models/telescope_refractor_classified.glb?v=${OPTICAL_REVISION}`)
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
        if (object.userData.opticalGeometry) {
          this.teachingMeshes.push(object)
        } else {
          const members = this.parts.get(id) ?? []
          members.push(object)
          this.parts.set(id, members)
        }
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
        const translucent = fade(['mount', 'tripod', 'counterweight', 'finderScope', 'fasteners'].includes(id) ? .035 : .10)
        this.baseMaterials.set(object, Array.isArray(object.material) ? base : base[0]!)
        this.fadedMaterials.set(object, Array.isArray(object.material) ? faded : faded[0]!)
        this.opticsMaterials.set(object, Array.isArray(object.material) ? translucent : translucent[0]!)
        object.material = this.baseMaterials.get(object)!
      })

      const frame = new THREE.Matrix4().fromArray(gltf.scene.userData.opticalFrame as number[])
      const metadata: unknown = gltf.scene.userData
      if (!isRefractorMetadata(metadata)) throw new Error('Missing calibrated refractor metadata')
      if (!validateSourceAlignment(this.model, metadata)) throw new Error('Optical frame does not match source glass')
      this.metadata = metadata
      this.validation = validateRays(metadata)

      const box = new THREE.Box3().setFromObject(this.model)
      const scale = 7 / box.getSize(new THREE.Vector3()).length()
      this.model.scale.setScalar(scale)
      this.model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale)
      this.stage.setHomeView(new THREE.Vector3(6, 3, 8), new THREE.Vector3())

      this.diagnostics.inspect(this.model)
      this.optics = this.buildOptics(frame, metadata)
      this.model.add(this.optics)
      this.stage.scene.add(this.model)
      this.stage.scene.add(this.diagnostics.group)

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
    } catch (error) {
      console.error('Failed to load reviewed refractor model', error)
      this.setStatus('模型加载失败，请检查分类 GLB 与光学标定数据；可刷新页面重试。')
    }
  }

  private buildOptics(frame: THREE.Matrix4, metadata: RefractorMetadata): THREE.Group {
    const group = new THREE.Group()
    group.name = 'TeachingOptics'
    const segments = raySegments(metadata, frame)
    for (const segment of segments) {
      const color = segment.field === 0 ? STEP_COLORS[segment.step]! : segment.field > 0 ? 0xffb36a : 0x79b5ff
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .95, depthTest: false })
      this.ownedMaterials.add(material)
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([segment.start, segment.end]), material)
      line.name = 'RaySegment'
      line.renderOrder = 20
      line.userData = { lessonStep: segment.step, field: segment.field }
      group.add(line)
      const length = segment.start.distanceTo(segment.end)
      if (segment.field === 0 && Math.abs(segment.apertureFrac) === 1 && length > .04) {
        const arrow = new THREE.ArrowHelper(segment.end.clone().sub(segment.start).normalize(),
          segment.start.clone().lerp(segment.end, .55), .018, color, .008, .004)
        arrow.name = 'PropagationArrow'
        arrow.userData = { lessonStep: segment.step, field: 0 }
        arrow.traverse(child => {
          const material = (child as THREE.Mesh).material as THREE.Material | undefined
          if (material) { material.depthTest = false; this.ownedMaterials.add(material) }
          child.renderOrder = 21
        })
        group.add(arrow)
      }
    }
    const focusPoint = new THREE.Mesh(
      new THREE.SphereGeometry(.002, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }))
    this.ownedMaterials.add(focusPoint.material as THREE.Material)
    focusPoint.position.copy(opticalPoint(frame, metadata.focusS, 0))
    focusPoint.name = 'FocalPoint'
    focusPoint.userData.lessonStep = 2
    group.add(focusPoint)

    // the focal plane, drawn as a thin ring so it reads as a surface rather than a line
    const axis = opticalAxis(frame)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.0095, .0102, 64),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .55, side: THREE.DoubleSide }))
    this.ownedMaterials.add(ring.material as THREE.Material)
    ring.position.copy(opticalPoint(frame, metadata.focusS, 0))
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
    ring.name = 'FocalPlane'
    ring.userData.lessonStep = 2
    group.add(ring)
    return group
  }

  private updateLabels(): void {
    const m = this.metadata
    if (!m || !this.model || this.mode !== 'optics' || !this.showLabels) {
      this.options.onLabels?.([])
      return
    }
    const frame = new THREE.Matrix4().fromArray(m.opticalFrame)
    this.model.updateMatrixWorld(true)
    const landmarks = [
      { id: 'objective', s: m.objectiveFrontS, h: .085, step: 0 },
      { id: 'focus', s: m.focusS, h: .045, step: 2 },
      { id: 'eyepiece', s: m.eyepieceFrontS, h: -.045, step: 0 },
    ]
    this.options.onLabels?.(landmarks.map(({ id, s, h, step }) => {
      const point = this.model!.localToWorld(opticalPoint(frame, s, h)).project(this.stage.camera)
      return { id: `refractor-${id}`, textKey: `demos.items.refractor.labels.${id}`,
        x: (point.x + 1) * this.container.clientWidth / 2,
        y: (1 - point.y) * this.container.clientHeight / 2,
        visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1
          && this.lessonStep >= step }
    }))
  }

  private updateAppearance(): void {
    for (const [id, meshes] of this.parts) {
      for (const mesh of meshes) {
        mesh.visible = !(this.mode === 'structure' && this.isolated && this.selected && id !== this.selected)
        if (this.mode === 'structure' && id === this.selected) {
          mesh.material = this.glowMaterials.get(id)!
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
    for (const mesh of this.teachingMeshes) {
      mesh.visible = this.mode === 'optics'
      mesh.material = this.baseMaterials.get(mesh)!
    }
    if (this.optics) {
      this.optics.visible = this.mode === 'optics'
      for (const child of this.optics.children) {
        if (typeof child.userData.lessonStep === 'number') {
          child.visible = this.rayVisible && child.userData.lessonStep <= this.lessonStep
            && (this.showFields || !child.userData.field)
        }
      }
    }
    this.panel.querySelector('[data-fields]')!.setAttribute('aria-pressed', String(this.showFields))
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
      this.focusObject(this.optics, 1.5)
      const distance = this.stage.camera.position.distanceTo(this.stage.controls.target)
      this.stage.camera.position.copy(this.stage.controls.target).addScaledVector(view, distance)
      this.stage.controls.update()
    }
    this.updateLabels()
    this.setStatus(mode === 'optics' ? REFRACTOR_STEPS[this.lessonStep]![2] : this.structureHint())
  }

  /** A direction perpendicular to the measured optical axis, or null before the model loads. */
  sideViewDirection(): THREE.Vector3 | null {
    if (!this.model) return null
    const frame = new THREE.Matrix4().fromArray(this.model.userData.opticalFrame as number[])
    const axis = opticalAxis(frame)
    const up = new THREE.Vector3(0, 1, 0)
    // Pick the sign deliberately: with the camera on `axis × up`, increasing optical
    // coordinate s projects from left to right.  That keeps the teaching order visible
    // in the canvas: objective → focus → eyepiece.  The opposite perpendicular direction
    // is geometrically valid but makes the labels and the propagation arrows look reversed.
    const view = new THREE.Vector3().crossVectors(axis, up)
    return view.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, 1) : view.normalize()
  }

  private structureHint(): string {
    const counts = new Map<PartId, number>()
    for (const [id, meshes] of this.parts) counts.set(id, meshes.length)
    const confirmed = REFRACTOR_PARTS.filter((part) => (counts.get(part.id) ?? 0) > 0).length
    return `点击模型或列表：选中部件呼吸发光，其他部件淡化。可单独显示以核对形状。`
      + `当前已按形状和装配位置确认 ${confirmed} 类零件。`
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
      <div class="telescope-model-note">直通观测端示意：光传播方向为 <strong>物镜 → 焦平面 → 目镜 → 观察者</strong>。默认侧视图中，物镜在左、目镜在右。使用等效薄透镜展示成像原理；侧向接口不参与本光路。</div>
      <div class="telescope-lesson" aria-label="光路讲解步骤">
        <div class="telescope-lesson-heading">镜筒内光路 · 外壳半透明显示</div>
        <div class="telescope-step-list"></div>
        <button type="button" class="telescope-ray-toggle" data-rays aria-pressed="true">隐藏光线</button>
        <button type="button" class="telescope-ray-toggle" data-fields aria-pressed="false">离轴光束</button>
        <button type="button" class="telescope-ray-toggle" data-focus-view>放大焦点与目镜</button>
        <button type="button" class="telescope-ray-toggle" data-optical-home>完整光路</button>
        <details class="telescope-ray-check"><summary>光路校验</summary><p data-ray-check role="status"></p></details>
      </div>
      <div class="telescope-parts-heading">机械结构 · 已确认类别</div>
      <div class="telescope-structure-actions">
        <button type="button" data-isolate disabled>只看选中部件</button>
        <button type="button" data-clear>取消选择</button>
      </div>
      <button type="button" class="telescope-ray-toggle" data-diagnostics aria-pressed="false">几何诊断</button>
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
      button.innerHTML = `<span class="telescope-dot" style="background:${new THREE.Color(part.highlight).getStyle()}"></span>${part.label}`
      button.addEventListener('click', () => this.selectPart(part.id))
      panel.querySelector('.telescope-part-list')!.appendChild(button)
    }
    panel.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
      button.addEventListener('click', () => this.setViewMode(button.dataset.view as ViewMode))
    })
    panel.querySelector('[data-fields]')!.addEventListener('click', () => {
      this.showFields = !this.showFields
      this.updateAppearance()
    })
    panel.querySelector('[data-optical-home]')!.addEventListener('click', () => this.setViewMode('optics'))
    panel.querySelector('[data-focus-view]')!.addEventListener('click', () => {
      if (!this.metadata || !this.model) return
      this.lessonStep = 3
      this.rayVisible = true
      this.updateAppearance()
      const frame = new THREE.Matrix4().fromArray(this.metadata.opticalFrame)
      const center = this.model.localToWorld(opticalPoint(frame,
        (this.metadata.focusS + this.metadata.eyepieceFrontS) / 2, 0))
      this.stage.controls.target.copy(center)
      this.stage.camera.position.copy(center).addScaledVector(this.sideViewDirection()!, .85)
      this.stage.controls.update()
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
    panel.querySelector('[data-diagnostics]')!.addEventListener('click', () => {
      this.diagnostics.toggle()
      panel.querySelector<HTMLButtonElement>('[data-diagnostics]')!
        .setAttribute('aria-pressed', String(this.diagnostics.isEnabled()))
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
    const target = this.panel.querySelector<HTMLElement>('[data-ray-check]')
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
    if ((this.mode !== 'structure' && !this.diagnostics.isEnabled()) || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    const rect = this.stage.renderer.domElement.getBoundingClientRect()
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.stage.camera)
    if (this.diagnostics.isEnabled()) {
      const diagnosticMeshes = [...this.parts.values()].flat().concat(this.teachingMeshes).filter(mesh => mesh.visible)
      const hit = this.raycaster.intersectObjects(diagnosticMeshes, false)[0]?.object
      this.diagnostics.selectMesh(hit instanceof THREE.Mesh ? hit : null)
      if (hit instanceof THREE.Mesh) {
        this.setStatus(`${hit.name} · ${String(hit.userData.partId ?? 'unclassified')} · 点击诊断列表可查看源图元信息。`)
      }
      return
    }
    const meshes = [...this.parts.values()].flat().filter((mesh) => mesh.visible)
    const id: unknown = this.raycaster.intersectObjects(meshes, false)[0]?.object.userData.partId
    this.selectPart(isPartId(id) ? id : null)
  }
}
