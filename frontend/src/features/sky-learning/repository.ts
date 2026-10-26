export type LearningSkill = 'locate' | 'name'

export interface LearningAttempt {
  id: string
  unitId: string
  lessonId: string
  skill: LearningSkill
  correct: boolean
  hinted: boolean
  exposed: boolean
  answeredAt: number
}

export interface ReviewCard {
  unitId: string
  lessonId: string
  skill: LearningSkill
  targetId: string
  dueAt: number
  intervalDays: number
  reviews: number
  successes: number
}

export interface LearningQuestion {
  id: string
  unitId: string
  targetId: string
  skill: LearningSkill
  variant: number
}

export interface LearningSession {
  id: string
  lessonId: string
  mode: 'learn' | 'review'
  index: number
  phase: 'study' | 'question' | 'feedback' | 'complete'
  questions: LearningQuestion[]
  hinted: boolean
  exposedTargetIds: string[]
  lastAttempt?: LearningAttempt
}

export interface LearningArchive {
  schemaVersion: 1
  revision: number
  createdAt: number
  updatedAt: number
  attempts: LearningAttempt[]
  cards: Record<string, ReviewCard>
  completedLessonIds: string[]
  session: LearningSession | null
  exposures?: Record<string, number>
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const RETRY_DELAY_MS = 10 * 60 * 1000
// Provisional fixed intervals, not an FSRS model or a measure of mastery.
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

const DATABASE_NAME = 'astro-sky-learning'
const STORE_NAME = 'archives'
const ARCHIVE_KEY = 'local'
const MAX_ATTEMPTS = 50_000
const MAX_CARDS = 10_000
const MAX_QUESTIONS = 1_000
const MAX_TIMESTAMP = 8_640_000_000_000_000 - 31 * DAY_MS
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/

export class LearningStorageError extends Error {
  constructor(message: string, public readonly code: 'unavailable' | 'blocked' | 'read' | 'write' | 'invalid' = 'invalid') {
    super(message)
    this.name = 'LearningStorageError'
  }
}

export class LearningStorageConflictError extends LearningStorageError {
  constructor() {
    super('学习记录已在另一个页面更新，请重新载入后继续。', 'write')
    this.name = 'LearningStorageConflictError'
  }
}

export function makeEmptyArchive(now = Date.now()): LearningArchive {
  timestamp(now, '创建时间')
  return {
    schemaVersion: 1,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    attempts: [],
    cards: {},
    completedLessonIds: [],
    session: null,
    exposures: {},
  }
}

export function isIndependentSuccess(attempt: LearningAttempt): boolean {
  return attempt.correct && !attempt.hinted && !attempt.exposed
}

export function reviewCardKey(unitId: string): string {
  return unitId
}

/** Applies one answer to a copy. Persist that copy before presenting committed progress. */
export function recordAttempt(archive: LearningArchive, attempt: LearningAttempt, targetId: string): LearningArchive {
  const parsed = parseAttempt(attempt)
  identifier(targetId, '目标 ID')
  requireValid(parsed.unitId === `${targetId}:${parsed.skill}`, '知识点与目标不匹配')
  const existing = archive.attempts.find((item) => item.id === parsed.id)
  if (existing) {
    requireValid(sameAttempt(existing, parsed), '重复的答题 ID 对应不同答案')
    return archive
  }
  requireValid(archive.attempts.length < MAX_ATTEMPTS, '学习记录已达容量上限，请先导出备份')
  const previous = archive.cards[parsed.unitId]
  const independentSuccess = isIndependentSuccess(parsed)
  let intervalDays = previous?.intervalDays ?? 0
  let dueAt = previous?.dueAt ?? parsed.answeredAt

  if (!parsed.correct || parsed.hinted) {
    intervalDays = 0
    dueAt = parsed.answeredAt + RETRY_DELAY_MS
  } else if (parsed.exposed) {
    // Seeing the answer establishes a first review date, but cannot advance an interval.
    intervalDays = Math.max(1, intervalDays)
    dueAt = Math.max(dueAt, parsed.answeredAt + DAY_MS)
  } else if (intervalDays === 0) {
    intervalDays = 1
    dueAt = parsed.answeredAt + DAY_MS
  } else if (parsed.answeredAt >= dueAt) {
    const step = REVIEW_INTERVAL_DAYS.findIndex((days) => days === intervalDays)
    intervalDays = REVIEW_INTERVAL_DAYS[Math.min(step + 1, REVIEW_INTERVAL_DAYS.length - 1)]!
    dueAt = parsed.answeredAt + intervalDays * DAY_MS
  }

  const card: ReviewCard = {
    unitId: parsed.unitId,
    lessonId: parsed.lessonId,
    skill: parsed.skill,
    targetId,
    intervalDays,
    dueAt,
    reviews: (previous?.reviews ?? 0) + 1,
    successes: (previous?.successes ?? 0) + Number(independentSuccess),
  }
  return {
    ...archive,
    updatedAt: Math.max(archive.updatedAt, parsed.answeredAt),
    attempts: [...archive.attempts, parsed],
    cards: { ...archive.cards, [parsed.unitId]: card },
  }
}

function requireValid(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new LearningStorageError(`学习记录格式无效：${detail}。`)
}

function object(value: unknown, detail: string): Record<string, unknown> {
  requireValid(typeof value === 'object' && value !== null && !Array.isArray(value), detail)
  const prototype = Object.getPrototypeOf(value)
  requireValid(prototype === Object.prototype || prototype === null, detail)
  return value as Record<string, unknown>
}

function identifier(value: unknown, detail: string): string {
  requireValid(typeof value === 'string' && ID_PATTERN.test(value), detail)
  requireValid(!['__proto__', 'constructor', 'prototype'].includes(value), detail)
  return value
}

function integer(value: unknown, detail: string, maximum = Number.MAX_SAFE_INTEGER - 1): number {
  requireValid(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum, detail)
  return value
}

function timestamp(value: unknown, detail: string): number {
  return integer(value, detail, MAX_TIMESTAMP)
}

function boolean(value: unknown, detail: string): boolean {
  requireValid(typeof value === 'boolean', detail)
  return value
}

function skill(value: unknown): LearningSkill {
  requireValid(value === 'locate' || value === 'name', '题型')
  return value
}

function array(value: unknown, detail: string, maximum: number): unknown[] {
  requireValid(Array.isArray(value) && value.length <= maximum, detail)
  return value
}

function identifiers(value: unknown, detail: string, maximum: number): string[] {
  const values = array(value, detail, maximum).map((item) => identifier(item, detail))
  requireValid(new Set(values).size === values.length, `${detail}存在重复项`)
  return values
}

function parseAttempt(value: unknown): LearningAttempt {
  const item = object(value, '答题记录')
  const parsed: LearningAttempt = {
    id: identifier(item.id, '答题 ID'),
    unitId: identifier(item.unitId, '知识点 ID'),
    lessonId: identifier(item.lessonId, '课程 ID'),
    skill: skill(item.skill),
    correct: boolean(item.correct, '回答结果'),
    hinted: boolean(item.hinted, '提示状态'),
    exposed: boolean(item.exposed, '答案展示状态'),
    answeredAt: timestamp(item.answeredAt, '答题时间'),
  }
  requireValid(parsed.unitId.endsWith(`:${parsed.skill}`), '知识点与题型不匹配')
  return parsed
}

function sameAttempt(a: LearningAttempt, b: LearningAttempt): boolean {
  return a.id === b.id && a.unitId === b.unitId && a.lessonId === b.lessonId && a.skill === b.skill
    && a.correct === b.correct && a.hinted === b.hinted && a.exposed === b.exposed && a.answeredAt === b.answeredAt
}

/** Normalizes untrusted backup/IndexedDB data into fresh objects with only known fields. */
function validateArchive(value: unknown): LearningArchive {
  const source = object(value, '存档')
  requireValid(source.schemaVersion === 1, '不支持此存档版本')
  const createdAt = timestamp(source.createdAt, '创建时间')
  const updatedAt = timestamp(source.updatedAt, '更新时间')
  requireValid(updatedAt >= createdAt, '更新时间早于创建时间')
  const revision = integer(source.revision, '记录版本')
  const attempts = array(source.attempts, '答题记录数量', MAX_ATTEMPTS).map(parseAttempt)
  const attemptsById = new Map<string, LearningAttempt>()
  const unitStats = new Map<string, { reviews: number; successes: number; latest: LearningAttempt }>()
  for (const attempt of attempts) {
    requireValid(!attemptsById.has(attempt.id), '答题 ID 重复')
    requireValid(attempt.answeredAt <= updatedAt, '答题时间晚于更新时间')
    attemptsById.set(attempt.id, attempt)
    const stats = unitStats.get(attempt.unitId)
    unitStats.set(attempt.unitId, {
      reviews: (stats?.reviews ?? 0) + 1,
      successes: (stats?.successes ?? 0) + Number(isIndependentSuccess(attempt)),
      latest: attempt,
    })
  }

  const rawCards = object(source.cards, '复习卡片')
  requireValid(Object.keys(rawCards).length <= MAX_CARDS, '复习卡片数量过多')
  const cards: Record<string, ReviewCard> = {}
  for (const [key, value] of Object.entries(rawCards)) {
    identifier(key, '卡片索引')
    const raw = object(value, '复习卡片')
    const card: ReviewCard = {
      unitId: identifier(raw.unitId, '知识点 ID'),
      lessonId: identifier(raw.lessonId, '课程 ID'),
      skill: skill(raw.skill),
      targetId: identifier(raw.targetId, '目标 ID'),
      dueAt: timestamp(raw.dueAt, '复习时间'),
      intervalDays: integer(raw.intervalDays, '复习间隔', 30),
      reviews: integer(raw.reviews, '练习次数', MAX_ATTEMPTS),
      successes: integer(raw.successes, '独立答对次数', MAX_ATTEMPTS),
    }
    requireValid(key === card.unitId && key === `${card.targetId}:${card.skill}`, '卡片索引与知识点不匹配')
    requireValid(card.intervalDays === 0 || REVIEW_INTERVAL_DAYS.some((days) => days === card.intervalDays), '复习间隔')
    const stats = unitStats.get(key)
    requireValid(stats && card.reviews === stats.reviews && card.successes === stats.successes, '卡片统计与答题记录不一致')
    requireValid(card.lessonId === stats.latest.lessonId, '卡片课程与答题记录不一致')
    cards[key] = card
  }
  requireValid(unitStats.size === Object.keys(cards).length, '答题记录缺少对应复习卡片')

  const completedLessonIds = identifiers(source.completedLessonIds, '已完成课程', 1_000)
  let session: LearningSession | null = null
  if (source.session !== null) {
    const raw = object(source.session, '学习会话')
    requireValid(raw.mode === 'learn' || raw.mode === 'review', '会话模式')
    requireValid(raw.phase === 'study' || raw.phase === 'question' || raw.phase === 'feedback' || raw.phase === 'complete', '会话阶段')
    const questions = array(raw.questions, '练习题数量', MAX_QUESTIONS).map((value): LearningQuestion => {
      const item = object(value, '练习题')
      const question: LearningQuestion = {
        id: identifier(item.id, '题目 ID'),
        unitId: identifier(item.unitId, '知识点 ID'),
        targetId: identifier(item.targetId, '目标 ID'),
        skill: skill(item.skill),
        variant: integer(item.variant, '视图变化编号', 1_000_000),
      }
      requireValid(question.unitId === `${question.targetId}:${question.skill}`, '题目与知识点不匹配')
      return question
    })
    requireValid(new Set(questions.map((item) => item.id)).size === questions.length, '题目 ID 重复')
    const index = integer(raw.index, '当前题目位置', questions.length)
    requireValid(raw.phase === 'complete' || (raw.phase === 'study' && questions.length === 0) || index < questions.length, '当前题目不存在')
    const exposedTargetIds = identifiers(raw.exposedTargetIds, '已展示答案的目标', MAX_QUESTIONS)
    const targets = new Set(questions.map((question) => question.targetId))
    requireValid(exposedTargetIds.every((id) => targets.has(id)), '已展示目标不属于当前练习')
    session = {
      id: identifier(raw.id, '会话 ID'),
      lessonId: identifier(raw.lessonId, '会话课程 ID'),
      mode: raw.mode,
      phase: raw.phase,
      index,
      questions,
      hinted: boolean(raw.hinted, '提示状态'),
      exposedTargetIds,
    }
    if (raw.lastAttempt !== undefined) {
      const lastAttempt = parseAttempt(raw.lastAttempt)
      const savedAttempt = attemptsById.get(lastAttempt.id)
      requireValid(savedAttempt && sameAttempt(savedAttempt, lastAttempt), '会话答案不属于已保存记录')
      session.lastAttempt = lastAttempt
    }
    if (session.phase === 'feedback') {
      const question = questions[index]!
      requireValid(session.lastAttempt?.id === question.id && session.lastAttempt.unitId === question.unitId && session.lastAttempt.skill === question.skill, '反馈与当前题目不匹配')
    }
  }
  const rawExposures = object(source.exposures ?? {}, '近期答案展示')
  requireValid(Object.keys(rawExposures).length <= MAX_CARDS, '近期展示目标过多')
  const exposures: Record<string, number> = {}
  for (const [key, value] of Object.entries(rawExposures)) exposures[identifier(key, '已展示目标 ID')] = timestamp(value, '答案展示时间')
  return { schemaVersion: 1, revision, createdAt, updatedAt, attempts, cards, completedLessonIds, session, exposures }
}

export function exportBackup(archive: LearningArchive): string {
  const normalized = validateArchive(archive)
  const result = JSON.stringify({ format: 'astro-sky-learning', version: 1, archive: normalized }, null, 2)
  requireValid(new TextEncoder().encode(result).byteLength <= MAX_BACKUP_BYTES, '备份文件超过 5 MB')
  return result
}

export function parseBackup(text: string): LearningArchive {
  requireValid(typeof text === 'string' && text.length <= MAX_BACKUP_BYTES, '备份文件超过 5 MB')
  requireValid(new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES, '备份文件超过 5 MB')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new LearningStorageError('无法读取备份：文件不是有效的 JSON。')
  }
  const envelope = object(parsed, '备份文件')
  requireValid(envelope.format === 'astro-sky-learning' && envelope.version === 1, '不支持此备份格式或版本')
  return validateArchive(envelope.archive)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new LearningStorageError('此浏览器无法保存本地学习记录，请使用支持 IndexedDB 的普通浏览窗口。', 'unavailable'))
      return
    }
    let request: IDBOpenDBRequest
    let settled = false
    try {
      request = indexedDB.open(DATABASE_NAME, 1)
    } catch {
      reject(new LearningStorageError('无法打开本地学习记录，请检查浏览器存储设置。', 'unavailable'))
      return
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      if (settled) database.close()
      else {
        settled = true
        resolve(database)
      }
    }
    request.onerror = () => {
      settled = true
      reject(new LearningStorageError('无法打开本地学习记录，请检查浏览器存储设置。', 'unavailable'))
    }
    request.onblocked = () => {
      settled = true
      reject(new LearningStorageError('其他页面正在使用旧版学习记录，请关闭其他学习页面后重试。', 'blocked'))
    }
  })
}

export async function loadArchive(): Promise<LearningArchive> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let result: LearningArchive
    let failure: unknown
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(ARCHIVE_KEY)
      request.onsuccess = () => {
        try {
          result = request.result === undefined ? makeEmptyArchive() : validateArchive(request.result)
        } catch (error) {
          failure = error
          transaction.abort()
        }
      }
      transaction.oncomplete = () => {
        database.close()
        resolve(result)
      }
      transaction.onabort = transaction.onerror = () => {
        database.close()
        reject(failure ?? new LearningStorageError('读取学习记录失败，现有记录未被修改。', 'read'))
      }
    } catch {
      database.close()
      reject(new LearningStorageError('读取学习记录失败，现有记录未被修改。', 'read'))
    }
  })
}

/** Compares and replaces the entire archive inside one IndexedDB read/write transaction. */
export async function saveArchive(archive: LearningArchive, expectedRevision: number): Promise<LearningArchive> {
  integer(expectedRevision, '预期记录版本', Number.MAX_SAFE_INTEGER - 2)
  const snapshot = validateArchive(archive)
  // Every record we accept for storage must remain exportable as a complete backup.
  exportBackup(snapshot)
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let result: LearningArchive
    let failure: unknown
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(ARCHIVE_KEY)
      request.onsuccess = () => {
        try {
          const current = request.result === undefined ? null : validateArchive(request.result)
          if ((current?.revision ?? 0) !== expectedRevision) throw new LearningStorageConflictError()
          result = {
            ...snapshot,
            revision: expectedRevision + 1,
            updatedAt: Math.max(Date.now(), snapshot.updatedAt),
          }
          store.put(result, ARCHIVE_KEY)
        } catch (error) {
          failure = error
          transaction.abort()
        }
      }
      transaction.oncomplete = () => {
        database.close()
        resolve(result)
      }
      transaction.onabort = transaction.onerror = () => {
        database.close()
        reject(failure ?? new LearningStorageError('保存失败，可能是存储空间不足或浏览器限制。本次结果尚未保存。', 'write'))
      }
    } catch {
      database.close()
      reject(new LearningStorageError('保存学习记录失败，本次结果尚未保存。', 'write'))
    }
  })
}
