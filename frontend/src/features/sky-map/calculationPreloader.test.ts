import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalculationPreloader } from './calculationPreloader'

afterEach(() => {
  vi.useRealTimers()
})

describe('CalculationPreloader', () => {
  it('preloads results and serves a later calculation from cache', async () => {
    vi.useFakeTimers()
    const calculate = vi.fn(async (value: number) => value * 2)
    const preloader = new CalculationPreloader(calculate, String, { preloadDelayMs: 10 })

    preloader.preload([2, 3])
    await vi.runAllTimersAsync()

    expect(calculate).toHaveBeenCalledTimes(2)
    await expect(preloader.calculate(2)).resolves.toBe(4)
    expect(calculate).toHaveBeenCalledTimes(2)
  })

  it('keeps warming the queue when a live calculation hits cache', async () => {
    vi.useFakeTimers()
    const calculate = vi.fn(async (value: number) => value * 2)
    const preloader = new CalculationPreloader(calculate, String, { preloadDelayMs: 10 })

    preloader.preload([1, 2, 3])
    await vi.advanceTimersByTimeAsync(10)
    await expect(preloader.calculate(1)).resolves.toBe(2)
    await vi.runAllTimersAsync()

    expect(calculate.mock.calls.map(([value]) => value)).toEqual([1, 2, 3])
  })

  it('cancels queued background work when a live calculation arrives', async () => {
    vi.useFakeTimers()
    const calculate = vi.fn(async (value: number) => value)
    const preloader = new CalculationPreloader(calculate, String, { preloadDelayMs: 10 })

    preloader.preload([1, 2, 3])
    await expect(preloader.calculate(9)).resolves.toBe(9)
    await vi.runAllTimersAsync()

    expect(calculate).toHaveBeenCalledOnce()
    expect(calculate).toHaveBeenCalledWith(9)
  })

  it('deduplicates concurrent calculations for the same parameters', async () => {
    let resolve!: (value: number) => void
    const result = new Promise<number>((resolvePromise) => { resolve = resolvePromise })
    const calculate = vi.fn(() => result)
    const preloader = new CalculationPreloader(calculate, String)

    const first = preloader.calculate(4)
    const second = preloader.calculate(4)
    resolve(8)

    await expect(first).resolves.toBe(8)
    await expect(second).resolves.toBe(8)
    expect(calculate).toHaveBeenCalledOnce()
  })

  it('prunes frames outside the latest preload window', async () => {
    vi.useFakeTimers()
    const calculate = vi.fn(async (value: number) => value)
    const preloader = new CalculationPreloader(calculate, String, { preloadDelayMs: 10 })

    preloader.preload([1, 2])
    await vi.runAllTimersAsync()
    await preloader.calculate(9)
    preloader.preload([10, 11])
    await vi.runAllTimersAsync()
    await preloader.calculate(1)

    expect(calculate.mock.calls.map(([value]) => value)).toEqual([1, 2, 9, 10, 11, 1])
  })
})
