import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  allLessons, chineseFigures, chineseLessons, chineseStages, isChineseLesson,
  lessons, starForLesson, stars,
} from './content'
import { projectLearningStars } from './projection'
import { exportBackup, makeEmptyArchive, parseBackup } from './repository'
import { acceptsStarName, createLessonSession, validateContentReferences } from './session'

interface CultureName { language: string; value: string; preferred?: boolean }
interface CultureFigure { id: string; type: string; names: CultureName[]; paths: string[][] }
const culture = JSON.parse(readFileSync(new URL(
  '../../../../tools/catalog/sky-content/cultures/chinese-traditional.json', import.meta.url,
), 'utf8')) as {
  figures: CultureFigure[]
  starNames: { objectId: string; names: CultureName[] }[]
}
const sourceFigureById = new Map(culture.figures.map(figure => [figure.id, figure]))
const starById = new Map(stars.map(star => [star.id, star]))
const traditionalNames = new Map(culture.starNames.map(star => [
  star.objectId, star.names.find(name => name.language === 'zh-CN' && name.preferred)?.value,
]))
const mansionGroups = [
  { stage: 'cn-dragon', names: ['角', '亢', '氐', '房', '心', '尾', '箕'] },
  { stage: 'cn-tortoise', names: ['斗', '牛', '女', '虚', '危', '室', '壁'] },
  { stage: 'cn-tiger', names: ['奎', '娄', '胃', '昴', '毕', '觜', '参'] },
  { stage: 'cn-bird', names: ['井', '鬼', '柳', '星', '张', '翼', '轸'] },
]

describe('Chinese sky learning content', () => {
  it('adds a separate 41-lesson route with seven ordered stages and globally unique IDs', () => {
    expect(lessons).toHaveLength(104)
    expect(chineseLessons).toHaveLength(41)
    expect(allLessons).toHaveLength(145)
    expect(allLessons.slice(0, lessons.length)).toEqual(lessons)
    expect(new Set(allLessons.map(lesson => lesson.id)).size).toBe(allLessons.length)
    expect(chineseStages.map(stage => stage.id)).toEqual([
      'cn-foundations', 'cn-enclosures', 'cn-dragon', 'cn-tortoise',
      'cn-tiger', 'cn-bird', 'cn-asterisms',
    ])
    expect(chineseStages.map(stage => stage.lessonIds.length)).toEqual([2, 6, 7, 7, 7, 7, 5])
    expect(chineseStages.flatMap(stage => stage.lessonIds)).toEqual(chineseLessons.map(lesson => lesson.id))
    for (const lesson of chineseLessons) {
      expect(lesson.id).toMatch(/^cn-/)
      expect(isChineseLesson(lesson), lesson.id).toBe(true)
      expect(lesson.constellationIds, lesson.id).toEqual([])
    }
  })

  it('teaches all 28 mansions once in the traditional four-symbol sequence', () => {
    const seen: string[] = []
    for (const group of mansionGroups) {
      const groupLessons = chineseLessons.filter(lesson => lesson.stage === group.stage)
      const names = groupLessons.map(lesson => {
        const mansions = lesson.asterismIds!.map(id => sourceFigureById.get(id)!)
          .filter(figure => figure.type === 'lunar-mansion')
        expect(mansions, lesson.id).toHaveLength(1)
        seen.push(mansions[0].id)
        return mansions[0].names.find(name => name.language === 'zh-CN')!.value
      })
      expect(names, group.stage).toEqual(group.names.map(name => `${name}宿`))
    }
    expect(new Set(seen).size).toBe(28)
    expect([...seen].sort()).toEqual(culture.figures.filter(figure => figure.type === 'lunar-mansion').map(figure => figure.id).sort())
  })

  it('preserves the complete source paths of 28 mansions, six enclosure walls and 14 representative asterisms', () => {
    const representatives = [39, 40, 41, 65, 83, 93, 149, 213, 232, 234, 263, 266, 268, 304]
      .map(number => `asterism-${String(number).padStart(3, '0')}`)
    const expectedIds = culture.figures.filter(figure =>
      figure.type === 'lunar-mansion' || figure.type === 'enclosure-wall' || representatives.includes(figure.id),
    ).map(figure => figure.id)
    expect(chineseFigures).toHaveLength(48)
    expect(chineseFigures.map(figure => figure.id).sort()).toEqual(expectedIds.sort())
    const coveredIds = new Set(chineseLessons.flatMap(lesson => lesson.asterismIds!))
    expect([...coveredIds].sort()).toEqual([...expectedIds].sort())
    for (const figure of chineseFigures) {
      const source = sourceFigureById.get(figure.id)!
      expect(figure.type, figure.id).toBe(source.type)
      expect(figure.name, figure.id).toBe(source.names.find(name => name.language === 'zh-CN')!.value)
      expect(figure.paths, figure.id).toEqual(source.paths)
      for (const id of figure.paths.flat()) expect(starById.has(id), `${figure.id}: ${id}`).toBe(true)
    }
  })

  it('uses actual Chinese figure vertices for every named target and keeps all lesson references valid', () => {
    for (const lesson of chineseLessons) {
      const sourcePaths = lesson.asterismIds!.flatMap(id => {
        expect(sourceFigureById.has(id), `${lesson.id}: ${id}`).toBe(true)
        return sourceFigureById.get(id)!.paths
      })
      expect(lesson.paths, lesson.id).toEqual(sourcePaths)
      const vertices = new Set(sourcePaths.flat())
      const visible = new Set(lesson.starIds)
      expect(visible.size, lesson.id).toBe(lesson.starIds.length)
      expect(lesson.targetIds.length, lesson.id).toBeLessThanOrEqual(3)
      expect(new Set(lesson.targetIds).size, lesson.id).toBe(lesson.targetIds.length)
      expect(lesson.kind, lesson.id).toBe(lesson.targetIds.length ? 'stars' : 'orientation')
      for (const id of lesson.starIds) expect(starById.has(id), `${lesson.id}: ${id}`).toBe(true)
      for (const id of vertices) expect(visible.has(id), `${lesson.id}: invisible vertex ${id}`).toBe(true)
      for (const id of lesson.targetIds) {
        expect(vertices.has(id), `${lesson.id}: background star used as target ${id}`).toBe(true)
        const traditionalName = traditionalNames.get(id)
        expect(traditionalName, `${lesson.id}: unnamed target ${id}`).toBeTruthy()
        expect(starById.get(id)?.traditionalName, id).toBe(traditionalName)
        expect(starForLesson(id, lesson)?.name, id).toBe(traditionalName)
      }
      const targetNames = lesson.targetIds.map(id => starForLesson(id, lesson)!.name)
      expect(new Set(targetNames).size, `${lesson.id}: ambiguous target labels`).toBe(targetNames.length)
    }
  })

  it('keeps every Chinese field within 85 degrees and fits all rotation variants without clipping stars', () => {
    const rad = Math.PI / 180
    for (const lesson of chineseLessons) {
      const field = lesson.starIds.map(id => starById.get(id)!)
      for (const star of field) {
        const cosDistance = Math.sin(star.decDeg * rad) * Math.sin(lesson.centerDecDeg * rad)
          + Math.cos(star.decDeg * rad) * Math.cos(lesson.centerDecDeg * rad)
          * Math.cos((star.raDeg - lesson.centerRaDeg) * rad)
        expect(cosDistance, `${lesson.id}: ${star.id} outside field`).toBeGreaterThan(Math.cos(85 * rad))
      }
      for (let variant = 0; variant < 6; variant += 1) {
        const projected = projectLearningStars(field,
          { raDeg: lesson.centerRaDeg, decDeg: lesson.centerDecDeg }, 800, 560, variant)
        expect(projected.length, `${lesson.id}: rotation ${variant}`).toBe(field.length)
        for (const star of projected) {
          expect(Number.isFinite(star.x) && Number.isFinite(star.y), `${lesson.id}: ${star.id}`).toBe(true)
          expect(star.x).toBeGreaterThanOrEqual(59.99)
          expect(star.x).toBeLessThanOrEqual(740.01)
          expect(star.y).toBeGreaterThanOrEqual(59.99)
          expect(star.y).toBeLessThanOrEqual(500.01)
        }
      }
    }
  })

  it('creates and restores every Chinese session alongside existing completed courses', () => {
    for (const lesson of chineseLessons) {
      const archive = makeEmptyArchive()
      archive.completedLessonIds = [lessons[0].id, lesson.id]
      archive.session = createLessonSession(lesson.id)
      expect(archive.session.questions, lesson.id).toHaveLength(lesson.targetIds.length * 2)
      expect(archive.session.questions.map(question => question.targetId), lesson.id)
        .toEqual([...lesson.targetIds, ...lesson.targetIds])
      const restored = parseBackup(exportBackup(archive))
      expect(restored.session, lesson.id).toEqual(archive.session)
      expect(() => validateContentReferences(restored), lesson.id).not.toThrow()
    }
  })

  it('uses traditional labels in Chinese lessons without mutating Western names or accepted aliases', () => {
    const chinese = chineseLessons.find(lesson => lesson.targetIds.includes('HIP:11767'))!
    const polaris = lessons.find(lesson => lesson.id === 'polaris')!
    const dipper = chineseLessons.find(lesson => lesson.asterismIds!.includes('asterism-039'))!
    expect(chinese).toBeDefined()
    expect(dipper).toBeDefined()
    const chinesePole = starForLesson('HIP:11767', chinese)!
    expect(chinesePole.name).toBe('勾陈一')
    expect(starForLesson('HIP:11767', polaris)?.name).toBe('北极星')
    expect(starForLesson('HIP:54061', dipper)?.name).toBe('北斗一')
    expect(starForLesson('HIP:54061', polaris)?.name).toBe('天枢')
    expect(starById.get('HIP:11767')?.name).toBe('北极星')
    expect(starById.get('HIP:54061')?.name).toBe('天枢')
    expect(acceptsStarName(chinesePole, '勾陈一')).toBe(true)
    expect(acceptsStarName(chinesePole, '北极星')).toBe(true)
    expect(acceptsStarName(starForLesson('HIP:11767', polaris)!, '勾陈一')).toBe(true)
  })
})
