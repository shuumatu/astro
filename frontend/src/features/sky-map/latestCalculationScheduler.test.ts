import { describe, expect, it, vi } from 'vitest'
import { LatestCalculationScheduler } from './latestCalculationScheduler'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

describe('LatestCalculationScheduler', () => {
  it('starts immediately and publishes the result', async () => {
    const onResult = vi.fn()
    const scheduler = new LatestCalculationScheduler(
      async (value: number) => value * 2,
      onResult,
      vi.fn(),
    )

    scheduler.request(3)
    await flushPromises()

    expect(onResult).toHaveBeenCalledOnce()
    expect(onResult).toHaveBeenCalledWith(6)
  })

  it('keeps only the newest request while a calculation is running', async () => {
    const first = deferred<number>()
    const latest = deferred<number>()
    const calculate = vi.fn((value: number) => value === 1 ? first.promise : latest.promise)
    const onResult = vi.fn()
    const scheduler = new LatestCalculationScheduler(calculate, onResult, vi.fn())

    scheduler.request(1)
    scheduler.request(2)
    scheduler.request(3)

    expect(calculate).toHaveBeenCalledTimes(1)
    expect(calculate).toHaveBeenLastCalledWith(1)

    first.resolve(10)
    await flushPromises()

    expect(calculate).toHaveBeenCalledTimes(2)
    expect(calculate).toHaveBeenLastCalledWith(3)
    expect(onResult).not.toHaveBeenCalled()

    latest.resolve(30)
    await flushPromises()

    expect(onResult).toHaveBeenCalledOnce()
    expect(onResult).toHaveBeenCalledWith(30)
  })

  it('ignores a result after disposal', async () => {
    const calculation = deferred<number>()
    const onResult = vi.fn()
    const onError = vi.fn()
    const scheduler = new LatestCalculationScheduler(
      () => calculation.promise,
      onResult,
      onError,
    )

    scheduler.request(1)
    scheduler.dispose()
    calculation.resolve(1)
    await flushPromises()

    expect(onResult).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}
