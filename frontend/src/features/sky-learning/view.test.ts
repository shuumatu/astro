// @vitest-environment jsdom
import { createApp, h, nextTick, type App } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SkyLearningView from '../../views/SkyLearningView.vue'
import { createLessonSession } from './session'
import { lessons, allLessons, chineseLessons, starForLesson } from './content'
import { exportBackup, makeEmptyArchive, parseBackup, type LearningArchive } from './repository'

const storage = vi.hoisted(() => ({ archive: null as LearningArchive | null, failNext: false }))
vi.mock('./repository', async importOriginal => {
  const actual = await importOriginal<typeof import('./repository')>()
  return { ...actual,
    loadArchive: async () => structuredClone(storage.archive!),
    saveArchive: async (value: LearningArchive, expectedRevision: number) => {
      if (storage.failNext) { storage.failNext = false; throw new Error('测试存储暂时不可用') }
      if (storage.archive!.revision !== expectedRevision) throw new actual.LearningStorageConflictError()
      // Validate the same serialized invariants as the real IndexedDB repository.
      const next = actual.parseBackup(actual.exportBackup(value))
      next.revision = expectedRevision + 1
      storage.archive = next
      return structuredClone(next)
    },
  }
})

let app: App | undefined
let root: HTMLDivElement
let lockHeld = false
const flush = async () => { for (let i = 0; i < 15; i += 1) { await Promise.resolve(); await nextTick() } }
const text = () => root.textContent ?? ''
function button(label: string): HTMLButtonElement {
  const element = [...root.querySelectorAll('button')].find(item => item.textContent?.trim() === label)
  if (!element) throw new Error(`Button not found: ${label}`)
  return element
}
async function click(label: string) { button(label).click(); await flush() }
function courseButton(lessonId: string): HTMLButtonElement {
  const title = allLessons.find(item => item.id === lessonId)!.title
  const card = [...root.querySelectorAll('.lesson-card')].find(item => item.querySelector('h4')?.textContent === title)
  if (!card) throw new Error(`Course not found: ${lessonId}`)
  return card.querySelector('button')!
}
async function selectCourse(lessonId: string) { courseButton(lessonId).click(); await flush() }
function review(lessonId: string) {
  const session = createLessonSession(lessonId)
  session.mode = 'review'
  session.phase = 'question'
  session.questions = session.questions.filter(item => item.skill === 'name')
  return session
}
async function mount(path = '/learn/sky/session') {
  root = document.createElement('div'); document.body.append(root)
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/learn/sky', name: 'sky-learning', component: SkyLearningView },
    { path: '/learn/chinese', name: 'chinese-learning', component: SkyLearningView },
    { path: '/learn/sky/session', name: 'sky-learning-session', component: SkyLearningView },
    { path: '/learn/sky/progress', name: 'sky-learning-progress', component: SkyLearningView },
    { path: '/sky-map', component: { render: () => h('div') } },
  ] })
  await router.push(path); await router.isReady()
  app = createApp({ render: () => h(RouterView) }); app.use(router); app.mount(root)
  await flush()
  return router
}

beforeEach(() => {
  storage.archive = makeEmptyArchive(); storage.failNext = false; lockHeld = false
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) => {
      if (lockHeld) return callback(null)
      lockHeld = true
      try { await callback({ name: 'test' }) } finally { lockHeld = false }
    },
  } })
})
afterEach(async () => { app?.unmount(); root?.remove(); await flush(); vi.restoreAllMocks() })

describe('learning view saved assessment flow', () => {
  it('does not leak a recalled star through the course heading, chart, or accessibility labels', async () => {
    storage.archive!.session = review('polaris')
    await mount()
    expect(text()).toContain('标记的这颗星叫什么')
    expect(root.innerHTML).not.toContain('北极星')
    expect(root.innerHTML).not.toContain('勾陈一')
    expect(text()).toContain('在星图中找回记忆')
  })

  it('tracks all answer exposures from a shared hint and preserves them for the next target', async () => {
    storage.archive!.session = review('summer-triangle')
    await mount()
    await click('看结构提示')
    expect(storage.archive!.session!.exposedTargetIds).toEqual(lessons.find(item => item.id === 'summer-triangle')!.targetIds)
    await click('暂时想不起来')
    await click('下一题')
    const input = root.querySelector('input#star-answer') as HTMLInputElement
    input.value = '天津四'; input.dispatchEvent(new Event('input', { bubbles: true })); await flush()
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush()
    expect(storage.archive!.attempts[1]).toMatchObject({ correct: true, hinted: false, exposed: true })
    expect(storage.archive!.cards['HIP:102098:name'].successes).toBe(0)
  })

  it('keeps the question pending on save failure and retries exactly one committed attempt', async () => {
    storage.archive!.session = review('polaris')
    await mount()
    storage.failNext = true
    await click('暂时想不起来')
    expect(text()).toContain('测试存储暂时不可用')
    expect(text()).not.toContain('已保存到此浏览器')
    expect(storage.archive!.attempts).toHaveLength(0)
    await click('重试保存')
    expect(storage.archive!.attempts).toHaveLength(1)
    expect(storage.archive!.session!.phase).toBe('feedback')
    expect(text()).toContain('已保存到此浏览器')
    const backup = parseBackup(exportBackup(storage.archive!))
    expect(backup.session!.phase).toBe('feedback')
    expect(backup.session!.lastAttempt!.id).toBe(backup.attempts[0].id)
  })

  it('marks reference-page navigation as exposure before returning to the same question', async () => {
    storage.archive!.session = review('polaris')
    const router = await mount()
    await router.push('/learn/sky/progress'); await flush()
    expect(storage.archive!.session!.exposedTargetIds).toEqual(['HIP:11767'])
    await router.push('/learn/sky/session'); await flush()
    expect(text()).toContain('标记的这颗星叫什么')
  })

  it('allows guide completion with no fabricated quiz result', async () => {
    storage.archive!.session = createLessonSession(lessons[0].id)
    await mount()
    await click('完成这节导读')
    expect(storage.archive!.completedLessonIds).toEqual([lessons[0].id])
    expect(storage.archive!.attempts).toHaveLength(0)
    expect(text()).toContain('导读完成')
  })

  it('opens the selected numbered course and preserves saved work from another unfinished course', async () => {
    storage.archive!.completedLessonIds = [lessons[0].id]
    storage.archive!.session = createLessonSession('polaris')
    const router = await mount()
    await click('隐藏提示，开始练习')
    await click('暂时想不起来')
    await router.push('/learn/sky'); await flush()
    const saved = structuredClone(storage.archive!)
    const switchedAt = Date.now() + 60_000
    vi.spyOn(Date, 'now').mockReturnValue(switchedAt)
    expect(text()).toContain('第 1 课')
    expect(courseButton('polaris').textContent).toContain('继续本课')
    expect(courseButton('orion').textContent).toContain('进入课程')
    await selectCourse('orion')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ lessonId: 'orion', mode: 'learn', phase: 'study', index: 0 })
    expect(text()).toContain(lessons.find(item => item.id === 'orion')!.title)
    expect(storage.archive!.attempts).toEqual(saved.attempts)
    expect(storage.archive!.cards).toEqual(saved.cards)
    expect(storage.archive!.completedLessonIds).toEqual(saved.completedLessonIds)
    expect(storage.archive!.exposures!['HIP:11767']).toBe(switchedAt)
  })

  it('resumes the same unfinished course without resetting its question', async () => {
    const active = createLessonSession('polaris')
    active.phase = 'question'; active.index = 1
    storage.archive!.session = active
    const router = await mount('/learn/sky')
    await selectCourse('polaris')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ id: active.id, phase: 'question', index: 1 })
    expect(text()).toContain('标记的这颗星叫什么')
  })

  it('starts a chosen course even when a review of that same region is unfinished', async () => {
    const active = review('polaris')
    storage.archive!.session = active
    const router = await mount('/learn/sky')
    expect(courseButton('polaris').textContent).toContain('进入课程')
    await selectCourse('polaris')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ lessonId: 'polaris', mode: 'learn', phase: 'study' })
    expect(storage.archive!.session!.id).not.toBe(active.id)
  })

  it.each(['different', 'same'])('restarts a completed course with a %s course currently open', async activeCourse => {
    storage.archive!.completedLessonIds = [lessons[0].id]
    const active = createLessonSession(activeCourse === 'same' ? lessons[0].id : 'polaris')
    if (activeCourse === 'same') active.phase = 'complete'
    storage.archive!.session = active
    const router = await mount('/learn/sky')
    expect(courseButton(lessons[0].id).textContent).toContain('重新学习')
    await selectCourse(lessons[0].id)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ lessonId: lessons[0].id, phase: 'study' })
    expect(storage.archive!.session!.id).not.toBe(active.id)
    expect(storage.archive!.completedLessonIds).toEqual([lessons[0].id])
  })

  it('keeps the previous session when switching fails and enters the chosen course after retry', async () => {
    storage.archive!.session = createLessonSession('polaris')
    const router = await mount('/learn/sky')
    const saved = structuredClone(storage.archive!)
    storage.failNext = true
    await selectCourse('orion')
    expect(router.currentRoute.value.path).toBe('/learn/sky')
    expect(storage.archive).toEqual(saved)
    expect(text()).toContain('测试存储暂时不可用')
    await click('重试保存')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ lessonId: 'orion', phase: 'study' })
    expect(storage.archive!.revision).toBe(saved.revision + 1)
  })

  it('provides a read-only view when another tab owns the writing session', async () => {
    lockHeld = true
    await mount('/learn/sky')
    expect(button('开始第一课').disabled).toBe(true)
    expect(courseButton('orion').disabled).toBe(true)
    expect(text()).toContain('另一个学习页面')
  })

  it('filters later chapters without renumbering courses and opens the chosen southern lesson', async () => {
    storage.archive!.completedLessonIds = ['chart-basics', 'orion']
    const router = await mount('/learn/sky')
    const stage = root.querySelector<HTMLSelectElement>('#course-stage')!
    stage.value = 'southern-cross'; stage.dispatchEvent(new Event('change', { bubbles: true })); await flush()
    const number = lessons.findIndex(lesson => lesson.id === 'southern-crux') + 1
    expect(root.querySelectorAll('.lesson-card').length).toBe(8)
    expect(text()).toContain(`第 ${number} 课`)
    expect(text()).not.toContain('第 1 课 ·')
    expect(root.querySelector('.course-group h3')?.textContent).toContain('14')
    await selectCourse('southern-crux')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session).toMatchObject({ lessonId: 'southern-crux', phase: 'study' })
    expect(storage.archive!.session!.questions).toHaveLength(4)
    await click('隐藏提示，开始练习')
    await click('暂时想不起来')
    expect(storage.archive!.attempts[0].lessonId).toBe('southern-crux')
    expect(storage.archive!.completedLessonIds).toEqual(['chart-basics', 'orion'])
  })

  it('finds exact course numbers and new star aliases and can clear an empty search', async () => {
    await mount('/learn/sky')
    const search = root.querySelector<HTMLInputElement>('#course-search')!
    const enter = async (value: string) => { search.value = value; search.dispatchEvent(new Event('input', { bubbles: true })); await flush() }
    await enter('第 20 课')
    expect(root.querySelectorAll('.lesson-card').length).toBe(1)
    expect(text()).toContain(lessons[19].title)
    await enter('Canopus')
    expect(text()).toContain(lessons.find(lesson => lesson.id === 'southern-carina')!.title)
    await enter('不存在的星座')
    expect(root.querySelectorAll('.lesson-card').length).toBe(0)
    expect(text()).toContain('没有匹配的课程')
    await click('显示全部课程')
    expect(root.querySelectorAll('.lesson-card').length).toBe(lessons.length)
  })

  it('does not introduce second-round names in an earlier shape guide', async () => {
    storage.archive!.session = createLessonSession('chart-basics')
    await mount()
    const chart = root.querySelector('.learning-chart')!
    expect(chart.textContent).not.toContain('天玑')
    expect(chart.textContent).not.toContain('摇光')
  })

  it('numbers Chinese courses independently and keeps the two completion totals separate', async () => {
    storage.archive!.completedLessonIds = [lessons[0].id, lessons[1].id, chineseLessons[0].id]
    const router = await mount('/learn/chinese')
    expect(root.querySelector('h1')?.textContent).toBe('中国星宫')
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(chineseLessons.length)
    expect(root.querySelector('.course-heading')?.textContent).toContain(`1 / ${chineseLessons.length}`)
    expect(root.querySelector('.lesson-card')?.textContent).toContain('第 1 课')
    const stage = root.querySelector<HTMLSelectElement>('#course-stage')!
    stage.value = 'cn-dragon'; stage.dispatchEvent(new Event('change', { bubbles: true })); await flush()
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(7)
    expect(root.querySelector('.lesson-card')?.textContent).toContain('第 9 课')
    await router.push('/learn/sky'); await flush()
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(lessons.length)
    expect(root.querySelector('.course-heading')?.textContent).toContain(`2 / ${lessons.length}`)
    expect(root.querySelector('h1')?.textContent).toBe('星空记忆')
  })

  it('opens an arbitrary Chinese lesson, resumes it after remount, and returns to its catalog', async () => {
    const chosen = chineseLessons.find(item => item.stage === 'cn-tiger' && item.targetIds.length)!
    let router = await mount('/learn/chinese')
    await selectCourse(chosen.id)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session?.lessonId).toBe(chosen.id)
    expect(root.querySelector('h1')?.textContent).toBe('中国星宫')
    await click('隐藏提示，开始练习')
    await click('暂时想不起来')
    const sessionId = storage.archive!.session!.id
    app!.unmount(); root.remove(); await flush()
    router = await mount()
    expect(storage.archive!.session!.id).toBe(sessionId)
    expect(text()).toContain('已保存到此浏览器')
    await click('结束本次，保留进度')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/chinese'))
    expect(storage.archive!.attempts).toHaveLength(1)
    expect(storage.archive!.session).toBeNull()
  })

  it('uses Chinese labels during study without leaking them into name recall and accepts a familiar alias', async () => {
    const chosen = chineseLessons.find(item => item.targetIds.includes('HIP:11767'))!
    storage.archive!.session = createLessonSession(chosen.id)
    await mount()
    expect(root.querySelector('.target-list')?.textContent).toContain('勾陈一')
    expect(root.querySelector('.target-list')?.textContent).not.toContain('北极星')
    app!.unmount(); root.remove(); await flush()
    const active = review(chosen.id)
    active.questions = active.questions.filter(item => item.targetId === 'HIP:11767')
    storage.archive!.session = active
    await mount()
    expect(root.innerHTML).not.toContain('勾陈一')
    expect(root.innerHTML).not.toContain('北极星')
    const input = root.querySelector<HTMLInputElement>('#star-answer')!
    input.value = '北极星'; input.dispatchEvent(new Event('input', { bubbles: true })); await flush()
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush()
    expect(storage.archive!.attempts.at(-1)?.correct).toBe(true)
    expect(text()).toContain('标记的正确目标：勾陈一')
  })

  it('opens a mansion from the overview and finds Chinese names in course search', async () => {
    const router = await mount('/learn/chinese')
    const chosen = chineseLessons.find(item => item.stage === 'cn-dragon' && item.targetIds.length)!
    const search = root.querySelector<HTMLInputElement>('#course-search')!
    search.value = starForLesson(chosen.targetIds[0], chosen)!.name
    search.dispatchEvent(new Event('input', { bubbles: true })); await flush()
    expect(root.querySelector('.lesson-card h4')?.textContent).toBe(chosen.title)
    const mansion = root.querySelector<HTMLButtonElement>('button[aria-label*="角宿"]')!
    expect(mansion).toBeTruthy()
    mansion.click(); await flush()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/learn/sky/session'))
    expect(storage.archive!.session?.lessonId).toBe(chosen.id)
  })

  it('shows both route totals and explicit shared backup scope on the progress page', async () => {
    storage.archive!.completedLessonIds = [lessons[0].id, chineseLessons[0].id]
    await mount('/learn/sky/progress')
    expect(text()).toContain(`认识星空 1 / ${lessons.length} 课`)
    expect(text()).toContain(`中国星宫 1 / ${chineseLessons.length} 课`)
    expect(text()).toContain('备份包含认识星空和中国星宫两条路线')
    await click('清除本地学习记录')
    expect(text()).toContain('将删除此浏览器认识星空和中国星宫两条路线')
    expect(storage.archive!.completedLessonIds).toHaveLength(2)
  })

  it('combines completion, stage, and search filters without renumbering lessons', async () => {
    storage.archive!.completedLessonIds = [lessons[0].id, lessons[2].id]
    await mount('/learn/sky')
    await click('已完成')
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(2)
    expect(text()).toContain('第 3 课')
    const search = root.querySelector<HTMLInputElement>('#course-search')!
    search.value = '第 2 课'; search.dispatchEvent(new Event('input', { bubbles: true })); await flush()
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(0)
    await click('未完成')
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(1)
    expect(root.querySelector('.lesson-card h4')?.textContent).toBe(lessons[1].title)
    await click('显示全部课程')
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(lessons.length)
    const shortcut = root.querySelector<HTMLButtonElement>('.stage-shortcut:nth-of-type(3)')!
    shortcut.click(); await flush()
    const stageId = root.querySelector<HTMLSelectElement>('#course-stage')!.value
    expect(stageId).not.toBe('all')
    expect(root.querySelectorAll('.lesson-card')).toHaveLength(lessons.filter(item => item.stage === stageId).length)
  })

  it.each(['/learn/sky', '/learn/chinese'])('continues to the next course in the same learning route from %s', async path => {
    const sequence = path === '/learn/chinese' ? chineseLessons : lessons
    storage.archive!.session = createLessonSession(sequence[0].id)
    await mount('/learn/sky/session')
    await click('完成这节导读')
    expect(storage.archive!.completedLessonIds).toContain(sequence[0].id)
    await click('继续下一课')
    expect(storage.archive!.session).toMatchObject({ lessonId: sequence[1].id, phase: 'study' })
    expect(storage.archive!.completedLessonIds).toContain(sequence[0].id)
  })
})
