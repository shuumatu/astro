import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DAY_MS,
  MAX_BACKUP_BYTES,
  RETRY_DELAY_MS,
  LearningStorageError,
  exportBackup,
  isIndependentSuccess,
  loadArchive,
  makeEmptyArchive,
  parseBackup,
  recordAttempt,
  saveArchive,
  type LearningArchive,
  type LearningAttempt,
} from './repository'

const START = Date.UTC(2026, 9, 23, 8)
const TARGET = 'HIP:11767'
const UNIT = `${TARGET}:locate`

function answer(overrides: Partial<LearningAttempt> = {}): LearningAttempt {
  return {
    id: 'answer-1',
    unitId: UNIT,
    lessonId: 'north-polaris',
    skill: 'locate',
    correct: true,
    hinted: false,
    exposed: false,
    answeredAt: START,
    ...overrides,
  }
}

function firstArchive(): LearningArchive {
  return recordAttempt(makeEmptyArchive(START), answer(), TARGET)
}

function rawBackup(archive: unknown): string {
  return JSON.stringify({ format: 'astro-sky-learning', version: 1, archive })
}

afterEach(() => vi.unstubAllGlobals())

describe('provisional local review scheduling', () => {
  it('records independent success without mutating the previous archive', () => {
    const before = makeEmptyArchive(START)
    const result = recordAttempt(before, answer(), TARGET)
    expect(before.attempts).toEqual([])
    expect(before.cards).toEqual({})
    expect(result.revision).toBe(0)
    expect(result.cards[UNIT]).toMatchObject({ reviews: 1, successes: 1, intervalDays: 1, dueAt: START + DAY_MS })
  })

  it('advances only due independent reviews through the provisional intervals', () => {
    let archive = firstArchive()
    for (const interval of [3, 7, 14, 30, 30]) {
      const answeredAt = archive.cards[UNIT]!.dueAt
      archive = recordAttempt(archive, answer({ id: `answer-${archive.attempts.length + 1}`, answeredAt }), TARGET)
      expect(archive.cards[UNIT]).toMatchObject({ intervalDays: interval, dueAt: answeredAt + interval * DAY_MS })
    }
    expect(archive.cards[UNIT]!.successes).toBe(6)
  })

  it('does not inflate the interval or postpone review when an answer is repeated early', () => {
    const initial = firstArchive()
    const repeated = recordAttempt(initial, answer({ id: 'again', answeredAt: START + 60_000 }), TARGET)
    expect(repeated.cards[UNIT]).toMatchObject({ intervalDays: 1, dueAt: initial.cards[UNIT]!.dueAt, reviews: 2 })
    const due = recordAttempt(repeated, answer({ id: 'tomorrow', answeredAt: START + DAY_MS }), TARGET)
    expect(due.cards[UNIT]!.intervalDays).toBe(3)
    const twoDaysEarly = recordAttempt(due, answer({ id: 'early', answeredAt: START + 2 * DAY_MS }), TARGET)
    expect(twoDaysEarly.cards[UNIT]!.intervalDays).toBe(3)
    expect(twoDaysEarly.cards[UNIT]!.dueAt).toBe(START + 4 * DAY_MS)
  })

  it.each([{ correct: false }, { hinted: true }])('retries a wrong or hinted answer without counting independent success: %j', (flags) => {
    const archive = recordAttempt(makeEmptyArchive(START), answer(flags), TARGET)
    expect(archive.cards[UNIT]).toMatchObject({ intervalDays: 0, dueAt: START + RETRY_DELAY_MS, successes: 0, reviews: 1 })
  })

  it('schedules a correct exposed answer tomorrow without treating it as independent recall', () => {
    const archive = recordAttempt(makeEmptyArchive(START), answer({ exposed: true }), TARGET)
    expect(archive.cards[UNIT]).toMatchObject({ intervalDays: 1, dueAt: START + DAY_MS, successes: 0 })
    expect(isIndependentSuccess(archive.attempts[0]!)).toBe(false)
  })

  it('does not advance an established interval after the answer was exposed', () => {
    const first = firstArchive()
    const advanced = recordAttempt(first, answer({ id: 'due', answeredAt: START + DAY_MS }), TARGET)
    const exposed = recordAttempt(advanced, answer({ id: 'shown', answeredAt: START + 2 * DAY_MS, exposed: true }), TARGET)
    expect(exposed.cards[UNIT]).toMatchObject({ intervalDays: 3, dueAt: START + 4 * DAY_MS, successes: 2 })
  })

  it('restarts at one day after a failed review', () => {
    const first = firstArchive()
    const failed = recordAttempt(first, answer({ id: 'fail', answeredAt: START + DAY_MS, correct: false }), TARGET)
    const relearned = recordAttempt(failed, answer({ id: 'retry', answeredAt: START + DAY_MS + RETRY_DELAY_MS }), TARGET)
    expect(relearned.cards[UNIT]!.intervalDays).toBe(1)
  })

  it('deduplicates the same event and rejects reusing its ID for different answers', () => {
    const archive = firstArchive()
    expect(recordAttempt(archive, answer(), TARGET)).toBe(archive)
    expect(() => recordAttempt(archive, answer({ correct: false }), TARGET)).toThrow('重复的答题 ID')
  })

  it('keeps name recall separate from star location and shares each target across lessons', () => {
    const archive = firstArchive()
    const named = recordAttempt(archive, answer({ id: 'name', unitId: `${TARGET}:name`, skill: 'name' }), TARGET)
    expect(Object.keys(named.cards)).toHaveLength(2)
    const nextLesson = recordAttempt(named, answer({ id: 'another-lesson', lessonId: 'winter-review', answeredAt: START + 1000 }), TARGET)
    expect(Object.keys(nextLesson.cards)).toHaveLength(2)
    expect(nextLesson.cards[UNIT]).toMatchObject({ lessonId: 'winter-review', reviews: 2 })
    expect(parseBackup(exportBackup(nextLesson))).toEqual(nextLesson)
  })

  it('rejects attempts bound to a different target', () => {
    expect(() => recordAttempt(makeEmptyArchive(START), answer(), 'HIP:54061')).toThrow('知识点与目标不匹配')
  })
})

describe('backup and resume validation', () => {
  it('round-trips pending feedback and the exposed answer state', () => {
    const archive = firstArchive()
    archive.session = {
      id: 'session-1', lessonId: 'north-polaris', mode: 'learn', index: 0, phase: 'feedback',
      questions: [{ id: 'answer-1', unitId: UNIT, targetId: TARGET, skill: 'locate', variant: 2 }],
      hinted: true, exposedTargetIds: [TARGET], lastAttempt: archive.attempts[0],
    }
    archive.completedLessonIds = ['orientation']
    const restored = parseBackup(exportBackup(archive))
    expect(restored).toEqual(archive)
    expect(restored.session).not.toBe(archive.session)
    expect(restored.cards).not.toBe(archive.cards)
    expect(recordAttempt(restored, answer(), TARGET).attempts).toHaveLength(1)
  })

  it('allows an orientation lesson with no questions in study or complete phase', () => {
    const archive = makeEmptyArchive(START)
    archive.session = { id: 'orientation-session', lessonId: 'orientation', mode: 'learn', phase: 'study', index: 0, questions: [], hinted: false, exposedTargetIds: [] }
    expect(parseBackup(exportBackup(archive))).toEqual(archive)
    archive.session.phase = 'complete'
    expect(parseBackup(exportBackup(archive))).toEqual(archive)
    archive.session.phase = 'question'
    expect(() => exportBackup(archive)).toThrow('当前题目不存在')
  })

  it.each([
    (archive: LearningArchive) => { archive.schemaVersion = 2 as 1 },
    (archive: LearningArchive) => { archive.revision = -1 },
    (archive: LearningArchive) => { archive.updatedAt = START - 1 },
    (archive: LearningArchive) => { archive.attempts.push({ ...archive.attempts[0]! }) },
    (archive: LearningArchive) => { archive.attempts[0]!.correct = 'true' as unknown as boolean },
    (archive: LearningArchive) => { archive.cards[UNIT]!.successes = 100 },
    (archive: LearningArchive) => { archive.cards[UNIT]!.intervalDays = 2 },
    (archive: LearningArchive) => { archive.cards[UNIT]!.dueAt = Number.POSITIVE_INFINITY },
    (archive: LearningArchive) => { archive.cards[UNIT]!.targetId = 'HIP:54061' },
    (archive: LearningArchive) => { delete archive.cards[UNIT] },
    (archive: LearningArchive) => { archive.completedLessonIds = ['north-polaris', 'north-polaris'] },
  ])('rejects invalid values and broken cross-references (%#)', (mutate) => {
    const archive = firstArchive()
    mutate(archive)
    expect(() => parseBackup(rawBackup(archive))).toThrow(LearningStorageError)
  })

  it('rejects feedback referencing an uncommitted attempt', () => {
    const archive = firstArchive()
    archive.session = {
      id: 'session', lessonId: 'north-polaris', mode: 'review', index: 0, phase: 'feedback', hinted: false,
      questions: [{ id: 'missing', unitId: UNIT, targetId: TARGET, skill: 'locate', variant: 0 }],
      exposedTargetIds: [TARGET], lastAttempt: answer({ id: 'missing' }),
    }
    expect(() => parseBackup(rawBackup(archive))).toThrow('会话答案不属于已保存记录')
  })

  it('rejects feedback attached to a different question and out-of-bounds indices', () => {
    const archive = firstArchive()
    archive.session = {
      id: 'session', lessonId: 'north-polaris', mode: 'review', index: 0, phase: 'feedback', hinted: false,
      questions: [{ id: 'different-question', unitId: UNIT, targetId: TARGET, skill: 'locate', variant: 0 }],
      exposedTargetIds: [TARGET], lastAttempt: answer(),
    }
    expect(() => parseBackup(rawBackup(archive))).toThrow('反馈与当前题目不匹配')
    archive.session.phase = 'question'
    archive.session.index = 1
    expect(() => parseBackup(rawBackup(archive))).toThrow('当前题目不存在')
  })

  it('rejects malformed, unrelated, too-large and prototype-key files', () => {
    expect(() => parseBackup('{')).toThrow('有效的 JSON')
    expect(() => parseBackup(JSON.stringify(makeEmptyArchive(START)))).toThrow('不支持此备份格式')
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('超过 5 MB')
    const archive = firstArchive()
    const body = rawBackup(archive).replace('"cards":{', '"cards":{"__proto__":{},')
    expect(() => parseBackup(body)).toThrow(LearningStorageError)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('strips unknown metadata rather than propagating it into the stored archive', () => {
    const archive = { ...firstArchive(), extra: { secret: 'unrelated' } }
    const restored = parseBackup(rawBackup(archive))
    expect(restored).not.toHaveProperty('extra')
  })
})

describe('storage failures', () => {
  it('reports unavailable storage instead of silently starting an empty persistent session', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(loadArchive()).rejects.toMatchObject({ code: 'unavailable' })
    await expect(saveArchive(makeEmptyArchive(START), 0)).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('validates before opening or changing the database', async () => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    const archive = firstArchive()
    archive.cards[UNIT]!.reviews = 9
    await expect(saveArchive(archive, 0)).rejects.toThrow('卡片统计与答题记录不一致')
    expect(open).not.toHaveBeenCalled()
  })
})
