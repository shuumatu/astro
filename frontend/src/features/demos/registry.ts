import type { DemoSceneModule } from './types'

export interface DemoDefinition {
  slug: string
  titleKey: string
  summaryKey: string
  loadScene: () => Promise<DemoSceneModule>
}

export const demos: DemoDefinition[] = [
  {
    slug: 'meteor-shower',
    titleKey: 'demos.items.meteorShower.title',
    summaryKey: 'demos.items.meteorShower.summary',
    loadScene: () => import('./scenes/meteor-shower/index'),
  },
]

export function findDemo(slug: string): DemoDefinition | null {
  return demos.find((demo) => demo.slug === slug) ?? null
}
