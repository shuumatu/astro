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
  /**
   * Selenographic longitude of the point the Sun is directly over, in degrees east.
   *
   * This is the one angle a real Sun position needs: it places the terminator, where the Sun sits
   * on the surface, and it is what the moon's phase is measured against. Deliberately the *only*
   * angle control - see `sunDirectionFor` in the Moon scene for what fixing the Sun's latitude
   * costs and what it buys.
   */
  sunLongitudeDeg?: number
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
  /**
   * Surface panoramas published for this feature, in the order the viewer should offer them.
   *
   * Only the identifiers and locale keys travel here: the imagery itself is the demo's business,
   * and the shell only has to decide whether to offer the button and which entry to open first.
   * An empty list means the feature genuinely has no panorama, which the interface states rather
   * than hiding, so a viewer is not left wondering whether they missed something.
   */
  panoramas?: DemoPanoramaReference[]
}

/** One browsable panorama, as the shell needs to see it. */
export interface DemoPanoramaReference {
  id: string
  /** Locale key for the translated title. */
  titleKey: string
  /** Locale key for the translated caption. */
  captionKey: string
  /** Credit line for the imagery, shown beside the panorama itself. */
  credit: string
  licence: string
}

export interface DemoSceneOptions {
  onLabels?: (anchors: DemoLabelAnchor[]) => void
  onPhaseChange?: (phase: DemoPhase) => void
  onRadiantResolved?: (radiant: DemoRadiant) => void
  /** Reports the feature the viewer drilled into, or null when they are back in the overview. */
  onHotspot?: (hotspot: DemoHotspot | null) => void
  onReadout?: (readout: DemoReadout | null) => void
  /**
   * Reports settings the scene resolved for itself, so the shell's controls show the values actually
   * in use rather than the placeholders they were initialised with. A scene that derives a value from
   * the world - the Moon's Sun position, which depends on the date the page was opened - cannot know
   * it at registry-definition time, and without this the slider and the lighting disagree.
   */
  onSettingsResolved?: (settings: Partial<DemoSceneSettings>) => void
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
