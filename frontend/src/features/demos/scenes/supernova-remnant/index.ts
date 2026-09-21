import type { DemoSceneOptions } from '../../types'
import { RemnantScene } from './scene'
export function createScene(container: HTMLElement, options?: DemoSceneOptions) {
  return new RemnantScene(container, options)
}
