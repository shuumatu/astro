import type { Component } from 'vue'
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

export interface DemoLightingDefinition {
  azimuthRange: { min: number, max: number, step: number }
  elevationRange: { min: number, max: number, step: number }
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
  /** Present when a scene lets the viewer position its principal light directly. */
  lighting?: DemoLightingDefinition
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
  /** Optional panel listing every feature the demo can focus, with its locale keys. */
  panel?: () => Promise<{ default: Component }>
  panelTitleKey?: string
  features?: DemoFeatureDefinition[]
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
      lightAzimuthDeg: 315,
      lightElevationDeg: 28,
      fullBright: false,
    },
    controls: ['labels', 'grid'],
    // This is now a terrain inspection tool: direct hillshade controls replace calendar time.
    transport: false,
    brightnessRange: { min: 0.4, max: 2.2, step: 0.1 },
    lighting: {
      azimuthRange: { min: 0, max: 359, step: 1 },
      elevationRange: { min: 5, max: 90, step: 1 },
    },
    panelTitleKey: 'demos.items.moon.panelTitle',
    panel: () => import('./components/DemoFeaturePanel.vue'),
    features: MOON_FEATURES.map((feature) => ({
      id: feature.id,
      titleKey: featureTitleKey(feature.id),
      categoryKey: featureCategoryKey(feature.category),
    })),
  },
]

export function findDemo(slug: string): DemoDefinition | null {
  return demos.find((demo) => demo.slug === slug) ?? null
}
