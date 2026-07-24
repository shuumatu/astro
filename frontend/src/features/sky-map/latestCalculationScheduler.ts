export class LatestCalculationScheduler<TParameters, TResult> {
  private pendingParameters: TParameters | null = null
  private running = false
  private disposed = false

  constructor(
    private readonly calculate: (parameters: TParameters) => Promise<TResult>,
    private readonly onResult: (result: TResult) => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  request(parameters: TParameters): void {
    if (this.disposed) return
    this.pendingParameters = parameters
    if (!this.running) void this.drain()
  }

  dispose(): void {
    this.disposed = true
    this.pendingParameters = null
  }

  private async drain(): Promise<void> {
    if (this.running || this.disposed) return
    this.running = true
    try {
      while (!this.disposed && this.pendingParameters !== null) {
        const parameters = this.pendingParameters
        this.pendingParameters = null
        const result = await this.calculate(parameters)
        if (!this.disposed && this.pendingParameters === null) this.onResult(result)
      }
    } catch (error) {
      if (!this.disposed) this.onError(error)
    } finally {
      this.running = false
      if (!this.disposed && this.pendingParameters !== null) void this.drain()
    }
  }
}
