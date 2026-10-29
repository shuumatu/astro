<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Clock3 } from 'lucide-vue-next'
import { directionName, reasonText, timeLabel, typeName } from './presentation'
import { tonightSkyMapLocation } from './skyMapLink'
import type { TonightRecommendation, TonightRequest } from './types'

const props = defineProps<{ target: TonightRecommendation; request: TonightRequest; language: string; featured?: boolean }>()
const zh = computed(() => props.language.startsWith('zh'))
const time = (value: string) => timeLabel(value, props.request.timeZone, props.request.nightDate, props.language)
const path = computed(() => {
  const samples = props.target.samples
  if (!samples.length) return ''
  const start = Date.parse(samples[0].atUtc), span = Math.max(1, Date.parse(samples[samples.length - 1].atUtc) - start)
  return samples.map((sample, index) => `${index ? 'L' : 'M'}${((Date.parse(sample.atUtc) - start) / span * 300).toFixed(2)},${(77 - Math.max(-10, sample.altitudeDeg) / 90 * 65).toFixed(2)}`).join(' ')
})
const windowStyle = computed(() => {
  const samples = props.target.samples
  if (!samples.length) return { x: 0, width: 0 }
  const start = Date.parse(samples[0].atUtc), span = Math.max(1, Date.parse(samples[samples.length - 1].atUtc) - start)
  return { x: (Date.parse(props.target.recommendedWindow.startUtc) - start) / span * 300, width: (Date.parse(props.target.recommendedWindow.endUtc) - Date.parse(props.target.recommendedWindow.startUtc)) / span * 300 }
})
const pattern = computed(() => props.target.targetType === 'constellation' || props.target.targetType === 'asterism')
</script>

<template>
  <article class="target-card" :class="{ featured }" :data-target="target.targetId">
    <div class="target-top"><span class="target-type">{{ typeName(target.targetType, language) }}</span><span class="target-badge">{{ zh ? '裸眼探索' : 'Naked-eye' }}</span></div>
    <h3>{{ target.name }}</h3>
    <p class="target-window"><Clock3 :size="14" aria-hidden="true" />{{ time(target.recommendedWindow.startUtc) }} — {{ time(target.recommendedWindow.endUtc) }}</p>
    <p class="target-position">{{ zh ? '最佳' : 'Best' }} {{ time(target.bestAtUtc) }} <span>·</span> {{ directionName(target.positionAtBest.azimuthDeg, language) }} <span>·</span> {{ Math.round(target.positionAtBest.altitudeDeg) }}°</p>
    <svg class="altitude-chart" viewBox="0 0 300 94" role="img" :aria-label="zh ? '高度变化曲线，色带为推荐窗口' : 'Altitude curve; shaded band marks the recommended window'">
      <rect :x="windowStyle.x" y="5" :width="windowStyle.width" height="74" rx="3" class="chart-window" />
      <path d="M0 77 H300 M0 33 H300" class="chart-grid" />
      <path :d="path" class="chart-path" />
      <text x="0" y="92">{{ time(target.samples[0].atUtc) }}</text><text x="300" y="92" text-anchor="end">{{ time(target.samples[target.samples.length - 1].atUtc) }}</text>
    </svg>
    <ul class="target-reasons"><li v-for="reason in target.reasons.slice(0, 3)" :key="reason.code">{{ reasonText(reason, language) }}</li></ul>
    <p v-if="pattern" class="target-note">{{ zh ? `方位与高度以 ${target.anchorName} 为参考。` : `Direction and altitude refer to ${target.anchorName}.` }}</p>
    <p v-if="target.targetType === 'moon' || target.targetType === 'planet'" class="target-note">{{ zh ? '细小地形或行星细节需要合适的光学器材。' : 'Fine lunar or planetary details require suitable optical equipment.' }}</p>
    <details v-if="target.limitations.length" class="target-limits"><summary>{{ zh ? '观察时留意' : 'Keep in mind' }} · {{ target.limitations.length }}</summary><p v-for="reason in target.limitations" :key="reason.code">{{ reasonText(reason, language) }}</p></details>
    <RouterLink class="target-link" :to="tonightSkyMapLocation(target, request)">{{ zh ? '在星图中找到它' : 'Find it on the sky map' }}<ArrowUpRight :size="16" aria-hidden="true" /></RouterLink>
  </article>
</template>

<style scoped>
.target-card{display:flex;flex-direction:column;min-width:0;padding:24px;border:1px solid var(--color-border);border-radius:14px;background:var(--color-surface)}
.target-card.featured{background:linear-gradient(150deg,color-mix(in srgb,var(--color-gold) 6%,var(--color-surface)),var(--color-surface));border-color:color-mix(in srgb,var(--color-gold) 26%,var(--color-border))}
.target-top{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:11px}.target-type{color:var(--color-gold);letter-spacing:.08em}.target-badge{color:var(--color-text-muted);padding:3px 7px;border:1px solid var(--color-border);border-radius:20px}
h3{margin:16px 0 14px;font-size:23px;font-weight:550;letter-spacing:.025em}.target-window{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-gold);margin:0 0 8px;font-variant-numeric:tabular-nums}.target-position{margin:0;color:var(--color-text-muted);font-size:12px}.target-position span{padding:0 5px;color:var(--color-text-subtle)}
.altitude-chart{display:block;width:100%;height:96px;margin:14px 0 8px;overflow:visible}.chart-window{fill:var(--color-gold);opacity:.08}.chart-grid{stroke:var(--color-border);stroke-width:.7;stroke-dasharray:3 4}.chart-path{stroke:var(--color-gold);stroke-width:1.5;fill:none}.altitude-chart text{font-size:9px;fill:var(--color-text-subtle)}
.target-reasons{padding-left:16px;margin:8px 0;font-size:12px;line-height:1.9;color:var(--color-text-muted)}.target-reasons li::marker{color:var(--color-gold)}.target-note{font-size:10px;line-height:1.8;color:var(--color-text-subtle);margin:5px 0}.target-limits{font-size:11px;line-height:1.8;color:var(--color-text-muted);margin:8px 0 16px}.target-limits summary{cursor:pointer}.target-limits p{margin:6px 0}.target-link{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:16px;border-top:1px solid var(--color-border);color:var(--color-blue);font-size:12px}.target-link:hover{color:var(--color-gold)}
</style>
