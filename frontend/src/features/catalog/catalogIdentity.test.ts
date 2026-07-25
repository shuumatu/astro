import { describe, expect, it } from 'vitest'
import { catalogIdentityForSelection, catalogSelectionAction, sameSkyObject } from './catalogIdentity'
import type { SkyObjectSelection } from '../sky-map/types'

describe('catalogIdentityForSelection', () => {
  it('uses stable keys for stars, Solar System bodies, and culture figures', () => {
    expect(catalogIdentityForSelection(selection('star', { id: 'HIP:91262', hipId: 91262 }), 'western-iau'))
      .toEqual({ objectType: 'star', objectKey: 'HIP:91262' })
    expect(catalogIdentityForSelection(selection('solarSystemBody', { id: 'moon' }), 'western-iau'))
      .toEqual({ objectType: 'solar-system-body', objectKey: 'solar-system:moon' })
    expect(catalogIdentityForSelection(selection('cultureFigure', { id: 'constellation-lyr' }), 'western-iau'))
      .toEqual({ objectType: 'culture-figure', objectKey: 'culture:western-iau:constellation-lyr' })
  })

  it('compares selections by stable kind and object id', () => {
    expect(sameSkyObject(selection('star', { id: 'HIP:1' }), selection('star', { id: 'HIP:1' }))).toBe(true)
    expect(sameSkyObject(selection('star', { id: 'HIP:1' }), selection('star', { id: 'HIP:2' }))).toBe(false)
  })

  it('selects on the first click and opens on the second click of the same object', () => {
    const vega = selection('star', { id: 'HIP:91262' })
    expect(catalogSelectionAction(null, vega)).toBe('select')
    expect(catalogSelectionAction(vega, selection('star', { id: 'HIP:91262' }))).toBe('open')
    expect(catalogSelectionAction(vega, null)).toBe('clear')
  })
})

function selection(kind: SkyObjectSelection['kind'], object: Record<string, unknown>): SkyObjectSelection {
  return { kind, object } as unknown as SkyObjectSelection
}
