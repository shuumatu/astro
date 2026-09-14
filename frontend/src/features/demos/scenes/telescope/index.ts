import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { TelescopeScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new TelescopeScene(container, options)
}

const demoModule: DemoSceneModule = { createScene }
export default demoModule
