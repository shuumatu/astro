import * as THREE from 'three'
import { MOON_RADIUS_KM } from './config'
import type { Vector3Like } from './selenography'

/** NASA Moon Trek exports are in metres, over this fixed square (6144 pixels per side). */
export const POLAR_EXTENT_M = 1_126_000
const PROJECTION_SCALE = MOON_RADIUS_KM * 1000 / POLAR_EXTENT_M
const radians = Math.PI / 180
const FADE_START = Math.sin(68 * radians)
const FADE_END = Math.sin(78 * radians)

/** Texture coordinates, with TextureLoader's default flipY; no longitude singularity. */
export function polarTextureUv(point: Vector3Like): [number, number] {
  const length = Math.hypot(point.x, point.y, point.z)
  const x = point.x / length
  const y = point.y / length
  const z = point.z / length
  const scale = PROJECTION_SCALE / (1 + Math.abs(y))
  return [0.5 - z * scale, 0.5 - Math.sign(y) * x * scale]
}

export function polarBlend(latitudeDeg: number): number {
  const t = THREE.MathUtils.clamp((Math.sin(Math.abs(latitudeDeg) * radians) - FADE_START)
    / (FADE_END - FADE_START), 0, 1)
  return t * t * (3 - 2 * t)
}

/** One elevation at each pole, independent of the duplicated SphereGeometry vertex longitude. */
export function poleHeightMeans(data: ArrayLike<number>, width: number, height: number): [number, number] {
  let north = 0
  let south = 0
  for (let x = 0; x < width; x += 1) {
    north += data[x * 4]
    south += data[((height - 1) * width + x) * 4]
  }
  return [north / (width * 255), south / (width * 255)]
}

/** Polar colour and globe relief share one mesh, depth, lighting and camera ground surface. */
export function configurePolarSurface(material: THREE.MeshStandardMaterial) {
  const uniforms = {
    lunarNorthMap: { value: null as THREE.Texture | null },
    lunarSouthMap: { value: null as THREE.Texture | null },
    lunarNorthReady: { value: 0 },
    lunarSouthReady: { value: 0 },
    lunarPoleHeights: { value: new THREE.Vector2(0.5, 0.5) },
  }
  material.customProgramCacheKey = () => 'lunar-polar-surface-v1'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 lunarSurfaceDirection;
uniform vec2 lunarPoleHeights;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
lunarSurfaceDirection = normalize(position);`)
      .replace('#include <displacementmap_vertex>', `
#ifdef USE_DISPLACEMENTMAP
  float lunarHeight = texture2D(displacementMap, vDisplacementMapUv).r;
  float lunarPoleHeight = lunarSurfaceDirection.y >= 0.0 ? lunarPoleHeights.x : lunarPoleHeights.y;
  // Only the innermost 1.5 degrees need longitude-independent convergence.
  float lunarPoleWeight = smoothstep(${Math.sin(88.5 * radians)}, 1.0, abs(lunarSurfaceDirection.y));
  lunarHeight = mix(lunarHeight, lunarPoleHeight, lunarPoleWeight);
  transformed += normalize(objectNormal) * (lunarHeight * displacementScale + displacementBias);
#endif`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 lunarSurfaceDirection;
uniform sampler2D lunarNorthMap;
uniform sampler2D lunarSouthMap;
uniform float lunarNorthReady;
uniform float lunarSouthReady;`)
      .replace('#include <map_fragment>', `
vec3 lunarDirection = normalize(lunarSurfaceDirection);
float lunarAbsY = abs(lunarDirection.y);
vec4 lunarColour = vec4(1.0);
#ifdef USE_MAP
  lunarColour = texture2D(map, vMapUv);
#endif
float lunarWeight = smoothstep(${FADE_START}, ${FADE_END}, lunarAbsY);
if (lunarWeight > 0.0) {
  // x=cos(lat)cos(lon), z=-cos(lat)sin(lon). North stereographic Y points
  // away from lon=0; the south projection reverses Y. UV V points up (flipY=true).
  vec2 lunarUv = vec2(0.5) + vec2(-lunarDirection.z, -sign(lunarDirection.y) * lunarDirection.x)
    * (${PROJECTION_SCALE} / (1.0 + lunarAbsY));
  if (lunarDirection.y >= 0.0 && lunarNorthReady > 0.5) {
    lunarColour = mix(lunarColour, texture2D(lunarNorthMap, lunarUv), lunarWeight);
  } else if (lunarDirection.y < 0.0 && lunarSouthReady > 0.5) {
    lunarColour = mix(lunarColour, texture2D(lunarSouthMap, lunarUv), lunarWeight);
  }
}
diffuseColor *= lunarColour;`)
      .replace('#include <normal_fragment_maps>', `
#ifdef USE_BUMPMAP
  // Equirectangular screen derivatives become singular at the pole. Keep LOLA displacement,
  // but smoothly suppress this unreliable micro-normal signal over the last five degrees.
  float lunarBumpWeight = 1.0 - smoothstep(${Math.sin(85 * radians)}, ${Math.sin(89 * radians)}, abs(normalize(lunarSurfaceDirection).y));
  if (lunarBumpWeight > 0.0001) {
    normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd() * lunarBumpWeight, faceDirection);
  }
#else
  #include <normal_fragment_maps>
#endif`)
  }
  return {
    setMap(hemisphere: 'north' | 'south', texture: THREE.Texture) {
      if (hemisphere === 'north') {
        uniforms.lunarNorthMap.value = texture
        uniforms.lunarNorthReady.value = 1
      } else {
        uniforms.lunarSouthMap.value = texture
        uniforms.lunarSouthReady.value = 1
      }
    },
    setPoleHeights(north: number, south: number) {
      uniforms.lunarPoleHeights.value.set(north, south)
    },
    dispose() {
      uniforms.lunarNorthMap.value?.dispose()
      uniforms.lunarSouthMap.value?.dispose()
    },
  }
}
