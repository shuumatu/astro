<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Compass, ChevronLeft, ChevronRight, MapPin, Moon, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-vue-next'
import { SkyMapWorkerClient } from '../features/sky-map/workerClient'
import { OBSERVER_PRESETS } from '../features/sky-map/observerPresets'
import { currentNightDate } from '../features/tonight/nightWindow'
import { moonPhaseName, timeLabel } from '../features/tonight/presentation'
import NightTimeline from '../features/tonight/NightTimeline.vue'
import TimelineDetails from '../features/tonight/TimelineDetails.vue'
import TargetCard from '../features/tonight/TargetCard.vue'
import { tonightSession } from '../features/tonight/session'
import type { ObservingEnvironment, TonightRequest, TonightResult, TonightTargetType, TonightWindowMode } from '../features/tonight/types'

const { locale } = useI18n()
const zh = computed(() => locale.value.startsWith('zh'))
const text = (cn: string, en: string) => zh.value ? cn : en
const saved = tonightSession.request
const initialDate = saved?.nightDate ?? currentNightDate(new Date(), 'Asia/Shanghai', OBSERVER_PRESETS.shenzhen)
const controls = reactive({ latitudeDeg: saved?.observer.latitudeDeg ?? Number(OBSERVER_PRESETS.shenzhen.latitudeDeg), longitudeDeg: saved?.observer.longitudeDeg ?? Number(OBSERVER_PRESETS.shenzhen.longitudeDeg), elevationMeters: saved?.observer.elevationMeters ?? Number(OBSERVER_PRESETS.shenzhen.elevationMeters), timeZone: saved?.timeZone ?? 'Asia/Shanghai', nightDate: initialDate,
  windowMode: saved?.windowMode ?? 'all-night' as TonightWindowMode,
  environment: saved?.environment ?? 'unknown' as ObservingEnvironment, customStartLocal: saved?.customStartLocal ?? `${initialDate}T20:00`, customEndLocal: saved?.customEndLocal ?? `${initialDate}T23:00` })
const preset = ref(saved ? tonightSession.preset : 'shenzhen')
const locating = ref(false), locationMessage = ref(''), loading = ref(true), ready = ref(false), error = ref('')
const result = shallowRef<TonightResult | null>(null)
const selectedId = ref('')
const filter = ref<'all' | TonightTargetType>(tonightSession.filter)
const displayedNightDate = computed(() => {
  if (controls.windowMode !== 'next-hour') return controls.nightDate
  try { return result.value?.request.nightDate ?? currentNightDate(new Date(), controls.timeZone, controls) } catch { return '' }
})
const cityNames: Record<string, [string, string]> = { shenzhen: ['深圳', 'Shenzhen'], beijing: ['北京', 'Beijing'], shanghai: ['上海', 'Shanghai'], chengdu: ['成都', 'Chengdu'] }
let client: SkyMapWorkerClient | null = null, sequence = 0, disposed = false
let timer: ReturnType<typeof setTimeout> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
const solarRows = computed(() => result.value?.timeline.bodies.map(body => ({ ...body, id: body.targetId })) ?? [])
const featured = computed(() => result.value?.featuredIds.map(id => result.value!.recommendations.find(item => item.targetId === id)!).filter(Boolean) ?? [])
const filtered = computed(() => result.value?.recommendations.filter(item => filter.value === 'all' || item.targetType === filter.value || filter.value === 'constellation' && item.targetType === 'asterism') ?? [])
const categories = computed(() => [
  { id: 'all', name: text('全部目标', 'All targets') }, { id: 'moon', name: text('月球', 'Moon') }, { id: 'planet', name: text('行星', 'Planets') }, { id: 'star', name: text('亮星', 'Bright stars') }, { id: 'constellation', name: text('星座与星群', 'Patterns') },
] as Array<{ id: typeof filter.value; name: string }>)
const selectedTarget = computed(() => result.value?.recommendations.find(item => item.targetId === selectedId.value))
const selectedBody = computed(() => result.value?.timeline.bodies.find(item => item.targetId === selectedId.value))
const selectedExclusion = computed(() => result.value?.excluded.find(item => item.targetId === selectedId.value)?.reason)
const placeName = computed(() => cityNames[preset.value]?.[zh.value ? 0 : 1] ?? text('自定地点', 'Custom location'))
const nightTitle = computed(() => {
  const date = displayedNightDate.value
  if (!date) return ''
  const first = new Date(`${date}T12:00:00Z`), last = new Date(first.getTime() + 86_400_000)
  if (!Number.isFinite(first.getTime())) return date
  if (zh.value) return first.getUTCMonth() === last.getUTCMonth()
    ? `${first.getUTCMonth() + 1}月${first.getUTCDate()}–${last.getUTCDate()}日`
    : `${first.getUTCMonth() + 1}月${first.getUTCDate()}日–${last.getUTCMonth() + 1}月${last.getUTCDate()}日`
  const format = (value: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(value)
  return `${format(first)} – ${format(last)}`
})
const modes = computed(() => [
  ['evening', text('前半夜', 'Evening')], ['late', text('后半夜', 'After midnight')], ['all-night', text('整夜', 'All night')], ['next-hour', text('现在起一小时', 'Next hour')], ['custom', text('自定义时段', 'Custom')],
])
const time = (instant: string | null) => result.value ? timeLabel(instant, result.value.request.timeZone, result.value.request.nightDate, locale.value) : '—'
function shiftNight(days: number) {
  const at = Date.parse(`${displayedNightDate.value}T12:00:00Z`) + days * 86_400_000
  if (!Number.isFinite(at)) return
  const date = new Date(at).toISOString().slice(0, 10)
  if (date < '1800-01-02' || date > '2199-12-30') return
  if (controls.windowMode === 'next-hour') controls.windowMode = 'all-night'
  controls.nightDate = date
}
function goTonight() {
  try { controls.nightDate = currentNightDate(new Date(), controls.timeZone, controls); controls.windowMode = 'all-night' } catch { void calculate() }
}
function selectTarget(id: string) { selectedId.value = selectedId.value === id ? '' : id }
const nightNotice = computed(() => {
  if (!result.value) return ''
  switch (result.value.night.status) {
    case 'polar-day': return text('这段日期处于极昼，天空没有达到本次观测所需的暗度。', 'The Sun stays up; the sky does not reach the darkness required for these targets.')
    case 'polar-night': return text('这段日期处于极夜，已按所选时段计算；部分时段仍可能有暮光。', 'The Sun does not rise. The selected interval is used; twilight may still occur.')
    case 'no-astronomical-night': return text('今晚没有完整的天文黑夜，明亮目标仍可能值得观察。', 'There is no fully astronomical night; bright targets may still be worthwhile.')
    default: return ''
  }
})
function choosePreset() {
  const value = OBSERVER_PRESETS[preset.value as keyof typeof OBSERVER_PRESETS]
  if (value) Object.assign(controls, value, { timeZone: 'Asia/Shanghai' })
  locationMessage.value = ''
}
function schedule() {
  sequence += 1
  result.value = null
  selectedId.value = ''
  if (timer) clearTimeout(timer)
  if (ready.value) { loading.value = true; timer = setTimeout(() => { void calculate() }, 180) }
}
watch(controls, schedule)
watch(locale, schedule)
watch(filter, value => { tonightSession.filter = value })
watch(() => controls.nightDate, (date) => { controls.customStartLocal = `${date}T20:00`; controls.customEndLocal = `${date}T23:00` })
async function initialize() {
  const token = ++sequence
  loading.value = true; ready.value = false; error.value = ''; result.value = null
  client?.dispose()
  const worker = new SkyMapWorkerClient()
  client = worker
  try {
    await worker.initialize()
    if (disposed || client !== worker) return
    ready.value = true
    await calculate()
  } catch (cause) {
    if (disposed || client !== worker || token !== sequence && ready.value) return
    error.value = cause instanceof Error ? cause.message : String(cause)
    loading.value = false
  }
}
async function calculate() {
  if (!client || !ready.value) return
  const token = ++sequence
  loading.value = true; error.value = ''; result.value = null
  try {
    if ([controls.latitudeDeg, controls.longitudeDeg, controls.elevationMeters].some(value => !Number.isFinite(value))) throw new Error(text('请填写有效的经纬度和海拔。', 'Enter valid coordinates and elevation.'))
    const observer = { latitudeDeg: Number(controls.latitudeDeg), longitudeDeg: Number(controls.longitudeDeg), elevationMeters: Number(controls.elevationMeters) }
    const request: TonightRequest = { observer, timeZone: controls.timeZone, nightDate: controls.windowMode === 'next-hour' ? currentNightDate(new Date(), controls.timeZone, observer) : controls.nightDate,
      windowMode: controls.windowMode, customStartLocal: controls.customStartLocal, customEndLocal: controls.customEndLocal,
      nowUtc: new Date().toISOString(), environment: controls.environment, cultureId: 'western-iau', interfaceLanguage: locale.value }
    const plan = await client.planTonight(request)
    if (token === sequence && !disposed) {
      result.value = plan
      tonightSession.request = { ...request, observer: { ...observer } }
      tonightSession.preset = preset.value
    }
  } catch (cause) {
    if (token === sequence && !disposed) error.value = cause instanceof Error ? cause.message : String(cause)
  } finally { if (token === sequence && !disposed) loading.value = false }
}
function locate() {
  if (!navigator.geolocation) { locationMessage.value = text('当前浏览器不支持定位，请手动选择地点。', 'Location is unavailable; choose a place manually.'); return }
  locating.value = true
  navigator.geolocation.getCurrentPosition((position) => {
    if (disposed) return
    preset.value = 'custom'
    controls.latitudeDeg = position.coords.latitude
    controls.longitudeDeg = position.coords.longitude
    controls.elevationMeters = Math.max(-500, Math.min(10000, position.coords.altitude ?? 0))
    locationMessage.value = text('已获取坐标，请核对下方观测地时区。', 'Coordinates updated. Please check the observing time zone below.')
    locating.value = false
  }, () => { if (!disposed) { locating.value = false; locationMessage.value = text('未能定位，可继续使用城市或手动坐标。', 'Location failed. City presets and manual coordinates still work.') } }, { timeout: 10000, maximumAge: 60000 })
}
onMounted(() => { void initialize(); refreshTimer = setInterval(() => { if (controls.windowMode === 'next-hour' && ready.value && !loading.value) void calculate() }, 60000) })
onBeforeUnmount(() => { disposed = true; sequence += 1; if (timer) clearTimeout(timer); if (refreshTimer) clearInterval(refreshTimer); client?.dispose() })
</script>

<template>
  <div class="tonight-page">
    <header class="tonight-hero">
      <div><p class="tonight-eyebrow"><Sparkles :size="14" />{{ text('抬头之前，先选一颗星', 'A little planning. A sky of possibilities.') }}</p><h1>{{ text('今晚看什么', 'What’s up tonight') }}<span>?</span></h1><p class="tonight-lead">{{ text('从你所在的地方，找到值得仰望的月球、行星与星空。', 'Find the Moon, planets and star patterns worth looking up for.') }}</p></div>
      <div class="hero-orbit" aria-hidden="true"><div></div><Moon :size="48" :stroke-width="1" /><i></i><b>YOUR NIGHT SKY</b></div>
    </header>
    <section id="observing-settings" class="tonight-controls" :aria-label="text('观测条件', 'Observing settings')">
      <div class="control-heading"><span><SlidersHorizontal :size="15" />{{ text('安排一次仰望', 'Plan your evening') }}</span><button type="button" class="quiet-button" :disabled="locating" @click="locate"><MapPin :size="14" />{{ locating ? text('定位中…', 'Locating…') : text('使用我的位置', 'Use my location') }}</button></div>
      <div class="control-grid">
        <label>{{ text('观测地点', 'Location') }}<select v-model="preset" @change="choosePreset"><option v-for="(names, id) in cityNames" :key="id" :value="id">{{ names[zh ? 0 : 1] }}</option><option value="custom">{{ text('手动坐标', 'Custom coordinates') }}</option></select></label>
        <label>{{ text('夜晚日期', 'Night starting on') }}<input :value="displayedNightDate" @input="controls.nightDate = ($event.target as HTMLInputElement).value" type="date" min="1800-01-02" max="2199-12-30" :disabled="controls.windowMode === 'next-hour'"></label>
        <label>{{ text('可用时间', 'Your time') }}<select v-model="controls.windowMode"><option v-for="mode in modes" :key="mode[0]" :value="mode[0]">{{ mode[1] }}</option></select></label>
        <label>{{ text('周围环境', 'Surroundings') }}<select v-model="controls.environment"><option value="unknown">{{ text('不确定', 'Not sure') }}</option><option value="urban">{{ text('城市灯光', 'Urban') }}</option><option value="suburban">{{ text('郊区', 'Suburban') }}</option><option value="dark">{{ text('暗空环境', 'Dark sky') }}</option></select></label>
      </div>
      <div v-if="controls.windowMode === 'custom'" class="custom-times"><label>{{ text('开始（当地时间）', 'Start (local time)') }}<input v-model="controls.customStartLocal" type="datetime-local"></label><label>{{ text('结束（当地时间）', 'End (local time)') }}<input v-model="controls.customEndLocal" type="datetime-local"></label></div>
      <details class="coordinate-settings" :open="preset === 'custom'"><summary>{{ text('坐标与时区', 'Coordinates and time zone') }} · {{ controls.timeZone }}</summary><div class="control-grid">
        <label>{{ text('纬度（北为正）', 'Latitude (north +)') }}<input v-model.number="controls.latitudeDeg" type="number" min="-90" max="90" step="any" @input="preset = 'custom'"></label>
        <label>{{ text('经度（东为正）', 'Longitude (east +)') }}<input v-model.number="controls.longitudeDeg" type="number" min="-180" max="180" step="any" @input="preset = 'custom'"></label>
        <label>{{ text('海拔（米）', 'Elevation (m)') }}<input v-model.number="controls.elevationMeters" type="number" min="-500" max="10000" @input="preset = 'custom'"></label>
        <label>{{ text('观测地 IANA 时区', 'Observing IANA time zone') }}<input v-model="controls.timeZone" placeholder="Asia/Shanghai" spellcheck="false"></label>
      </div></details>
      <p class="settings-note">{{ preset === 'custom' ? text('按所填坐标与时区计算。', 'Uses your coordinates and time zone.') : text('城市预设使用中心坐标，默认深圳是示例地点。', 'Presets use city-centre coordinates; Shenzhen is the initial example.') }} {{ locationMessage }}</p>
    </section>
    <p class="conditions-note"><Compass :size="16" aria-hidden="true" />{{ text('按晴空、无遮挡条件估算 · 尚未接入天气预报 · 环境选项用于保守估计辨认难度', 'Assumes clear skies and an open horizon · Weather is not included · Surroundings help estimate recognition difficulty') }}</p>
    <div v-if="loading" class="tonight-state" role="status"><span class="loading-orbit"></span><h2>{{ ready ? text('正在挑选今晚的目标', 'Finding your targets') : text('正在载入真实星空数据', 'Loading the star catalog') }}</h2><p>{{ text('计算位置、连续观测窗口与推荐依据…', 'Calculating positions, observing windows and reasons…') }}</p></div>
    <div v-else-if="error" class="tonight-state error" role="alert"><h2>{{ text('暂时无法生成观测计划', 'Could not build this plan') }}</h2><p>{{ error }}</p><button type="button" class="button secondary" @click="ready ? calculate() : initialize()"><RefreshCw :size="15" />{{ text('重试', 'Retry') }}</button></div>
    <template v-else-if="result">
      <section class="night-summary" :aria-label="text('夜晚概览', 'Night overview')"><div><span>{{ text('日落', 'Sunset') }}</span><strong>{{ time(result.night.sunsetUtc) }}</strong></div><div><span>{{ text('天文暮光结束', 'Astronomical dusk') }}</span><strong>{{ time(result.night.astronomicalDuskUtc) }}</strong></div><div><span>{{ moonPhaseName(result.moon.phaseDeg, locale) }}</span><strong>{{ Math.round(result.moon.phaseFraction * 100) }}<small>% {{ text('受光', 'lit') }}</small></strong></div><div><span>{{ text('月落', 'Moonset') }}</span><strong>{{ time(result.night.moonsetUtc) }}</strong></div></section>
      <p class="summary-footnote">{{ result.request.nightDate }} · {{ result.request.timeZone }} · {{ text('月相按所选窗口开始时刻计算；“—”表示本夜没有该事件。', 'Moon phase is at the start of the selected window; “—” means no such event this night.') }}</p>
      <p v-if="nightNotice" class="night-notice">{{ nightNotice }}</p>

      <section class="solar-panel" :aria-label="text('太阳系观测时间表', 'Solar system observing timeline')">
        <header class="date-heading">
          <div><p class="tonight-eyebrow">{{ text('日落到黎明', 'DUSK TO DAWN') }}</p><h2>{{ nightTitle }}<span> · {{ placeName }}</span></h2><p class="solar-context">{{ result.request.timeZone }} · {{ modes.find(mode => mode[0] === controls.windowMode)?.[1] }} · {{ text('日出', 'Sunrise') }} {{ time(result.night.sunriseUtc) }}</p></div>
          <div class="date-navigation"><button type="button" :aria-label="text('前一晚', 'Previous night')" @click="shiftNight(-1)"><ChevronLeft :size="16" /></button><button type="button" @click="goTonight">{{ text('今晚', 'Tonight') }}</button><button type="button" :aria-label="text('后一晚', 'Next night')" @click="shiftNight(1)"><ChevronRight :size="16" /></button></div>
        </header>
        <NightTimeline :title="text('太阳系', 'Solar system')" :rows="solarRows" :timeline="result.timeline" :time-zone="result.request.timeZone" :language="locale" :recommendations="result.recommendations" :selected-id="selectedId" solar @select="selectTarget">
          <template #details><TimelineDetails :target="selectedTarget" :body="selectedBody" :exclusion="selectedExclusion" :request="result.request" :language="locale" @close="selectedId = ''" /></template>
        </NightTimeline>
        <div class="timeline-footer">
          <div class="chart-legend" :aria-label="text('时间轴图例', 'Timeline legend')"><span><i class="legend-day"></i>{{ text('白昼', 'Day') }}</span><span><i class="legend-twilight"></i>{{ text('暮光', 'Twilight') }}</span><span><i class="legend-night"></i>{{ text('黑夜', 'Night') }}</span><span class="legend-divider"></span><span><b class="legend-horizon"></b>{{ text('地平线上', 'Above horizon') }}</span><span><b class="legend-recommended"></b>{{ text('推荐时段', 'Recommended') }}</span></div>
          <p>{{ text('点击天体展开建议 · 当地时间，0 时后为次日', 'Select a target for advice · Local time, next day after midnight') }}</p>
        </div>
        <p class="timeline-note">{{ text('淡色横条表示位于地平线上，亮色部分为所选时段内的推荐窗口。天王星与海王星按需要光学器材的目标展示。', 'Faint bars show time above the horizon; bright segments are recommended windows. Uranus and Neptune are shown as targets for optical equipment.') }}</p>
      </section>

      <section v-if="featured.length" class="featured-section"><header class="results-heading"><div><p class="tonight-eyebrow">{{ text('先从这里开始', 'START HERE') }}</p><h2>{{ text('值得抬头的几个理由', 'A few reasons to look up') }}</h2></div><span>{{ text('适合所选时段 · 裸眼优先', 'For your selected interval · Naked-eye first') }}</span></header><div class="featured-grid"><TargetCard v-for="target in featured" :key="target.targetId" :target="target" :request="result.request" :language="locale" featured /></div></section>
      <section class="all-targets"><header class="results-heading"><h2>{{ text('探索今晚的天空', 'Explore your night sky') }}</h2><span>{{ result.recommendations.length }} {{ text('个候选目标', 'targets') }}</span></header><div class="category-tabs" role="group" :aria-label="text('目标类别', 'Target categories')"><button v-for="category in categories" :key="category.id" :class="{ active: filter === category.id }" :aria-pressed="filter === category.id" @click="filter = category.id">{{ category.name }}</button></div>
        <div v-if="filtered.length" class="target-grid"><TargetCard v-for="target in filtered" :key="target.targetId" :target="target" :request="result.request" :language="locale" /></div>
        <div v-else class="tonight-state"><Moon :size="30" :stroke-width="1" /><h3>{{ text('这个时段没有合适的目标', 'No suitable targets in this interval') }}</h3><p>{{ text('可以延长观测时间、查看后半夜，或选择其他日期。天空条件不满足时，我们会保留空结果。', 'Try a longer interval, after midnight, or another date. Targets are only listed when the conditions are met.') }}</p></div>
      </section>
      <details class="excluded-targets" v-if="result.excluded.length"><summary>{{ text('为什么有些目标没有出现？', 'Why are some targets missing?') }}</summary><p>{{ text('可能尚未升到合适高度、天空不够暗、骨架星难以辨认，或连续窗口不足五分钟。', 'Targets may be too low, the sky too bright, core stars too faint, or their window shorter than five minutes.') }}</p><ul><li v-for="item in result.excluded.filter(item => filter === 'all' || item.targetType === filter || filter === 'constellation' && item.targetType === 'asterism')" :key="item.targetId">{{ item.name }} — {{ ({ 'no-dark-window': text('天空暗度不足', 'Sky too bright'), 'below-altitude': text('高度不足', 'Too low'), 'too-faint': text('不易辨认', 'Too faint'), 'incomplete-pattern': text('主要骨架不满足条件', 'Core pattern not observable'), 'window-too-short': text('窗口过短', 'Window too short') })[item.reason] }}</li></ul></details>
    </template>
  </div>
</template>

<style scoped>
.tonight-page{padding:40px 0 70px}
.tonight-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:32px}
.tonight-eyebrow{display:flex;align-items:center;gap:9px;color:var(--color-gold);font-size:10px;letter-spacing:.14em;margin:0 0 14px;text-transform:uppercase}
.tonight-hero h1{font-family:'Noto Serif SC',Georgia,serif;font-size:clamp(33px,4vw,52px);font-weight:500;margin:0;letter-spacing:.04em}
.tonight-hero h1 span{color:var(--color-gold);margin-left:8px}
.tonight-lead{color:var(--color-text-muted);font-size:13px;line-height:1.9;margin:20px 0 0}
.hero-orbit{position:relative;display:grid;place-items:center;flex:0 0 200px;height:150px;color:var(--color-gold)}
.hero-orbit div{position:absolute;width:180px;height:80px;border:1px solid var(--color-border);border-radius:50%;transform:rotate(-30deg)}
.hero-orbit i{position:absolute;top:38px;right:24px;width:5px;height:5px;border-radius:50%;background:var(--color-blue);box-shadow:0 0 15px var(--color-blue)}
.hero-orbit b{position:absolute;bottom:2px;font:9px var(--font-mono);letter-spacing:.17em;color:var(--color-text-subtle)}
.tonight-controls{padding:22px 24px;border:1px solid var(--color-border);border-radius:14px;background:var(--color-surface)}
.control-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:19px;color:var(--color-text-muted);font-size:12px}
.control-heading>span,.quiet-button{display:flex;align-items:center;gap:8px}
.quiet-button{border:0;background:none;color:var(--color-blue);font:inherit;cursor:pointer}
.control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
label{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:11px;color:var(--color-text-muted)}
input,select{width:100%;min-width:0;box-sizing:border-box;padding:10px 12px;border:1px solid var(--color-border);border-radius:7px;background:var(--color-surface-raised);color:var(--color-text);font:inherit;font-size:13px;min-height:40px}
input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--color-blue);outline-offset:3px}
input:disabled{opacity:.5}
.coordinate-settings{margin-top:16px;color:var(--color-text-subtle);font-size:11px}
.coordinate-settings summary{cursor:pointer}
.coordinate-settings .control-grid{margin-top:14px}
.settings-note,.summary-footnote{color:var(--color-text-subtle);font-size:10px;line-height:1.8;margin:14px 0 0}
.custom-times{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.conditions-note{display:flex;align-items:flex-start;gap:8px;line-height:1.9;color:var(--color-text-subtle);font-size:11px;margin:18px 0 25px}
.conditions-note svg{flex-shrink:0;margin-top:2px}
.night-summary{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);padding:25px 0;gap:20px}
.night-summary div{display:flex;flex-direction:column;gap:10px;padding-left:24px;border-left:1px solid var(--color-border)}
.night-summary div:first-child{border:0;padding-left:0}
.night-summary span{color:var(--color-text-subtle);font-size:11px}
.night-summary strong{font-size:21px;font-weight:450;font-variant-numeric:tabular-nums}
.night-summary small{font-size:11px;color:var(--color-text-muted);margin-left:5px}
.night-notice{padding:14px 18px;background:color-mix(in srgb,var(--color-gold) 8%,transparent);border-left:2px solid var(--color-gold);font-size:12px;line-height:1.8;color:var(--color-text-muted)}
.featured-section,.all-targets{margin-top:38px}
.results-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}
.results-heading h2{font-size:22px;font-weight:500;margin:0}
.results-heading>span{font-size:10px;color:var(--color-text-subtle)}
.results-heading .tonight-eyebrow{margin-bottom:8px}
.featured-grid,.target-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.featured-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.featured-grid>:first-child{border-color:color-mix(in srgb,var(--color-gold) 50%,var(--color-border))}
.category-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:23px}
.category-tabs button{border:1px solid var(--color-border);border-radius:24px;background:transparent;color:var(--color-text-muted);padding:8px 16px;font:inherit;font-size:12px;cursor:pointer}
.category-tabs .active{color:var(--color-gold);background:color-mix(in srgb,var(--color-gold) 10%,transparent);border-color:color-mix(in srgb,var(--color-gold) 40%,var(--color-border))}
.tonight-state{text-align:center;padding:60px 20px;color:var(--color-text-muted)}
.tonight-state h2,.tonight-state h3{font-size:18px;font-weight:500;color:var(--color-text)}
.tonight-state p{font-size:12px;line-height:1.9;max-width:540px;margin:14px auto}
.tonight-state.error{border:1px solid var(--color-border);border-radius:12px}
.loading-orbit{display:inline-block;width:28px;height:28px;border:1px solid var(--color-border);border-top-color:var(--color-gold);border-radius:50%;animation:orbit 1.5s linear infinite}
.excluded-targets{border-top:1px solid var(--color-border);padding-top:20px;margin-top:30px;color:var(--color-text-subtle);font-size:11px;line-height:1.9}
.excluded-targets summary{cursor:pointer}.excluded-targets ul{columns:3;padding-left:17px}.excluded-targets li{break-inside:avoid;margin-bottom:4px}
.solar-panel{margin-top:32px;padding:26px 28px 18px;border:1px solid var(--color-border);border-radius:18px;background:radial-gradient(ellipse at 100% 0,color-mix(in srgb,var(--color-blue) 7%,transparent),transparent 55%),var(--color-surface)}
.date-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
.date-heading .tonight-eyebrow{margin-bottom:9px}
.date-heading h2{margin:0;font-size:21px;font-weight:500;color:var(--color-text);line-height:1.6}
.date-heading h2 span{color:var(--color-text-muted);font-size:15px;white-space:nowrap}
.solar-context{font-size:10px;color:var(--color-text-subtle);margin:7px 0 0}
.date-navigation{display:flex;align-items:center;flex-shrink:0;gap:3px;padding:3px;border:1px solid var(--color-border);border-radius:24px;background:var(--color-bg)}
.date-navigation button{display:flex;align-items:center;justify-content:center;min-width:30px;min-height:30px;padding:5px 7px;border:0;border-radius:20px;background:transparent;color:var(--color-text-muted);font:inherit;font-size:11px;cursor:pointer}
.date-navigation button:hover{color:var(--color-gold);background:color-mix(in srgb,var(--color-gold) 10%,transparent)}
.timeline-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:19px}
.chart-legend{display:flex;gap:13px;align-items:center;flex-wrap:wrap;font-size:10px;color:var(--color-text-muted)}
.chart-legend>span{display:inline-flex;align-items:center;gap:6px}
.chart-legend i{display:block;width:9px;height:9px;border-radius:3px;border:1px solid var(--color-border)}
.legend-day{background:color-mix(in srgb,var(--color-blue) 26%,var(--color-surface))}.legend-twilight{background:color-mix(in srgb,var(--color-gold) 14%,var(--color-surface))}.legend-night{background:var(--color-bg)}
.chart-legend b{display:block;width:22px;background:var(--color-gold);border-radius:6px}.legend-horizon{height:4px;opacity:.4}.legend-recommended{height:7px}
.legend-divider{height:11px;border-left:1px solid var(--color-border)}
.timeline-footer>p,.timeline-note{font-size:10px;line-height:1.8;color:var(--color-text-subtle);margin:0}
.timeline-note{margin-top:11px;padding-top:11px;border-top:1px solid var(--color-border)}
@keyframes orbit{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.loading-orbit{animation:none}}
@media(max-width:1000px){.featured-grid,.target-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-orbit{flex-basis:150px}.hero-orbit div{width:145px}.control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.tonight-page{padding-top:25px}.hero-orbit{display:none}.tonight-controls{padding:18px 16px}.control-heading{align-items:flex-start;font-size:11px}.control-grid{gap:14px 10px}.night-summary{grid-template-columns:1fr 1fr;gap:22px;padding:20px 0}.night-summary div:nth-child(3){border:0;padding-left:0}.night-summary strong{font-size:19px}.featured-grid,.target-grid{grid-template-columns:1fr}.results-heading{display:block}.results-heading>span{display:block;margin-top:10px}.custom-times{grid-template-columns:1fr}.excluded-targets ul{columns:1}.category-tabs button{padding:7px 11px;font-size:11px}.solar-panel{padding:20px 14px 15px}.date-heading{align-items:flex-start;gap:10px;flex-wrap:wrap}.date-heading h2{font-size:18px}.date-heading h2 span{font-size:13px}.date-navigation{margin-left:auto}.chart-legend{gap:10px;font-size:9px}.legend-divider{display:none!important}.timeline-footer>p,.timeline-note{font-size:9px}}
</style>
