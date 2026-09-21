import * as THREE from 'three'

// Deterministic teaching reconstruction, not a fit to a measured 3D point cloud.
function randomSource() {
  let seed = 1054
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 }
}
function pointMaterial(size: number, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { size: { value: size }, opacity: { value: opacity } },
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float size; varying vec3 tint;
      void main() { tint = color; vec4 p = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * p; gl_PointSize = clamp(size / max(.1, -p.z), 1., 90.); }`,
    fragmentShader: `uniform float opacity; varying vec3 tint;
      void main() { float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard;
        gl_FragColor = vec4(tint, exp(-r*r*5.) * (1.-smoothstep(.6,1.,r)) * opacity); }`,
  })
}
function points(positions: number[], colors: number[], size: number, opacity: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Points(g, pointMaterial(size, opacity))
}
export function createFilaments() {
  const random = randomSource(), positions: number[] = [], colors: number[] = []
  const warm = new THREE.Color('#e59655'), cool = new THREE.Color('#6bbbc6')
  // Short, interlocking, branching filaments follow a lopsided ellipsoid, not latitude rings.
  for (let strand = 0; strand < 420; strand++) {
    const theta = random() * Math.PI * 2, phi = Math.acos(2 * random() - 1)
    const length = .15 + random() * .6, direction = random() * Math.PI * 2
    const radial = .83 + random() * .2, phase = random() * 8
    const tint = warm.clone().lerp(cool, random() < .25 ? .8 : random() * .22)
    for (let step = 0; step < 85; step++) {
      const t = step / 84 - .5
      const a = theta + t * length * Math.cos(direction) / Math.max(.35, Math.sin(phi))
      const b = phi + t * length * Math.sin(direction)
      const r = radial + .045 * Math.sin(t * 19 + phase) + .035 * Math.sin(a * 7 + b * 5)
      const x = Math.sin(b) * Math.cos(a), y = Math.cos(b), z = Math.sin(b) * Math.sin(a)
      for (let width = 0; width < 2; width++) {
        const jitter = () => (random() - .5) * .035
        positions.push(2.35*x*r + .14*y*y + jitter(), 3.05*y*r + jitter(), 1.85*z*r + jitter())
        const brightness = .5 + .5 * Math.sin(Math.PI * (t + .5))
        colors.push(tint.r * brightness, tint.g * brightness, tint.b * brightness)
      }
    }
  }
  const cloud = points(positions, colors, 38, .36)
  cloud.name = 'filaments'
  return cloud
}
export function createDiffuseCloud() {
  const random = randomSource(), positions: number[] = [], colors: number[] = []
  for (let i = 0; i < 3800; i++) {
    const a = random() * Math.PI * 2, y = random() * 2 - 1
    const radius = Math.cbrt(random()), equator = Math.sqrt(1 - y*y)
    positions.push(1.9*radius*equator*Math.cos(a), 2.55*radius*y, 1.45*radius*equator*Math.sin(a))
    const c = new THREE.Color('#496b89').lerp(new THREE.Color('#8a6d94'), radius)
    colors.push(c.r, c.g, c.b)
  }
  const cloud = points(positions, colors, 580, .035)
  cloud.name = 'diffuse'
  return cloud
}
export function innerMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 n; varying vec3 v;
      void main() { vec4 p = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix * normal);
        v = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `varying vec3 n; varying vec3 v;
      void main() { float rim = pow(1.-abs(dot(normalize(n),normalize(v))),1.7);
        gl_FragColor = vec4(mix(vec3(.15,.31,.66),vec3(.5,.83,1.),rim), .16 + .28*rim); }`,
  })
}
