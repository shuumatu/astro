import * as THREE from 'three'

export type DiagnosticMeshRecord = {
  mesh: THREE.Mesh
  name: string
  partId: string
  source: string
  center: THREE.Vector3
  size: THREE.Vector3
}

/** Reusable geometry inspection overlay for reviewed GLB scenes. */
export class GeometryDiagnostics {
  readonly group = new THREE.Group()
  readonly panel: HTMLDivElement
  private readonly helpers = new Map<THREE.Mesh, THREE.Object3D>()
  private readonly records: DiagnosticMeshRecord[] = []
  private selected: THREE.Mesh | null = null
  private enabled = false

  constructor(private readonly container: HTMLElement) {
    this.group.name = 'GeometryDiagnostics'
    this.group.visible = false
    this.panel = document.createElement('div')
    this.panel.className = 'geometry-diagnostics'
    this.panel.hidden = true
    this.panel.innerHTML = '<strong>几何诊断</strong><span class="geometry-diagnostics-hint">点击条目高亮节点</span><div class="geometry-diagnostics-list"></div>'
    container.appendChild(this.panel)
  }

  inspect(root: THREE.Object3D): void {
    this.clear()
    root.updateWorldMatrix(true, true)
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const partId = String(object.userData.partId ?? 'unclassified')
      const source = [object.userData.sourceNode, object.userData.sourceMesh, object.userData.sourcePrimitive, object.userData.sourceComponent]
        .map((value) => value === undefined ? '?' : String(value)).join('/')
      this.records.push({ mesh: object, name: object.name, partId, source, center, size })
      const helper = new THREE.Box3Helper(box, 0x53d6ff)
      helper.userData.diagnosticMesh = object
      this.helpers.set(object, helper)
      this.group.add(helper)
    })
    this.renderList()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.group.visible = enabled
    this.panel.hidden = !enabled
    if (!enabled) this.select(null)
  }

  toggle(): void { this.setEnabled(!this.enabled) }
  isEnabled(): boolean { return this.enabled }

  select(mesh: THREE.Mesh | null): void {
    if (this.selected) {
      const previous = this.helpers.get(this.selected)
      if (previous) ((previous as THREE.Box3Helper).material as THREE.LineBasicMaterial).color.set(0x53d6ff)
    }
    this.selected = mesh
    if (mesh) {
      const helper = this.helpers.get(mesh)
      if (helper) ((helper as THREE.Box3Helper).material as THREE.LineBasicMaterial).color.set(0xffc857)
    }
    this.panel.querySelectorAll<HTMLElement>('[data-diagnostic-name]').forEach((row) => {
      row.classList.toggle('selected', row.dataset.diagnosticName === mesh?.name)
      if (mesh && row.dataset.diagnosticName === mesh.name) row.scrollIntoView({ block: 'nearest' })
    })
  }

  selectMesh(mesh: THREE.Mesh | null): void { this.select(mesh) }

  dispose(): void {
    this.clear()
    this.panel.remove()
  }

  private renderList(): void {
    const list = this.panel.querySelector('.geometry-diagnostics-list')!
    list.textContent = ''
    for (const record of this.records) {
      const row = document.createElement('button')
      row.type = 'button'
      row.dataset.diagnosticName = record.name
      row.innerHTML = `<b>${record.name}</b><small>${record.partId} · src ${record.source}<br>center ${record.center.toArray().map((n) => n.toFixed(3)).join(', ')} · size ${record.size.toArray().map((n) => n.toFixed(3)).join(', ')}</small>`
      row.addEventListener('click', () => this.select(record.mesh))
      list.appendChild(row)
    }
  }

  private clear(): void {
    this.helpers.clear()
    this.records.length = 0
    while (this.group.children.length) this.group.remove(this.group.children[0]!)
    this.selected = null
  }
}
