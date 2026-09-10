import * as THREE from 'three'

export interface GlowSpriteOptions {
  color?: number
  size?: number
  opacity?: number
}

let glowTexture: THREE.CanvasTexture | null = null
let starburstTexture: THREE.CanvasTexture | null = null

export function createGlowSprite(options: GlowSpriteOptions = {}): THREE.Sprite {
  const size = options.size ?? 8
  const material = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: options.color ?? 0xffd9a0,
    transparent: true,
    opacity: options.opacity ?? 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(size, size, 1)
  return sprite
}

export function createStarburstSprite(options: GlowSpriteOptions = {}): THREE.Sprite {
  const size = options.size ?? 10
  const material = new THREE.SpriteMaterial({
    map: getStarburstTexture(),
    color: options.color ?? 0xfff3d2,
    transparent: true,
    opacity: options.opacity ?? 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(size, size, 1)
  return sprite
}

function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.16, 'rgba(255, 250, 235, 0.82)')
    gradient.addColorStop(0.34, 'rgba(255, 232, 190, 0.34)')
    gradient.addColorStop(0.62, 'rgba(255, 205, 140, 0.09)')
    gradient.addColorStop(1, 'rgba(255, 190, 120, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  glowTexture = new THREE.CanvasTexture(canvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  return glowTexture
}

function getStarburstTexture(): THREE.CanvasTexture {
  if (starburstTexture) return starburstTexture
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const center = size / 2
    const gradient = context.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.2, 'rgba(255, 244, 214, 0.35)')
    gradient.addColorStop(0.55, 'rgba(255, 226, 170, 0.07)')
    gradient.addColorStop(1, 'rgba(255, 214, 150, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    context.globalCompositeOperation = 'lighter'
    context.translate(center, center)
    const rayCount = 12
    for (let index = 0; index < rayCount; index += 1) {
      const angle = (index / rayCount) * Math.PI * 2
      const length = index % 2 === 0 ? center * 0.94 : center * 0.6
      const halfWidth = index % 2 === 0 ? size * 0.006 : size * 0.004
      const rayGradient = context.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length)
      rayGradient.addColorStop(0, 'rgba(255, 247, 224, 0.55)')
      rayGradient.addColorStop(0.45, 'rgba(255, 238, 200, 0.16)')
      rayGradient.addColorStop(1, 'rgba(255, 230, 180, 0)')
      context.fillStyle = rayGradient
      context.beginPath()
      context.moveTo(0, 0)
      context.lineTo(Math.cos(angle) * length - Math.sin(angle) * halfWidth, Math.sin(angle) * length + Math.cos(angle) * halfWidth)
      context.lineTo(Math.cos(angle) * length + Math.sin(angle) * halfWidth, Math.sin(angle) * length - Math.cos(angle) * halfWidth)
      context.closePath()
      context.fill()
    }
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'source-over'
  }
  starburstTexture = new THREE.CanvasTexture(canvas)
  starburstTexture.colorSpace = THREE.SRGBColorSpace
  return starburstTexture
}
