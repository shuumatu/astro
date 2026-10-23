import * as THREE from 'three'
import { createStage } from '../../engine/stage'
import type { DemoScene, DemoSceneOptions } from '../../types'
import { INITIAL, LABELS, PARTICLE_COUNT, mapWind, reduceWind } from './model'
import { createAuroraCurtain, createBodies, glow } from './visuals'

const K = 'demos.items.solarWind.'
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

export function createScene(container: HTMLElement, options: DemoSceneOptions = {}): DemoScene {
  const stage = createStage(container, { cameraPosition: V(0, 0, 25), target: V(0, 0), maxPixelRatio: 1.5, background: 0x030913 })
  stage.controls.enabled = true
  // Direct manipulation also works when animation is stopped. No inertial motion
  // means reduced-motion mode can render only in response to input.
  stage.controls.enableDamping = false
  stage.controls.enablePan = false
  stage.controls.rotateSpeed = .65
  stage.controls.zoomSpeed = .8
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let state = { ...INITIAL, reducedMotion: motion?.matches ?? false }
  let disposed = false, suspended = false, showLabels = true, phase = 0, viewport = ''
  let reframing = false, viewDistance = 0, framedView = state.view
  const root = stage.scene
  root.add(new THREE.HemisphereLight(0xbfdfff, 0x172b4d, .85))
  const light = new THREE.DirectionalLight(0xffeddf, 2.5)
  light.position.set(-9, 3, 7); root.add(light)
  const bodies = createBodies(renderStill)
  root.add(bodies.group)

  function line(name: string, count: number, color: number, opacity: number) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
    object.name = name; object.frustumCulled = false; root.add(object)
    return object
  }
  const boundary = [-1, 1].map(sign => ({ sign, object: line(`boundary-${sign}`, 81, 0x61dce9, .7) }))
  const sideBoundary = [-1, 1].map(sign => ({ sign, object: line(`boundary-side-${sign}`, 81, 0x61dce9, .28) }))
  const field = Array.from({ length: 16 }, (_, i) => line(`field-${i}`, 81, 0x529bbd, .3))
  const envelope = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 64, 24), new THREE.MeshBasicMaterial({ color: 0x2c9ebc, transparent: true, opacity: .035, depthWrite: false, side: THREE.DoubleSide }))
  envelope.name = 'magnetosphere-envelope'; root.add(envelope)
  const paths = [-1, 1].map(sign => ({ sign, object: line(`precipitation-${sign}`, 41, 0xf0b3ff, .8) }))
  const imf = new THREE.ArrowHelper(V(0, 1), V(-5.1, -.7, .3), 1.4, 0xeaa3fa, .3, .17)
  root.add(imf)
  const reconnect = new THREE.Mesh(new THREE.TorusGeometry(.15, .016, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd196, transparent: true, depthWrite: false }))
  reconnect.name = 'reconnection'; root.add(reconnect)
  const reconnectionGlow = glow(0xffca8a, 1.6, .35); root.add(reconnectionGlow)
  const curtains = [-1, 1].map(createAuroraCurtain)
  curtains.forEach(curtain => root.add(curtain.object))
  const auroras = [-1, 1].flatMap(sign => [0, 1].map(layer => {
    const object = new THREE.Mesh(new THREE.TorusGeometry(1, 1, 8, 64), new THREE.MeshBasicMaterial({ color: layer ? 0xf78dc6 : 0x67ffd0, transparent: true, depthWrite: false }))
    object.name = `aurora-${sign}-${layer}`
    object.rotation.x = Math.PI / 2
    root.add(object)
    return { sign, layer, object }
  }))
  // One Points draw call for wind, one for precipitation; arrays are reused each frame.
  function particles(name: string, count: number, color: number, size: number) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const object = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: .8, depthWrite: false }))
    object.name = name; object.frustumCulled = false; root.add(object)
    return object
  }
  const wind = particles('solar-wind-particles', PARTICLE_COUNT, 0xffd17b, .065)
  const streakGeometry = new THREE.BufferGeometry()
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 6), 3))
  const colors = new Float32Array(PARTICLE_COUNT * 6)
  for (let i = 0; i < PARTICLE_COUNT; i++) colors.set([.95, .57, .2, .055, .045, .025], i * 6)
  streakGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending }))
  streaks.name = 'wind-streaks'; streaks.frustumCulled = false; root.add(streaks)
  const rain = particles('auroral-particles', 32, 0xf1c0ff, .065)
  let physical = mapWind(state.intensity, state.direction)
  const labelPoints: Record<typeof LABELS[number], THREE.Vector3> = {
    sun: V(-7.8, -2.7), wind: V(-5.4, 1.6), earth: V(-1.4, -1.5, 1.1), magnetopause: V(-3, 1.3),
    tail: V(5, 2.7), northAurora: V(.25, 1.5), southAurora: V(.25, -3.2), imf: V(-4.9, -2.9), reconnection: V(-3, -.8),
  }
  function pathAt(t: number, sign: number) {
    // Separate magnetospheric population: no direct Sun-to-oval particle conveyor.
    const foot = Math.sin(physical.ovalColatitude) * 1.04 / Math.sqrt(2)
    const height = Math.cos(physical.ovalColatitude) * 1.04
    return V(2.8 * (1 - t) + foot * t, sign * (.5 * (1 - t) + height * t + .62 * Math.sin(Math.PI * t)), .45 * (1 - t) + foot * t)
  }
  function updateGeometry() {
    physical = mapWind(state.intensity, state.direction)
    curtains.forEach(curtain => curtain.update(physical))
    const shell = envelope.geometry.getAttribute('position'), uv = envelope.geometry.getAttribute('uv')
    for (let i = 0; i < shell.count; i++) {
      const t = uv.getX(i), angle = uv.getY(i) * Math.PI * 2
      const radius = 2.1 * Math.sqrt(1 - Math.exp(-6 * t))
      shell.setXYZ(i, -physical.nose + (physical.tail + physical.nose) * t, Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    shell.needsUpdate = true; envelope.geometry.computeBoundingSphere()
    for (const { sign, object } of boundary) {
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const t = i / (positions.count - 1)
        positions.setXYZ(i, -physical.nose + (physical.tail + physical.nose) * t, sign * 2.1 * Math.sqrt(1 - Math.exp(-6 * t)), 0)
      }
      positions.needsUpdate = true
    }
    for (const { sign, object } of sideBoundary) {
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const t = i / (positions.count - 1)
        positions.setXYZ(i, -physical.nose + (physical.tail + physical.nose) * t, 0, sign * 2.1 * Math.sqrt(1 - Math.exp(-6 * t)))
      }
      positions.needsUpdate = true
    }
    field.forEach((object, index) => {
      const longitude = index / field.length * Math.PI * 2
      const a = object.geometry.getAttribute('position')
      // Dipole-like arcs join high-latitude footpoints through the equatorial
      // plane. Their night-side stretching is schematic, not a field solution.
      for (let i = 0; i < a.count; i++) {
        const angle = i / (a.count - 1) * Math.PI
        const stretch = Math.cos(longitude) < 0 ? physical.nose * .83 : physical.tail * .76
        const radius = .38 + Math.sin(angle) * (stretch - .38)
        a.setXYZ(i, Math.cos(longitude) * radius, Math.cos(angle) * (.92 + Math.sin(angle) * .95), Math.sin(longitude) * (.38 + 1.35 * Math.sin(angle)))
      }
      a.needsUpdate = true
    })
    for (const { sign, object } of paths) {
      const a = object.geometry.getAttribute('position')
      for (let i = 0; i < a.count; i++) { const p = pathAt(i / (a.count - 1), sign); a.setXYZ(i, p.x, p.y, p.z) }
      a.needsUpdate = true; object.material.opacity = .2 + physical.activity * .7
    }
    imf.setDirection(state.direction === 'sideways' ? V(1, 0) : V(0, state.direction === 'south' ? -1 : 1))
    reconnect.position.set(-physical.nose, 0, .2)
    reconnect.material.opacity = physical.coupling
    reconnectionGlow.position.copy(reconnect.position)
    reconnectionGlow.material.uniforms.opacity!.value = physical.coupling * .5
    for (const { sign, layer, object } of auroras) {
      // Update existing torus vertices to a thin oval; never allocate geometry on input.
      const a = object.geometry.getAttribute('position')
      const r = Math.sin(physical.ovalColatitude) * (1.04 + layer * .045)
      const thickness = physical.ovalWidth * (layer ? .18 : .35)
      for (let j = 0; j <= 8; j++) for (let i = 0; i <= 64; i++) {
        const u = i / 64 * Math.PI * 2, v = j / 8 * Math.PI * 2
        a.setXYZ(j * 65 + i, (r + thickness * Math.cos(v)) * Math.cos(u), (r + thickness * Math.cos(v)) * Math.sin(u), thickness * Math.sin(v))
      }
      a.needsUpdate = true; object.geometry.computeBoundingSphere()
      object.position.y = sign * Math.cos(physical.ovalColatitude) * (1.04 + layer * .1)
      object.material.opacity = .18 + physical.activity * .6
    }
    labelPoints.magnetopause.set(-physical.nose + .3, 1.4, 0)
    labelPoints.reconnection.x = -physical.nose
    labelPoints.southAurora.y = state.view === 'earth' ? -1.8 : -3.2
    const detail = state.view === 'earth'
    wind.material.opacity = detail ? .25 : .8
    streaks.material.opacity = detail ? .18 : .7
    field.forEach(object => { object.material.opacity = detail ? .16 : .3 })
    envelope.material.opacity = detail ? .014 : .035
    imf.visible = !detail
    updateParticles()
  }
  function updateParticles() {
    const positions = wind.geometry.getAttribute('position')
    const streakPositions = streakGeometry.getAttribute('position')
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = -6.1 + ((i * .61803398875 + phase * .12) % 1) * 14.5
      const lane = .12 + ((i * 37) % 101) / 100 * 2.5
      const azimuth = i * 2.39996322973
      const deflect = x > -physical.nose ? 2.25 * Math.sqrt(1 - Math.exp(-Math.max(0, x + physical.nose))) : 0
      const y = Math.cos(azimuth) * (lane + deflect)
      positions.setXYZ(i, x, y, Math.sin(azimuth) * (lane + deflect))
      const backX = x - .18 - physical.strength * .24
      const backDeflect = backX > -physical.nose ? 2.25 * Math.sqrt(1 - Math.exp(-Math.max(0, backX + physical.nose))) : 0
      streakPositions.setXYZ(i * 2, x, y, positions.getZ(i))
      streakPositions.setXYZ(i * 2 + 1, backX, Math.cos(azimuth) * (lane + backDeflect), Math.sin(azimuth) * (lane + backDeflect))
    }
    positions.needsUpdate = true
    wind.geometry.setDrawRange(0, Math.round(90 + 150 * physical.strength))
    streakPositions.needsUpdate = true
    streakGeometry.setDrawRange(0, wind.geometry.drawRange.count * 2)
    const drops = rain.geometry.getAttribute('position')
    for (let i = 0; i < drops.count; i++) {
      const p = pathAt((i / 16 + phase * .35) % 1, i < 16 ? 1 : -1)
      drops.setXYZ(i, p.x, p.y, p.z)
    }
    drops.needsUpdate = true; rain.material.opacity = .15 + physical.activity * .85
  }
  function frameView() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
    const key = `${w}:${h}:${state.view}`
    if (viewport === key) return false
    viewport = key
    const mobile = w <= 760
    const viewWidth = Math.max(100, mobile ? w - 24 : w - 392)
    const viewHeight = Math.max(80, mobile ? h * .43 : h - 180)
    const detail = state.view === 'earth'
    const distance = Math.max((detail ? 5.4 : 19) / (viewWidth / h), (detail ? 5.8 : 10) / (viewHeight / h)) / (2 * Math.tan(THREE.MathUtils.degToRad(45 / 2)))
    reframing = true
    const offset = stage.camera.position.clone().sub(stage.controls.target)
    const keepOrientation = viewDistance > 0 && framedView === state.view
    stage.controls.target.set(detail ? 0 : -.4, 0, 0)
    stage.controls.minDistance = detail ? 2.5 : 5
    stage.controls.maxDistance = Math.max(distance * 2.5, 45)
    if (keepOrientation) offset.multiplyScalar(distance / viewDistance)
    else offset.set(distance * .08, distance * .08, distance)
    stage.camera.position.copy(stage.controls.target).add(offset)
    stage.camera.lookAt(stage.controls.target)
    viewDistance = distance; framedView = state.view
    stage.camera.setViewOffset(w, h, mobile ? 0 : 185, mobile ? h * .11 : -25, w, h)
    stage.camera.updateMatrixWorld()
    stage.controls.update()
    reframing = false
    return true
  }
  function labels() {
    const compact = container.clientWidth <= 760
    options.onLabels?.(LABELS.map(id => {
      const anchor = labelPoints[id].clone()
      if (compact && state.view === 'earth') {
        if (id === 'northAurora') anchor.set(1.2, 1, 0)
        if (id === 'southAurora') anchor.set(1.2, -1.05, 0)
      }
      const p = anchor.project(stage.camera)
      const compactHidden = compact && ['magnetopause', 'reconnection', 'earth', 'wind', 'imf'].includes(id)
      const detailHidden = state.view === 'earth' && !['northAurora', 'southAurora'].includes(id)
      const y = (1 - p.y) * container.clientHeight / 2
      return { id, textKey: K + 'labels.' + id, x: (p.x + 1) * container.clientWidth / 2, y, visible: showLabels && !compactHidden && !detailHidden && Math.abs(p.x) < .96 && Math.abs(p.y) < .95 && p.z > -1 && p.z < 1 }
    }))
  }
  function renderStill() {
    if (disposed || suspended || state.contextLost) return
    frameView(); stage.camera.updateMatrixWorld(); bodies.faceCamera(stage.camera); reconnectionGlow.quaternion.copy(stage.camera.quaternion); labels(); stage.renderer.render(root, stage.camera)
  }
  function syncPlayback() {
    stage.controls.enabled = !suspended && !state.contextLost
    if (suspended || state.contextLost || state.reducedMotion || !state.playing) { stage.stop(); renderStill() }
    else stage.start()
  }
  function publish() { options.onState?.({ ...state }) }
  function preferenceChanged() {
    state = { ...state, reducedMotion: motion?.matches ?? false }; publish(); syncPlayback()
  }
  function lost(event: Event) {
    event.preventDefault(); state = { ...state, contextLost: true }; publish(); syncPlayback()
  }
  function restored() {
    state = { ...state, contextLost: false }; publish(); syncPlayback(); renderStill()
  }
  const canvas = stage.renderer.domElement
  canvas.tabIndex = 0
  function cameraChanged() { if (!reframing) renderStill() }
  stage.controls.addEventListener('change', cameraChanged)
  function moveCamera(action: string) {
    if (disposed || suspended || state.contextLost) return
    const offset = stage.camera.position.clone().sub(stage.controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    if (action === 'left') spherical.theta -= .18
    else if (action === 'right') spherical.theta += .18
    else if (action === 'up') spherical.phi -= .15
    else if (action === 'down') spherical.phi += .15
    else if (action === 'in') spherical.radius *= .85
    else if (action === 'out') spherical.radius /= .85
    else if (action === 'reset') { viewDistance = 0; viewport = ''; renderStill(); return }
    else return
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, Math.PI * .06, Math.PI * .94)
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, stage.controls.minDistance, stage.controls.maxDistance)
    stage.camera.position.copy(stage.controls.target).add(offset.setFromSpherical(spherical))
    stage.controls.update(); renderStill()
  }
  function cameraKey(event: KeyboardEvent) {
    const action = ({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'in','=':'in','-':'out',Home:'reset'} as Record<string,string>)[event.key]
    if (action) { event.preventDefault(); event.stopPropagation(); moveCamera(action) }
  }
  canvas.addEventListener('keydown', cameraKey)
  canvas.addEventListener('webglcontextlost', lost)
  canvas.addEventListener('webglcontextrestored', restored)
  motion?.addEventListener('change', preferenceChanged)
  const observer = new ResizeObserver(() => { viewport = ''; renderStill() })
  observer.observe(container)
  stage.setFrameHandler(delta => {
    if (disposed || suspended || state.contextLost) return
    if (state.playing && !state.reducedMotion) { phase += delta * (.35 + physical.strength); updateParticles(); curtains.forEach(curtain => curtain.animate(phase)) }
    frameView(); bodies.faceCamera(stage.camera); reconnectionGlow.quaternion.copy(stage.camera.quaternion)
  })
  updateGeometry(); publish(); renderStill(); syncPlayback()
  return {
    applySettings(settings) {
      if (disposed) return
      if (settings.showLabels !== undefined) showLabels = settings.showLabels
      if (settings.playing !== undefined && state.playing !== settings.playing) {
        state = { ...state, playing: settings.playing }; publish(); syncPlayback()
      }
      renderStill()
    },
    runCommand(command) {
      if (disposed) return
      if (command && typeof command === 'object' && 'type' in command && command.type === 'camera' && 'value' in command && typeof command.value === 'string') {
        moveCamera(command.value); return
      }
      const next = reduceWind(state, command)
      if (next === state) return
      const playbackChanged = next.playing !== state.playing
      state = next; updateGeometry(); publish(); renderStill(); syncPlayback()
      if (playbackChanged) options.onSettingsResolved?.({ playing: state.playing })
    },
    resetView() { moveCamera('reset') },
    setSuspended(value) { if (!disposed) { suspended = value; syncPlayback() } },
    dispose() {
      if (disposed) return
      disposed = true
      bodies.dispose()
      observer.disconnect(); motion?.removeEventListener('change', preferenceChanged)
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored)
      canvas.removeEventListener('keydown', cameraKey); stage.controls.removeEventListener('change', cameraChanged)
      stage.setFrameHandler(null); stage.dispose()
    },
  }
}
