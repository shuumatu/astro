interface CalculationPreloaderOptions {
  maximumEntries?: number
  preloadDelayMs?: number
}

export class CalculationPreloader<TParameters, TResult> {
  private readonly cache = new Map<string, TResult>()
  private readonly pending = new Map<string, Promise<TResult>>()
  private readonly preloadQueue: TParameters[] = []
  private readonly queuedKeys = new Set<string>()
  private readonly maximumEntries: number
  private readonly preloadDelayMs: number
  private preloadTimer: ReturnType<typeof setTimeout> | null = null
  private retainedKey: string | null = null
  private disposed = false

  constructor(
    private readonly calculateUncached: (parameters: TParameters) => Promise<TResult>,
    private readonly keyFor: (parameters: TParameters) => string,
    options: CalculationPreloaderOptions = {},
  ) {
    this.maximumEntries = options.maximumEntries ?? 16
    this.preloadDelayMs = options.preloadDelayMs ?? 60
  }

  calculate(parameters: TParameters): Promise<TResult> {
    const key = this.keyFor(parameters)
    this.retainedKey = key
    if (this.cache.has(key) || this.pending.has(key)) return this.getOrCalculate(parameters)
    this.cancelQueuedPreloads()
    return this.getOrCalculate(parameters)
  }

  preload(parameters: TParameters[]): void {
    if (this.disposed) return
    if (this.preloadTimer !== null) clearTimeout(this.preloadTimer)
    this.preloadTimer = null
    this.preloadQueue.length = 0
    this.queuedKeys.clear()
    const desiredKeys = new Set(parameters.map((item) => this.keyFor(item)))
    for (const key of this.cache.keys()) {
      if (key !== this.retainedKey && !desiredKeys.has(key)) this.cache.delete(key)
    }
    for (const item of parameters) {
      const key = this.keyFor(item)
      if (this.cache.has(key) || this.pending.has(key) || this.queuedKeys.has(key)) continue
      this.preloadQueue.push(item)
      this.queuedKeys.add(key)
    }
    this.scheduleNextPreload()
  }

  dispose(): void {
    this.disposed = true
    this.cancelQueuedPreloads()
    this.cache.clear()
    this.retainedKey = null
  }

  private getOrCalculate(parameters: TParameters): Promise<TResult> {
    const key = this.keyFor(parameters)
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, cached)
      return Promise.resolve(cached)
    }
    const existing = this.pending.get(key)
    if (existing) return existing
    const calculation = this.calculateUncached(parameters)
      .then((result) => {
        if (!this.disposed) this.store(key, result)
        return result
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, calculation)
    return calculation
  }

  private store(key: string, result: TResult): void {
    this.cache.delete(key)
    this.cache.set(key, result)
    while (this.cache.size > this.maximumEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined
      if (oldestKey === undefined) break
      this.cache.delete(oldestKey)
    }
  }

  private scheduleNextPreload(): void {
    if (this.disposed || this.preloadTimer !== null || this.preloadQueue.length === 0) return
    this.preloadTimer = setTimeout(() => {
      this.preloadTimer = null
      const parameters = this.preloadQueue.shift()
      if (!parameters || this.disposed) return
      this.queuedKeys.delete(this.keyFor(parameters))
      void this.getOrCalculate(parameters)
        .catch(() => undefined)
        .finally(() => this.scheduleNextPreload())
    }, this.preloadDelayMs)
  }

  private cancelQueuedPreloads(): void {
    if (this.preloadTimer !== null) clearTimeout(this.preloadTimer)
    this.preloadTimer = null
    this.preloadQueue.length = 0
    this.queuedKeys.clear()
  }
}
