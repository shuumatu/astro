<script lang="ts">
import { stars, type LearningLesson } from './content'
import { projectLearningStars } from './projection'
const starsById = new Map(stars.map(star => [star.id, star]))
</script>

<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ lesson: LearningLesson; featured?: boolean }>(), { featured: false })
const projected = computed(() => {
  const ids = new Set([...props.lesson.paths.flat(), ...props.lesson.targetIds])
  const points = [...ids].flatMap(id => { const star = starsById.get(id); return star ? [star] : [] })
  return projectLearningStars(points, { raDeg: props.lesson.centerRaDeg, decDeg: props.lesson.centerDecDeg }, 240, 120, 0, 18)
})
const segments = computed(() => {
  const points = new Map(projected.value.map(star => [star.id, star]))
  return props.lesson.paths.flatMap(path => path.slice(1).flatMap((id, index) => {
    const from = points.get(path[index]); const to = points.get(id)
    return from && to ? [{ from, to }] : []
  }))
})
</script>

<template>
  <svg class="lesson-preview" :class="{ featured }" viewBox="0 0 240 120" aria-hidden="true" focusable="false">
    <g class="preview-lines"><line v-for="(line, index) in segments" :key="index" :x1="line.from.x" :y1="line.from.y" :x2="line.to.x" :y2="line.to.y" /></g>
    <g v-for="star in projected" :key="star.id">
      <circle v-if="star.magnitude < 2" :cx="star.x" :cy="star.y" r="5" class="preview-halo" />
      <circle :cx="star.x" :cy="star.y" :r="Math.max(.7, Math.min(2.4, 2.4 - star.magnitude * .25))" :class="lesson.targetIds.includes(star.id) ? 'preview-target' : 'preview-star'" />
    </g>
  </svg>
</template>

<style scoped>
.lesson-preview { display: block; width: 100%; height: 100%; padding: 4px 22px; }
.preview-lines { stroke: var(--color-blue); stroke-width: .7; opacity: .35; }
.preview-star { fill: var(--color-blue); opacity: .85; }
.preview-target { fill: var(--color-gold); }
.preview-halo { fill: var(--color-blue); opacity: .09; }
.featured { padding: 0; min-height: 120px; }
.featured .preview-lines { stroke: var(--color-gold); opacity: .4; }
</style>
