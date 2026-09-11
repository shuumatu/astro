export interface DemoSceneSettings {
  playing: boolean
  timeScale: number
  showOrbits: boolean
  showLabels: boolean
  /**
   * Selenographic graticule. Optional because only demos that need a coordinate frame
   * declare it, and their definitions are the only places that render the toggle.
   */
  showGrid?: boolean
  /** Multiplier on the scene's lighting, 1 being the modelled brightness. */
  brightness?: number
  /** User-controlled light direction around the currently inspected surface point. */
  lightAzimuthDeg?: number
  /** Height of that light above the inspected point's local horizon. */
  lightElevationDeg?: number
  /** Removes the terminator while retaining a small directional term for readable relief. */
  fullBright?: boolean
}

export interface DemoLabelAnchor {
  id: string
  x: number
  y: number
  visible: boolean
  /**
   * Locale key for this label. Scenes that omit it fall back to `demos.scene.<id>`, which is
   * how the meteor shower demo names its fixed set of labels.
   */
  textKey?: string
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

/** A short live readout a scene wants shown next to its hint, e.g. the simulated lunar phase. */
export interface DemoReadout {
  key: string
  params?: Record<string, string | number>
  /**
   * Simulated instant the readout describes, as epoch milliseconds. The view formats it with
   * the active interface language so the scene never has to know about locales.
   */
  timestampMs?: number
}

/** The feature a viewer drilled into, with the facts the info card should show. */
export interface DemoHotspot {
  id: string
  /** Short facts that need no translation, such as coordinates and diameter. */
  facts: string[]
}

export interface DemoSceneOptions {
  onLabels?: (anchors: DemoLabelAnchor[]) => void
  onPhaseChange?: (phase: DemoPhase) => void
  onRadiantResolved?: (radiant: DemoRadiant) => void
  /** Reports the feature the viewer drilled into, or null when they are back in the overview. */
  onHotspot?: (hotspot: DemoHotspot | null) => void
  onReadout?: (readout: DemoReadout | null) => void
}

export interface DemoScene {
  applySettings(settings: Partial<DemoSceneSettings>): void
  resetView(): void
  dispose(): void
  /** Leaves the ground-level view and returns to the orbital overview. */
  leaveSurfaceView?(): void
  /** Stops or restarts rendering, e.g. while the tab is hidden. */
  setSuspended?(suspended: boolean): void
  /** Flies the camera down to a named feature and starts orbiting it. */
  focusHotspot?(id: string): void
  /** Returns to the overview without changing the demo's settings. */
  clearFocus?(): void
  /** Runs a demo-declared action button, e.g. a lunar phase preset. */
  runAction?(id: string): void
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
