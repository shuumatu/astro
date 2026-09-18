import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { EclipseScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new EclipseScene(container, options)
}

const demoModule: DemoSceneModule = {
  createScene,
}

export default demoModule
