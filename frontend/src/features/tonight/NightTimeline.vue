<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Orbit, Star } from 'lucide-vue-next'
import type { NightTimeline, TimeInterval, TonightRecommendation } from './types'

interface TimelineRow { id: string; name: string; windows: TimeInterval[]; riseUtc?: string | null; setUtc?: string | null; phaseFraction?: number }
const props = defineProps<{ title: string; rows: TimelineRow[]; timeline: NightTimeline; timeZone: string; language: string; recommendations: TonightRecommendation[]; selectedId?: string; solar?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const zh = computed(() => props.language.startsWith('zh'))
const start = computed(() => Date.parse(props.timeline.bounds.startUtc))
const end = computed(() => Date.parse(props.timeline.bounds.endUtc))
const percent = (value: string | number) => ((typeof value === 'number' ? value : Date.parse(value)) - start.value) / (end.value - start.value) * 100
const clock = (value: string | number) => new Intl.DateTimeFormat(props.language, { timeZone: props.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
const ticks = computed(() => {
  const values: { at: number; label: string }[] = []
  for (let at = start.value; at <= end.value; at += 2 * 3_600_000) values.push({ at, label: clock(at).slice(0, 2) })
  if (values.at(-1)?.at !== end.value) values.push({ at: end.value, label: clock(end.value).slice(0, 2) })
  return values
})
const clipped = (window: TimeInterval) => {
  const left = Math.max(0, percent(window.startUtc)), right = Math.min(100, percent(window.endUtc))
  return { left: `${left}%`, width: `${Math.max(0, right - left)}%` }
}
const intersects = (window: TimeInterval) => Date.parse(window.endUtc) > start.value && Date.parse(window.startUtc) < end.value
const recommendation = (id: string) => props.recommendations.find(item => item.targetId === id)
const colors: Record<string, string> = { moon: '#ecefee', mercury: '#aeb1b2', venus: '#e4dabd', mars: '#d99e89', jupiter: '#cbb2b0', saturn: '#d8c6a0', uranus: '#71b1c3', neptune: '#679dbd' }
const color = (id: string) => colors[id] ?? (id.startsWith('HIP:') ? '#a8c3ee' : '#c5b9df')
function events(row: TimelineRow) {
  if (!props.solar) return []
  return [{ at: row.riseUtc, rising: true }, { at: row.setUtc, rising: false }].filter(event => event.at && percent(event.at) >= 0 && percent(event.at) <= 100)
}
function description(row: TimelineRow) {
  const ranges = row.windows.filter(intersects).map(window => `${clock(window.startUtc)}–${clock(window.endUtc)}`).join('、')
  return `${row.name}，${ranges || (zh.value ? '此时间轴内不在地平线上' : 'Below the horizon in this interval')}，${zh.value ? '查看详情' : 'show details'}`
}
</script>

<template>
  <section class="timeline-section" :aria-label="title">
    <header class="section-heading"><h2><Orbit :size="18" :stroke-width="1.4" aria-hidden="true" />{{ title }}</h2><span>{{ solar ? (zh ? '升落与观测窗口' : 'Rise, set & observing windows') : (zh ? '推荐观测时段' : 'Recommended windows') }}</span></header>
    <div class="timeline-table">
      <div class="time-axis" aria-hidden="true"><span class="axis-caption">{{ zh ? '当地时间' : 'Local time' }}</span><div><span v-for="tick in ticks" :key="tick.at" :class="{ midnight: tick.label === '00' }" :style="{ left: `${percent(tick.at)}%` }">{{ tick.label }}</span></div></div>
      <div class="timeline-body">
        <div class="sky-background" aria-hidden="true">
          <span v-for="(band, i) in timeline.bands" :key="i" class="sky-band" :class="band.kind" :style="clipped(band)"></span>
          <i v-for="tick in ticks" :key="tick.at" :style="{ left: `${percent(tick.at)}%` }"></i>
        </div>
        <template v-for="row in rows" :key="row.id">
        <button type="button" class="timeline-row" :class="{ selected: selectedId === row.id }" :style="{ '--object-color': color(row.id) }" :aria-expanded="selectedId === row.id" :aria-label="description(row)" @click="emit('select', row.id)">
          <span class="object-label"><span v-if="solar" class="planet-disc" :class="[row.id, { crescent: (row.phaseFraction ?? 1) < .5 }]" aria-hidden="true"></span><Star v-else :size="16" :stroke-width="1.3" aria-hidden="true" /><span class="object-name">{{ row.name }}<small v-if="row.id === 'uranus' || row.id === 'neptune'">{{ zh ? '光学器材' : 'Optics' }}</small></span><ChevronRight :size="12" class="row-arrow" /></span>
          <span class="row-track" aria-hidden="true">
            <span v-for="(window, i) in row.windows.filter(intersects)" :key="`h-${i}`" class="visibility-bar" :class="{ horizon: solar }" :style="clipped(window)"></span>
            <span v-for="(window, i) in (solar ? recommendation(row.id)?.windows ?? [] : []).filter(intersects)" :key="`r-${i}`" class="visibility-bar recommended" :style="clipped(window)"></span>
            <span v-for="event in events(row)" :key="event.at!" class="event-label" :class="{ ending: !event.rising, edge: percent(event.at!) < 8, 'right-edge': percent(event.at!) > 92 }" :style="{ left: `${percent(event.at!)}%` }">{{ clock(event.at!) }}</span>
            <span v-if="!row.windows.some(intersects)" class="no-window">{{ solar ? (zh ? '地平线下' : 'Below horizon') : '—' }}</span>
          </span>
        </button>
        <div v-if="selectedId === row.id" class="row-detail"><slot name="details"></slot></div>
        </template>
      </div>
    </div>
    <p v-if="!rows.length" class="empty-group">{{ zh ? '所选时段没有满足条件的目标' : 'No suitable targets for this interval' }}</p>
  </section>
</template>

<style scoped>
.timeline-section {
  --label-width: 156px;
  margin: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.section-heading h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: .03em;
}
.section-heading h2 svg { color: var(--color-gold); }
.section-heading > span {
  color: var(--color-text-subtle);
  font-size: 10px;
}
.time-axis {
  position: relative;
  height: 30px;
  padding-left: var(--label-width);
}
.axis-caption {
  position: absolute;
  left: 0;
  top: 2px;
  color: var(--color-text-subtle);
  font-size: 10px;
  letter-spacing: .04em;
}
.time-axis > div { position: relative; height: 100%; }
.time-axis > div > span {
  position: absolute;
  transform: translateX(-50%);
  color: var(--color-text-muted);
  font: 11px var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.time-axis > div > span:first-child { transform: none; }
.time-axis > div > span:last-child { transform: translateX(-100%); }
.time-axis > div > span.midnight { color: var(--color-gold); }
.timeline-body { position: relative; padding: 7px 0; }
.sky-background {
  position: absolute;
  inset: 0 0 0 var(--label-width);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
  border-radius: 12px;
  background: var(--color-bg);
  pointer-events: none;
}
.sky-band { position: absolute; top: 0; bottom: 0; }
.day { background: color-mix(in srgb, var(--color-blue) 26%, var(--color-surface)); }
.civil { background: color-mix(in srgb, var(--color-gold) 14%, var(--color-surface)); }
.nautical { background: color-mix(in srgb, var(--color-blue) 11%, var(--color-surface)); }
.astronomical { background: color-mix(in srgb, var(--color-blue) 4%, var(--color-surface)); }
.night { background: var(--color-bg); }
.sky-background i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed color-mix(in srgb, var(--color-text-subtle) 15%, transparent);
}
.timeline-row {
  --track-object-color: color-mix(in srgb, var(--object-color) 90%, var(--color-text));
  position: relative;
  display: grid;
  grid-template-columns: var(--label-width) minmax(0, 1fr);
  width: 100%;
  min-height: 57px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  text-align: left;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  transition: background .16s;
}
.timeline-row:last-child { border-bottom-color: transparent; }
.timeline-row:hover { background: color-mix(in srgb, var(--color-blue) 5%, transparent); }
.timeline-row.selected { background: color-mix(in srgb, var(--color-gold) 6%, transparent); }
.timeline-row:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 4px; }
.object-label {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 7px 15px 7px 5px;
}
.object-name {
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.object-name small {
  display: block;
  width: fit-content;
  margin-top: 2px;
  color: var(--color-text-subtle);
  font-size: 9px;
  letter-spacing: .02em;
}
.row-arrow {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--color-text-subtle);
  opacity: .65;
  transition: transform .16s, opacity .16s;
}
.timeline-row:hover .row-arrow { opacity: 1; }
.timeline-row.selected .row-arrow { transform: rotate(90deg); color: var(--color-gold); opacity: 1; }
.planet-disc {
  position: relative;
  display: block;
  flex-shrink: 0;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: var(--object-color);
  box-shadow: inset -4px 0 0 #00000024, 0 0 0 4px color-mix(in srgb, var(--object-color) 6%, transparent);
}
.planet-disc.crescent {
  background: color-mix(in srgb, var(--object-color) 28%, var(--color-surface));
  box-shadow: inset -5px 0 0 var(--object-color), 0 0 0 4px color-mix(in srgb, var(--object-color) 6%, transparent);
}
.planet-disc.saturn::after {
  content: '';
  position: absolute;
  width: 28px;
  height: 7px;
  left: -5px;
  top: 5px;
  border: 1px solid var(--object-color);
  border-radius: 50%;
  transform: rotate(-35deg);
}
.object-label > svg { color: var(--color-lilac); flex-shrink: 0; }
.row-track { position: relative; display: block; min-width: 0; overflow: hidden; }
.visibility-bar {
  position: absolute;
  top: 21px;
  height: 7px;
  border-radius: 8px;
  background: var(--track-object-color);
}
.visibility-bar.horizon { opacity: .32; height: 5px; top: 22px; }
.visibility-bar.recommended {
  height: 9px;
  top: 20px;
  background: linear-gradient(90deg, var(--track-object-color), color-mix(in srgb, var(--track-object-color) 75%, var(--color-gold)));
  box-shadow: 0 0 9px color-mix(in srgb, var(--object-color) 12%, transparent);
}
.event-label {
  position: absolute;
  top: 34px;
  color: var(--color-text-muted);
  font: 9px var(--font-mono);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.event-label.ending { transform: translateX(-100%); }
.event-label.edge { transform: none; }
.event-label.right-edge { transform: translateX(-100%); }
.no-window { position: absolute; top: 20px; left: 12px; color: var(--color-text-subtle); font-size: 10px; }
.empty-group { color: var(--color-text-subtle); font-size: 12px; padding: 14px 0; }
.timeline-row.selected .object-name { color: var(--color-gold); }
.row-detail { position: relative; padding: 10px 0 14px; background: var(--color-surface); }
.row-detail:deep(.timeline-details) { margin-top: 0; }
:global(:root[data-theme='light'] .timeline-row) { --track-object-color: color-mix(in srgb, var(--object-color) 45%, var(--color-text)); }
:global(:root[data-theme='light'] .planet-disc) { outline: 1px solid color-mix(in srgb, var(--color-text-subtle) 25%, transparent); }

@media (max-width: 600px) {
  .timeline-section { --label-width: 98px; }
  .section-heading { gap: 10px; margin-bottom: 20px; }
  .section-heading h2 { font-size: 16px; gap: 8px; }
  .section-heading > span { font-size: 9px; }
  .object-label { gap: 10px; padding: 6px 8px 6px 3px; }
  .object-name { font-size: 12px; }
  .object-name small { font-size: 8px; }
  .planet-disc { width: 16px; height: 16px; }
  .planet-disc.saturn::after { width: 24px; height: 6px; left: -4px; top: 4px; }
  .row-arrow { display: none; }
  .time-axis > div > span { font-size: 9px; }
  .axis-caption { font-size: 9px; }
  .sky-background { border-radius: 8px; }
  .timeline-row { min-height: 54px; }
  .event-label { font-size: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .timeline-row, .row-arrow { transition: none; }
}
</style>
