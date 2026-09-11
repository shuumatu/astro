import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { MoonScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new MoonScene(container, options)
}

const demoModule: DemoSceneModule = {
  createScene,
}

export default demoModule
