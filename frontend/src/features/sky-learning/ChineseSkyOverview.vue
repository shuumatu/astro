<script setup lang="ts">
import { computed, useId } from 'vue'
import { chineseFigures, chineseLessons } from './content'

const props = withDefaults(defineProps<{
  completedLessonIds: string[]
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{
  selectLesson: [id: string]
  selectStage: [id: string]
}>()

const headingId = `chinese-sky-overview-${useId()}`
const completed = computed(() => new Set(props.completedLessonIds))
const enclosures = [
  { name: '紫微', subtitle: '从北极附近认识天上的宫城', marker: '01' },
  { name: '太微', subtitle: '在狮子与室女一带寻找垣墙', marker: '02' },
  { name: '天市', subtitle: '在武仙、蛇夫附近认识天市', marker: '03' },
].map(enclosure => ({
  ...enclosure,
  lesson: chineseLessons.find(lesson => lesson.stage === 'cn-enclosures' && lesson.title.includes(enclosure.name)),
}))

const quadrantDefinitions = [
  { stage: 'cn-dragon', name: '东方青龙', direction: '东', tone: 'jade', cue: '从角起步，循龙身到箕', mansions: ['角', '亢', '氐', '房', '心', '尾', '箕'] },
  { stage: 'cn-tortoise', name: '北方玄武', direction: '北', tone: 'blue', cue: '从斗到壁，七宿依次连接', mansions: ['斗', '牛', '女', '虚', '危', '室', '壁'] },
  { stage: 'cn-tiger', name: '西方白虎', direction: '西', tone: 'silver', cue: '从奎到参，留意昴、毕的星形', mansions: ['奎', '娄', '胃', '昴', '毕', '觜', '参'] },
  { stage: 'cn-bird', name: '南方朱雀', direction: '南', tone: 'amber', cue: '从井到轸，分段记住七宿', mansions: ['井', '鬼', '柳', '星', '张', '翼', '轸'] },
].map(quadrant => ({
  ...quadrant,
  mansions: quadrant.mansions.map(name => {
    const figure = chineseFigures.find(figure => figure.name === name || figure.name === `${name}宿`)
    const lesson = figure && chineseLessons.find(lesson => lesson.stage === quadrant.stage && lesson.asterismIds?.includes(figure.id))
    return { name, lesson }
  }),
}))
const quadrants = computed(() => quadrantDefinitions.map(quadrant => ({
  ...quadrant,
  learned: quadrant.mansions.filter(mansion => mansion.lesson && completed.value.has(mansion.lesson.id)).length,
})))

function lessonLabel(name: string, lesson: (typeof chineseLessons)[number] | undefined) {
  if (!lesson) return `${name}，课程准备中`
  return `${name}：${lesson.title}，${completed.value.has(lesson.id) ? '已完成学习，重新学习' : '进入课程'}`
}
</script>

<template>
  <section class="chinese-overview" :aria-labelledby="headingId">
    <header class="overview-heading">
      <div>
        <p class="overview-kicker">中国星空 · 学习索引</p>
        <h2 :id="headingId">三垣为纲，四象为序</h2>
        <p class="overview-intro">先三垣，再按四象记七宿；宿在这里读 <span lang="zh-Latn">xiù</span>。</p>
      </div>
      <div class="overview-guide"><span class="guide-dot" aria-hidden="true"></span>点击星官，直接进入课程</div>
    </header>

    <div class="section-label"><span>01</span> 认识三垣 <i aria-hidden="true"></i><small>建立星空的整体框架</small></div>
    <div class="enclosure-grid" aria-label="三垣课程入口">
      <button v-for="enclosure in enclosures" :key="enclosure.name" type="button" class="enclosure-button"
        :class="{ completed: enclosure.lesson && completed.has(enclosure.lesson.id) }"
        :disabled="disabled || !enclosure.lesson"
        :aria-label="lessonLabel(`${enclosure.name}垣`, enclosure.lesson)"
        @click="enclosure.lesson && emit('selectLesson', enclosure.lesson.id)">
        <span class="enclosure-symbol" aria-hidden="true">
          <svg width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" /><ellipse cx="21" cy="21" rx="9" ry="16" :transform="`rotate(${Number(enclosure.marker) * 35} 21 21)`" /><path d="M21 16v10M16 21h10" /><circle class="orbit-dot" cx="21" cy="5" r="2" /></svg>
        </span>
        <span class="enclosure-copy"><strong>{{ enclosure.name }}垣</strong><span>{{ enclosure.subtitle }}</span><small>{{ enclosure.lesson && completed.has(enclosure.lesson.id) ? '已学习 · 再看一次' : '进入图形导读' }} <span aria-hidden="true">↗</span></small></span>
        <svg v-if="enclosure.lesson && completed.has(enclosure.lesson.id)" class="enclosure-mark" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
      </button>
    </div>

    <div class="section-label"><span>02</span> 串起四象 <i aria-hidden="true"></i><small>每象七宿，循序记忆</small></div>
    <div class="quadrant-grid" aria-label="四象与二十八宿课程入口">
      <article v-for="quadrant in quadrants" :key="quadrant.stage" class="quadrant-card" :class="[`tone-${quadrant.tone}`, { 'all-learned': quadrant.learned === 7 }]">
        <div class="quadrant-heading">
          <h3><button type="button" class="quadrant-title" :disabled="disabled"
            :aria-label="`查看${quadrant.name}七宿课程`" @click="emit('selectStage', quadrant.stage)">
            <span class="direction-seal" aria-hidden="true">{{ quadrant.direction }}</span>
            <span>{{ quadrant.name }}</span><span class="stage-arrow" aria-hidden="true">→</span>
          </button></h3>
          <span class="quadrant-count"><strong>{{ quadrant.learned }}</strong> / 7 已学</span>
        </div>
        <p class="quadrant-cue">{{ quadrant.cue }}</p>
        <ol class="mansion-list">
          <li v-for="(mansion, index) in quadrant.mansions" :key="mansion.name">
            <button type="button" class="mansion-button" :class="{ completed: mansion.lesson && completed.has(mansion.lesson.id) }"
              :disabled="disabled || !mansion.lesson" :aria-label="lessonLabel(`${mansion.name}宿`, mansion.lesson)"
              :title="mansion.lesson?.title"
              @click="mansion.lesson && emit('selectLesson', mansion.lesson.id)">
              <small aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</small>
              <span class="mansion-name">{{ mansion.name }}</span>
              <span class="mansion-status" aria-hidden="true"><svg v-if="mansion.lesson && completed.has(mansion.lesson.id)" width="11" height="11" viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg><i v-else></i></span>
            </button>
          </li>
        </ol>
        <div class="quadrant-progress" role="progressbar" :aria-label="`${quadrant.name}学习进度`" :aria-valuenow="quadrant.learned" :aria-valuemin="0" :aria-valuemax="7"><span :style="{ width: `${quadrant.learned / 7 * 100}%` }"></span></div>
      </article>
    </div>

    <p class="overview-note">以下是记忆顺序，不代表当前观测方向；同名星官用于认识宿的线索，不代表整宿边界。</p>
  </section>
</template>

<style scoped src="./chinese-overview.css"></style>
