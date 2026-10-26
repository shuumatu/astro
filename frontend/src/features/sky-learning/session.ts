import { allLessons as lessons, stars, type LearningStar } from './content'
import type { LearningArchive, LearningSession } from './repository'

// A conservative separation window for this initial course, not a memory model.
export const RECENT_EXPOSURE_MS = 30 * 60 * 1000

export function exposeTargets(archive: LearningArchive, ids: string[], now = Date.now()): LearningArchive {
  return { ...archive, exposures: { ...archive.exposures, ...Object.fromEntries(ids.map(id => [id, now])) } }
}

export function wasRecentlyExposed(archive: LearningArchive, targetId: string, now = Date.now()): boolean {
  const shownAt = archive.exposures?.[targetId]
  // Future timestamps are treated conservatively when the system clock moves back.
  if (shownAt !== undefined && now - shownAt < RECENT_EXPOSURE_MS) return true
  return archive.attempts.some(attempt => attempt.unitId.startsWith(`${targetId}:`) && now - attempt.answeredAt < RECENT_EXPOSURE_MS)
}

export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s·・]/gu, '')
}

export function acceptsStarName(star: LearningStar, value: string): boolean {
  const answer = normalizeAnswer(value)
  return answer.length > 0 && [star.name, ...star.aliases].some(name => normalizeAnswer(name) === answer)
}

export function createLessonSession(lessonId: string): LearningSession {
  const lesson = lessons.find(item => item.id === lessonId)
  if (!lesson) throw new Error('课程不存在，请返回课程目录。')
  const id = crypto.randomUUID()
  // Separate directions so a just-revealed answer is not immediately tested again.
  const questions = (['locate', 'name'] as const).flatMap((skill, pass) => lesson.targetIds.map((targetId, index) => ({
    id: `${id}:${skill}:${targetId}`, unitId: `${targetId}:${skill}`, targetId, skill, variant: pass + index % 2,
  })))
  return { id, lessonId, mode: 'learn', index: 0, phase: 'study', questions, hinted: false, exposedTargetIds: [] }
}

export function dueCards(archive: LearningArchive, now = Date.now()) {
  return Object.values(archive.cards).filter(card => card.dueAt <= now && lessons.some(lesson =>
    lesson.id === card.lessonId && lesson.targetIds.includes(card.targetId),
  )).sort((a, b) => a.dueAt - b.dueAt || a.unitId.localeCompare(b.unitId))
}

export function createReviewSession(archive: LearningArchive, now = Date.now()): LearningSession | null {
  const due = dueCards(archive, now)
  if (!due.length) return null
  const lessonId = due[0].lessonId
  const id = crypto.randomUUID()
  // One region per short review session; the next region stays in the due queue.
  const questions = due.filter(card => card.lessonId === lessonId).slice(0, 8).map((card, index) => ({
    id: `${id}:${card.unitId}`, unitId: card.unitId, targetId: card.targetId, skill: card.skill, variant: 1 + index % 3,
  }))
  const exposedTargetIds = [...new Set(questions.map(question => question.targetId))].filter(id => wasRecentlyExposed(archive, id, now))
  return { id, lessonId, mode: 'review', index: 0, phase: 'question', questions, hinted: false, exposedTargetIds }
}

export function validateContentReferences(archive: LearningArchive): void {
  const knownLesson = (id: string) => lessons.find(lesson => lesson.id === id)
  if (archive.completedLessonIds.some(id => !knownLesson(id))) throw new Error('备份包含当前版本未提供的课程，请使用对应版本恢复。')
  for (const card of Object.values(archive.cards)) {
    if (!knownLesson(card.lessonId)?.targetIds.includes(card.targetId)) throw new Error('备份包含当前版本未提供的练习对象。')
  }
  const session = archive.session
  if (session && (!knownLesson(session.lessonId) || session.questions.some(question =>
    !knownLesson(session.lessonId)?.targetIds.includes(question.targetId),
  ) || session.exposedTargetIds.some(id => !stars.some(star => star.id === id)))) {
    throw new Error('学习会话与当前课程不兼容，请导出记录后使用对应版本恢复。')
  }
}
