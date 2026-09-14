import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createStage, type Stage } from '../../engine/stage'
import type { DemoScene, DemoSceneOptions, DemoSceneSettings } from '../../types'
import { TELESCOPE_PARTS, isPartId, type PartId } from './parts'
import { buildOptics, OPTICAL_VIEW_NORMAL } from './optics'

type ViewMode = 'structure' | 'optics'
const STEPS = [
  ['平行光入射', '星光由前端开口进入', '远处天体的光近似平行，从镜筒前端射向后端主镜。黄色箭头指示入射方向。'],
  ['主镜会聚', '凹面主镜反射光束', '主镜承担物镜的集光与成像作用。绿色光束经抛物面主镜反射后，向前方会聚。牛反没有另一个独立的物镜透镜。'],
  ['副镜折转', '平面副镜折向调焦座', '倾斜约 45° 的平面副镜截取会聚光束，将其折向镜筒侧面的调焦座。紫色光束延续会聚，不是平行出射。'],
  ['焦点与目镜', '焦平面成实像，目镜供观察', '白点表示轴上星点的理想焦点。焦平面形成实像，目镜用于放大观察；这里不模拟目镜内部镜片和出瞳。'],
] as const

export class TelescopeScene implements DemoScene {
  private readonly stage: Stage
  private readonly panel: HTMLDivElement
  private readonly parts = new Map<PartId, THREE.Mesh[]>()
  private readonly baseMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  private readonly fadedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  private readonly ownedMaterials = new Set<THREE.Material>()
  private readonly glowMaterials = new Map<PartId, THREE.MeshStandardMaterial>()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private model: THREE.Group | null = null
  private optics: THREE.Group | null = null
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
    for (const part of TELESCOPE_PARTS) {
      const material = new THREE.MeshStandardMaterial({
        color: part.color, emissive: part.color, emissiveIntensity: 1,
        metalness: .15, roughness: .4, side: THREE.DoubleSide,
      })
      this.glowMaterials.set(part.id, material)
      this.ownedMaterials.add(material)
    }
    this.panel = this.createControls(container)
    const canvas = this.stage.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    this.stage.setFrameHandler((_delta, elapsed) => {
      if (this.selected && this.mode === 'structure') {
        this.glowMaterials.get(this.selected)!.emissiveIntensity = this.reducedMotion
          ? 1 : .5 + (1 + Math.sin(elapsed * 4)) * .75
      }
    })
    this.stage.start()
    void this.loadModel()
  }

  applySettings(_settings: Partial<DemoSceneSettings>): void {}
  setSuspended(suspended: boolean): void { if (suspended) this.stage.stop(); else this.stage.start() }
  resetView(): void {
    this.selected = null
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
    // Include cached materials that are not currently attached to visible meshes.
    this.ownedMaterials.forEach((material) => material.dispose())
  }

  private async loadModel(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync('/models/telescope_newtonian_classified.glb?v=3')
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
      const palette = [0x344b66, 0xd3dbe3, 0x303947, 0x8493a5, 0xbecbd7, 0x52677e, 0x314761, 0x91a2b6]
      const displayBySource = new Map<THREE.Material, THREE.MeshStandardMaterial>()
      const displayMaterial = (source: THREE.Material): THREE.MeshStandardMaterial => {
        const existing = displayBySource.get(source)
        if (existing) return existing
        const material = new THREE.MeshStandardMaterial({
          color: palette[displayBySource.size % palette.length], metalness: .3, roughness: .45,
          side: THREE.DoubleSide,
        })
        displayBySource.set(source, material)
        this.ownedMaterials.add(material)
        return material
      }
      this.model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const id: unknown = object.userData.partId
        if (!isPartId(id)) throw new Error(`Missing reviewed partId: ${object.name}`)
        const members = this.parts.get(id) ?? []
        members.push(object)
        this.parts.set(id, members)
        const source = Array.isArray(object.material) ? object.material : [object.material]
        const base = source.map(displayMaterial)
        const faded = base.map((material) => {
          const clone = material.clone()
          clone.transparent = true
          clone.opacity = .10
          clone.depthWrite = false
          this.ownedMaterials.add(clone)
          return clone
        })
        this.baseMaterials.set(object, Array.isArray(object.material) ? base : base[0]!)
        this.fadedMaterials.set(object, Array.isArray(object.material) ? faded : faded[0]!)
        object.material = this.baseMaterials.get(object)!
      })
      displayBySource.forEach((_display, source) => source.dispose())
      const frame: unknown = this.model.userData.opticalFrame
      if (!Array.isArray(frame) || frame.length !== 16 || !frame.every(Number.isFinite)) {
        throw new Error('Missing calibrated optical frame')
      }
      const box = new THREE.Box3().setFromObject(this.model)
      const scale = 7 / box.getSize(new THREE.Vector3()).length()
      this.model.scale.setScalar(scale)
      this.model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale)
      this.optics = buildOptics(frame as number[])
      this.model.add(this.optics)
      this.stage.scene.add(this.model)
      this.options.onLabels?.([])
      this.options.onReadout?.({ key: 'demos.items.telescope.readout', params: { count: this.parts.size } })
      this.setViewMode(this.mode)
    } catch (error) {
      console.error('Failed to load reviewed telescope model', error)
      this.setStatus('模型加载失败，请检查分类 GLB 和光学坐标数据；可刷新页面重试。')
    }
  }

  private updateAppearance(): void {
    for (const [id, meshes] of this.parts) {
      for (const mesh of meshes) {
        mesh.visible = !(this.mode === 'structure' && this.isolated && this.selected && id !== this.selected)
        if (this.mode === 'optics' && id === 'internalDisk') mesh.visible = false
        mesh.material = this.mode === 'structure' && id === this.selected
          ? this.glowMaterials.get(id)!
          : this.mode === 'optics' || this.selected ? this.fadedMaterials.get(mesh)! : this.baseMaterials.get(mesh)!
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
      this.focusObject(this.optics, 1.6)
      const distance = this.stage.camera.position.distanceTo(this.stage.controls.target)
      const direction = OPTICAL_VIEW_NORMAL.clone().transformDirection(this.optics.matrixWorld)
      this.stage.camera.position.copy(this.stage.controls.target).addScaledVector(direction, distance)
      this.stage.controls.update()
    }
    this.setStatus(mode === 'optics' ? STEPS[this.lessonStep]![2] : '点击模型或列表：选中部件呼吸发光，其他部件淡化。可单独显示以核对形状。')
  }

  private selectPart(id: PartId | null): void {
    this.selected = id
    if (!id) this.isolated = false
    this.updateAppearance()
    const definition = TELESCOPE_PARTS.find((part) => part.id === id)
    this.setStatus(definition ? `${definition.label}：${definition.description}` : '点击模型或列表查看部件。')
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
      <div class="telescope-controls-title">牛顿式反射望远镜</div>
      <div class="telescope-controls-subtitle">按几何拆分分类 · 保持装配位置</div>
      <div class="telescope-view-switch" role="group" aria-label="演示视图">
        <button type="button" data-view="structure" class="active" aria-pressed="true">机械结构</button>
        <button type="button" data-view="optics" aria-pressed="false">光路原理</button>
      </div>
      <div class="telescope-model-note">主镜承担物镜作用。金色主镜与蓝色副镜为理想教学补建，非厂家参数。原模型筒内带孔圆盘会遮光，光路模式暂隐藏该件；不代表原机械模型已经光学验证。</div>
      <div class="telescope-lesson" aria-label="光路讲解步骤">
        <div class="telescope-lesson-heading">镜筒内光路 · 外壳透明显示</div>
        <div class="telescope-step-list"></div>
        <button type="button" class="telescope-ray-toggle" data-rays aria-pressed="true">隐藏光线</button>
      </div>
      <div class="telescope-parts-heading">机械结构</div>
      <div class="telescope-structure-actions">
        <button type="button" data-isolate disabled>只看选中部件</button>
        <button type="button" data-clear>取消选择</button>
      </div>
      <div class="telescope-part-list"></div>
      <p class="telescope-status" role="status">正在载入分类模型…</p>`
    STEPS.forEach(([title, detail], index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'telescope-step'
      button.dataset.step = String(index)
      button.innerHTML = `<span class="telescope-step-number">${index + 1}</span><span><strong>${title}</strong><small>${detail}</small></span>`
      button.addEventListener('click', () => {
        this.lessonStep = index
        this.rayVisible = true
        this.updateAppearance()
        this.setStatus(STEPS[index]![2])
      })
      panel.querySelector('.telescope-step-list')!.appendChild(button)
    })
    for (const part of TELESCOPE_PARTS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.part = part.id
      button.disabled = true
      button.innerHTML = `<span class="telescope-dot" style="background:${new THREE.Color(part.color).getStyle()}"></span>${part.label}`
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
  private readonly onPointerDown = (event: PointerEvent): void => {
    this.downPoint = { x: event.clientX, y: event.clientY }
  }
  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.downPoint
    this.downPoint = null
    if (this.mode !== 'structure' || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    const rect = this.stage.renderer.domElement.getBoundingClientRect()
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.stage.camera)
    const meshes = [...this.parts.values()].flat().filter((mesh) => mesh.visible)
    const id: unknown = this.raycaster.intersectObjects(meshes, false)[0]?.object.userData.partId
    this.selectPart(isPartId(id) ? id : null)
  }
}
