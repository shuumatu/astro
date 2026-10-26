<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, Compass, Download, Layers3, ListFilter, RotateCcw, Search, ShieldCheck, Sparkles, Target, Upload } from 'lucide-vue-next'
import LearningStarChart from '../features/sky-learning/LearningStarChart.vue'
import LessonPreview from '../features/sky-learning/LessonPreview.vue'
import ChineseSkyOverview from '../features/sky-learning/ChineseSkyOverview.vue'
import { allLessons as lessons, lessons as westernLessons, chineseLessons, stars, allStages, stages as westernStages, chineseStages, chineseFigures, isChineseLesson, starForLesson, constellations, sources, coordinateNote, type LearningLesson } from '../features/sky-learning/content'
import { loadArchive, saveArchive, recordAttempt, parseBackup, exportBackup, MAX_BACKUP_BYTES, LearningStorageConflictError,
  type LearningArchive, type LearningAttempt } from '../features/sky-learning/repository'
import { acceptsStarName, createLessonSession, createReviewSession, dueCards, exposeTargets, wasRecentlyExposed, validateContentReferences } from '../features/sky-learning/session'

const route = useRoute()
const router = useRouter()
const archive = ref<LearningArchive | null>(null)
const loading = ref(true)
const saving = ref(false)
const writable = ref(false)
const acquiring = ref(false)
const error = ref('')
const notice = ref('')
const input = ref('')
const selectedId = ref<string | null>(null)
const studyLabels = ref(true)
const studyLines = ref(true)
const studyVariant = ref(0)
const selectedStage = ref('all')
const courseQuery = ref('')
const courseStatus = ref<'all' | 'unlearned' | 'completed'>('all')
const importPreview = ref<LearningArchive | null>(null)
const resetRequested = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const answerInput = ref<HTMLInputElement | null>(null)
let releaseLock: (() => void) | undefined
let disposed = false
const retryAction = ref<(() => Promise<boolean>) | null>(null)
const now = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined

const page = computed(() => route.name === 'sky-learning-session' ? 'session' : route.name === 'sky-learning-progress' ? 'progress' : 'courses')
const session = computed(() => archive.value?.session ?? null)
const lesson = computed(() => lessons.find(item => item.id === session.value?.lessonId))
const isChinese = computed(() => page.value === 'courses' ? route.name === 'chinese-learning' : page.value === 'session' && isChineseLesson(lesson.value))
const courseLessons = computed(() => isChinese.value ? chineseLessons : westernLessons)
const question = computed(() => session.value?.questions[session.value.index])
const target = computed(() => question.value ? starForLesson(question.value.targetId, lesson.value) : undefined)
const lessonStars = computed(() => stars.filter(star => lesson.value?.starIds.includes(star.id)).map(star => starForLesson(star.id, lesson.value)!))
const groups = computed(() => isChinese.value ? chineseStages : westernStages)
const completedIds = computed(() => new Set(archive.value?.completedLessonIds ?? []))
const filteredLessons = computed(() => {
  const query = courseQuery.value.trim().toLocaleLowerCase()
  const number = query.match(/^第?\s*(\d+)\s*课?$/)?.[1]
  return courseLessons.value.filter((item, index) => {
    if (selectedStage.value !== 'all' && item.stage !== selectedStage.value) return false
    if (courseStatus.value === 'completed' && !completedIds.value.has(item.id)) return false
    if (courseStatus.value === 'unlearned' && completedIds.value.has(item.id)) return false
    if (number) return index + 1 === Number(number)
    if (!query) return true
    const names = item.targetIds.flatMap(id => {
      const star = starForLesson(id, item)
      return star ? [star.name, ...star.aliases] : []
    })
    return [item.title, courseSummary(item), ...names].join(' ').toLocaleLowerCase().includes(query)
  })
})
const filteredGroups = computed(() => groups.value.map((group, index) => ({
  ...group, number: index + 1, lessons: filteredLessons.value.filter(item => item.stage === group.id),
})).filter(group => group.lessons.length))
const studyTargetIds = new Set(lessons.flatMap(item => item.targetIds))
const studyLabelIds = computed(() => {
  if (!lesson.value) return []
  if (lesson.value.targetIds.length) return lesson.value.targetIds
  // Later name courses must not add their answers to earlier shape introductions.
  const earlierLessons = courseLessons.value.slice(0, courseLessons.value.indexOf(lesson.value) + 1)
  return [...new Set(earlierLessons.flatMap(item => item.targetIds))]
    .filter(id => lesson.value?.paths.some(path => path.includes(id)))
})
const due = computed(() => archive.value ? dueCards(archive.value, now.value) : [])
const cards = computed(() => Object.values(archive.value?.cards ?? {}))
const nextLesson = computed(() => courseLessons.value.find(item => !archive.value?.completedLessonIds.includes(item.id)))
const blocked = computed(() => !writable.value || saving.value || loading.value)
const hasUnfinishedSession = computed(() => session.value && session.value.phase !== 'complete')
const completedCount = computed(() => page.value === 'progress' ? archive.value?.completedLessonIds.length ?? 0 : courseLessons.value.filter(item => archive.value?.completedLessonIds.includes(item.id)).length)
const westernCompleted = computed(() => westernLessons.filter(item => archive.value?.completedLessonIds.includes(item.id)).length)
const chineseCompleted = computed(() => chineseLessons.filter(item => archive.value?.completedLessonIds.includes(item.id)).length)
const sessionAttempts = computed(() => archive.value?.attempts.filter(attempt => session.value?.questions.some(item => item.id === attempt.id)) ?? [])
const independentCorrect = computed(() => sessionAttempts.value.filter(attempt => attempt.correct && !attempt.hinted && !attempt.exposed).length)
const stageTitle = computed(() => allStages.find(item => item.id === lesson.value?.stage)?.title ?? '')
const featuredLesson = computed(() => hasUnfinishedSession.value ? lesson.value : nextLesson.value)
const followingLesson = computed(() => lesson.value && session.value?.mode === 'learn'
  ? courseLessons.value[courseLessons.value.indexOf(lesson.value) + 1] : undefined)
const answeredCount = computed(() => session.value ? Math.min(session.value.questions.length,
  session.value.index + (session.value.phase === 'feedback' ? 1 : 0)) : 0)
const stageProgress = computed(() => groups.value.map(group => {
  const items = courseLessons.value.filter(item => item.stage === group.id)
  return { ...group, total: items.length, completed: items.filter(item => completedIds.value.has(item.id)).length }
}))
function resetCourseFilters() { selectedStage.value = 'all'; courseQuery.value = ''; courseStatus.value = 'all' }

function courseSummary(item: LearningLesson): string {
  const regions = isChineseLesson(item)
    ? item.asterismIds!.map(id => chineseFigures.find(figure => figure.id === id)?.name ?? id).join('、')
    : item.constellationIds.map(code => constellations.find(figure => figure.code === code)?.name ?? code).join('、')
  return `${regions} · ${item.targetIds.length ? '练习亮星定位与名称回忆' : '先认识主要图形与相邻区域'}`
}
watch(() => session.value?.id, () => { studyLabels.value = true; studyLines.value = true; studyVariant.value = 0; input.value = ''; selectedId.value = null })
watch(isChinese, resetCourseFilters)

function selectChineseStage(id: string) {
  selectedStage.value = id
  courseQuery.value = ''
  courseStatus.value = 'all'
  void nextTick(() => document.getElementById('course-directory')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
}

function cloneArchive(): LearningArchive {
  return JSON.parse(JSON.stringify(archive.value)) as LearningArchive
}
function dateText(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value)
}
function message(cause: unknown): string { return cause instanceof Error ? cause.message : '学习记录未保存，请重试。' }

async function refresh() {
  if (saving.value) return
  loading.value = true
  error.value = ''
  retryAction.value = null
  try {
    const stored = await loadArchive()
    validateContentReferences(stored)
    if (!disposed) archive.value = stored
  } catch (cause) { archive.value = null; error.value = message(cause) }
  finally { loading.value = false }
}

async function acquireWriter() {
  if (acquiring.value || writable.value || disposed) return
  if (!navigator.locks) {
    error.value = '此环境不支持安全的本地学习会话。请通过 HTTPS 或 localhost 使用支持 Web Locks 的浏览器。'
    return
  }
  acquiring.value = true
  void navigator.locks.request('astro-sky-learning-writer', { ifAvailable: true }, async lock => {
    acquiring.value = false
    if (!lock || disposed) return
    // Refresh after obtaining the lock so a previously open read-only tab cannot overwrite newer work.
    const released = new Promise<void>(resolve => { releaseLock = resolve })
    await refresh()
    if (disposed) { releaseLock?.(); return }
    writable.value = true
    if (page.value !== 'session' && hasUnfinishedSession.value) await markSessionExposed()
    if (page.value === 'progress') await commit(current => exposeTargets(current, Object.values(current.cards).map(card => card.targetId)))
    await released
    writable.value = false
  }).catch(cause => { acquiring.value = false; error.value = message(cause) })
}

async function commit(change: (current: LearningArchive) => LearningArchive | void): Promise<boolean> {
  if (blocked.value || !archive.value) return false
  saving.value = true
  error.value = ''
  notice.value = ''
  retryAction.value = null
  const revision = archive.value.revision
  const copy = cloneArchive()
  try {
    const result = change(copy) ?? copy
    archive.value = await saveArchive(result, revision)
    now.value = Date.now()
    return true
  } catch (cause) {
    error.value = message(cause)
    if (cause instanceof LearningStorageConflictError) {
      error.value = '记录已被另一页面更新。请重新读取记录后继续，本次未覆盖已有进度。'
    } else retryAction.value = () => commit(change)
    return false
  } finally { saving.value = false }
}

function isCurrentLesson(id: string): boolean {
  return !!hasUnfinishedSession.value && session.value?.mode === 'learn' && session.value.lessonId === id
}
async function startLesson(id: string): Promise<boolean> {
  if (blocked.value) return false
  if (isCurrentLesson(id)) { await router.push('/learn/sky/session'); return true }
  if (await commit(current => {
    const previousTargets = current.session?.questions.map(item => item.targetId) ?? []
    current.session = createLessonSession(id)
    return exposeTargets(current, [...previousTargets, ...lessons.find(item => item.id === id)!.starIds.filter(starId => studyTargetIds.has(starId))])
  })) {
    input.value = ''; selectedId.value = null
    await router.push('/learn/sky/session')
    return true
  }
  // Retrying a failed course switch must also enter the selected lesson after it is saved.
  if (retryAction.value) retryAction.value = () => startLesson(id)
  return false
}
async function startReview() {
  if (hasUnfinishedSession.value) { await router.push('/learn/sky/session'); return }
  if (!archive.value) return
  const review = createReviewSession(archive.value)
  if (!review) return
  if (await commit(current => { current.session = review })) {
    input.value = ''; selectedId.value = null
    await router.push('/learn/sky/session')
  }
}
async function beginQuestions() {
  await commit(current => {
    const active = current.session!
    active.exposedTargetIds = [...(lesson.value?.targetIds ?? [])]
    if (active.questions.length) active.phase = 'question'
    else {
      active.phase = 'complete'
      current.completedLessonIds = [...new Set([...current.completedLessonIds, active.lessonId])]
    }
  })
}
async function showHint() {
  await commit(current => {
    current.session!.hinted = true
    current.session!.exposedTargetIds = [...new Set(current.session!.questions.map(item => item.targetId))]
    return exposeTargets(current, current.session!.exposedTargetIds)
  })
}
async function answer(correct: boolean, pickedId?: string) {
  if (!session.value || !question.value || session.value.phase !== 'question' || blocked.value) return
  const active = session.value
  const q = question.value
  const attempt: LearningAttempt = { id: q.id, unitId: q.unitId, lessonId: active.lessonId, skill: q.skill,
    correct, hinted: active.hinted, exposed: active.exposedTargetIds.includes(q.targetId) || wasRecentlyExposed(archive.value!, q.targetId), answeredAt: Date.now() }
  if (await commit(current => {
    const result = recordAttempt(current, attempt, q.targetId)
    result.session!.phase = 'feedback'
    result.session!.lastAttempt = attempt
    result.session!.exposedTargetIds = [...new Set([...result.session!.exposedTargetIds, q.targetId])]
    return exposeTargets(result, [q.targetId])
  })) selectedId.value = pickedId ?? null
}
function pickStar(id: string) {
  if (question.value?.skill === 'locate') void answer(id === question.value.targetId, id)
}
function submitName() { if (target.value && input.value.trim()) void answer(acceptsStarName(target.value, input.value)) }
async function advance() {
  if (await commit(current => {
    const active = current.session!
    active.index += 1
    active.hinted = false
    delete active.lastAttempt
    if (active.index >= active.questions.length) {
      active.phase = 'complete'
      if (active.mode === 'learn') current.completedLessonIds = [...new Set([...current.completedLessonIds, active.lessonId])]
    } else active.phase = 'question'
  })) { input.value = ''; selectedId.value = null; await nextTick(); answerInput.value?.focus() }
}
async function endSession() {
  const directory = isChineseLesson(lesson.value) ? '/learn/chinese' : '/learn/sky'
  if (await commit(current => {
    const exposed = exposeTargets(current, current.session?.questions.map(item => item.targetId) ?? [])
    exposed.session = null
    return exposed
  })) await router.push(directory)
}
function downloadBackup() {
  if (!archive.value) return
  try {
    const url = URL.createObjectURL(new Blob([exportBackup(archive.value)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `astro-learning-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = '已发起备份下载，请确认文件已保存。'
  } catch (cause) { error.value = message(cause) }
}
async function chooseBackup(event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  importPreview.value = null; error.value = ''
  if (!file) return
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('备份不能超过 5 MB。')
    const parsed = parseBackup(await file.text())
    validateContentReferences(parsed)
    importPreview.value = parsed
  } catch (cause) { error.value = message(cause) }
  finally { element.value = '' }
}
async function restoreBackup() {
  if (!importPreview.value) return
  const restored = JSON.parse(JSON.stringify(importPreview.value)) as LearningArchive
  // A transfer resumes from committed progress; never resurrect an old in-flight question.
  restored.session = null
  if (await commit(() => restored)) { importPreview.value = null; notice.value = '备份已恢复，原始复习日期已保留。' }
}
async function clearProgress() {
  if (await commit(current => {
    current.attempts = []; current.cards = {}; current.completedLessonIds = []; current.session = null; current.exposures = {}
  })) { resetRequested.value = false; notice.value = '已清除本浏览器的星图学习记录。' }
}
function wake() { now.value = Date.now(); if (!document.hidden && !writable.value) void refresh() }
async function markSessionExposed() {
  return commit(current => {
    if (current.session) current.session.exposedTargetIds = [...new Set(current.session.questions.map(item => item.targetId))]
    return exposeTargets(current, current.session?.exposedTargetIds ?? [])
  })
}
async function guardNavigation(to: { name?: unknown }) {
  if (saving.value) return false
  // Other pages contain names and reference material. Returning to this session is practice, not an independent test.
  if (page.value === 'session' && hasUnfinishedSession.value && writable.value && !await markSessionExposed()) return false
  if (to.name === 'sky-learning-progress' && writable.value) return commit(current => exposeTargets(current, Object.values(current.cards).map(card => card.targetId)))
  return true
}
onMounted(async () => {
  await refresh(); await acquireWriter()
  if (disposed) return
  clockTimer = setInterval(() => { now.value = Date.now() }, 30_000)
  document.addEventListener('visibilitychange', wake)
})
onBeforeUnmount(() => { disposed = true; releaseLock?.(); clearInterval(clockTimer); document.removeEventListener('visibilitychange', wake) })
onBeforeRouteLeave(guardNavigation)
onBeforeRouteUpdate(guardNavigation)
</script>

<template>
  <div class="learning-page" :class="{ 'is-session': page === 'session' }">
    <header class="learning-heading">
      <div><p class="learning-kicker"><Sparkles :size="15" aria-hidden="true" /> {{ isChinese ? '从三垣到四象 · 认识传统星空' : '从一颗星，到整片天空 · 中文课程' }}</p><h1>{{ isChinese ? '中国星宫' : '星空记忆' }}</h1><p class="heading-description">{{ isChinese ? '以三垣建立方位，以七宿串起四象，记住星官与星名。' : '循着亮星认识星图，让每一次仰望，都多一份熟悉。' }}</p></div>
      <RouterLink class="map-link" to="/sky-map"><Compass :size="18" /> 打开完整星图 <ArrowUpRight :size="16" /></RouterLink>
    </header>
    <nav class="learning-tabs" aria-label="星空学习导航">
      <RouterLink to="/learn/sky" :class="{ active: page === 'courses' && !isChinese }"><Compass :size="16" aria-hidden="true" /> 认识星空</RouterLink>
      <RouterLink to="/learn/chinese" :class="{ active: page === 'courses' && isChinese }"><Sparkles :size="16" aria-hidden="true" /> 中国星宫</RouterLink>
      <RouterLink to="/learn/sky/progress" :class="{ active: page === 'progress' }"><Layers3 :size="16" aria-hidden="true" /> 学习进度与备份</RouterLink>
      <RouterLink v-if="session" to="/learn/sky/session" :class="{ active: page === 'session' }">{{ session.phase === 'complete' ? '本次结果' : '继续本次学习' }}</RouterLink>
    </nav>
    <p class="local-note"><ShieldCheck :size="14" aria-hidden="true" /><span>无需登录 · 记录仅保存在此浏览器。换设备或清除网站数据前，请导出备份；共用浏览器也会共用进度。</span></p>
    <p v-if="loading" role="status">正在读取本地学习记录…</p>
    <div v-if="error" class="learning-alert" role="alert"><p>{{ error }}</p><button v-if="retryAction" class="button secondary" :disabled="saving" @click="retryAction?.()">重试保存</button> <button class="button secondary" :disabled="saving" @click="refresh">重新读取</button></div>
    <p v-if="notice" class="learning-notice" role="status">{{ notice }}</p>
    <div v-if="!loading && !writable" class="learning-alert">另一个学习页面可能正在使用记录。本页可以浏览；请关闭另一个学习页面后继续。 <button class="button secondary" :disabled="acquiring" @click="acquireWriter">在此页继续</button></div>

    <template v-if="archive && !loading">
      <template v-if="page === 'courses'">
        <section class="learning-start">
          <div class="featured-course"><div class="featured-copy"><p class="learning-kicker"><span class="live-dot" /> {{ hasUnfinishedSession ? '接着上次，继续探索' : '下一步 · 从这里开始' }}</p><h2>{{ hasUnfinishedSession ? '继续上次的星空练习' : nextLesson?.title ?? '回到星空，再认一次' }}</h2><p>{{ hasUnfinishedSession ? `${lesson?.title ?? ''} · 已保存到最近一步，也可在下方自由选择其他课程。` : nextLesson ? courseSummary(nextLesson) : '全部课程已学习一遍。通过跨日复习巩固星名与位置，也可重访不熟悉的星区。' }}</p>
            <div class="featured-actions">
            <RouterLink v-if="hasUnfinishedSession" class="button primary" to="/learn/sky/session">继续上次学习 <ArrowRight :size="16" /></RouterLink>
            <button v-else-if="nextLesson" class="button primary" :disabled="blocked" @click="startLesson(nextLesson.id)">{{ completedCount ? '学习下一课' : '开始第一课' }} <ArrowRight :size="16" /></button>
            <a class="directory-link" href="#course-directory">自由选择课程 <ArrowRight :size="14" /></a>
            </div>
          </div><div v-if="featuredLesson" class="featured-chart"><LessonPreview :lesson="featuredLesson" featured /><span>真实星位 · 形状预览</span></div></div>
          <div class="review-box"><div class="review-title"><RotateCcw :size="17" /><span>让记忆更长久</span></div><div class="review-count"><strong>{{ due.length }}</strong><span>项到期复习</span></div><p>{{ due.length ? '再认一次，巩固星名与位置。' : '慢慢来，先认识一片新的星空。' }}</p><button class="button secondary" :disabled="blocked || !due.length" @click="startReview">{{ hasUnfinishedSession ? '先继续本次学习' : '开始今日复习' }} <ArrowRight :size="14" /></button><small>每次复习一片星区，按到期时间安排。</small></div>
        </section>
        <ChineseSkyOverview v-if="isChinese" :completed-lesson-ids="archive.completedLessonIds" :disabled="blocked" @select-lesson="startLesson" @select-stage="selectChineseStage" />
        <section id="course-directory" class="course-directory" aria-label="课程目录">
        <div class="course-heading"><div><p class="learning-kicker">{{ String(groups.length).padStart(2, '0') }} 个阶段 · 每一课都可以直接开始</p><h2>{{ isChinese ? '中国星宫的学习路线' : '从零开始的学习路线' }}</h2></div><div class="course-completion"><span>{{ completedCount }} / {{ courseLessons.length }} 课已完成学习</span><progress :value="completedCount" :max="courseLessons.length" aria-label="课程学习进度" /></div></div>
        <p class="directory-description">先认形，再记少量星名。固定星图帮助建立记忆，户外观测请在完整星图中设置地点与时间。</p>
        <details v-if="hasUnfinishedSession" class="switch-note"><summary>自由切课，已保存的进度会保留</summary><p>可随时选择其他课。切课会保留已保存的作答、复习安排和完成记录；被切换的未完成课程再次进入时，从导读开始。</p></details>
        <div class="curriculum-layout">
          <aside class="stage-sidebar" aria-label="阶段快捷导航"><div class="stage-sidebar-heading"><ListFilter :size="15" /> 学习阶段 <span>{{ groups.length }}</span></div><button class="stage-shortcut" :class="{ selected: selectedStage === 'all' }" :aria-pressed="selectedStage === 'all'" @click="selectChineseStage('all')"><span class="stage-number"><Layers3 :size="14" /></span><span class="stage-name">全部阶段</span><span class="stage-total">{{ courseLessons.length }}</span></button><button v-for="(group, index) in stageProgress" :key="group.id" class="stage-shortcut" :class="{ selected: selectedStage === group.id }" :aria-pressed="selectedStage === group.id" @click="selectChineseStage(group.id)"><span class="stage-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="stage-name">{{ group.title }}</span><span class="stage-total">{{ group.completed }}/{{ group.total }}</span></button><p class="sidebar-note"><ShieldCheck :size="14" /> 学习进度自动保存在本机</p></aside>
          <div class="course-results">
        <div class="course-filters">
          <label for="course-stage">学习阶段<select id="course-stage" v-model="selectedStage"><option value="all">全部阶段 · {{ courseLessons.length }} 课</option><option v-for="(group, index) in groups" :key="group.id" :value="group.id">{{ String(index + 1).padStart(2, '0') }} · {{ group.title }}</option></select></label>
          <label class="course-search" for="course-search">查找课程<span class="search-field"><Search :size="16" aria-hidden="true" /><input id="course-search" v-model="courseQuery" type="search" :placeholder="isChinese ? '输入课号、星官或星名' : '输入课号、星座或星名'" /></span></label>
        </div>
        <div class="course-result-toolbar"><div class="status-filters" role="group" aria-label="按学习状态筛选"><button :aria-pressed="courseStatus === 'all'" @click="courseStatus = 'all'">全部</button><button :aria-pressed="courseStatus === 'unlearned'" @click="courseStatus = 'unlearned'">未完成</button><button :aria-pressed="courseStatus === 'completed'" @click="courseStatus = 'completed'">已完成</button></div><span role="status">显示 {{ filteredLessons.length }} / {{ courseLessons.length }} 课</span><button v-if="selectedStage !== 'all' || courseQuery || courseStatus !== 'all'" class="text-button reset-filters" @click="resetCourseFilters">显示全部课程</button></div>
        <div v-if="!filteredLessons.length" class="empty-state"><Search :size="28" /><h3>没有匹配的课程</h3><p>试试其他课号、名称，或调整学习状态。</p><button class="button secondary" @click="resetCourseFilters">重置筛选条件</button></div>
        <section v-for="group in filteredGroups" :key="group.id" class="course-group">
          <div class="group-heading"><h3><span>{{ String(group.number).padStart(2, '0') }}</span>{{ group.title }}</h3><span>{{ group.lessons.length }} 课</span></div><p class="muted group-description">{{ group.description }}</p>
          <div class="lesson-grid"><article v-for="item in group.lessons" :key="item.id" class="lesson-card" :class="{ 'is-completed': completedIds.has(item.id), 'is-current': isCurrentLesson(item.id) }">
            <div class="lesson-visual"><LessonPreview :lesson="item" /><span class="lesson-number">{{ String(courseLessons.indexOf(item) + 1).padStart(2, '0') }}</span><span v-if="isCurrentLesson(item.id)" class="lesson-state">学习中</span><span v-else-if="completedIds.has(item.id)" class="lesson-state"><Check :size="12" /> 已完成</span></div>
            <div class="lesson-card-body"><p class="lesson-kind"><span>第 {{ courseLessons.indexOf(item) + 1 }} 课 · {{ item.targetIds.length ? `${item.targetIds.length} 个星名 · 定位与回忆` : '图形导读' }}</span></p>
            <h4>{{ item.title }}</h4><p class="lesson-summary">{{ courseSummary(item) }}</p>
            <button class="lesson-link" :disabled="blocked" @click="startLesson(item.id)">{{ isCurrentLesson(item.id) ? '继续本课' : archive.completedLessonIds.includes(item.id) ? '重新学习' : '进入课程' }} <ArrowRight :size="16" /></button>
            </div>
          </article></div>
        </section>
          </div>
        </div>
        </section>
        <aside v-if="isChinese" class="roadmap"><BookOpen :size="23" /><div><h3>先认星官，再连接天区</h3><p>从北斗与北极附近开始，分辨三垣，再按青龙、玄武、白虎、朱雀的顺序认识二十八宿，最后复习代表星官。课程使用传统连线与现代恒星坐标；覆盖入门所需的星官，并非古代全部星官或某一朝代的天空复原。图形导读只记录学习完成，星名课提供定位与回忆练习。</p></div></aside>
        <aside v-else class="roadmap"><BookOpen :size="23" /><div><h3>从熟悉的亮星，走向全天 88 星座</h3><p>前 19 课建立四季骨架，再依次学习四季连通、第二轮星名、邻区补全、南天路线与综合回顾。可按兴趣直接选课；较暗星区先认位置和形状，无需一次记住所有星名。导读完成表示学习过，独立认形测验仍待补充。</p></div></aside>
      </template>

      <section v-else-if="page === 'session' && session && lesson" class="session-section">
        <div class="session-topline"><RouterLink :to="isChinese ? '/learn/chinese' : '/learn/sky'" class="directory-link"><BookOpen :size="15" /> 课程目录</RouterLink><ol class="session-steps" aria-label="本课学习步骤"><li :class="{ active: session.phase === 'study', done: session.phase !== 'study' }" :aria-current="session.phase === 'study' ? 'step' : undefined"><span>01</span> 观察星图</li><li v-if="session.questions.length" :class="{ active: session.phase === 'question' || session.phase === 'feedback', done: session.phase === 'complete' }" :aria-current="session.phase === 'question' || session.phase === 'feedback' ? 'step' : undefined"><span>02</span> 回忆练习</li><li :class="{ active: session.phase === 'complete' }" :aria-current="session.phase === 'complete' ? 'step' : undefined"><span>{{ session.questions.length ? '03' : '02' }}</span> 完成学习</li></ol></div>
        <header class="session-heading"><div><p class="learning-kicker">{{ session.mode === 'review' ? '今日复习' : stageTitle }}</p><h2>{{ session.phase === 'study' || session.phase === 'complete' ? lesson.title : '在星图中找回记忆' }}</h2></div><button class="text-button" :disabled="blocked" @click="endSession">结束本次，保留进度</button></header>
        <div v-if="session.questions.length && session.phase !== 'study' && session.phase !== 'complete'" class="exercise-progress"><progress :value="answeredCount" :max="session.questions.length" aria-label="本次练习进度" /><span>{{ answeredCount }} / {{ session.questions.length }} 已作答</span></div>
        <template v-if="session.phase !== 'complete'">
          <div class="session-layout">
            <LearningStarChart :stars="lessonStars" :paths="lesson.paths" :center-ra-deg="lesson.centerRaDeg" :center-dec-deg="lesson.centerDecDeg" :label-ids="studyLabelIds"
              :variant="session.phase === 'study' ? studyVariant : question?.variant ?? 0" :show-labels="session.phase === 'study' && studyLabels" :show-lines="session.phase === 'study' ? studyLines : session.hinted || session.phase === 'feedback'"
              :highlight-id="session.phase === 'feedback' || question?.skill === 'name' ? target?.id : null" :selected-id="selectedId"
              :disabled="blocked || session.phase !== 'question' || question?.skill !== 'locate'" @select="pickStar" />
            <div class="exercise-panel">
              <template v-if="session.phase === 'study'">
                <p class="learning-kicker"><Compass :size="15" aria-hidden="true" /> 先认识它</p><h3>{{ lesson.title }}</h3><p>{{ lesson.description }}</p><p class="tip">{{ lesson.tip }}</p>
                <div class="study-controls" aria-label="学习星图显示"><label><input v-model="studyLines" type="checkbox" /> 连线</label><label v-if="studyLabelIds.length"><input v-model="studyLabels" type="checkbox" /> 主要星名</label><button class="text-button" @click="studyVariant += 1">换个朝向</button></div>
                <ul v-if="lesson.targetIds.length" class="target-list"><li v-for="id in lesson.targetIds" :key="id"><strong>{{ starForLesson(id, lesson)?.name }}</strong></li></ul>
                <p class="muted">{{ lesson.targetIds.length ? '观察星点之间的关系。练习时会隐藏名称并改变图形朝向。' : '先建立形状与位置的印象。本课是导读，不计作独立测验。' }}</p>
                <button class="button primary" :disabled="blocked" @click="beginQuestions">{{ lesson.targetIds.length ? '隐藏提示，开始练习' : '完成这节导读' }} <ArrowRight :size="16" /></button>
              </template>
              <template v-else-if="question && target">
                <p class="learning-kicker"><Target :size="15" aria-hidden="true" /> {{ session.index + 1 }} / {{ session.questions.length }} · {{ question.skill === 'locate' ? '看名字找星' : '看星点想名字' }}</p>
                <h3>{{ question.skill === 'locate' ? `请在图中找到${target.name}` : '标记的这颗星叫什么？' }}</h3>
                <template v-if="session.phase === 'question'">
                  <p class="muted">{{ question.skill === 'locate' ? '点击一个星点提交答案；也可用 Tab 选择星点，再按回车。' : '输入中文名或已学习的别名。想不起来时，可以先看提示。' }}</p>
                  <form v-if="question.skill === 'name'" @submit.prevent="submitName"><label for="star-answer">星名</label><input id="star-answer" ref="answerInput" v-model="input" autocomplete="off" placeholder="输入你记得的星名…" :disabled="blocked" maxlength="100" /><button class="button primary" :disabled="blocked || !input.trim()" type="submit">提交答案 <ArrowRight :size="16" /></button><small class="input-hint">按 Enter 提交，也接受已收录的别名</small></form>
                  <div class="exercise-actions"><button class="button secondary" :disabled="blocked || session.hinted" @click="showHint">{{ session.hinted ? '已使用提示' : '看结构提示' }}</button><button class="text-button" :disabled="blocked" @click="answer(false)">暂时想不起来</button></div>
                  <p v-if="session.hinted" class="tip">{{ lesson.tip }}<br>本题会记为借助提示完成。</p>
                </template>
                <div v-else class="answer-feedback" :class="{ 'is-correct': session.lastAttempt?.correct }" aria-live="polite">
                  <div class="feedback-icon"><CheckCircle2 v-if="session.lastAttempt?.correct" :size="26" /><RotateCcw v-else :size="26" /></div>
                  <strong :class="session.lastAttempt?.correct ? 'correct' : 'incorrect'">{{ session.lastAttempt?.correct ? '答对了' : '一起再认一次' }}</strong>
                  <p>标记的正确目标：<b>{{ target.name }}</b></p>
                  <p v-if="session.lastAttempt?.hinted || session.lastAttempt?.exposed" class="muted">这次有提示或刚学习过答案，计作巩固练习；后续复习再检查独立回忆。</p>
                  <p v-else class="muted">{{ session.lastAttempt?.correct ? '已记录这次独立回忆。' : '已加入待复习内容。' }}</p>
                  <p class="saved"><ShieldCheck :size="14" /> 已保存到此浏览器</p><button class="button primary" :disabled="blocked" @click="advance">{{ session.index + 1 === session.questions.length ? '查看本次结果' : '下一题' }} <ArrowRight :size="16" /></button>
                </div>
              </template>
            </div>
          </div>
        </template>
        <div v-else class="completion"><div class="completion-emblem"><Check :size="32" /></div><p class="learning-kicker">又认识了一片星空</p><h2>{{ session.questions.length ? '本次练习完成' : '导读完成' }}</h2><p>{{ session.questions.length ? `完成 ${sessionAttempts.length} 题，答对 ${sessionAttempts.filter(attempt => attempt.correct).length} 题，其中 ${independentCorrect} 题为无提示、近期未看过答案的回忆。` : '已经认识这片星空的基本线索，可以继续下一课。' }}</p><p class="muted">完成课程代表已经学习一遍。长期记忆需要跨日复习；实际观测与图上练习不同。</p><div class="exercise-actions"><button v-if="followingLesson" class="button primary" :disabled="blocked" @click="startLesson(followingLesson.id)">继续下一课 <ArrowRight :size="16" /></button><button class="button secondary" :disabled="blocked" @click="endSession">回到课程目录</button><RouterLink class="text-button" to="/learn/sky/progress">查看学习进度</RouterLink></div><p v-if="followingLesson" class="next-lesson-note">下一课 · {{ followingLesson.title }}</p></div>
      </section>
      <section v-else-if="page === 'session'" class="empty-state"><h2>从一节短课开始</h2><p>目前没有进行中的练习。</p><RouterLink class="button primary" to="/learn/sky">选择课程</RouterLink></section>

      <section v-else-if="page === 'progress'">
        <div class="progress-summary"><article><strong>{{ completedCount }}</strong><span>课已完成学习</span></article><article><strong>{{ archive.attempts.length }}</strong><span>次已保存作答</span></article><article><strong>{{ due.length }}</strong><span>项到期复习</span></article></div>
        <p class="muted">认识星空 {{ westernCompleted }} / {{ westernLessons.length }} 课 · 中国星宫 {{ chineseCompleted }} / {{ chineseLessons.length }} 课。两条路线共用本地档案；同一颗星的定位与名称练习共享复习安排，名称题也接受已收录的别名。</p>
        <h2>星名与位置，分别巩固</h2><p class="muted">当前使用 1、3、7、14、30 天的初版复习阶梯，按作答调整；不表示个人记忆概率，也不等同于实地辨认能力。</p>
        <div v-if="cards.length" class="progress-table-wrap"><table class="progress-table"><thead><tr><th>目标</th><th>能力</th><th>独立答对 / 作答</th><th>下次复习</th></tr></thead><tbody><tr v-for="card in cards" :key="card.unitId"><td>{{ starForLesson(card.targetId, lessons.find(item => item.id === card.lessonId))?.name ?? card.targetId }}</td><td>{{ card.skill === 'locate' ? '星图定位' : '星名回忆' }}</td><td>{{ card.successes }} / {{ card.reviews }}</td><td>{{ card.dueAt <= now ? '已到期' : dateText(card.dueAt) }}</td></tr></tbody></table></div>
        <p v-else class="empty-state">完成第一组练习后，这里会出现各项能力和复习时间。</p>
        <section class="backup-panel"><h2>带走你的学习记录</h2><p class="muted">备份包含认识星空和中国星宫两条路线，在另一台设备导入即可继续。导入会整体替换当前记录，不会合并两份进度。</p><div class="exercise-actions"><button class="button secondary" @click="downloadBackup"><Download :size="16" /> 导出备份</button><button class="button secondary" :disabled="blocked" @click="fileInput?.click()"><Upload :size="16" /> 导入备份</button><input ref="fileInput" class="sr-only" type="file" accept="application/json,.json" tabindex="-1" aria-label="选择学习备份" @change="chooseBackup" /></div>
          <div v-if="importPreview" class="import-preview"><h3>确认恢复这份备份</h3><p>最近更新：{{ dateText(importPreview.updatedAt) }} · {{ importPreview.completedLessonIds.length }} 课 · {{ importPreview.attempts.length }} 次作答。</p><p>当前 {{ archive.attempts.length }} 次作答将被替换。建议先导出当前备份。</p><div class="exercise-actions"><button class="button secondary" @click="downloadBackup">先备份当前记录</button><button class="button primary" :disabled="blocked" @click="restoreBackup">替换并恢复</button><button class="text-button" @click="importPreview = null">取消</button></div></div>
          <div class="reset-section"><button class="text-button" :disabled="blocked" @click="resetRequested = !resetRequested">清除本地学习记录</button><div v-if="resetRequested" class="import-preview"><p>将删除此浏览器认识星空和中国星宫两条路线的课程进度、作答和复习记录。建议先导出备份。</p><button class="button secondary" :disabled="blocked" @click="clearProgress">确认清除学习记录</button> <button class="text-button" @click="resetRequested = false">取消</button></div></div>
        </section>
      </section>
    </template>
    <details class="source-notes"><summary>星图数据与来源</summary><p>{{ coordinateNote }}</p><p>中国星宫采用本项目收录的 Stellarium 中国星空文化版本，以香港太空馆星图及伊世同《中西对照恒星图表（1950.0）》等为依据。传统星官的划分与连线存在时代、文献差异；当前显示现代星位，不是古代某年天空的复原。</p><ul><li v-for="source in sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}</a> — {{ source.attribution }} <span v-if="'license' in source">（{{ source.license }}）</span></li></ul><p>入门阅读：<a href="https://www.hokoon.edu.hk/weeklysp/1909_5.html" target="_blank" rel="noopener noreferrer">可观自然教育中心暨天文馆：三垣四象二十八宿</a>。</p></details>
    <p v-if="saving" role="status" class="saving-status">正在保存…</p>
  </div>
</template>

<style scoped src="../features/sky-learning/learning-page.css"></style>
