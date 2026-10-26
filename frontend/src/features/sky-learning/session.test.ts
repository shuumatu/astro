import { describe, expect, it } from 'vitest'
import { acceptsStarName, createLessonSession, createReviewSession, exposeTargets, RECENT_EXPOSURE_MS, wasRecentlyExposed, validateContentReferences } from './session'
import { lessons, chineseLessons, stars } from './content'
import { makeEmptyArchive, recordAttempt, exportBackup, parseBackup } from './repository'

describe('sky learning sessions', () => {
  it('accepts reviewed aliases but not partial names or empty input', () => {
    const star = { id: 'test', name: '河鼓二', aliases: ['牛郎星', 'Altair'], raDeg: 0, decDeg: 0, magnitude: 0, colorIndex: null }
    expect(acceptsStarName(star, ' ＡＬＴＡＩＲ ')).toBe(true)
    expect(acceptsStarName(star, '牛郎星')).toBe(true)
    expect(acceptsStarName(star, '牛郎')).toBe(false)
    expect(acceptsStarName(star, '')).toBe(false)
  })
  it('uses independent stable units for locate and recall, with unique question instances', () => {
    const lesson = lessons.find(item => item.targetIds.length > 0)!
    const first = createLessonSession(lesson.id)
    const second = createLessonSession(lesson.id)
    expect(first.questions).toHaveLength(lesson.targetIds.length * 2)
    expect(first.questions[0].unitId).toBe(second.questions[0].unitId)
    expect(first.questions[0].id).not.toBe(second.questions[0].id)
    expect(first.phase).toBe('study')
  })
  it('reviews only learned due units without a study page revealing names first', () => {
    const lesson = lessons.find(item => item.targetIds.length > 0)!
    const targetId = lesson.targetIds[0]
    const now = Date.now()
    const archive = recordAttempt(makeEmptyArchive(), { id: 'attempt', unitId: `${targetId}:locate`, lessonId: lesson.id,
      skill: 'locate', correct: false, hinted: false, exposed: false, answeredAt: now }, targetId)
    expect(createReviewSession(archive, now)).toBeNull()
    const review = createReviewSession(archive, now + 24 * 60 * 60 * 1000)!
    expect(review.questions).toHaveLength(1)
    expect(review.phase).toBe('question')
    expect(review.exposedTargetIds).toEqual([])
  })
  it('rejects stale content references before restoring a session', () => {
    expect(stars.length).toBeGreaterThan(20)
    const archive = makeEmptyArchive()
    archive.completedLessonIds = ['unknown']
    expect(() => validateContentReferences(archive)).toThrow()
  })
  it('keeps recent exposure across closed sessions without counting it as independent recall', () => {
    const now = Date.now()
    const archive = exposeTargets(makeEmptyArchive(), ['HIP:11767'], now)
    expect(wasRecentlyExposed(archive, 'HIP:11767', now + 10_000)).toBe(true)
    expect(wasRecentlyExposed(archive, 'HIP:11767', now - 10_000)).toBe(true)
    expect(wasRecentlyExposed(archive, 'HIP:11767', now + RECENT_EXPOSURE_MS)).toBe(false)
    expect(wasRecentlyExposed(archive, 'HIP:91262', now)).toBe(false)
  })

  it('shares a physical star review card across routes and restores both course histories', () => {
    const chinese = chineseLessons.find(lesson => lesson.targetIds.includes('HIP:11767'))!
    const now = Date.now()
    let archive = recordAttempt(makeEmptyArchive(), { id: 'western', unitId: 'HIP:11767:name', lessonId: 'polaris',
      skill: 'name', correct: true, hinted: false, exposed: false, answeredAt: now }, 'HIP:11767')
    archive = exposeTargets(archive, ['HIP:11767'], now)
    archive = recordAttempt(archive, { id: 'chinese', unitId: 'HIP:11767:name', lessonId: chinese.id,
      skill: 'name', correct: true, hinted: false, exposed: wasRecentlyExposed(archive, 'HIP:11767', now + 1000), answeredAt: now + 1000 }, 'HIP:11767')
    archive.completedLessonIds = [lessons[0].id, chineseLessons[0].id]
    const restored = parseBackup(exportBackup(archive))
    expect(() => validateContentReferences(restored)).not.toThrow()
    expect(Object.keys(restored.cards)).toEqual(['HIP:11767:name'])
    expect(restored.cards['HIP:11767:name']).toMatchObject({ reviews: 2, successes: 1, lessonId: chinese.id })
    const review = createReviewSession(restored, restored.cards['HIP:11767:name'].dueAt)!
    expect(review.lessonId).toBe(chinese.id)
    expect(review.questions).toHaveLength(1)
  })
})
