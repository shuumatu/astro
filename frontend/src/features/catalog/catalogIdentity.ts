import type { SkyObjectSelection } from '../sky-map/types'
import type { CatalogObjectType } from './types'

export interface CatalogIdentity {
  objectType: CatalogObjectType
  objectKey: string
}

export function catalogIdentityForSelection(
  selection: SkyObjectSelection,
  cultureId: string,
): CatalogIdentity {
  if (selection.kind === 'star') {
    return { objectType: 'star', objectKey: `HIP:${selection.object.hipId}` }
  }
  if (selection.kind === 'solarSystemBody') {
    return { objectType: 'solar-system-body', objectKey: `solar-system:${selection.object.id}` }
  }
  return {
    objectType: 'culture-figure',
    objectKey: `culture:${cultureId}:${selection.object.id}`,
  }
}

export function sameSkyObject(
  left: SkyObjectSelection | null,
  right: SkyObjectSelection | null,
): boolean {
  return left !== null && right !== null && left.kind === right.kind && left.object.id === right.object.id
}

export function catalogSelectionAction(
  current: SkyObjectSelection | null,
  next: SkyObjectSelection | null,
): 'clear' | 'select' | 'open' {
  if (!next) return 'clear'
  return sameSkyObject(current, next) ? 'open' : 'select'
}
