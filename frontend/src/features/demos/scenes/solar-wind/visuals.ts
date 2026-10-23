import * as THREE from 'three'
import type { mapWind } from './model'

type Response = ReturnType<typeof mapWind>
const surfaceVertex = `varying vec3 vNormal; varying vec3 vPosition; varying vec2 vUv;
void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`

/** Small, scene-owned glow quads: no bloom pass, canvas allocation or shared texture lifetime. */
export function glow(color: number, size: number, opacity: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: surfaceVertex,
    fragmentShader: `varying vec2 vUv;uniform vec3 tint;uniform float opacity;
      void main(){float r=length(vUv-.5)*2.;float a=exp(-5.*r*r)*(1.-smoothstep(.35,1.,r));gl_FragColor=vec4(tint,a*opacity);}`,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), material)
}

export function createBodies(onReady: () => void) {
  const group = new THREE.Group()
  let disposed = false
  const earthMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 8, emissive: 0x061322, emissiveIntensity: .45 })
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), earthMaterial)
  earth.name = 'earth'; earth.rotation.y = 2.2
  group.add(earth)
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}demos/meteor-shower/earth-day.jpg`, loaded => {
    if (disposed) { loaded.dispose(); return }
    onReady()
  }, undefined, () => {
    if (disposed) return
    texture.dispose(); earthMaterial.map = null; earthMaterial.color.setHex(0x287aa4); earthMaterial.needsUpdate = true; onReady()
  })
  texture.colorSpace = THREE.SRGBColorSpace
  earthMaterial.map = texture
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.055, 48, 32), new THREE.ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: `varying vec3 vNormal;void main(){float rim=pow(1.-abs(vNormal.z),3.);gl_FragColor=vec4(.16,.57,1.,rim*.65);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  atmosphere.name = 'atmosphere'; group.add(atmosphere)
  const earthGlow = glow(0x147fa5, 4.5, .19); group.add(earthGlow)
  const glows = [earthGlow]
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.48, 64, 40), new THREE.ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: `varying vec3 vNormal;varying vec3 vPosition;
      float grain(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){vec3 p=vPosition*18.;float n=grain(floor(p))*.23+sin(p.x*1.8+sin(p.y*2.3))*sin(p.z*2.1)*.08;
      float limb=pow(max(0.,vNormal.z),.45);vec3 c=mix(vec3(1.,.21,.015),vec3(1.,.82,.31),limb);
      gl_FragColor=vec4(c*(.84+n),1.);}`,
  }))
  sun.name = 'sun'; sun.position.x = -7.8; group.add(sun)
  for (const [size, opacity] of [[7.5, .32], [4.5, .6]]) {
    const corona = glow(0xff8d23, size!, opacity!); corona.position.set(-7.8, 0, 0); group.add(corona); glows.push(corona)
  }
  // A deterministic sparse background, visually distinct from the moving gold wind.
  const stars = new Float32Array(180 * 3)
  for (let i = 0; i < 180; i++) {
    stars[i * 3] = ((i * .61803398875) % 1 - .5) * 44
    stars[i * 3 + 1] = ((i * .41421356237) % 1 - .5) * 28
    stars[i * 3 + 2] = -9 - i % 7
  }
  const starGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(stars, 3))
  const starfield = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x809bab, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .32, depthWrite: false }))
  starfield.name = 'background-stars'; group.add(starfield)
  return { group, faceCamera(camera: THREE.Camera) { glows.forEach(object => object.quaternion.copy(camera.quaternion)) }, dispose() { disposed = true; texture.dispose(); earthMaterial.map = null } }
}

/** Two translucent, folded emission curtains, not height-resolved aurora predictions. */
export function createAuroraCurtain(sign: number) {
  const geometry = new THREE.PlaneGeometry(1, 1, 96, 10)
  const material = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { activity: { value: .2 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float time;uniform float activity;
      void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.x*56.+time*.6)*.018*uv.y*activity;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float activity;uniform float time;
      void main(){float folds=.48+.52*pow(.5+.5*sin(vUv.x*180.+sin(vUv.x*39.+time*.4)*2.),2.);
      float fade=sin(vUv.y*3.14159)*pow(1.-vUv.y,.6);
      vec3 color=mix(vec3(.13,1.,.65),vec3(.62,.25,1.),smoothstep(.32,1.,vUv.y));
      gl_FragColor=vec4(color,fade*folds*(.26+activity*.74));}`,
  })
  const object = new THREE.Mesh(geometry, material)
  object.name = `aurora-curtain-${sign}`
  function update(response: Response) {
    const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
    for (let i = 0; i < positions.count; i++) {
      const u = uv.getX(i), height = uv.getY(i), angle = u * Math.PI * 2
      const radius = 1.025 + height * (.13 + response.activity * .23)
      const colatitude = response.ovalColatitude + Math.sin(angle * 6) * .017 * height
      positions.setXYZ(i, Math.sin(colatitude) * radius * Math.cos(angle), sign * Math.cos(colatitude) * radius, Math.sin(colatitude) * radius * Math.sin(angle))
    }
    positions.needsUpdate = true; geometry.computeBoundingSphere()
    material.uniforms.activity!.value = response.activity
  }
  return { object, update, animate(time: number) { material.uniforms.time!.value = time } }
}
