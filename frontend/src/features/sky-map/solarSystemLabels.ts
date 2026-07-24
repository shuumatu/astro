import type { ProjectedPoint } from './projection'
import type { SolarSystemBodyId } from './types'

export interface SolarSystemLabelInput {
  id: SolarSystemBodyId
  text: string
  anchor: 'start' | 'end'
  radius: number
  point: ProjectedPoint
}

export interface LabelBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface SolarSystemLabelLayout extends SolarSystemLabelInput {
  x: number
  y: number
  leaderX: number
  displaced: boolean
  bounds: LabelBounds
}

export function layoutSolarSystemLabels(
  labels: SolarSystemLabelInput[],
  size: number,
): SolarSystemLabelLayout[] {
  const fontSize = Math.max(9, Math.min(13, size * 0.0155))
  const lineStep = fontSize + 5
  const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4].map((step) => step * lineStep)
  const occupied: LabelBounds[] = []

  return [...labels]
    .sort((left, right) => left.point.x - right.point.x)
    .map((label) => {
      const width = estimatedLabelWidth(label.text, fontSize)
      const height = fontSize * 1.25
      const labelOffset = label.radius + 5
      const baseX = label.point.x + (label.anchor === 'end' ? -labelOffset : labelOffset)
      let placement = placeLabel(label.anchor, baseX, label.point.y, width, height, size)

      for (const offset of offsets) {
        const candidate = placeLabel(
          label.anchor,
          baseX,
          label.point.y + offset,
          width,
          height,
          size,
        )
        placement = candidate
        if (!occupied.some((bounds) => labelBoundsOverlap(candidate.bounds, bounds))) break
      }

      occupied.push(placement.bounds)
      return {
        ...label,
        x: placement.x,
        y: placement.y,
        leaderX: placement.x + (label.anchor === 'end' ? 2 : -2),
        displaced: Math.abs(placement.y - label.point.y) > 2,
        bounds: placement.bounds,
      }
    })
}

function placeLabel(
  anchor: 'start' | 'end',
  requestedX: number,
  requestedY: number,
  width: number,
  height: number,
  size: number,
): { x: number; y: number; bounds: LabelBounds } {
  const margin = 4
  const y = Math.max(margin + height / 2, Math.min(size - margin - height / 2, requestedY))
  let x = requestedX
  let left = anchor === 'end' ? x - width : x
  let right = anchor === 'end' ? x : x + width
  if (left < margin) {
    x += margin - left
    left = margin
    right = left + width
  } else if (right > size - margin) {
    x -= right - (size - margin)
    right = size - margin
    left = right - width
  }
  return {
    x,
    y,
    bounds: { left, right, top: y - height / 2, bottom: y + height / 2 },
  }
}

function estimatedLabelWidth(text: string, fontSize: number): number {
  const units = Array.from(text).reduce((total, character) => {
    if (character === ' ') return total + 0.35
    return total + (character.charCodeAt(0) > 0xff ? 1 : 0.62)
  }, 0)
  return Math.max(fontSize, units * fontSize)
}

function labelBoundsOverlap(left: LabelBounds, right: LabelBounds): boolean {
  const gap = 3
  return left.left < right.right + gap
    && left.right + gap > right.left
    && left.top < right.bottom + gap
    && left.bottom + gap > right.top
}
