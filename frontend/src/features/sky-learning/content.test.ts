import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { constellations, coreConstellations, lessons, roadmap, sources, sourceVersion, stages, stars } from './content'
import learningData from './learning-stars.json'
import { projectLearningStars } from './projection'
import { createLessonSession, validateContentReferences } from './session'
import { exportBackup, makeEmptyArchive, parseBackup } from './repository'

describe('sky learning content', () => {
  it('preserves real catalog coordinates, epochs, magnitudes and measured colors for every displayed star', () => {
    const catalog = JSON.parse(gunzipSync(readFileSync(new URL(
      '../../../../backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/catalog.json.gz', import.meta.url,
    ))).toString('utf8')) as {
      stars: { id: string; raDeg: number; decDeg: number; visualMagnitude: number; colorIndex: number | null; epochYear: number }[]
    }
    const supplement = JSON.parse(readFileSync(new URL('../../../../tools/catalog/learning-star-supplement.json', import.meta.url), 'utf8')) as typeof catalog
    const original = new Map([...catalog.stars, ...supplement.stars].map((star) => [star.id, star]))
    expect(new Set(stars.map((star) => star.id)).size).toBe(stars.length)
    for (const star of stars) {
      const source = original.get(star.id)
      expect(source, star.id).toBeDefined()
      expect([star.raDeg, star.decDeg, star.magnitude, star.epochYear], star.id)
        .toEqual([source!.raDeg, source!.decDeg, source!.visualMagnitude, source!.epochYear])
      expect(star.colorIndex, star.id).toBe(Number.isFinite(source!.colorIndex) ? source!.colorIndex : null)
      expect(star.colorIndex === null || Number.isFinite(star.colorIndex), star.id).toBe(true)
    }
  })

  it('retains warm and cool reference stars while keeping missing colors unknown', () => {
    const byId = new Map(stars.map((star) => [star.id, star]))
    expect(byId.get('HIP:27989')?.colorIndex).toBe(1.5) // Betelgeuse
    expect(byId.get('HIP:24436')?.colorIndex).toBe(-0.03) // Rigel
    expect(byId.get('HIP:80763')?.colorIndex).toBe(1.865) // Antares
    expect(byId.get('HIP:91262')?.colorIndex).toBe(-0.001) // Vega
    expect(byId.get('HIP:26220')?.colorIndex).toBeNull()
  })

  it('has complete lesson references and distinct answer targets, with no quiz on orientation-only lessons', () => {
    const ids = new Set(stars.map((star) => star.id))
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length)
    for (const lesson of lessons) {
      const visible = new Set(lesson.starIds)
      expect(visible.size, lesson.id).toBe(lesson.starIds.length)
      expect(lesson.targetIds.length, lesson.id).toBeLessThanOrEqual(3)
      expect(new Set(lesson.targetIds).size, lesson.id).toBe(lesson.targetIds.length)
      expect(lesson.kind, lesson.id).toBe(lesson.targetIds.length ? 'stars' : 'orientation')
      for (const id of lesson.starIds) expect(ids.has(id), `${lesson.id}: ${id}`).toBe(true)
      for (const id of [...lesson.targetIds, ...lesson.paths.flat()]) {
        expect(visible.has(id), `${lesson.id}: invisible target or path ${id}`).toBe(true)
      }
      expect(stages.find((stage) => stage.id === lesson.stage)?.lessonIds).toContain(lesson.id)
    }
    expect(lessons[0].kind).toBe('orientation')
    expect(lessons[0].targetIds).toEqual([])
  })

  it('keeps each chart inside an 85-degree field radius, including the polar and RA-wrap lessons', () => {
    const byId = new Map(stars.map((star) => [star.id, star]))
    const rad = Math.PI / 180
    for (const lesson of lessons) {
      for (const id of lesson.starIds) {
        const star = byId.get(id)!
        const cosDistance = Math.sin(star.decDeg * rad) * Math.sin(lesson.centerDecDeg * rad)
          + Math.cos(star.decDeg * rad) * Math.cos(lesson.centerDecDeg * rad)
          * Math.cos((star.raDeg - lesson.centerRaDeg) * rad)
        expect(cosDistance, `${lesson.id}: ${id} near/behind projection horizon`).toBeGreaterThan(Math.cos(85 * rad))
      }
    }
  })

  it('introduces all 21 core constellations in the documented curriculum order', () => {
    const expected = ['UMa', 'UMi', 'Cas', 'Ori', 'CMa', 'CMi', 'Tau', 'Aur', 'Gem', 'Boo', 'Vir', 'Leo', 'Lyr', 'Cyg', 'Aql', 'Sco', 'Sgr', 'Peg', 'And', 'Per', 'PsA']
    expect([...new Set(lessons.slice(0, 19).flatMap((lesson) => lesson.constellationIds))]).toEqual(expected)
    expect(coreConstellations.map((constellation) => constellation.code)).toEqual(expected)
    expect(roadmap.map((stage) => [stage.constellationCount, stage.status])).toEqual([[21, 'available'], [55, 'available'], [88, 'available']])
  })

  it('binds the first 20 names to physical stars rather than ambiguous translated aliases', () => {
    const expected = [11767, 53910, 54061, 27989, 24436, 32349, 37279, 21421, 24608, 36850, 37826, 69673, 65474, 49669, 57632, 91262, 102098, 97649, 80763, 113368]
      .map((id) => `HIP:${id}`)
    const targets = [...new Set(lessons.slice(0, 19).flatMap((lesson) => lesson.targetIds))]
    expect(targets.sort()).toEqual(expected.sort())
    const byId = new Map(stars.map((star) => [star.id, star]))
    expect(byId.get('HIP:54061')?.name).toBe('天枢')
    expect(byId.get('HIP:11767')?.name).toBe('北极星')
    expect(byId.get('HIP:11767')?.aliases).toContain('勾陈一')
    expect(byId.get('HIP:97649')?.aliases).toContain('牛郎星')
    expect(byId.get('HIP:91262')?.aliases).toContain('织女星')
    expect(new Set(targets.map((id) => byId.get(id)!.name)).size).toBe(20)
  })

  it('keeps the original course IDs and saved sessions compatible as new courses are appended', () => {
    const originalIds = ['chart-basics', 'dipper-pointers', 'polaris', 'cassiopeia-shape', 'ursa-major-context', 'orion', 'winter-dogs', 'taurus', 'auriga', 'gemini', 'winter-connections', 'spring-arc', 'leo', 'summer-triangle', 'scorpius', 'sagittarius-teapot', 'pegasus-square', 'andromeda-perseus', 'fomalhaut']
    expect(lessons.slice(0, 19).map(lesson => lesson.id)).toEqual(originalIds)
    const archive = makeEmptyArchive()
    archive.completedLessonIds = originalIds
    for (const id of originalIds) {
      archive.session = createLessonSession(id)
      expect(() => validateContentReferences(parseBackup(exportBackup(archive))), id).not.toThrow()
    }
  })

  it('extends the documented route to exactly 88 distinct constellations, with no empty or reordered chapters', () => {
    const neighbors = ['Cep', 'Dra', 'Cam', 'Lyn', 'CVn', 'Com', 'CrB', 'Crv', 'Crt', 'Hya', 'Sex', 'LMi', 'Her', 'Oph', 'Ser', 'Lib', 'Sct', 'Sge', 'Del', 'Vul', 'CrA', 'Ari', 'Tri', 'Psc', 'Aqr', 'Cap', 'Equ', 'Lac', 'Cet', 'Cnc', 'Mon', 'Lep', 'Col', 'Eri']
    const south = ['Cru', 'Cen', 'Mus', 'TrA', 'Cir', 'Lup', 'Ara', 'Nor', 'Car', 'Vel', 'Pup', 'Pyx', 'Ant', 'Vol', 'Pic', 'Phe', 'Scl', 'For', 'Hor', 'Cae', 'Ret', 'Dor', 'Hyi', 'Gru', 'Tuc', 'Pav', 'Ind', 'Mic', 'Tel', 'Aps', 'Cha', 'Oct', 'Men']
    const expected = [...coreConstellations.map(item => item.code), ...neighbors, ...south]
    expect(new Set(expected).size).toBe(88)
    expect([...new Set(lessons.flatMap(lesson => lesson.constellationIds))]).toEqual(expected)
    expect(constellations.map(item => item.code)).toEqual(expected)
    expect(stages.flatMap(stage => stage.lessonIds)).toEqual(lessons.map(lesson => lesson.id))
    for (const stage of stages) expect(stage.lessonIds.length, stage.id).toBeGreaterThan(0)
    for (const figure of learningData.figures.filter(item => !coreConstellations.some(core => core.code === item.code))) {
      const shown = new Set(lessons.filter(lesson => lesson.constellationIds.includes(figure.code)).flatMap(lesson => lesson.paths.flat()))
      for (const id of figure.paths.flat()) expect(shown.has(id), `${figure.code}: missing figure vertex ${id}`).toBe(true)
    }
  })

  it('binds new named targets to verified catalog identities and keeps answer names unambiguous within each lesson', () => {
    const names: Record<string, string> = {
      'HIP:58001': '天玑', 'HIP:59774': '天权', 'HIP:62956': '玉衡', 'HIP:65378': '开阳', 'HIP:67301': '摇光',
      'HIP:26727': '参宿一', 'HIP:26311': '参宿二', 'HIP:25930': '参宿三',
      'HIP:113963': '室宿一', 'HIP:113881': '室宿二', 'HIP:1067': '壁宿一', 'HIP:677': '壁宿二',
      'HIP:5447': '奎宿九', 'HIP:15863': '天船三', 'HIP:14576': '大陵五', 'HIP:7588': '水委一',
      'HIP:60718': '十字架二', 'HIP:61084': '十字架一', 'HIP:71683': '南门二', 'HIP:68702': '马腹一',
      'HIP:30438': '老人星', 'HIP:109268': '鹤一', 'HIP:100751': '孔雀十一',
    }
    const byId = new Map(stars.map(star => [star.id, star]))
    const targets = new Set(lessons.flatMap(lesson => lesson.targetIds))
    for (const [id, name] of Object.entries(names)) {
      expect(targets.has(id), name).toBe(true)
      expect(byId.get(id)?.name, id).toBe(name)
    }
    for (const lesson of lessons) {
      const names = lesson.targetIds.map(id => byId.get(id)!.name)
      expect(new Set(names).size, lesson.id).toBe(names.length)
      expect(names.some(name => name.startsWith('HIP:')), lesson.id).toBe(false)
    }
  })

  it('can project and restore every new lesson, including southern polar charts and mixed reviews', () => {
    const byId = new Map(stars.map(star => [star.id, star]))
    for (const lesson of lessons.slice(19)) {
      for (const variant of [0, 3]) {
        const projected = projectLearningStars(lesson.starIds.map(id => byId.get(id)!), { raDeg: lesson.centerRaDeg, decDeg: lesson.centerDecDeg }, 800, 560, variant)
        expect(projected.length, lesson.id).toBe(lesson.starIds.length)
        for (const star of projected) {
          expect(Number.isFinite(star.x) && Number.isFinite(star.y), `${lesson.id}: ${star.id}`).toBe(true)
          expect(star.x).toBeGreaterThanOrEqual(59.99)
          expect(star.x).toBeLessThanOrEqual(740.01)
          expect(star.y).toBeGreaterThanOrEqual(59.99)
          expect(star.y).toBeLessThanOrEqual(500.01)
        }
      }
      const archive = makeEmptyArchive()
      archive.session = createLessonSession(lesson.id)
      expect(archive.session.questions.length, lesson.id).toBe(lesson.targetIds.length * 2)
      expect(() => validateContentReferences(parseBackup(exportBackup(archive))), lesson.id).not.toThrow()
    }
  })

  it('retains attribution and source versions for reproducible bundled teaching data', () => {
    expect(sourceVersion.catalog).toBeTruthy()
    expect(sourceVersion.western).toBeTruthy()
    expect(sourceVersion.chinese).toBeTruthy()
    expect(sources.some((source) => source.title === 'Hipparcos Catalogue')).toBe(true)
    expect(sources.some((source) => source.title === 'Stellarium Western sky culture')).toBe(true)
    expect(sources.some((source) => source.title === 'Stellarium Chinese sky culture')).toBe(true)
    for (const source of sources) expect(source.url).toMatch(/^https:\/\//)
  })
})
