import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { RefractorScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new RefractorScene(container, options)
}

const demoModule: DemoSceneModule = { createScene }
export default demoModule
