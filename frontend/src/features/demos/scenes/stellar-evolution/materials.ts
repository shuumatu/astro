import * as THREE from 'three'

// Procedural structure lives in object space: no polar pinching or UV seam when orbiting.
const noise = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(.11, .37, .73));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x),
                 mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
                 mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return .56*noise3(p) + .28*noise3(p*2.03+7.1) + .16*noise3(p*4.07+19.3);
}
`

/** Emissive photosphere, with limb darkening rather than a planet's day/night terminator. */
export function createPhotosphereMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const uniforms = {
    stellarTime: { value: 0 },
    granuleScale: { value: 28 },
    granuleContrast: { value: .22 },
    spotStrength: { value: 0 },
  }
  material.userData.surface = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying vec3 stellarPosition;
varying vec3 stellarNormal;
varying vec3 stellarView;
${shader.vertexShader}`.replace('#include <begin_vertex>', `
#include <begin_vertex>
stellarPosition = position;
stellarNormal = normalize(normalMatrix * normal);
stellarView = -(modelViewMatrix * vec4(position, 1.0)).xyz;
`)
    shader.fragmentShader = `
uniform float stellarTime, granuleScale, granuleContrast, spotStrength;
varying vec3 stellarPosition, stellarNormal, stellarView;
${noise}
${shader.fragmentShader}`.replace('#include <color_fragment>', `
#include <color_fragment>
vec3 p = normalize(stellarPosition);
vec3 drift = vec3(stellarTime * .023, 0.0, stellarTime * .017);
float cells = fbm(p * granuleScale + drift);
float lanes = smoothstep(.27, .68, cells);
float fine = noise3(p * granuleScale * 3.0 + drift);
float mu = max(0.0, dot(normalize(stellarNormal), normalize(stellarView)));
float limb = .36 + .64 * pow(mu, .48);
float activity = smoothstep(.66, .8, fbm(p * 7.0 + vec3(3.0)));
float belt = 1.0 - smoothstep(.18, .52, abs(p.y));
float spots = activity * belt * spotStrength;
float surface = 1.0 + granuleContrast * ((lanes-.5)*1.6 + (fine-.5)*.35);
diffuseColor.rgb *= limb * surface * (1.0 - spots * .78);
`)
  }
  material.customProgramCacheKey = () => 'stellar-photosphere-v2'
  return material
}

export function updatePhotosphere(material: THREE.MeshBasicMaterial, time: number, radius: number): void {
  const uniforms = material.userData.surface
  if (!uniforms) return
  uniforms.stellarTime.value = time
  // Giant cells are coarser; hot compact remnants have a much smoother photosphere.
  const giant = THREE.MathUtils.smoothstep(radius, 1.4, 2.65)
  const compact = 1 - THREE.MathUtils.smoothstep(radius, .25, .7)
  uniforms.granuleScale.value = THREE.MathUtils.lerp(58, 7, giant)
  uniforms.granuleContrast.value = THREE.MathUtils.lerp(.14 + giant * .28, .018, compact)
  uniforms.spotStrength.value = (1 - giant) * (1 - compact) * .8
}

/** Patchy extinction concentrated around the disk plane, with clearer polar cavities. */
export function addDustExtinction(material: THREE.MeshBasicMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 dustPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ndustPosition = position;')
    shader.fragmentShader = `varying vec3 dustPosition;\n${noise}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
#include <color_fragment>
float equator = 1.0 - smoothstep(.12,.85,abs(dustPosition.y));
float knots = fbm(dustPosition*8.0);
diffuseColor.a *= equator * (.2 + .8*smoothstep(.28,.7,knots));
`)
  }
  material.customProgramCacheKey = () => 'stellar-dust-extinction'
}

const shellVertex = /* glsl */ `
uniform float explosion;
varying vec3 vPosition, vNormal, vView;
void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  // Explosion asymmetry is present from the outset; it is not a late-age switch.
  // Angular variations stand in for different ejecta velocities and dense plumes.
  vec3 p = normalize(position);
  float plumes = .13*sin(p.x*5.0+p.z*3.0) + .10*sin(p.y*7.0-p.x*2.0)
    + .09*p.x - .07*p.z;
  vec3 displaced = position * (1.0 + explosion * plumes);
  displaced.x += explosion * .1 * p.y * p.y;
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

/** Two nested, irregular ellipsoids show depth and ionisation zones, not a flat torus. */
export function createGasEnvelope(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'gasEnvelope'
  for (let layer = 0; layer < 2; layer += 1) {
    const geometry = new THREE.SphereGeometry(1, 96, 64)
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
      const ripple = 1 + .045 * Math.sin(x * 17 + y * 9) * Math.sin(z * 13 - y * 11)
      positions.setXYZ(i, x * ripple, y * ripple, z * ripple)
    }
    geometry.computeVertexNormals()
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, opacity: { value: 0 }, explosion: { value: 0 },
        outer: { value: layer },
      },
      vertexShader: shellVertex,
      fragmentShader: /* glsl */ `
uniform float time, opacity, explosion, outer;
varying vec3 vPosition, vNormal, vView;
${noise}
void main() {
  vec3 p = normalize(vPosition);
  float mu = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - mu, 2.3);
  float billows = fbm(p * mix(7.0, 11.0, explosion) + time * .012);
  float strands = 1.0 - abs(2.0 * noise3(p * 34.0 + billows * 4.0) - 1.0);
  float filaments = pow(strands, 8.0);
  float density = smoothstep(.26, .73, billows);
  float broken = mix(1.0, smoothstep(.34,.62,fbm(p*4.0+vec3(8.0))), explosion);
  float alpha = opacity * (.09 + rim * .8) * (density * .72 + filaments * .65);
  alpha *= broken;
  vec3 innerColor = mix(vec3(.12,.58,.60), vec3(.16,.36,.72), explosion);
  vec3 outerColor = mix(vec3(.72,.20,.12), vec3(.9,.25,.075), explosion);
  vec3 color = mix(innerColor, outerColor, outer);
  color = mix(color, vec3(.72,.86,.93), filaments * .28);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.setScalar(layer === 0 ? .76 : 1)
    group.add(mesh)
  }
  return group
}

/** Swirling temperature gradient with soft inner and outer disk boundaries. */
export function createAccretionMaterial(innerRadius: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const time = { value: 0 }
  material.userData.diskTime = time
  material.onBeforeCompile = (shader) => {
    shader.uniforms.diskTime = time
    shader.vertexShader = `varying vec2 diskPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ndiskPosition = position.xy;')
    shader.fragmentShader = `varying vec2 diskPosition;\nuniform float diskTime;\n${noise}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
#include <color_fragment>
float r = length(diskPosition);
float a = atan(diskPosition.y, diskPosition.x);
float heat = 1.0 - smoothstep(${innerRadius.toFixed(3)}, 1.0, r);
float bands = .78 + .22 * sin(r*105.0 + a*3.0 - diskTime * 1.5);
float turbulence = .65 + .35 * fbm(vec3(diskPosition*18.0, diskTime*.12));
diffuseColor.rgb *= mix(vec3(.5,.16,.05), vec3(1.0,.86,.62), heat) * bands;
diffuseColor.a *= smoothstep(${innerRadius.toFixed(3)}, ${(innerRadius + .07).toFixed(3)}, r)
  * (1.0-smoothstep(.68,1.0,r)) * turbulence;
`)
  }
  material.customProgramCacheKey = () => `stellar-disk-${innerRadius}`
  return material
}

export { createBlackHoleImage } from './blackHoleMaterial'

/** Dipole field lines are a teaching overlay; magnetic fields are not visible filaments. */
export function createMagneticField(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'magneticField'
  const material = new THREE.LineBasicMaterial({
    color: 0x7daeca, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (let meridian = 0; meridian < 6; meridian += 1) {
    const phi = meridian * Math.PI / 3
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 100; i += 1) {
      const theta = .14 + i / 100 * (Math.PI - .28)
      const r = 1.1 * Math.sin(theta) ** 2
      points.push(new THREE.Vector3(r*Math.sin(theta)*Math.cos(phi), r*Math.cos(theta), r*Math.sin(theta)*Math.sin(phi)))
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material))
  }
  return group
}
