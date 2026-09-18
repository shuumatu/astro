import type { Component } from 'vue'
import type { DemoGuideDefinition } from './guide'
import { featureCategoryKey, featureTitleKey, MOON_FEATURES } from './scenes/moon/hotspots'
import type { DemoSceneModule, DemoSceneSettings } from './types'

/** Display toggles a demo can ask the top bar to render. */
export type DemoControlId = 'orbits' | 'labels' | 'grid'

/** Locale keys for those toggles, kept here so the shell and the tests share one list. */
export const CONTROL_LABEL_KEYS: Record<DemoControlId, string> = {
  orbits: 'demos.controls.orbits',
  labels: 'demos.controls.labels',
  grid: 'demos.controls.grid',
}

export interface DemoActionDefinition {
  id: string
  labelKey: string
}

export interface DemoFeatureDefinition {
  id: string
  titleKey: string
  categoryKey: string
}

export interface DemoDefinition {
  slug: string
  titleKey: string
  summaryKey: string
  loadScene: () => Promise<DemoSceneModule>
  /** Starting settings; anything omitted comes from DEFAULT_DEMO_SETTINGS. */
  defaultSettings?: Partial<DemoSceneSettings>
  /** Toggles to show, in order. Defaults to the meteor shower's orbit and label switches. */
  controls?: DemoControlId[]
  /** One-shot buttons, such as the lunar phase presets. */
  actions?: DemoActionDefinition[]
  /** Unit shown beside the time slider. Defaults to years per second. */
  speedUnitKey?: string
  /** Slider bounds. Defaults suit the meteor shower's years per second. */
  speedRange?: { min: number; max: number; step: number }
  /** Whether to show the playback and time-speed bar. Defaults to yes. */
  transport?: boolean
  /** Present when the demo exposes a brightness slider. */
  brightnessRange?: { min: number; max: number; step: number }
  /**
   * Present when the demo places its principal light by a single angle. The bounds are over the
   * selenographic longitude the light stands above, so a full turn is 0-359 degrees.
   */
  sunLongitudeRange?: { min: number; max: number; step: number }
  /** Corner hint. Defaults to the meteor shower's wording about its amber marker. */
  hintKey?: string
  /** Message shown while a scripted camera move runs. Defaults to the meteor shower's wording. */
  cinematicKey?: string | null
  /** Locale key for the data-source line under the stage. */
  creditKey?: string
  /**
   * Full-screen overlay for the `surface` phase. The overlay receives `active` and, for demos
   * that publish one, `radiantAltitudeDeg`.
   */
  surfaceOverlay?: () => Promise<{ default: Component }>
  /**
   * Full-screen overlay for browsing a feature's surface panoramas, opened from the hotspot
   * card. Unlike `surfaceOverlay` it is driven by the viewer rather than by the phase, so it
   * receives `active`, the selected hotspot and a way to pause the scene behind it.
   */
  panoramaOverlay?: () => Promise<{ default: Component }>
  /** Locale key for the label on the hotspot card's button that opens the panorama viewer. */
  panoramaButtonKey?: string
  /** Locale key for the note shown on the card when the feature has no panorama. */
  panoramaNoneKey?: string
  /** Optional panel listing every feature the demo can focus, with its locale keys. */
  panel?: () => Promise<{ default: Component }>
  panelTitleKey?: string
  features?: DemoFeatureDefinition[]
  /**
   * Full control surface for a demo whose switches do not fit the shared chips.
   *
   * Unlike `panel`, which lists features, this is the demo's own cockpit: it is mounted inside the
   * stage, receives the state the scene published through `DemoSceneOptions.onState`, and sends
   * commands back with `DemoScene.runCommand`. The shell neither reads the state nor names a
   * command, so a demo can grow its own controls without the shell learning its vocabulary.
   */
  controlPanel?: () => Promise<{ default: Component }>
  /** Optional subtitle timeline. Cues are implemented by this demo's scene. */
  guide?: DemoGuideDefinition
}

export const demos: DemoDefinition[] = [
  {
    slug: 'meteor-shower',
    titleKey: 'demos.items.meteorShower.title',
    summaryKey: 'demos.items.meteorShower.summary',
    loadScene: () => import('./scenes/meteor-shower/index'),
    surfaceOverlay: () => import('./components/MeteorSurfaceOverlay.vue'),
    creditKey: 'demos.items.meteorShower.credit',
  },
  {
    slug: 'moon',
    titleKey: 'demos.items.moon.title',
    summaryKey: 'demos.items.moon.summary',
    hintKey: 'demos.items.moon.hint',
    // Keep the opening camera move, but leave the image unobstructed while it runs.
    cinematicKey: null,
    creditKey: 'demos.items.moon.credit',
    loadScene: () => import('./scenes/moon/index'),
    defaultSettings: {
      playing: false,
      timeScale: 0.1,
      showLabels: true,
      showGrid: false,
      brightness: 1,
      fullBright: false,
      // `sunLongitudeDeg` is deliberately absent: the scene fills it in from the real Sun position
      // for today's date, and a value here would overwrite that with a placeholder.
    },
    controls: ['labels', 'grid'],
    // This is a terrain inspection tool: one Sun-longitude control replaces calendar time.
    transport: false,
    brightnessRange: { min: 0.4, max: 2.2, step: 0.1 },
    sunLongitudeRange: { min: 0, max: 359, step: 1 },
    panelTitleKey: 'demos.items.moon.panelTitle',
    panel: () => import('./components/DemoFeaturePanel.vue'),
    panoramaOverlay: () => import('./components/DemoPanoramaOverlay.vue'),
    panoramaButtonKey: 'demos.items.moon.panorama.open',
    panoramaNoneKey: 'demos.items.moon.panorama.none',
    features: MOON_FEATURES.map((feature) => ({
      id: feature.id,
      titleKey: featureTitleKey(feature.id),
      categoryKey: featureCategoryKey(feature.category),
    })),
  },
  {
    slug: 'eclipses',
    titleKey: 'demos.items.eclipses.title',
    summaryKey: 'demos.items.eclipses.summary',
    hintKey: 'demos.items.eclipses.hint',
    creditKey: 'demos.items.eclipses.credit',
    loadScene: () => import('./scenes/eclipse/index'),
    guide: {
      titleKey: 'demos.items.eclipses.guide.title',
      steps: [
        { id: 'solar-alignment', subtitleKey: 'demos.items.eclipses.guide.solarAlignment', durationMs: 6500 },
        { id: 'solar-partial', subtitleKey: 'demos.items.eclipses.guide.solarPartial', durationMs: 8000 },
        { id: 'solar-total', subtitleKey: 'demos.items.eclipses.guide.solarTotal', durationMs: 8000 },
        { id: 'lunar-alignment', subtitleKey: 'demos.items.eclipses.guide.lunarAlignment', durationMs: 7000 },
        { id: 'lunar-partial', subtitleKey: 'demos.items.eclipses.guide.lunarPartial', durationMs: 8000 },
        { id: 'lunar-total', subtitleKey: 'demos.items.eclipses.guide.lunarTotal', durationMs: 8500 },
        { id: 'inclination', subtitleKey: 'demos.items.eclipses.guide.inclination', durationMs: 7000 },
      ],
    },
    controlPanel: () => import('./scenes/eclipse/EclipseControlPanel.vue'),
    defaultSettings: {
      playing: true,
      // Minutes of simulated time per second of wall clock: an eclipse unfolds over hours.
      timeScale: 1.5,
      showOrbits: true,
      showLabels: true,
    },
    /**
     * The eclipse panel carries every display switch - section, view, shadow cones, labels, the
     * orbital plane and the teaching assumption - so the shared chips stay out of its way. Only the
     * transport, reset and fullscreen controls remain in the shell.
     */
    controls: [],
    speedUnitKey: 'demos.items.eclipses.speedValue',
    speedRange: { min: 0.1, max: 20, step: 0.1 },
  },
  {
    slug: 'telescope-newtonian',
    titleKey: 'demos.items.telescope.title',
    summaryKey: 'demos.items.telescope.summary',
    hintKey: 'demos.items.telescope.hint',
    creditKey: 'demos.items.telescope.credit',
    loadScene: () => import('./scenes/telescope/index'),
    defaultSettings: { playing: false, timeScale: 0, showLabels: true, showOrbits: false },
    controls: ['labels'],
    transport: false,
  },
  {
    slug: 'telescope-refractor',
    titleKey: 'demos.items.refractor.title',
    summaryKey: 'demos.items.refractor.summary',
    hintKey: 'demos.items.refractor.hint',
    creditKey: 'demos.items.refractor.credit',
    loadScene: () => import('./scenes/refractor/index'),
    defaultSettings: { playing: false, timeScale: 0, showLabels: true, showOrbits: false },
    controls: ['labels'],
    transport: false,
  },
]

export function findDemo(slug: string): DemoDefinition | null {
  return demos.find((demo) => demo.slug === slug) ?? null
}
