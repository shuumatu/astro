import { describe, expect, it } from 'vitest'
import { eclipseGuideWindow, firstTotalContact, GUIDE_SYSTEM_FOCUS, guideFocusStrength } from './guide'
import { lunarEclipseTiming, lunarGeometryAt, nextLunarEclipses } from './ephemeris'
import { lunarPhaseWindows } from './geometry'
import type { EclipsePhaseBand } from './types'

const peakMs = 12_000_000
const bands: EclipsePhaseBand[] = [
  { kind: 'partial', startMs: 0, endMs: 24_000_000 },
  { kind: 'total', startMs: 11_000_000, endMs: 13_000_000 },
]

describe('eclipse tour cues', () => {
  it('joins partial and total chapters at the same contact instant', () => {
    const partial = eclipseGuideWindow('solar-partial', peakMs, bands)
    const total = eclipseGuideWindow('solar-total', peakMs, bands)
    expect(partial.startMs).toBeGreaterThan(bands[0]!.startMs)
    expect(partial.endMs).toBe(bands[1]!.startMs)
    expect(total.startMs).toBe(partial.endMs)
    expect(total.endMs).toBe(peakMs)
  })

  it('holds the system explanation on peak and never reverses a short phase', () => {
    expect(eclipseGuideWindow('inclination', peakMs, bands)).toEqual({ startMs: peakMs, endMs: peakMs })
    const short = eclipseGuideWindow('lunar-total', peakMs, [
      { kind: 'total', startMs: peakMs - 1000, endMs: peakMs + 1000 },
    ])
    expect(short.endMs).toBeGreaterThanOrEqual(short.startMs)
  })

  it('focuses physical objects in system chapters without altering the phase', () => {
    expect(GUIDE_SYSTEM_FOCUS['solar-alignment']).toContain('umbra')
    expect(GUIDE_SYSTEM_FOCUS['lunar-alignment']).toContain('earth')
    expect(GUIDE_SYSTEM_FOCUS.inclination).toContain('ascendingNode')
    expect(GUIDE_SYSTEM_FOCUS['solar-total']).toBeUndefined()
    expect(guideFocusStrength(0)).toBeCloseTo(0.7)
    expect(guideFocusStrength(0.5)).toBeCloseTo(1)
    expect(guideFocusStrength(1)).toBeCloseTo(0.7)
  })

  it('opens the lunar partial chapter after the Moon has entered the live umbra', () => {
    const event = nextLunarEclipses(Date.UTC(2026, 8, 18), 12).find((candidate) => candidate.kind === 'total')!
    const timing = lunarEclipseTiming(event.peakMs)
    const windows = lunarPhaseWindows({
      peakMs: timing.peakMs,
      penumbralSemiDurationMinutes: timing.penumbralSemiDurationMinutes,
      partialSemiDurationMinutes: timing.partialSemiDurationMinutes,
      totalSemiDurationMinutes: timing.totalSemiDurationMinutes,
    })
    const bands: EclipsePhaseBand[] = [
      { kind: 'partial', ...windows.partial! },
      { kind: 'total', ...windows.total! },
    ]
    const contact = firstTotalContact(windows.partial!.startMs, timing.peakMs,
      (timeMs) => lunarGeometryAt(timeMs).kind === 'total')
    const aligned = bands.map((band) => band.kind === 'total' ? { ...band, startMs: contact } : band)
    const window = eclipseGuideWindow('lunar-partial', timing.peakMs, aligned)
    const total = eclipseGuideWindow('lunar-total', timing.peakMs, aligned)
    expect(lunarGeometryAt(window.startMs).kind).toBe('partial')
    expect(lunarGeometryAt(window.startMs).umbraCoverage).toBeGreaterThan(0)
    expect(window.endMs).toBe(total.startMs)
    expect(lunarGeometryAt(total.startMs - 2000).kind).toBe('partial')
    expect(lunarGeometryAt(total.startMs).kind).toBe('total')
  })
})
