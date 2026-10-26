// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import LearningStarChart from './LearningStarChart.vue'
import { projectCelestialPoint, projectLearningStars, type LearningChartStar } from './projection'

describe('learning celestial projection', () => {
  it('keeps adjacent stars close across the RA wrap and preserves north-up, east-left orientation', () => {
    const west = projectCelestialPoint({ raDeg: 359, decDeg: 0 }, { raDeg: 0, decDeg: 0 })!
    const east = projectCelestialPoint({ raDeg: 1, decDeg: 0 }, { raDeg: 0, decDeg: 0 })!
    const north = projectCelestialPoint({ raDeg: 0, decDeg: 1 }, { raDeg: 0, decDeg: 0 })!
    expect(west.x).toBeGreaterThan(0)
    expect(east.x).toBeLessThan(0)
    expect(west.x).toBeCloseTo(-east.x, 10)
    expect(Math.abs(east.x)).toBeCloseTo(2 * Math.tan(Math.PI / 360), 10)
    expect(north.x).toBeCloseTo(0, 10)
    expect(north.y).toBeLessThan(0)
  })

  it('uses spherical geometry at the pole instead of flattening right ascension', () => {
    const center = { raDeg: 0, decDeg: 90 }
    const expectedRadius = 2 * Math.tan(5 * Math.PI / 180)
    const points = [0, 90, 180, 270].map((raDeg) => projectCelestialPoint({ raDeg, decDeg: 80 }, center)!)
    for (const point of points) expect(Math.hypot(point.x, point.y)).toBeCloseTo(expectedRadius, 10)
    expect(points[0].x).toBeCloseTo(0, 10)
    expect(points[0].y).toBeGreaterThan(0)
    expect(points[1].x).toBeLessThan(0)
    expect(points[1].y).toBeCloseTo(0, 10)
    const pole = projectCelestialPoint({ raDeg: 217, decDeg: 90 }, center)!
    expect(Math.hypot(pole.x, pole.y)).toBeCloseTo(0, 10)
  })

  it('rotates the view without mirroring or changing angular geometry', () => {
    const star = { raDeg: 65, decDeg: 21 }
    const center = { raDeg: 30, decDeg: 45 }
    const original = projectCelestialPoint(star, center)!
    const rotated = projectCelestialPoint(star, center, 90)!
    expect(rotated.x).toBeCloseTo(-original.y, 10)
    expect(rotated.y).toBeCloseTo(original.x, 10)
    expect(Math.hypot(rotated.x, rotated.y)).toBeCloseTo(Math.hypot(original.x, original.y), 10)
  })

  it('handles wide fields, invalid input, and the unprojectable antipode explicitly', () => {
    expect(projectCelestialPoint({ raDeg: 120, decDeg: 0 }, { raDeg: 0, decDeg: 0 })).not.toBeNull()
    expect(projectCelestialPoint({ raDeg: 180, decDeg: 0 }, { raDeg: 0, decDeg: 0 })).toBeNull()
    expect(projectCelestialPoint({ raDeg: NaN, decDeg: 0 }, { raDeg: 0, decDeg: 0 })).toBeNull()
    expect(projectCelestialPoint({ raDeg: 0, decDeg: 91 }, { raDeg: 0, decDeg: 0 })).toBeNull()
  })

  it('fits every valid star within a narrow screen at every lesson rotation', () => {
    const stars = [sampleStar('a', 359, 80), sampleStar('b', 60, 65), sampleStar('c', 190, 75)]
    for (let variant = 0; variant < 6; variant += 1) {
      const points = projectLearningStars(stars, { raDeg: 0, decDeg: 85 }, 280, 340, variant, 50)
      expect(points).toHaveLength(stars.length)
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(49.999)
        expect(point.x).toBeLessThanOrEqual(230.001)
        expect(point.y).toBeGreaterThanOrEqual(49.999)
        expect(point.y).toBeLessThanOrEqual(290.001)
      }
    }
  })

  it('centers a one-star exercise and supports an empty exercise', () => {
    const center = { raDeg: 0, decDeg: 0 }
    expect(projectLearningStars([sampleStar('a', 20, 10)], center, 500, 400)[0]).toMatchObject({ x: 250, y: 200 })
    expect(projectLearningStars([], center, 500, 400)).toEqual([])
  })
})

describe('learning chart recall controls', () => {
  it('switches appearance without moving stars or revealing answers, and remembers the selection', async () => {
    const key = 'astro-sky-learning-render-mode'
    const previous = localStorage.getItem(key)
    localStorage.removeItem(key)
    const root = document.createElement('div')
    const selected: string[] = []
    const props = {
      stars: [{ ...sampleStar('target', 10, 20), magnitude: 4, name: '隐藏的星名', aliases: ['隐藏的别名'] }, sampleStar('other', 20, 30)],
      paths: [['target', 'other']], centerRaDeg: 10, centerDecDeg: 20,
      showLabels: false, showLines: false, disabled: true,
      onSelect: (id: string) => selected.push(id),
    }
    let app = createApp({ render: () => h(LearningStarChart, props) })
    const modeButton = (name: string) => [...root.querySelectorAll('button')].find(node => node.textContent === name)!
    const positions = () => [...root.querySelectorAll('[data-star-id]')].map(node => node.getAttribute('transform'))
    try {
      app.mount(root); await nextTick()
      const originalPositions = positions()
      expect(modeButton('自然星空').getAttribute('aria-pressed')).toBe('true')
      modeButton('清晰认星').click(); await nextTick()
      expect(root.querySelector('.learning-chart')!.classList.contains('is-clear')).toBe(true)
      expect(root.querySelector('.learning-chart__core')!.getAttribute('fill')).not.toContain('url(')
      expect(positions()).toEqual(originalPositions)
      expect(root.innerHTML).not.toContain('隐藏的星名')
      expect(root.innerHTML).not.toContain('隐藏的别名')
      expect(root.querySelector('.learning-chart__lines')).toBeNull()
      expect(selected).toEqual([])
      expect(localStorage.getItem(key)).toBe('clear')
      app.unmount()
      app = createApp({ render: () => h(LearningStarChart, props) })
      app.mount(root); await nextTick()
      expect(modeButton('清晰认星').getAttribute('aria-pressed')).toBe('true')
      modeButton('自然星空').click(); await nextTick()
      expect(root.querySelector('.learning-chart__core')!.getAttribute('fill')).toContain('url(')
      expect(positions()).toEqual(originalPositions)
      expect(localStorage.getItem(key)).toBe('natural')
    } finally {
      app.unmount()
      if (previous === null) localStorage.removeItem(key)
      else localStorage.setItem(key, previous)
    }
  })

  it('uses independent light profiles for multiple charts and keeps faint stars easy to select', async () => {
    const root = document.createElement('div')
    const selected: string[] = []
    const props = {
      stars: [{ ...sampleStar('faint', 0, 0), magnitude: 5.5 }],
      paths: [], centerRaDeg: 0, centerDecDeg: 0, showLabels: false, showLines: false,
      onSelect: (id: string) => selected.push(id),
    }
    const app = createApp({ render: () => h('div', [h(LearningStarChart, props), h(LearningStarChart, props)]) })
    try {
      app.mount(root); await nextTick()
      const profiles = [...root.querySelectorAll('radialGradient')].map(node => node.id)
      expect(new Set(profiles).size).toBe(profiles.length)
      for (const core of root.querySelectorAll('.learning-chart__core')) {
        const profileId = core.getAttribute('fill')!.slice(5, -1)
        expect(profiles).toContain(profileId)
      }
      const svg = root.querySelector('svg')!
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 489.6 } as DOMRect)
      // Tap well outside the tiny visible core but inside the unchanged large
      // interaction area. Both selection and an outside miss must be reliable.
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 380, clientY: 245 }))
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 390, clientY: 245 }))
      expect(selected).toEqual(['faint'])
    } finally { app.unmount() }
  })

  it('only labels the requested learning targets even when surrounding background stars are visible', async () => {
    const root = document.createElement('div')
    const app = createApp({ render: () => h(LearningStarChart, {
      stars: [ { ...sampleStar('target', 10, 20), name: '目标星名' }, { ...sampleStar('background', 12, 22), name: '不应显示的背景名' } ],
      paths: [], centerRaDeg: 10, centerDecDeg: 20, showLabels: true, showLines: true, labelIds: ['target'],
    }) })
    try {
      app.mount(root); await nextTick()
      expect(root.textContent).toContain('目标星名')
      expect(root.innerHTML).not.toContain('不应显示的背景名')
    } finally { app.unmount() }
  })
  it('omits answers from text and accessibility attributes and accepts keyboard selection', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const selected: string[] = []
    const star = { ...sampleStar('HIP:11767', 37.95, 89.26), name: '北极星', aliases: ['勾陈一'] }
    const app = createApp({ render: () => h(LearningStarChart, {
      stars: [star], paths: [], centerRaDeg: 0, centerDecDeg: 85,
      showLabels: false, showLines: false, highlightId: star.id,
      onSelect: (id: string) => selected.push(id),
    }) })
    try {
      app.mount(root)
      await nextTick()
      expect(root.innerHTML).not.toContain('北极星')
      expect(root.innerHTML).not.toContain('勾陈一')
      const button = root.querySelector('[role="button"]')!
      expect(button.getAttribute('aria-label')).toBe('星点 1，待辨认的目标')
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      expect(selected).toEqual([star.id, star.id])
    } finally {
      app.unmount()
      root.remove()
    }
  })

  it('shows names during study and suppresses selection when disabled', async () => {
    const root = document.createElement('div')
    const selected: string[] = []
    const app = createApp({ render: () => h(LearningStarChart, {
      stars: [{ ...sampleStar('HIP:91262', 279.23, 38.78), name: '织女一' }],
      paths: [], centerRaDeg: 280, centerDecDeg: 39, showLabels: true, showLines: true, disabled: true,
      onSelect: (id: string) => selected.push(id),
    }) })
    try {
      app.mount(root)
      await nextTick()
      expect(root.textContent).toContain('织女一')
      const button = root.querySelector('[role="button"]')!
      expect(button.getAttribute('tabindex')).toBe('-1')
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(selected).toEqual([])
    } finally {
      app.unmount()
    }
  })
})

function sampleStar(id: string, raDeg: number, decDeg: number): LearningChartStar {
  return { id, raDeg, decDeg, name: id, aliases: [], magnitude: 2 }
}
