<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, X } from 'lucide-vue-next'
import { directionName, reasonText, timeLabel } from './presentation'
import { tonightSkyMapLocation } from './skyMapLink'
import type { ExclusionCode, NightTimeline, TonightRecommendation, TonightRequest } from './types'

const props = defineProps<{ target?: TonightRecommendation; body?: NightTimeline['bodies'][number]; exclusion?: ExclusionCode; request: TonightRequest; language: string }>()
defineEmits<{ close: [] }>()
const zh = computed(() => props.language.startsWith('zh'))
const text = (cn: string, en: string) => zh.value ? cn : en
const time = (value: string | null) => timeLabel(value, props.request.timeZone, props.request.nightDate, props.language)
const explanation = computed(() => {
  if (props.body?.targetId === 'uranus' || props.body?.targetId === 'neptune') return text('此目标以光学器材观测为主，未列入裸眼推荐。横条显示地平线上方的时段，实际观测还需考虑天空暗度与天体高度。', 'This is a target for optical equipment and is not included in naked-eye recommendations. The bar shows time above the horizon; darkness and altitude also matter.')
  const reasons: Record<ExclusionCode, string> = {
    'no-dark-window': text('所选时段天空暗度不足。', 'The selected interval is not dark enough.'),
    'below-altitude': text('所选时段内，天体没有达到适合观测的高度。', 'The target does not reach a suitable altitude during your selected interval.'),
    'too-faint': text('在当前环境下，这个目标不容易用裸眼辨认。', 'This target is difficult to identify with the naked eye in these surroundings.'),
    'incomplete-pattern': text('主要骨架星没有同时满足观测条件。', 'The core pattern stars do not meet the observing conditions together.'),
    'window-too-short': text('满足条件的连续观测窗口不足五分钟。', 'The continuous observing window is shorter than five minutes.'),
  }
  return props.exclusion ? reasons[props.exclusion] : text('所选时段内没有满足推荐条件的观测窗口。可以调整观测时间或日期。', 'There is no suitable observing window in the selected interval. Try another time or date.')
})
</script>

<template>
  <aside class="timeline-details" :aria-label="text('观测详情', 'Observing details')">
    <header><h3>{{ target?.name ?? body?.name }}</h3><button type="button" :aria-label="text('收起详情', 'Close details')" @click="$emit('close')"><X :size="17" /></button></header>
    <dl v-if="body" class="rise-set"><div><dt>{{ text('升起', 'Rise') }}</dt><dd>{{ time(body.riseUtc) }}</dd></div><div><dt>{{ text('落下', 'Set') }}</dt><dd>{{ time(body.setUtc) }}</dd></div></dl>
    <template v-if="target">
      <p class="best-time">{{ text('最佳观测', 'Best view') }} <strong>{{ time(target.bestAtUtc) }}</strong><span>· {{ directionName(target.positionAtBest.azimuthDeg, language) }} · {{ Math.round(target.positionAtBest.altitudeDeg) }}°</span></p>
      <p class="recommended-window">{{ text('建议时段', 'Suggested interval') }} {{ time(target.recommendedWindow.startUtc) }} — {{ time(target.recommendedWindow.endUtc) }}</p>
      <ul><li v-for="reason in target.reasons" :key="reason.code">{{ reasonText(reason, language) }}</li></ul>
      <p v-if="target.anchorName" class="detail-note">{{ text(`方位与高度以 ${target.anchorName} 为参考。`, `Direction and altitude refer to ${target.anchorName}.`) }}</p>
      <p v-if="target.targetType === 'moon' || target.targetType === 'planet'" class="detail-note">{{ text('细小地形或行星细节需要合适的光学器材。', 'Fine lunar or planetary details require suitable optical equipment.') }}</p>
      <p v-for="reason in target.limitations" :key="reason.code" class="detail-note">{{ reasonText(reason, language) }}</p>
      <RouterLink :to="tonightSkyMapLocation(target, request)">{{ text('在星图中找到它', 'Find it on the sky map') }}<ArrowUpRight :size="15" /></RouterLink>
    </template>
    <p v-else class="not-recommended">{{ explanation }}</p>
    <p v-if="body && (!body.riseUtc || !body.setUtc)" class="detail-note">{{ text('“—”表示这条时间轴内没有对应的升落事件。', '“—” means no corresponding rise or set event within this timeline.') }}</p>
  </aside>
</template>

<style scoped>
.timeline-details {
  margin-top: 14px;
  padding: 19px 22px;
  border: 1px solid color-mix(in srgb, var(--color-gold) 28%, var(--color-border));
  border-radius: 10px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--color-gold) 5%, var(--color-surface)), var(--color-surface));
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.8;
}
.timeline-details header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.timeline-details h3 { margin: 0; color: var(--color-text); font-size: 19px; font-weight: 500; }
.timeline-details header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
}
.timeline-details header button:hover { color: var(--color-text); border-color: var(--color-blue); }
.rise-set { display: flex; flex-wrap: wrap; gap: 12px 28px; margin: 12px 0 15px; }
.rise-set > div { display: flex; gap: 10px; }
.rise-set dt { color: var(--color-text-subtle); }
.rise-set dd { margin: 0; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.best-time { margin: 15px 0 3px; color: var(--color-text-muted); }
.best-time strong { margin-left: 6px; color: var(--color-gold); font-weight: 500; font-variant-numeric: tabular-nums; }
.best-time > span { margin-left: 10px; color: var(--color-text-muted); }
.recommended-window { margin: 3px 0 12px; color: var(--color-text-subtle); font-size: 11px; }
.timeline-details ul { padding-left: 17px; margin: 12px 0; }
.timeline-details li::marker { color: var(--color-gold); }
.detail-note { margin: 6px 0; color: var(--color-text-subtle); font-size: 10px; }
.not-recommended { margin: 12px 0; font-size: 12px; }
.timeline-details a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  margin-top: 12px;
  padding: 4px 0;
  color: var(--color-blue);
  font-size: 12px;
}
.timeline-details a:hover { color: var(--color-gold); }
.timeline-details button:focus-visible, .timeline-details a:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }
@media (max-width: 600px) {
  .timeline-details { padding: 15px; }
  .timeline-details h3 { font-size: 17px; }
  .timeline-details header button { width: 36px; height: 36px; }
  .best-time > span { display: block; margin: 3px 0 0; }
  .rise-set { gap: 8px 20px; }
}
</style>