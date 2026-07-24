import { describe, expect, it } from 'vitest'
import { parseSkyTargetQuery } from './targetSearch'
import type { SolarSystemBodyId } from './types'

const CHINESE_NAMES: Record<SolarSystemBodyId, string> = {
  sun: '太阳',
  moon: '月球',
  mercury: '水星',
  venus: '金星',
  mars: '火星',
  jupiter: '木星',
  saturn: '土星',
  uranus: '天王星',
  neptune: '海王星',
}

describe('parseSkyTargetQuery', () => {
  it.each(['HIP 97675', 'hip:97675', '97675'])(
    'parses the HIP query %s',
    (query) => {
      expect(parse(query)).toEqual({ kind: 'star', hipId: 97675 })
    },
  )

  it('parses a localized Solar System body name', () => {
    expect(parse('火星')).toEqual({ kind: 'solarSystemBody', id: 'mars' })
  })

  it('parses stable body identifiers case-insensitively', () => {
    expect(parse('  NEPTUNE  ')).toEqual({ kind: 'solarSystemBody', id: 'neptune' })
  })

  it.each(['', 'HIP 0', 'not-a-target'])(
    'rejects the invalid query %s',
    (query) => {
      expect(parse(query)).toEqual({ kind: 'invalid' })
    },
  )
})

function parse(query: string) {
  return parseSkyTargetQuery(query, (id) => CHINESE_NAMES[id])
}
