import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createAuroraCurtain, createBodies } from './visuals'
import { mapWind } from './model'

afterEach(() => vi.restoreAllMocks())

function loadBodies() {
  const texture = new THREE.Texture<HTMLImageElement>()
  const release = vi.spyOn(texture, 'dispose')
  let loaded!: (texture: THREE.Texture<HTMLImageElement>) => void, failed!: () => void
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad, _progress, onError) => {
    loaded = onLoad!; failed = () => onError!(new Error('Texture unavailable'))
    return texture
  })
  const ready = vi.fn(), bodies = createBodies(ready)
  const earth = bodies.group.getObjectByName('earth') as THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>
  function cleanup() {
    bodies.dispose()
    bodies.group.traverse(object => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose())
      else mesh.material?.dispose()
    })
  }
  return { texture, release, loaded, failed, ready, bodies, earth, cleanup }
}

it('renders a blue fallback if the local Earth texture cannot load', () => {
  const fixture = loadBodies()
  fixture.failed()
  expect(fixture.earth.material.map).toBeNull()
  expect(fixture.earth.material.color.getHex()).toBe(0x287aa4)
  expect(fixture.ready).toHaveBeenCalledOnce()
  expect(fixture.release).toHaveBeenCalled()
  fixture.cleanup()
})

it('does not revive a disposed scene when an image finishes loading late', () => {
  const fixture = loadBodies()
  fixture.cleanup()
  fixture.loaded(fixture.texture)
  fixture.failed()
  expect(fixture.earth.material.map).toBeNull()
  expect(fixture.ready).not.toHaveBeenCalled()
  expect(fixture.release).toHaveBeenCalled()
})

it('keeps both curtains above the surface and reuses their buffers during animation', () => {
  const north = createAuroraCurtain(1), south = createAuroraCurtain(-1)
  const position = north.object.geometry.getAttribute('position')
  for (const direction of ['north', 'south'] as const) {
    const response = mapWind(85, direction)
    north.update(response); south.update(response)
    const opposite = south.object.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      expect(Math.hypot(position.getX(i), position.getY(i), position.getZ(i))).toBeGreaterThan(1)
      expect(opposite.getY(i)).toBeCloseTo(-position.getY(i))
    }
  }
  const vertices = Array.from(position.array)
  north.animate(5)
  expect(north.object.material.uniforms.time!.value).toBe(5)
  expect(north.object.geometry.getAttribute('position')).toBe(position)
  expect(Array.from(position.array)).toEqual(vertices)
  for (const curtain of [north, south]) { curtain.object.geometry.dispose(); curtain.object.material.dispose() }
})
