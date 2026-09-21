import type { DemoScene, DemoSceneModule, DemoSceneOptions } from '../../types'
import { StellarEvolutionScene } from './scene'

export function createScene(container: HTMLElement, options?: DemoSceneOptions): DemoScene {
  return new StellarEvolutionScene(container, options)
}

const demoModule: DemoSceneModule = {
  createScene,
}

export default demoModule
