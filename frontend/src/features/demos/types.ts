export interface DemoSceneSettings {
  playing: boolean
  timeScale: number
  showOrbits: boolean
  showLabels: boolean
}

export interface DemoLabelAnchor {
  id: string
  x: number
  y: number
  visible: boolean
}

/**
 * `orbit` is the free-look overview, `cinematic` is a scripted camera move that takes over
 * from the user, and `surface` hands rendering over to the ground-level viewer.
 */
export type DemoPhase = 'orbit' | 'cinematic' | 'surface'

export interface DemoRadiant {
  /** Altitude of the radiant above the local horizon at the observing site, in degrees. */
  altitudeDeg: number
}

export interface DemoSceneOptions {
  onLabels?: (anchors: DemoLabelAnchor[]) => void
  onPhaseChange?: (phase: DemoPhase) => void
  onRadiantResolved?: (radiant: DemoRadiant) => void
}

export interface DemoScene {
  applySettings(settings: Partial<DemoSceneSettings>): void
  resetView(): void
  dispose(): void
  /** Leaves the ground-level view and returns to the orbital overview. */
  leaveSurfaceView?(): void
  /** Stops or restarts rendering, e.g. while the tab is hidden. */
  setSuspended?(suspended: boolean): void
}

export interface DemoSceneModule {
  createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene
}

export const DEFAULT_DEMO_SETTINGS: DemoSceneSettings = {
  playing: true,
  timeScale: 0.3,
  showOrbits: true,
  showLabels: true,
}
