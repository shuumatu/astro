import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { MeteorShowerScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new MeteorShowerScene(container, options)
}

const demoModule: DemoSceneModule = {
  createScene,
}

export default demoModule
