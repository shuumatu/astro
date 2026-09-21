import * as THREE from 'three'
import { CRITICAL_IMPACT, RAY_TABLE, rayTableData } from './blackHoleGeodesics'

/** Distant-observer Schwarzschild disk intersections; illustrative emission. */
export function createBlackHoleImage(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  // RG encodes 16-bit inverse radius. Ordinary byte textures can be linearly
  // filtered on all supported devices, without float-texture extensions.
  const rays = new THREE.DataTexture(rayTableData(), RAY_TABLE.width, RAY_TABLE.height)
  rays.minFilter = rays.magFilter = THREE.LinearFilter
  rays.generateMipmaps = false
  rays.needsUpdate = true
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, opacity: { value: 0 }, shadow: { value: .2 },
      rays: { value: rays },
    },
    vertexShader: /* glsl */ `
varying vec2 screenPosition;
varying float elevation;
void main() {
  screenPosition = position.xy;
  elevation = (viewMatrix * vec4(0.0,1.0,0.0,0.0)).z;
  vec4 center = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
  float scale = length(modelMatrix[0].xyz);
  gl_Position = projectionMatrix * (center + vec4(position.xy*scale,0.0,0.0));
}`,
    fragmentShader: /* glsl */ `
uniform float time, opacity, shadow;
uniform sampler2D rays;
varying vec2 screenPosition;
varying float elevation;
const float PI = 3.14159265359;
const float critical = ${CRITICAL_IMPACT};

float inverseRadius(float impact, float phi) {
  float delta = impact-critical;
  float span = delta < 0.0 ? critical : ${RAY_TABLE.maxImpact.toFixed(1)}-critical;
  float x = .5 + .5*sign(delta)*pow(abs(delta)/span,1.0/3.0);
  vec2 uv = vec2(x,phi/${RAY_TABLE.maxAngle});
  // Table endpoints live at texel centres, not at texture edges.
  uv = (uv*vec2(${RAY_TABLE.width - 1}.0,${RAY_TABLE.height - 1}.0)+.5)
    /vec2(${RAY_TABLE.width}.0,${RAY_TABLE.height}.0);
  vec2 packed = texture2D(rays,uv).rg;
  return dot(packed,vec2(256.0/257.0,1.0/257.0));
}

vec3 emission(float radius, float angle, float impactX, float cosElevation, float outer) {
  float t = clamp((radius-3.0)/(outer-3.0),0.0,1.0);
  float phase = angle-time*.45*pow(3.0/radius,1.5);
  float ripple = .8*sin(phase*3.0+radius*1.7)+.3*sin(phase*7.0-radius*2.1);
  float lanes = .6+.23*sin(t*155.0+ripple)+.12*sin(t*293.0-ripple*1.7);
  // Source-radius variation over a screen pixel suppresses unresolved lanes.
  float footprint = abs(dFdx(t))+abs(dFdy(t));
  lanes = mix(lanes,.6,smoothstep(.012,.04,footprint));
  float heat = pow(3.0/radius,.8);
  vec3 tint = mix(vec3(.32,.003,.0002),vec3(1.0,.26,.012),heat);
  // Circular-orbit gravitational/Doppler shift for a distant observer.
  // Its artistic exposure is compressed so the receding side remains readable.
  float omega = sqrt(.5/(radius*radius*radius));
  float shift = sqrt(max(.01,1.0-1.5/radius))
    /max(.2,1.0+omega*impactX*cosElevation);
  float boost = clamp(pow(shift,3.0),.18,3.5);
  float envelope = smoothstep(3.0,3.25,radius)*(1.0-smoothstep(outer*.72,outer,radius));
  return tint*lanes*envelope*boost*1.8;
}

// Intersect ONE curved ray with the same physical disk at phi + n*pi.
// Near the equator, the near-side intersection recedes beyond the outer disk
// instead of morphing its image into a pre-drawn arc on the opposite side.
vec4 traceDisk(vec2 p) {
  float screenR = length(p);
  float rs = max(shadow,.001)/critical;
  float impact = screenR/rs;
  if (impact >= ${RAY_TABLE.maxImpact.toFixed(1)}) return vec4(0.0);
  float cosElevation = sqrt(max(0.0,1.0-elevation*elevation));
  float tangentY = p.y/max(screenR,.000001)*cosElevation;
  float phi = atan(-elevation,tangentY);
  if (phi <= 0.0) phi += PI;
  float outer = max(4.0,.91/rs);
  vec3 light = vec3(0.0);
  float transmission = 1.0;
  for (int order=0;order<3;order++) {
    float crossing = phi+float(order)*PI;
    float u = inverseRadius(impact,crossing);
    float radius = 1.0/max(u,.00001);
    float coverage = smoothstep(3.0,3.06,radius)*(1.0-smoothstep(outer*.97,outer,radius));
    // Observer-local disk coordinates keep the radial texture continuous when
    // crossing y=0. No sign branch or image-wide hemisphere crossfade.
    float x = sin(crossing)*p.x/max(screenR,.000001);
    float z = cos(crossing)*cosElevation
      - sin(crossing)*p.y/max(screenR,.000001)*elevation;
    light += transmission*coverage*emission(radius,atan(z,x),p.x/rs,cosElevation,outer);
    transmission *= 1.0-coverage;
  }
  float captured = 1.0-step(critical,impact);
  return vec4(light,1.0-transmission*(1.0-captured));
}
void main() {
  // Pixel-footprint integration handles the thin disk's edge-on limit; this
  // averages adjacent light rays, never complete images at different angles.
  vec2 pixel = vec2(length(dFdx(screenPosition)),length(dFdy(screenPosition)))*.3;
  vec4 optical = (traceDisk(screenPosition+pixel)
    +traceDisk(screenPosition-pixel)
    +traceDisk(screenPosition+vec2(pixel.x,-pixel.y))
    +traceDisk(screenPosition+vec2(-pixel.x,pixel.y)))*.25;
  gl_FragColor = vec4(optical.rgb/max(optical.a,.0001),optical.a*min(1.0,opacity/.95));
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, depthTest: false,
  })
  // Shader uniforms are not scanned by the shared scene texture disposer.
  material.addEventListener('dispose', () => rays.dispose())
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.name = 'blackHoleImage'
  mesh.renderOrder = 5
  return mesh
}
