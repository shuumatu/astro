import { describe, expect, it } from 'vitest'
import { layoutSolarSystemLabels } from './solarSystemLabels'
import type { SolarSystemLabelInput, SolarSystemLabelLayout } from './solarSystemLabels'

describe('layoutSolarSystemLabels', () => {
  it('separates clustered mobile labels', () => {
    const labels = layoutSolarSystemLabels([
      input('sun', '太阳', 220, 170),
      input('jupiter', '木星', 226, 170),
      input('mars', '火星', 146, 168),
      input('uranus', '天王星', 140, 168),
    ], 343)

    expect(overlappingPairs(labels)).toEqual([])
    expect(labels.some((label) => label.displaced)).toBe(true)
  })

  it('keeps longer English labels inside the chart', () => {
    const labels = layoutSolarSystemLabels([
      input('mercury', 'Mercury', 320, 180, 'end'),
      input('neptune', 'Neptune', 337, 180, 'end'),
      input('jupiter', 'Jupiter', 324, 180, 'end'),
    ], 343)

    expect(overlappingPairs(labels)).toEqual([])
    for (const label of labels) {
      expect(label.bounds.left).toBeGreaterThanOrEqual(4)
      expect(label.bounds.right).toBeLessThanOrEqual(339)
      expect(label.bounds.top).toBeGreaterThanOrEqual(4)
      expect(label.bounds.bottom).toBeLessThanOrEqual(339)
    }
  })
})

function input(
  id: SolarSystemLabelInput['id'],
  text: string,
  x: number,
  y: number,
  anchor: SolarSystemLabelInput['anchor'] = 'start',
): SolarSystemLabelInput {
  return { id, text, anchor, radius: 5, point: { x, y } }
}

function overlappingPairs(labels: SolarSystemLabelLayout[]): string[][] {
  const overlaps: string[][] = []
  for (let left = 0; left < labels.length; left += 1) {
    for (let right = left + 1; right < labels.length; right += 1) {
      const first = labels[left].bounds
      const second = labels[right].bounds
      if (first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top) {
        overlaps.push([labels[left].text, labels[right].text])
      }
    }
  }
  return overlaps
}
