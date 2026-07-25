export interface WesternCultureArtworkAnchor {
  hipId: number
  imageX: number
  imageY: number
}

export interface WesternCultureArtwork {
  id: string
  file: string
  width: number
  height: number
  anchors: WesternCultureArtworkAnchor[]
}

interface UpstreamArtworkIndex {
  constellations?: Array<{
    id?: string
    image?: {
      file?: string
      size?: unknown
      anchors?: Array<{ hip?: unknown; pos?: unknown }>
    }
  }>
}

const INDEX_URL = '/sky-cultures/western/index.json'
const ARTWORK_ROOT = '/sky-cultures/western/'

let artworkPromise: Promise<WesternCultureArtwork[]> | null = null
const imageCache = new Map<string, HTMLImageElement>()
const loadingImages = new Set<string>()

export function loadWesternCultureArtwork(): Promise<WesternCultureArtwork[]> {
  artworkPromise ??= fetch(INDEX_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load Western culture artwork (${response.status})`)
      return response.json() as Promise<UpstreamArtworkIndex>
    })
    .then(parseArtworkIndex)
  return artworkPromise
}

export function westernCultureArtworkImage(
  artwork: WesternCultureArtwork,
  onLoad: () => void,
): HTMLImageElement | null {
  const url = `${ARTWORK_ROOT}${artwork.file}`
  const cached = imageCache.get(url)
  if (cached) return cached
  if (loadingImages.has(url)) return null

  loadingImages.add(url)
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    loadingImages.delete(url)
    imageCache.set(url, image)
    onLoad()
  }
  image.onerror = () => loadingImages.delete(url)
  image.src = url
  return null
}

function parseArtworkIndex(index: UpstreamArtworkIndex): WesternCultureArtwork[] {
  return (index.constellations ?? []).flatMap((constellation) => {
    const image = constellation.image
    if (!constellation.id || !image?.file || !isSize(image.size) || !image.anchors) return []
    const anchors = image.anchors.flatMap((anchor) => {
      if (typeof anchor.hip !== 'number' || !Number.isInteger(anchor.hip) || !isPosition(anchor.pos)) return []
      return [{ hipId: anchor.hip, imageX: anchor.pos[0], imageY: anchor.pos[1] }]
    })
    return anchors.length >= 3
      ? [{ id: constellation.id, file: image.file, width: image.size[0], height: image.size[1], anchors }]
      : []
  })
}

function isSize(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item) && item > 0)
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}
