import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { createStage } from '../../engine/stage'
import type { DemoScene, DemoSceneOptions } from '../../types'
import { celestialVector, createTeachingEarth, EARTH_RADIUS, earthOrientation, observerFrame } from './earth'
import { CHAPTERS, DEG, EXAMPLES, INITIAL, angles, exampleState, fromHorizontal, horizontal, local, spherical, eclipticToEquatorial, equatorialToEcliptic, equatorialToGalactic, galacticToEquatorial, precessionPole, wrap, type AstronomyState, type Example, type Vec } from './model'

const COLOR = { horizon: 0x64dec8, equator: 0x78acff, longitude: 0xffce70, latitude: 0xff8cad, galactic: 0xd5a1ff, white: 0xe6efff }
const HOME = new THREE.Vector3(8, 7, 11)
const ORIGIN = new THREE.Vector3()
type ViewportRect = { left: number; top: number; right: number; bottom: number }
const intersects = (a: ViewportRect, b: ViewportRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** Find space for a circular diagram without assuming translated panels have a fixed height. */
export function diagramViewport(width: number, height: number, overlays: ViewportRect[]): ViewportRect {
  const bounds = { left: 16, top: 16, right: Math.max(17, width - 16), bottom: Math.max(17, height - 16) }
  const blocked = overlays.map(r => ({ left: r.left - 14, top: r.top - 14, right: r.right + 14, bottom: r.bottom + 14 }))
    .filter(r => intersects(r, bounds))
  let best = bounds, score = -Infinity
  for (const left of [bounds.left, ...blocked.map(r => r.right)]) {
    for (const right of [bounds.right, ...blocked.map(r => r.left)]) {
      if (left < bounds.left || right > bounds.right || right - left < 100) continue
      for (const top of [bounds.top, ...blocked.map(r => r.bottom)]) {
        for (const bottom of [bounds.bottom, ...blocked.map(r => r.top)]) {
          if (top < bounds.top || bottom > bounds.bottom || bottom - top < 100) continue
          const candidate = { left, top, right, bottom }
          if (blocked.some(r => intersects(candidate, r))) continue
          const w = right - left, h = bottom - top
          // Prioritize the sphere's diameter, then breathing room for its labels.
          const value = Math.min(w, h) + Math.sqrt(w * h) * .05
          if (value > score) { best = candidate; score = value }
        }
      }
    }
  }
  return best
}

export function createScene(container: HTMLElement, options: DemoSceneOptions = {}): DemoScene {
  const stage = createStage(container, { cameraPosition: HOME, minDistance: 9, maxDistance: 25, background: 0x060f1e })
  let state = { ...INITIAL }, showLabels = true, dirty = true, publishElapsed = 0, viewportKey = '', layoutElapsed = 1
  let overlayRects: ViewportRect[] = [], diagramRect: ViewportRect | null = null
  const labelSizes = new Map<string, { width: number; height: number }>()
  const group = new THREE.Group()
  stage.scene.add(group)
  const earth = createTeachingEarth()
  group.add(earth.root)
  stage.scene.add(new THREE.HemisphereLight(0xe1f1ff, 0x294861, 2.3))
  const light = new THREE.DirectionalLight(0xffffff, 2.2)
  light.position.set(5, 8, 6); stage.scene.add(light)
  const lines: Line2[] = []
  const dots: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  let lineIndex = 0, dotIndex = 0
  const surfaceMaterial = (color: number, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(3, 48, 32), surfaceMaterial(0x6b9ec7, .025))
  const plane = new THREE.Mesh(new THREE.CircleGeometry(3, 128), surfaceMaterial(COLOR.horizon, .075))
  sphere.renderOrder = -2; plane.renderOrder = -1
  group.add(sphere, plane)
  const focusHalo = new THREE.Mesh(new THREE.RingGeometry(.135, .155, 40), surfaceMaterial(COLOR.longitude, .8))
  focusHalo.name = 'astronomy-focus-halo'; focusHalo.renderOrder = 6; focusHalo.visible = false
  group.add(focusHalo)
  const labels: { id: string; point: THREE.Vector3 }[] = []
  // Three.js uses a right-handed frame: east = +X, up = +Y, north = -Z.
  // Keeping north at +Z would mirror the sky and reverse a top-view compass.
  const world = (v: Vec) => {
    if (state.perspective === 'earth') return celestialVector(v).multiplyScalar(3)
    const [east, up, north] = local(v, state.latitude, state.lst)
    return new THREE.Vector3(east, up, -north).multiplyScalar(3)
  }
  const sample = (fn: (angle: number) => THREE.Vector3, end = 360) => Array.from({ length: 181 }, (_, i) => fn(i / 180 * end))

  function line(points: THREE.Vector3[], color: number, width = 2.5, opacity = 1, dashed = false) {
    if (points.length < 2 || points.every(p => p.distanceToSquared(points[0]!) < 1e-12)) return
    let object = lines[lineIndex++]
    if (!object) {
      // Transparent strokes must not write depth: coincident circles otherwise cut holes
      // in later strokes. Screen-space widths stay legible regardless of zoom or device.
      object = new Line2(new LineGeometry(), new LineMaterial({ transparent: true, depthWrite: false, depthTest: false }))
      object.frustumCulled = false
      lines.push(object); group.add(object)
    }
    const start = object.geometry.getAttribute('instanceStart'), end = object.geometry.getAttribute('instanceEnd')
    if (start?.count === points.length - 1) {
      points.slice(0, -1).forEach((p, i) => {
        start.setXYZ(i, p.x, p.y, p.z)
        const next = points[i + 1]!
        end.setXYZ(i, next.x, next.y, next.z)
      })
      start.needsUpdate = true; end.needsUpdate = true
    } else {
      object.geometry.dispose(); object.geometry = new LineGeometry()
      object.geometry.setPositions(points.flatMap(p => p.toArray()))
    }
    object.material.color.setHex(color); object.material.linewidth = width; object.material.opacity = opacity
    object.material.dashed = dashed
    if (dashed) { object.material.dashSize = .13; object.material.gapSize = .09; object.computeLineDistances() }
    object.material.resolution.set(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight))
    object.renderOrder = width >= 4 ? 4 : 2; object.visible = true
  }
  function curve(fn: (angle: number) => THREE.Vector3, color: number, width = 2.5, opacity = 1, end = 360) { line(sample(fn, end), color, width, opacity) }
  function label(id: string, point: THREE.Vector3) { labels.push({ id, point }) }
  function focus(point: THREE.Vector3) { focusHalo.position.copy(point); focusHalo.visible = true }
  function dot(point: THREE.Vector3, color: number, size = .06) {
    let mesh = dots[dotIndex++]
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ depthTest: false }))
      mesh.renderOrder = 5; dots.push(mesh); group.add(mesh)
    }
    mesh.position.copy(point); mesh.scale.setScalar(size); mesh.material.color.setHex(color); mesh.visible = true
  }
  function arrow(points: THREE.Vector3[], color: number) {
    line(points, color, 4)
    const tip = points.at(-1)!, previous = points.at(-4) ?? points[0]!
    if (tip.distanceToSquared(previous) < 1e-10) return
    const tangent = tip.clone().sub(previous).normalize()
    const side = tip.clone().normalize().cross(tangent).normalize().multiplyScalar(.08)
    const back = tip.clone().addScaledVector(tangent, -.18)
    line([back.clone().add(side), tip, back.clone().sub(side)], color, 3)
  }
  function framePlane(normal: THREE.Vector3, color: number) {
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.normalize())
    plane.material.color.setHex(color)
  }
  function clear() {
    lines.forEach(object => { object.visible = false }); dots.forEach(object => { object.visible = false })
    focusHalo.visible = false
    lineIndex = 0; dotIndex = 0; labels.length = 0
  }
  function rebuildEarth() {
    const { chapter, step } = state
    earth.root.quaternion.copy(earthOrientation(state))
    const pole = celestialVector(chapter === 'precession' ? precessionPole(state.years) : [0, 0, 1])
    const { position: observer, up, north, east } = observerFrame(state.latitude, state.lst)
    const isLocal = chapter === 'horizon' || chapter === 'daily'
    const northEnd = pole.clone().multiplyScalar(3), southEnd = northEnd.clone().negate()
    line([southEnd, northEnd], COLOR.equator, 2.5)
    label('pole', northEnd.clone().multiplyScalar(1.08))
    label('southPole', southEnd.clone().multiplyScalar(1.08))
    label('earthModel', new THREE.Vector3(-1.5, -.9, .2))
    plane.position.set(0, 0, 0)
    plane.scale.setScalar(1)
    plane.visible = false
    if (isLocal) {
      // The horizon here is genuinely tangent at the surface site, never through Earth's
      // center. Angles are directions at O; the globe and outer sphere are not to scale.
      dot(observer, COLOR.longitude, .07)
      focus(observer)
      label('surfaceObserver', observer.clone().addScaledVector(north, -.3))
      line([observer, up.clone().multiplyScalar(2.8)], COLOR.horizon, 2)
      label('zenith', up.clone().multiplyScalar(2.9))
      if (step >= 1) {
        plane.visible = true
        plane.position.copy(observer); plane.scale.setScalar(.34)
        framePlane(up.clone(), COLOR.horizon)
        curve(a => observer.clone().addScaledVector(north, Math.cos(a * DEG) * 1.02).addScaledVector(east, Math.sin(a * DEG) * 1.02), COLOR.horizon, 2.5)
        label('tangentHorizon', observer.clone().addScaledVector(east, -1.2))
      }
      if (chapter === 'horizon' && step >= 2) {
        const visiblePole = new THREE.Vector3(0, state.latitude < 0 ? -1 : 1, 0)
        const groundDirection = north.clone().multiplyScalar(state.latitude < 0 ? -1 : 1)
        line([observer, observer.clone().addScaledVector(visiblePole, 1.9)], COLOR.equator, 2.5)
        line([observer, observer.clone().addScaledVector(groundDirection, .95)], COLOR.horizon, 1.5)
        curve(a => observer.clone().addScaledVector(groundDirection, Math.cos(a * DEG) * .72).addScaledVector(up, Math.sin(a * DEG) * .72), COLOR.latitude, 4, 1, Math.abs(state.latitude))
        label('poleAltitude', observer.clone().addScaledVector(groundDirection, 1.35).addScaledVector(up, .5))
      }
    }
    if (chapter !== 'horizon' && (step >= 1 || chapter === 'precession')) {
      curve(a => world(spherical(a, 0)), COLOR.equator, 2.5)
      label('equator', world(spherical(145, 0)))
      if (!isLocal) { plane.visible = true; framePlane(new THREE.Vector3(0, 1, 0), COLOR.equator) }
      // A pair of radial guides makes the extension from surface equator unambiguous.
      if (chapter === 'equatorial') {
        for (const a of [15, 195]) line([celestialVector(spherical(a, 0)).multiplyScalar(EARTH_RADIUS), world(spherical(a, 0))], COLOR.equator, 1.3, .6)
      }
    }
    if (chapter === 'equatorial' && step === 0) label('surfaceEquator', new THREE.Vector3(1.15, 0, 0))
    if (chapter === 'daily') {
      // In the fixed celestial frame, the stars remain still while Earth and O rotate.
      if (step >= 1) {
        curve(a => world(spherical(a, state.dec)), COLOR.longitude, 2, .75)
        label('declinationCircle', world(spherical(160, state.dec)))
      }
      dot(world(spherical(state.ra * 15, state.dec)), COLOR.longitude, .09)
      focus(world(spherical(state.ra * 15, state.dec)))
      label('fixedStar', world(spherical(state.ra * 15, state.dec)))
    }
    if (chapter === 'ecliptic' && step >= 1 || chapter === 'precession') {
      curve(a => world(eclipticToEquatorial(spherical(a, 0))), COLOR.longitude, 2.5)
      label('ecliptic', world(eclipticToEquatorial(spherical(65, 0))))
    }
    if (chapter === 'galactic' && step >= 1) {
      curve(a => world(galacticToEquatorial(spherical(a, 0))), COLOR.galactic, 2.5)
      label('galactic', world(galacticToEquatorial(spherical(60, 0))))
    }
    if (chapter === 'precession') {
      const eclipticPole = world(eclipticToEquatorial([0, 0, 1]))
      line([ORIGIN, eclipticPole], COLOR.longitude, 2)
      label('eclipticPole', eclipticPole.clone().multiplyScalar(1.12))
      if (step >= 1) curve(a => world(precessionPole(a / 360 * 26000)), COLOR.horizon, 3)
      if (step >= 2) {
        const u = new THREE.Vector3(1, 0, 0).cross(pole).normalize(), v = pole.clone().cross(u)
        curve(a => u.clone().multiplyScalar(Math.cos(a * DEG) * 3).addScaledVector(v, Math.sin(a * DEG) * 3), COLOR.white, 3)
        label('movingEquator', u.clone().multiplyScalar(3.1))
      }
    } else if (!isLocal && step >= 2) {
      const convert = chapter === 'ecliptic' ? eclipticToEquatorial : chapter === 'galactic' ? galacticToEquatorial : (v: Vec) => v
      const eq = spherical(state.ra * 15, state.dec)
      const coords = chapter === 'ecliptic' ? angles(equatorialToEcliptic(eq)) : chapter === 'galactic' ? angles(equatorialToGalactic(eq)) : { lon: state.ra * 15, lat: state.dec }
      const point = (a: number, b: number) => world(convert(spherical(a, b)))
      arrow(sample(a => point(a, 0).multiplyScalar(.78), coords.lon), COLOR.longitude)
      arrow(sample(a => point(coords.lon, a), coords.lat), COLOR.latitude)
      dot(point(0, 0), COLOR.longitude)
      label(chapter === 'galactic' ? 'center' : 'equinox', point(0, 0))
      dot(world(eq), COLOR.longitude, .1); focus(world(eq)); label('target', world(eq).multiplyScalar(1.05))
    }
    if (state.grid) {
      for (const dec of [-60, -30, 30, 60]) curve(a => world(spherical(a, dec)), 0x8198b8, 1, .2)
    }
    dirty = false
  }
  function rebuild() {
    clear()
    earth.root.visible = state.perspective === 'earth'
    if (state.perspective === 'earth') { rebuildEarth(); return }
    plane.visible = true; plane.position.set(0, 0, 0); plane.scale.setScalar(1)
    const { chapter, step } = state
    const isLocal = chapter === 'horizon' || chapter === 'daily'
    framePlane(isLocal ? new THREE.Vector3(0, 1, 0) : world([0, 0, 1]), isLocal ? COLOR.horizon : COLOR.equator)
    if (state.grid) {
      for (const dec of [-60, -30, 30, 60]) curve(a => world(spherical(a, dec)), 0x8198b8, 1, .2)
      for (const ra of [0, 60, 120]) curve(a => world([Math.cos(a * DEG) * Math.cos(ra * DEG), Math.cos(a * DEG) * Math.sin(ra * DEG), Math.sin(a * DEG)]), 0x8198b8, 1, .2)
    }
    dot(ORIGIN, COLOR.white, .1)
    label(chapter === 'precession' ? 'earth' : 'observer', new THREE.Vector3(0, -.32, 0))
    if (isLocal) {
      curve(a => new THREE.Vector3(Math.sin(a * DEG) * 3, 0, -Math.cos(a * DEG) * 3), COLOR.horizon)
      for (const [id, v] of [['north', [0, 0, -3.35]], ['east', [3.35, 0, 0]], ['south', [0, 0, 3.35]], ['west', [-3.35, 0, 0]]] as [string, Vec][]) label(id, new THREE.Vector3(...v))
      label('horizon', new THREE.Vector3(-2.1, 0, -2.1))
    }
    if (chapter !== 'horizon' && (chapter !== 'daily' || step > 0)) {
      curve(a => world(spherical(a, 0)), COLOR.equator)
      label('equator', world(spherical(150, 0)))
    }
    if (chapter === 'equatorial' || chapter === 'daily') {
      line([world([0, 0, -1]), world([0, 0, 1])], COLOR.equator, 1.5, .65)
      label('pole', world([0, 0, 1]).multiplyScalar(1.08))
      if (state.latitude < 0) label('southPole', world([0, 0, -1]).multiplyScalar(1.08))
    }
    if (chapter === 'precession') {
      const pole = precessionPole(state.years)
      curve(a => world(eclipticToEquatorial(spherical(a, 0))), COLOR.longitude, 2)
      label('ecliptic', world(eclipticToEquatorial(spherical(60, 0))))
      const eclipticPole = world(eclipticToEquatorial([0, 0, 1]))
      line([ORIGIN, eclipticPole], COLOR.longitude, 2)
      label('eclipticPole', eclipticPole.multiplyScalar(1.12))
      line([world(pole).negate(), world(pole)], COLOR.white, 3)
      dot(world(pole), COLOR.white, .085); label('pole', world(pole).multiplyScalar(1.05))
      if (step >= 1) curve(a => world(precessionPole(a / 360 * 26000)), COLOR.horizon, 3)
      if (step >= 2) {
        const n = new THREE.Vector3(...pole), u = new THREE.Vector3(1, 0, 0).cross(n).normalize(), v = n.clone().cross(u)
        curve(a => world(u.clone().multiplyScalar(Math.cos(a * DEG)).addScaledVector(v, Math.sin(a * DEG)).toArray() as Vec), COLOR.white, 3)
        label('movingEquator', world(u.toArray() as Vec))
      }
      dirty = false; return
    }
    const target = world(spherical(state.ra * 15, state.dec))
    dot(target, COLOR.longitude, .1); focus(target); label('target', target.clone().multiplyScalar(1.05))
    line([ORIGIN, target], COLOR.white, 1.8, .8)
    if (chapter === 'horizon') {
      line([ORIGIN, new THREE.Vector3(0, 3, 0)], COLOR.horizon, 1.5, .55)
      label('zenith', new THREE.Vector3(0, 3.25, 0))
      const h = horizontal(state.ra, state.dec, state.latitude, state.lst)
      if (h.azimuth !== null && step >= 1) {
        const az = h.azimuth * DEG
        const foot = new THREE.Vector3(Math.sin(az) * 3, 0, -Math.cos(az) * 3)
        dot(foot, COLOR.longitude); label('foot', foot.clone().multiplyScalar(1.1))
        line([ORIGIN, new THREE.Vector3(0, 0, -3)], COLOR.longitude, 1.5, .65)
        line([ORIGIN, foot], COLOR.longitude, 1.5, .65)
        arrow(sample(a => new THREE.Vector3(Math.sin(a * DEG) * 1.55, 0, -Math.cos(a * DEG) * 1.55), h.azimuth), COLOR.longitude)
        label('azimuthArc', new THREE.Vector3(Math.sin(az / 2) * 1.9, 0, -Math.cos(az / 2) * 1.9))
        if (step >= 2) {
          arrow(sample(a => new THREE.Vector3(Math.sin(az) * Math.cos(a * DEG), Math.sin(a * DEG), -Math.cos(az) * Math.cos(a * DEG)).multiplyScalar(3), h.altitude), COLOR.latitude)
          label('altitudeArc', new THREE.Vector3(Math.sin(az) * Math.cos(h.altitude * DEG / 2), Math.sin(h.altitude * DEG / 2), -Math.cos(az) * Math.cos(h.altitude * DEG / 2)).multiplyScalar(3.2))
        }
      }
    } else if (chapter === 'daily') {
      if (step >= 1) {
        // The dashed half is below the local horizon. Split exactly at each crossing so
        // rising/setting remains legible even for grazing and circumpolar examples.
        const points = sample(a => world(spherical(a, state.dec)))
        let segment = [points[0]!], above = points[0]!.y >= 0
        for (const point of points.slice(1)) {
          const previous = segment.at(-1)!
          if ((point.y >= 0) !== above) {
            const crossing = previous.clone().lerp(point, -previous.y / (point.y - previous.y))
            segment.push(crossing)
            line(segment, COLOR.longitude, above ? 3 : 2, above ? 1 : .4, !above)
            segment = [crossing]; above = !above
          }
          segment.push(point)
        }
        line(segment, COLOR.longitude, above ? 3 : 2, above ? 1 : .4, !above)
        label('dailyPath', world(spherical(state.ra * 15 + 100, state.dec)))
      }
    } else {
      const secondary = chapter === 'ecliptic' || chapter === 'galactic'
      const convert = chapter === 'ecliptic' ? eclipticToEquatorial : chapter === 'galactic' ? galacticToEquatorial : (v: Vec) => v
      const coords = chapter === 'ecliptic' ? angles(equatorialToEcliptic(spherical(state.ra * 15, state.dec))) : chapter === 'galactic' ? angles(equatorialToGalactic(spherical(state.ra * 15, state.dec))) : { lon: state.ra * 15, lat: state.dec }
      const point = (a: number, b: number) => world(convert(spherical(a, b)))
      if (secondary && step >= 1) {
        curve(a => point(a, 0), chapter === 'ecliptic' ? COLOR.longitude : COLOR.galactic, 3)
        label(chapter, point(60, 0))
      }
      if (!secondary || step >= 1) {
        dot(point(0, 0), COLOR.longitude)
        label(chapter === 'galactic' ? 'center' : 'equinox', point(0, 0).multiplyScalar(1.05))
      }
      if (step >= (secondary ? 2 : 1)) {
        arrow(sample(a => point(a, 0).multiplyScalar(.72), coords.lon), COLOR.longitude)
        line([ORIGIN, point(0, 0)], COLOR.longitude, 1.5, .5)
        line([ORIGIN, point(coords.lon, 0)], COLOR.longitude, 1.5, .5)
        dot(point(coords.lon, 0), COLOR.latitude)
        label(chapter === 'equatorial' ? 'raArc' : 'longitudeArc', point(coords.lon / 2, 0).multiplyScalar(.8))
      }
      if (step >= 2) {
        arrow(sample(a => point(coords.lon, a), coords.lat), COLOR.latitude)
        if (Math.abs(coords.lat) > 2) label(chapter === 'equatorial' ? 'decArc' : 'latitudeArc', point(coords.lon, coords.lat / 2).multiplyScalar(1.08))
      }
    }
    dirty = false
  }
  const publish = () => options.onState?.({ ...state })
  function measureLayout(width: number, height: number) {
    const origin = container.getBoundingClientRect?.() ?? { left: 0, top: 0 }
    const panels = Array.from(container.querySelectorAll?.<HTMLElement>('.astronomy-panel, .astronomy-hud, .lesson-caption') ?? [])
    // The shared toolbar is a sibling of the canvas stage. Measure its actual cards,
    // not the transparent flex row between them, so open sky remains usable for labels.
    const toolbars = Array.from((container.parentElement ?? container).querySelectorAll?.<HTMLElement>('.overlay.top') ?? [])
    const toolbarCards = toolbars.flatMap(element => {
      if (element.classList.contains('overlay-hidden')) return []
      const cards = Array.from(element.querySelectorAll<HTMLElement>('.info-card, .display-stack'))
      return cards.length ? cards : [element]
    })
    overlayRects = [...panels, ...toolbarCards].flatMap(element => {
      const r = element.getBoundingClientRect()
      return r.width && r.height ? [{ left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top }] : []
    })
    const mobileExpanded = width <= 900 && panels.some(element => element.matches('.astronomy-panel') && element.getBoundingClientRect().height > height * .45)
    // Opening a phone's control drawer should not zoom the sky away behind it.
    if (!mobileExpanded || !diagramRect || !viewportKey.startsWith(`${width}:${height}:`)) diagramRect = diagramViewport(width, height, overlayRects)
    for (const element of Array.from(container.querySelectorAll?.<HTMLElement>('[data-demo-label]') ?? [])) {
      if (element.dataset.demoLabel) labelSizes.set(element.dataset.demoLabel, { width: element.offsetWidth, height: element.offsetHeight })
    }
  }
  function resetView(view = 'oblique') {
    const azimuth = (horizontal(state.ra, state.dec, state.latitude, state.lst).azimuth ?? 0) * DEG
    const site = observerFrame(state.latitude, state.lst)
    const side = state.perspective === 'earth' ? site.east.clone().multiplyScalar(15) : state.chapter === 'horizon' ? new THREE.Vector3(Math.cos(azimuth) * 15, 0, Math.sin(azimuth) * 15) : new THREE.Vector3(12, 1.5, .01)
    const home = state.perspective === 'earth' ? state.chapter === 'horizon' ? site.east.clone().multiplyScalar(12).addScaledVector(site.up, 6) : new THREE.Vector3(11, 7, 8) : HOME
    stage.setHomeView(view === 'top' ? new THREE.Vector3(0, 15, .01) : view === 'side' ? side : home, ORIGIN)
    stage.resetView(); viewportKey = ''; layoutElapsed = 1
  }
  function zoom(direction: string) {
    const offset = stage.camera.position.clone().sub(stage.controls.target)
    const distance = THREE.MathUtils.clamp(offset.length() * (direction === 'in' ? .82 : 1.22), 9, 25)
    stage.camera.position.copy(stage.controls.target).add(offset.setLength(distance))
    stage.controls.update()
  }
  publish()
  resetView()
  stage.setFrameHandler(delta => {
    if (state.playing && !document.hidden) {
      if (state.chapter === 'precession') state.years = wrap(state.years + delta * 1000 * state.speed, 26000)
      else state.lst = wrap(state.lst + delta * .45 * state.speed, 24)
      dirty = true; publishElapsed += delta
      if (publishElapsed > .1) { publish(); publishElapsed = 0 }
    }
    if (dirty) rebuild()
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight)
    layoutElapsed += delta
    if (layoutElapsed >= .2 || !viewportKey.startsWith(`${width}:${height}:`)) {
      measureLayout(width, height); layoutElapsed = 0
    }
    const rect = diagramRect ?? diagramViewport(width, height, [])
    const nextViewport = `${width}:${height}:${rect.left}:${rect.top}:${rect.right}:${rect.bottom}`
    if (nextViewport !== viewportKey) {
      viewportKey = nextViewport
      const available = Math.max(120, Math.min(rect.right - rect.left, rect.bottom - rect.top))
      // The endpoints extend beyond the 3-unit sphere, and their labels sit above them.
      // Reserve that extra room instead of filling the free rectangle edge to edge.
      stage.camera.fov = Math.min(100, 2 * Math.atan(.29 * height / available) / DEG)
      stage.camera.setViewOffset(width, height, width / 2 - (rect.left + rect.right) / 2, height / 2 - (rect.top + rect.bottom) / 2, width, height)
      stage.camera.updateProjectionMatrix()
      lines.forEach(object => object.material.resolution.set(width, height))
    }
    focusHalo.quaternion.copy(stage.camera.quaternion)
    // Keep the endpoint's outline a steady screen-space size when using the zoom buttons.
    focusHalo.scale.setScalar(stage.camera.position.length() / HOME.length())
    stage.camera.updateMatrixWorld()
    const projected = labels.map(({ id, point }) => {
      const p = point.clone().project(stage.camera)
      const compact = width < 600
      // The caption names measurement arcs on phones; repeating those long labels inside
      // the small sphere obscures the angles themselves. Keep the endpoint P identifiable.
      const redundant = compact && ['azimuthArc', 'altitudeArc', 'raArc', 'decArc', 'longitudeArc', 'latitudeArc'].includes(id)
      const labelId = compact && (id === 'foot' || id === 'observer') ? `${id}Short` : id
      return { id: labelId, textKey: `demos.items.positionalAstronomy.labels.${labelId}`, x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, visible: showLabels && !redundant && p.z < 1 && p.z > -1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 }
    })
    const priority = (id: string) => ['target', 'fixedStar', 'surfaceObserver', 'pole', 'zenith', 'north', 'east', 'south', 'west'].indexOf(id)
    const occupied: ViewportRect[] = []
    // Prefer endpoints and compass directions when two labels converge while orbiting.
    for (const anchor of [...projected].sort((a, b) => (priority(a.id) < 0 ? 99 : priority(a.id)) - (priority(b.id) < 0 ? 99 : priority(b.id)))) {
      if (!anchor.visible) continue
      const size = labelSizes.get(anchor.id) ?? { width: anchor.id.endsWith('Short') ? 32 : 78, height: 24 }
      const box = { left: anchor.x - size.width / 2 - 4, right: anchor.x + size.width / 2 + 4, top: anchor.y - size.height * 1.5 - 3, bottom: anchor.y - size.height * .5 + 3 }
      if (box.top < 4 || box.bottom > height - 4 || overlayRects.some(r => intersects(box, r)) || occupied.some(r => intersects(box, r))) anchor.visible = false
      else occupied.push(box)
    }
    options.onLabels?.(projected)
  })
  stage.start()
  return {
    applySettings(settings) { if (settings.showLabels !== undefined) showLabels = settings.showLabels },
    resetView() { resetView() },
    runCommand(command) {
      if (!command || typeof command !== 'object') return
      const c = command as { type: string; value: unknown }
      if (c.type === 'reset') {
        const { chapter, perspective, grid, speed } = state
        state = { ...INITIAL, chapter, perspective, grid, speed }; resetView()
      }
      else if (c.type === 'view' && ['top', 'side', 'oblique'].includes(String(c.value))) resetView(String(c.value))
      else if ((c.type === 'zoom' || c.type === 'camera') && (c.value === 'in' || c.value === 'out')) zoom(c.value)
      else if (c.type === 'grid') state.grid = !state.grid
      else if (c.type === 'speed' && typeof c.value === 'number' && [.25, .5, 1, 2].includes(c.value)) state.speed = c.value
      else if (c.type === 'perspective' && (c.value === 'earth' || c.value === 'observer')) { state.perspective = c.value; state.playing = false; resetView() }
      else if (c.type === 'playing') { state.playing = typeof c.value === 'boolean' ? c.value : !state.playing; if (state.playing) state.step = 2 }
      else if (c.type === 'example' && EXAMPLES.includes(c.value as Example)) {
        const { perspective, grid, speed } = state
        state = { ...exampleState(c.value as Example), perspective: c.value === 'southeast' ? 'observer' : perspective, grid, speed }
        resetView()
      }
      else if (c.type === 'chapter' && CHAPTERS.includes(c.value as AstronomyState['chapter'])) { state.chapter = c.value as AstronomyState['chapter']; state.playing = false; state.step = 0; resetView() }
      else if (typeof c.value === 'number' && Number.isFinite(c.value)) {
        const ranges = { latitude: [-90, 90], ra: [0, 24], dec: [-90, 90], lst: [0, 24], years: [0, 26000], step: [0, 2] }
        if (c.type === 'azimuth' || c.type === 'altitude') {
          const h = horizontal(state.ra, state.dec, state.latitude, state.lst)
          const az = c.type === 'azimuth' ? wrap(c.value) : h.azimuth ?? 0
          const alt = c.type === 'altitude' ? Math.max(-90, Math.min(90, c.value)) : h.altitude
          Object.assign(state, fromHorizontal(az, alt, state.latitude, state.lst))
        } else if (Object.hasOwn(ranges, c.type)) {
          const field = c.type as keyof typeof ranges, range = ranges[field]
          state[field] = Math.min(range[1]!, Math.max(range[0]!, field === 'step' ? Math.round(c.value) : c.value))
          if (field === 'step' || field === 'lst' || field === 'years') state.playing = false
        }
      }
      dirty = true; publish()
    },
    dispose() { earth.dispose(); stage.dispose() },
    setSuspended(suspended) { if (suspended) stage.stop(); else stage.start() },
  }
}
