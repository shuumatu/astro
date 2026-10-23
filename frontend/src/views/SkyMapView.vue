<script setup lang="ts">
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Triangle } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadCatalogEntry } from '../features/catalog/api'
import CatalogInfoCard from '../features/catalog/CatalogInfoCard.vue'
import { catalogIdentityForSelection, catalogSelectionAction } from '../features/catalog/catalogIdentity'
import type { CatalogEntry } from '../features/catalog/types'
import { CalculationPreloader } from '../features/sky-map/calculationPreloader'
import SkyMapCanvas from '../features/sky-map/SkyMapCanvas.vue'
import SkyTargetSearch from '../features/sky-map/SkyTargetSearch.vue'
import {
  adjacentTimeCalculationParameters,
  skyCalculationParametersKey,
} from '../features/sky-map/framePreload'
import type { TimeNavigationDirection } from '../features/sky-map/framePreload'
import { LatestCalculationScheduler } from '../features/sky-map/latestCalculationScheduler'
import { selectLocalizedName } from '../features/sky-map/localizedName'
import {
  ObservationTimeWheelBatcher,
  OBSERVATION_TIME_PRESETS,
  OBSERVATION_TIME_STEPS,
  accumulateObservationTimeWheel,
  observationTimeForPreset,
  shiftObservationTime,
} from '../features/sky-map/observationTime'
import type {
  ObservationTimePreset,
  ObservationTimeStep,
} from '../features/sky-map/observationTime'
import {
  OBSERVER_PRESET_IDS,
  observerLocationForPreset,
} from '../features/sky-map/observerPresets'
import type { ObserverPresetId } from '../features/sky-map/observerPresets'
import type {
  CatalogSummary,
  SkyCalculationParameters,
  SkyFrame,
  SkyObjectSelection,
  SkySearchSuggestion,
  StarNamePresentation,
} from '../features/sky-map/types'
import { SkyMapWorkerClient } from '../features/sky-map/workerClient'

type ViewStatus = 'loadingCatalog' | 'ready' | 'error'
type SkyCalculationResult = Awaited<ReturnType<SkyMapWorkerClient['calculate']>>

const ASTRONOMICAL_UNIT_KM = 149_597_870.7
const CALCULATION_DEBOUNCE_MS = 80
const TIME_WHEEL_RESET_MS = 240

const DEFAULT_OBSERVER_PRESET: ObserverPresetId = 'shenzhen'
const defaultObserverLocation = observerLocationForPreset(DEFAULT_OBSERVER_PRESET)

const { t, locale } = useI18n({ useScope: 'global' })
const controls = reactive({
  observedAt: localDateTimeValue(new Date()),
  ...defaultObserverLocation,
  cultureId: 'western-iau',
  magnitudeLimit: 5.5,
  applyRefraction: true,
  showStarNames: true,
  showCultureLines: true,
  showCultureLabels: true,
  showCultureBoundaries: true,
  showCultureArtwork: true,
  showSolarSystemBodies: true,
  enabledFeaturedPatternIds: [] as string[],
})
const status = ref<ViewStatus>('loadingCatalog')
const activeTimePreset = ref<ObservationTimePreset | 'custom'>('now')
const activeLocationPreset = ref<ObserverPresetId | 'custom'>(DEFAULT_OBSERVER_PRESET)
const errorMessage = ref('')
const catalog = ref<CatalogSummary | null>(null)
const frame = shallowRef<SkyFrame | null>(null)
const calculationDurationMs = ref<number | null>(null)
const selectedObject = ref<SkyObjectSelection | null>(null)
const catalogCardOpen = ref(false)
const catalogCardEntry = ref<CatalogEntry | null>(null)
const catalogCardLoading = ref(false)
const catalogCardError = ref(false)
const selectedStarNames = ref<StarNamePresentation | null>(null)
const controlsCollapsed = ref(false)
const skyCanvas = ref<InstanceType<typeof SkyMapCanvas> | null>(null)
const skyMapStage = ref<HTMLDivElement | null>(null)
const isSkyMapFullscreen = ref(false)
const fullscreenSupported = ref(false)
const targetQuery = ref('')
const targetMessage = ref('')
let workerClient: SkyMapWorkerClient | null = null
let calculationScheduler: LatestCalculationScheduler<
  SkyCalculationParameters,
  SkyCalculationResult
> | null = null
let calculationPreloader: CalculationPreloader<SkyCalculationParameters, SkyCalculationResult> | null = null
let calculationTimer: ReturnType<typeof setTimeout> | null = null
let timeWheelResetTimer: ReturnType<typeof setTimeout> | null = null
let accumulatedTimeWheelDelta = 0
let timeWheelBatcher: ObservationTimeWheelBatcher | null = null
let timeNavigationDirection: TimeNavigationDirection = 1
let catalogCardSequence = 0
let starNameSequence = 0
let pendingFeaturedPatternId = ''

const statusText = computed(() => t(`skyMap.status.${status.value}`))
const observedAtLabel = computed(() => frame.value
  ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(frame.value.observedAt))
  : '—')
const visibleStarCount = computed(() => frame.value
  ? new Intl.NumberFormat(locale.value).format(frame.value.stars.length)
  : '—')
const featuredPatternOptions = computed(() => (catalog.value?.featuredPatterns ?? []).map((pattern) => ({
  id: pattern.id,
  name: selectLocalizedName(pattern.names, locale.value, 'en'),
})))
const enabledFeaturedPatternCount = computed(() => controls.enabledFeaturedPatternIds.length)
const catalogCardIdentity = computed(() => selectedObject.value
  ? catalogIdentityForSelection(selectedObject.value, controls.cultureId)
  : null)
const selectedStarObjectId = computed(() => selectedObject.value?.kind === 'star'
  ? selectedObject.value.object.id
  : null)
const catalogCardAliases = computed(() => selectedStarNames.value?.objectId === selectedStarObjectId.value
  ? selectedStarNames.value.aliases
  : [])
const catalogCardFacts = computed(() => {
  const selection = selectedObject.value
  if (!selection) return []
  const position = selection.kind === 'cultureFigure' || selection.kind === 'featuredPattern'
    ? selection.object.labelPosition
    : selection.object
  const facts = [
    {
      label: t('skyMap.position'),
      value: position
        ? `${formatCoordinate(position.azimuthDeg, '°')} / ${formatCoordinate(position.altitudeDeg, '°')}`
        : '— / —',
    },
  ]
  if (selection.kind === 'cultureFigure') {
    facts.push({ label: t('skyMap.constellation'), value: selection.object.name })
    facts.push({ label: t('skyMap.culture'), value: t(`skyMap.cultures.${controls.cultureId}`) })
    return facts
  }
  if (selection.kind === 'featuredPattern') {
    facts.push({ label: t('skyMap.featuredPatterns'), value: selection.object.name })
    facts.push({
      label: t('skyMap.memberStars'),
      value: new Intl.NumberFormat(locale.value).format(selection.object.memberObjectIds.length),
    })
    return facts
  }
  facts.push({
    label: t('skyMap.magnitude'),
    value: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(selection.object.visualMagnitude),
  })
  facts.push({
    label: selection.kind === 'star' ? t('skyMap.spectralType') : t('skyMap.distance'),
    value: selection.kind === 'star' ? (selection.object.spectralType ?? '—') : formatSelectedDataFor(selection),
  })
  return facts
})

watch(targetQuery, () => {
  targetMessage.value = ''
})
watch(
  [selectedStarObjectId, () => controls.cultureId, locale],
  () => { void loadSelectedStarNames() },
  { flush: 'sync' },
)
watch(() => controls.observedAt, requestCalculation, { flush: 'sync' })
watch(() => [...controls.enabledFeaturedPatternIds], requestCalculation, { flush: 'sync' })
watch(() => [controls.cultureId, locale.value] as const, () => {
  requestCalculation()
  if (catalogCardOpen.value) void loadSelectedCatalogEntry()
}, { flush: 'sync' })
watch(
  () => [
    controls.latitudeDeg,
    controls.longitudeDeg,
    controls.elevationMeters,
    controls.magnitudeLimit,
    controls.applyRefraction,
  ] as const,
  scheduleCalculation,
)

onMounted(() => {
  timeWheelBatcher = new ObservationTimeWheelBatcher(applyObservationMinuteDelta)
  window.addEventListener('wheel', handlePageWheel, { passive: false })
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('keydown', handleFullscreenKeydown)
  fullscreenSupported.value = document.fullscreenEnabled
    && typeof HTMLElement.prototype.requestFullscreen === 'function'
  void initialize()
})
onBeforeUnmount(() => {
  window.removeEventListener('wheel', handlePageWheel)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', handleFullscreenKeydown)
  if (calculationTimer) clearTimeout(calculationTimer)
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelBatcher?.reset()
  timeWheelBatcher = null
  calculationScheduler?.dispose()
  calculationScheduler = null
  calculationPreloader?.dispose()
  calculationPreloader = null
  const client = workerClient
  workerClient = null
  client?.dispose()
})

async function initialize(): Promise<void> {
  status.value = 'loadingCatalog'
  errorMessage.value = ''
  calculationScheduler?.dispose()
  calculationScheduler = null
  calculationPreloader?.dispose()
  calculationPreloader = null
  workerClient?.dispose()
  const client = new SkyMapWorkerClient()
  workerClient = client
  try {
    const catalogSummary = await client.initialize()
    if (client !== workerClient) return
    catalog.value = catalogSummary
    if (!catalogSummary.cultureIds.includes(controls.cultureId)) {
      controls.cultureId = catalogSummary.defaultCultureId
    }
    const preloader = new CalculationPreloader(
      (parameters) => client.calculate(parameters),
      skyCalculationParametersKey,
      { maximumEntries: 128, preloadDelayMs: 8 },
    )
    calculationPreloader = preloader
    calculationScheduler = new LatestCalculationScheduler(
      (parameters) => preloader.calculate(parameters),
      applyCalculationResult,
      fail,
    )
    void loadSelectedStarNames()
    requestCalculation()
  } catch (error) {
    if (client !== workerClient) return
    fail(error)
  }
}

function requestCalculation(): void {
  const parameters = currentCalculationParameters()
  if (!calculationScheduler || !catalog.value || !parameters) return
  errorMessage.value = ''
  targetMessage.value = ''
  calculationScheduler.request(parameters)
}

function applyCalculationResult(result: SkyCalculationResult): void {
  frame.value = result.frame
  selectedObject.value = selectedObject.value
    ? resolveSelectionInFrame(selectedObject.value, result.frame)
    : null
  calculationDurationMs.value = result.calculationDurationMs
  status.value = 'ready'
  if (pendingFeaturedPatternId) {
    const id = pendingFeaturedPatternId
    pendingFeaturedPatternId = ''
    const pattern = result.frame.featuredPatterns.find((candidate) => candidate.id === id)
    if (pattern) locateTarget({ kind: 'featuredPattern', object: pattern })
    else targetMessage.value = t('skyMap.targetNotVisible', { id })
  }
  const parameters = currentCalculationParameters()
  if (parameters && parameters.observedAt === result.frame.observedAt) {
    calculationPreloader?.preload(adjacentTimeCalculationParameters(parameters, timeNavigationDirection))
  }
}

function currentCalculationParameters(): SkyCalculationParameters | null {
  const observedAt = new Date(controls.observedAt)
  const latitudeDeg = controls.latitudeDeg
  const longitudeDeg = controls.longitudeDeg
  const elevationMeters = controls.elevationMeters
  if (
    Number.isNaN(observedAt.getTime())
    || !Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90
    || !Number.isFinite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180
    || !Number.isFinite(elevationMeters) || elevationMeters < -500 || elevationMeters > 10_000
  ) return null
  return {
    observedAt: observedAt.toISOString(),
    observer: { latitudeDeg, longitudeDeg, elevationMeters },
    magnitudeLimit: controls.magnitudeLimit,
    minimumAltitudeDeg: 0,
    applyRefraction: controls.applyRefraction,
    cultureId: controls.cultureId,
    interfaceLanguage: locale.value,
    enabledFeaturedPatternIds: [...controls.enabledFeaturedPatternIds],
  }
}

function scheduleCalculation(): void {
  if (calculationTimer) clearTimeout(calculationTimer)
  calculationTimer = setTimeout(() => {
    calculationTimer = null
    requestCalculation()
  }, CALCULATION_DEBOUNCE_MS)
}

function useTimePreset(preset: ObservationTimePreset): void {
  resetPendingTimeWheel()
  activeTimePreset.value = preset
  controls.observedAt = localDateTimeValue(observationTimeForPreset(preset))
}

function useCustomTime(): void {
  activeTimePreset.value = 'custom'
}

function adjustObservationTime(step: ObservationTimeStep): void {
  resetPendingTimeWheel()
  const current = new Date(controls.observedAt)
  if (Number.isNaN(current.getTime())) return
  activeTimePreset.value = 'custom'
  controls.observedAt = localDateTimeValue(shiftObservationTime(current, step))
}

function handlePageWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
  const result = accumulateObservationTimeWheel(
    accumulatedTimeWheelDelta,
    event.deltaY * modeScale,
  )
  accumulatedTimeWheelDelta = result.accumulatedDelta
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelResetTimer = setTimeout(() => {
    accumulatedTimeWheelDelta = 0
    timeWheelResetTimer = null
  }, TIME_WHEEL_RESET_MS)
  if (!result.step) return
  timeWheelBatcher?.enqueue(result.step)
}

function applyObservationMinuteDelta(minuteDelta: number): void {
  const current = new Date(controls.observedAt)
  if (Number.isNaN(current.getTime())) return
  timeNavigationDirection = minuteDelta < 0 ? -1 : 1
  current.setMinutes(current.getMinutes() + minuteDelta)
  activeTimePreset.value = 'custom'
  controls.observedAt = localDateTimeValue(current)
}

function resetPendingTimeWheel(): void {
  if (timeWheelResetTimer) clearTimeout(timeWheelResetTimer)
  timeWheelResetTimer = null
  timeWheelBatcher?.reset()
  accumulatedTimeWheelDelta = 0
}

function handleFullscreenChange(): void {
  isSkyMapFullscreen.value = document.fullscreenElement === skyMapStage.value
}

function handleFullscreenKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (catalogCardOpen.value) {
    closeCatalogCard()
    return
  }
  if (document.fullscreenElement !== skyMapStage.value) return
  void document.exitFullscreen()
}

async function toggleSkyMapFullscreen(): Promise<void> {
  const stage = skyMapStage.value
  if (!stage || !fullscreenSupported.value) return
  if (document.fullscreenElement === stage) {
    await document.exitFullscreen()
    return
  }
  await stage.requestFullscreen()
}

function useLocationPreset(): void {
  if (activeLocationPreset.value === 'custom') return
  Object.assign(controls, observerLocationForPreset(activeLocationPreset.value))
}

function useCustomLocation(): void {
  activeLocationPreset.value = 'custom'
}

function selectTargetSuggestion(suggestion: SkySearchSuggestion): void {
  if (suggestion.targetType === 'solarSystemBody') {
    const id = suggestion.objectId.slice('solar-system:'.length)
    const body = frame.value?.solarSystemBodies.find((candidate) => candidate.id === id)
    if (body) {
      controls.showSolarSystemBodies = true
      locateTarget({ kind: 'solarSystemBody', object: body })
    } else {
      selectedObject.value = null
      targetMessage.value = t('skyMap.targetNotVisible', { id: suggestion.term })
    }
    return
  }
  if (suggestion.targetType === 'cultureFigure') {
    const id = suggestion.objectId.split(':').at(-1)
    const figure = frame.value?.cultureFigures.find((candidate) => candidate.id === id)
    if (figure) locateTarget({ kind: 'cultureFigure', object: figure })
    return
  }
  if (suggestion.targetType === 'featuredPattern') {
    const id = suggestion.objectId.slice('featured-pattern:'.length)
    const pattern = frame.value?.featuredPatterns.find((candidate) => candidate.id === id)
    if (pattern) {
      locateTarget({ kind: 'featuredPattern', object: pattern })
      return
    }
    pendingFeaturedPatternId = id
    if (!controls.enabledFeaturedPatternIds.includes(id)) {
      controls.enabledFeaturedPatternIds.push(id)
    } else {
      requestCalculation()
    }
    return
  }
  if (!suggestion.availableInCatalog) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.targetUnavailable', { id: suggestion.term })
    return
  }
  const star = frame.value?.stars.find((candidate) => candidate.id === suggestion.objectId)
  if (!star) {
    selectedObject.value = null
    targetMessage.value = t('skyMap.targetNotVisible', { id: suggestion.term })
    return
  }
  locateTarget({ kind: 'star', object: star })
}

function handleTargetSearchEmpty(): void {
  selectedObject.value = null
  targetMessage.value = t('skyMap.noTargetMatches')
}

function locateTarget(selection: SkyObjectSelection): void {
  closeCatalogCard()
  selectedObject.value = selection
  skyCanvas.value?.focusObject(selection)
  targetMessage.value = t('skyMap.targetLocated', { id: formatSelectedObject(selection) })
}

function selectObject(selection: SkyObjectSelection | null): void {
  const action = catalogSelectionAction(selectedObject.value, selection)
  if (action === 'open' && selection) {
    selectedObject.value = selection
    catalogCardOpen.value = true
    void loadSelectedCatalogEntry()
    return
  }
  closeCatalogCard()
  selectedObject.value = selection
  targetMessage.value = ''
}

async function loadSelectedCatalogEntry(): Promise<void> {
  const identity = catalogCardIdentity.value
  if (!identity) return
  const sequence = ++catalogCardSequence
  catalogCardLoading.value = true
  catalogCardError.value = false
  catalogCardEntry.value = null
  try {
    const entry = await loadCatalogEntry(identity.objectType, identity.objectKey, locale.value)
    if (sequence === catalogCardSequence) catalogCardEntry.value = entry
  } catch {
    if (sequence === catalogCardSequence) catalogCardError.value = true
  } finally {
    if (sequence === catalogCardSequence) catalogCardLoading.value = false
  }
}

function closeCatalogCard(): void {
  catalogCardSequence += 1
  catalogCardOpen.value = false
  catalogCardEntry.value = null
  catalogCardLoading.value = false
  catalogCardError.value = false
}

async function loadSelectedStarNames(): Promise<void> {
  const objectId = selectedStarObjectId.value
  const client = workerClient
  const sequence = ++starNameSequence
  if (!objectId || !client) {
    selectedStarNames.value = null
    return
  }
  try {
    const result = await client.resolveStarNames({
      objectId,
      cultureId: controls.cultureId,
      interfaceLanguage: locale.value,
    })
    if (sequence === starNameSequence && objectId === selectedStarObjectId.value) {
      selectedStarNames.value = result
    }
  } catch {
    if (sequence === starNameSequence) selectedStarNames.value = null
  }
}

function fail(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : String(error)
  status.value = 'error'
}

function localDateTimeValue(date: Date): string {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 16)
}

function formatCoordinate(value: number | undefined, suffix: string): string {
  if (value === undefined) return '—'
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

function formatSelectedObject(selection = selectedObject.value): string {
  if (!selection) return '—'
  if (selection.kind === 'solarSystemBody') return t(`skyMap.solarSystemBodies.${selection.object.id}`)
  if (selection.kind === 'cultureFigure') return selection.object.name
  if (selection.kind === 'featuredPattern') return selection.object.name
  if (selectedStarNames.value?.objectId === selection.object.id) {
    return selectedStarNames.value.primaryName
  }
  const cultureName = frame.value?.starLabels.find(
    (label) => label.objectId === selection.object.id,
  )?.name
  return cultureName ?? `HIP ${selection.object.hipId}`
}

function resolveSelectionInFrame(
  selection: SkyObjectSelection,
  nextFrame: SkyFrame,
): SkyObjectSelection | null {
  if (selection.kind === 'star') {
    const star = nextFrame.stars.find((candidate) => candidate.id === selection.object.id)
    return star ? { kind: 'star', object: star } : null
  }
  if (selection.kind === 'cultureFigure') {
    const figure = nextFrame.cultureFigures.find((candidate) => candidate.id === selection.object.id)
    return figure ? { kind: 'cultureFigure', object: figure } : null
  }
  if (selection.kind === 'featuredPattern') {
    const pattern = nextFrame.featuredPatterns.find((candidate) => candidate.id === selection.object.id)
    return pattern ? { kind: 'featuredPattern', object: pattern } : null
  }
  const body = nextFrame.solarSystemBodies.find((candidate) => candidate.id === selection.object.id)
  return body ? { kind: 'solarSystemBody', object: body } : null
}

function formatSelectedDetail(): string {
  const selection = selectedObject.value
  if (!selection) return '—'
  if (selection.kind === 'star') return selection.object.spectralType ?? '—'
  if (selection.kind === 'cultureFigure') return t('skyMap.constellation')
  if (selection.kind === 'featuredPattern') return t('skyMap.featuredPatterns')
  return new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(selection.object.phaseFraction)
}

function formatSelectedData(): string {
  const selection = selectedObject.value
  if (!selection) return '—'
  if (selection.kind === 'star') return t(`skyMap.sources.${selection.object.astrometrySource}`)
  if (selection.kind === 'cultureFigure') return '—'
  if (selection.kind === 'featuredPattern') {
    return new Intl.NumberFormat(locale.value).format(selection.object.memberObjectIds.length)
  }
  if (selection.object.id === 'moon') {
    const kilometers = selection.object.distanceAu * ASTRONOMICAL_UNIT_KM
    return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(kilometers)} km`
  }
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(selection.object.distanceAu)} AU`
}

function formatSelectedDataFor(selection: Extract<SkyObjectSelection, { kind: 'solarSystemBody' }>): string {
  if (selection.object.id === 'moon') {
    const kilometers = selection.object.distanceAu * ASTRONOMICAL_UNIT_KM
    return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(kilometers)} km`
  }
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(selection.object.distanceAu)} AU`
}
</script>

<template>
  <section class="sky-map-page">
    <header class="sky-map-header">
      <div>
        <p class="sky-map-kicker">{{ t('skyMap.kicker') }}</p>
        <h1>{{ t('skyMap.title') }}</h1>
      </div>
      <div class="catalog-meta" aria-live="polite">
        <span class="status-dot" :class="status" aria-hidden="true"></span>
        <span>{{ statusText }}</span>
        <span v-if="catalog">{{ t('skyMap.catalogVersion', { version: catalog.version }) }}</span>
      </div>
    </header>

    <div class="sky-map-workspace" :class="{ 'controls-collapsed': controlsCollapsed }">
      <aside class="sky-controls">
        <form @submit.prevent>
          <fieldset>
            <legend>{{ t('skyMap.observation') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.observedAt') }}</span>
              <input
                v-model="controls.observedAt"
                type="datetime-local"
                required
                @input="useCustomTime"
              >
            </label>
            <div class="time-presets" role="group" :aria-label="t('skyMap.quickTimes')">
              <button
                v-for="preset in OBSERVATION_TIME_PRESETS"
                :key="preset"
                type="button"
                :class="{ active: activeTimePreset === preset }"
                :aria-pressed="activeTimePreset === preset"
                :disabled="status === 'loadingCatalog'"
                @click="useTimePreset(preset)"
              >{{ t(`skyMap.timePresets.${preset}`) }}</button>
            </div>
            <div class="time-adjustments" role="group" :aria-label="t('skyMap.adjustTime')">
              <button
                v-for="step in OBSERVATION_TIME_STEPS"
                :key="step"
                type="button"
                :title="t(`skyMap.timeSteps.${step}`)"
                :disabled="status === 'loadingCatalog'"
                @click="adjustObservationTime(step)"
              >{{ t(`skyMap.timeSteps.${step}`) }}</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.location') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.locationPreset') }}</span>
              <select
                v-model="activeLocationPreset"
                :disabled="status === 'loadingCatalog'"
                @change="useLocationPreset"
              >
                <option
                  v-for="preset in OBSERVER_PRESET_IDS"
                  :key="preset"
                  :value="preset"
                >{{ t(`skyMap.locationPresets.${preset}`) }}</option>
                <option value="custom">{{ t('skyMap.locationPresets.custom') }}</option>
              </select>
            </label>
            <div class="coordinate-grid">
              <label class="field">
                <span>{{ t('skyMap.latitude') }}</span>
                <input v-model.number="controls.latitudeDeg" type="number" min="-90" max="90" step="0.0001" required @input="useCustomLocation">
              </label>
              <label class="field">
                <span>{{ t('skyMap.longitude') }}</span>
                <input v-model.number="controls.longitudeDeg" type="number" min="-180" max="180" step="0.0001" required @input="useCustomLocation">
              </label>
            </div>
            <label class="field full-field">
              <span>{{ t('skyMap.elevation') }}</span>
              <input v-model.number="controls.elevationMeters" type="number" min="-500" max="10000" step="1" required @input="useCustomLocation">
            </label>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.target') }}</legend>
            <SkyTargetSearch
              v-model="targetQuery"
              :culture-id="controls.cultureId"
              :interface-language="locale"
              :placeholder="t('skyMap.targetPlaceholder')"
              :input-aria-label="t('skyMap.targetSearch')"
              :disabled="!catalog"
              @select="selectTargetSuggestion"
              @empty="handleTargetSearchEmpty"
              @error="fail"
            />
            <p v-if="targetMessage" class="target-message" role="status">{{ targetMessage }}</p>
          </fieldset>

          <fieldset>
            <legend>{{ t('skyMap.visibility') }}</legend>
            <label class="field full-field">
              <span>{{ t('skyMap.culture') }}</span>
              <select v-model="controls.cultureId" :disabled="status === 'loadingCatalog'">
                <option
                  v-for="cultureId in catalog?.cultureIds ?? []"
                  :key="cultureId"
                  :value="cultureId"
                >{{ t(`skyMap.cultures.${cultureId}`) }}</option>
              </select>
            </label>
            <label class="range-field">
              <span>{{ t('skyMap.magnitudeLimit') }}</span>
              <output>{{ controls.magnitudeLimit.toFixed(1) }}</output>
              <input
                v-model.number="controls.magnitudeLimit"
                type="range"
                min="-1"
                max="6.5"
                step="0.1"
                :aria-label="t('skyMap.magnitudeLimit')"
              >
            </label>
            <label class="toggle-row">
              <input v-model="controls.showStarNames" type="checkbox">
              <span>{{ t('skyMap.starNames') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureLines" type="checkbox">
              <span>{{ t('skyMap.cultureLines') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureLabels" type="checkbox">
              <span>{{ t('skyMap.cultureLabels') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showCultureBoundaries" type="checkbox">
              <span>{{ t('skyMap.cultureBoundaries') }}</span>
            </label>
            <label v-if="controls.cultureId === 'western-iau'" class="toggle-row">
              <input v-model="controls.showCultureArtwork" type="checkbox">
              <span>{{ t('skyMap.cultureArtwork') }}</span>
            </label>
            <label class="toggle-row">
              <input v-model="controls.showSolarSystemBodies" type="checkbox">
              <span>{{ t('skyMap.solarSystem') }}</span>
            </label>
            <details class="featured-pattern-menu">
              <summary>
                <Triangle :size="15" aria-hidden="true" />
                <span>{{ t('skyMap.featuredPatterns') }}</span>
                <span v-if="enabledFeaturedPatternCount" class="pattern-count">{{ enabledFeaturedPatternCount }}</span>
                <ChevronDown class="menu-chevron" :size="15" aria-hidden="true" />
              </summary>
              <div class="featured-pattern-options">
                <label
                  v-for="pattern in featuredPatternOptions"
                  :key="pattern.id"
                  class="toggle-row"
                >
                  <input
                    v-model="controls.enabledFeaturedPatternIds"
                    type="checkbox"
                    :value="pattern.id"
                    :disabled="status === 'loadingCatalog'"
                  >
                  <span>{{ pattern.name }}</span>
                </label>
              </div>
            </details>
            <label class="toggle-row">
              <input v-model="controls.applyRefraction" type="checkbox">
              <span>{{ t('skyMap.refraction') }}</span>
            </label>
          </fieldset>

        </form>
      </aside>

      <div ref="skyMapStage" class="sky-map-stage">
        <button
          v-if="!isSkyMapFullscreen"
          type="button"
          class="controls-toggle"
          :aria-label="t(controlsCollapsed ? 'skyMap.showControls' : 'skyMap.hideControls')"
          :title="t(controlsCollapsed ? 'skyMap.showControls' : 'skyMap.hideControls')"
          @click="controlsCollapsed = !controlsCollapsed"
        >
          <PanelLeftOpen v-if="controlsCollapsed" :size="18" aria-hidden="true" />
          <PanelLeftClose v-else :size="18" aria-hidden="true" />
        </button>
        <SkyMapCanvas
          ref="skyCanvas"
          :frame="frame"
          :show-star-names="controls.showStarNames"
          :show-culture-lines="controls.showCultureLines"
          :show-culture-labels="controls.showCultureLabels"
          :show-culture-boundaries="controls.showCultureBoundaries"
          :show-culture-artwork="controls.showCultureArtwork"
          :show-solar-system-bodies="controls.showSolarSystemBodies"
          :selected-object="selectedObject"
          :is-fullscreen="isSkyMapFullscreen"
          :fullscreen-supported="fullscreenSupported"
          @select="selectObject"
          @toggle-fullscreen="toggleSkyMapFullscreen"
        />
        <div v-if="status === 'loadingCatalog'" class="stage-state" role="status">
          <span class="loading-indicator" aria-hidden="true"></span>
          <span>{{ statusText }}</span>
        </div>
        <div v-else-if="status === 'error'" class="stage-state error-state" role="alert">
          <strong>{{ t('skyMap.loadFailed') }}</strong>
          <span>{{ errorMessage }}</span>
          <button type="button" class="secondary-command" @click="initialize">{{ t('skyMap.retry') }}</button>
        </div>
        <CatalogInfoCard
          v-if="catalogCardOpen && catalogCardIdentity && selectedObject"
          :entry="catalogCardEntry"
          :object-type="catalogCardIdentity.objectType"
          :object-key="catalogCardIdentity.objectKey"
          :object-name="formatSelectedObject(selectedObject)"
          :aliases="catalogCardAliases"
          :facts="catalogCardFacts"
          :loading="catalogCardLoading"
          :error="catalogCardError"
          @close="closeCatalogCard"
        />
      </div>
    </div>

    <footer class="sky-readout">
      <dl>
        <div>
          <dt>{{ t('skyMap.observedAt') }}</dt>
          <dd :title="observedAtLabel">{{ observedAtLabel }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.visibleStars') }}</dt>
          <dd :title="visibleStarCount">{{ visibleStarCount }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.calculationTime') }}</dt>
          <dd :title="calculationDurationMs === null ? '—' : `${calculationDurationMs.toFixed(1)} ms`">{{ calculationDurationMs === null ? '—' : `${calculationDurationMs.toFixed(1)} ms` }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.selectedObject') }}</dt>
          <dd :title="formatSelectedObject()">{{ formatSelectedObject() }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.magnitude') }}</dt>
          <dd :title="selectedObject && (selectedObject.kind === 'star' || selectedObject.kind === 'solarSystemBody') ? selectedObject.object.visualMagnitude.toFixed(2) : '—'">{{ selectedObject && (selectedObject.kind === 'star' || selectedObject.kind === 'solarSystemBody') ? selectedObject.object.visualMagnitude.toFixed(2) : '—' }}</dd>
        </div>
        <div>
          <dt>{{ selectedObject?.kind === 'solarSystemBody' ? t('skyMap.phase') : selectedObject?.kind === 'cultureFigure' ? t('skyMap.constellation') : selectedObject?.kind === 'featuredPattern' ? t('skyMap.featuredPatterns') : t('skyMap.spectralType') }}</dt>
          <dd :title="formatSelectedDetail()">{{ formatSelectedDetail() }}</dd>
        </div>
        <div>
          <dt>{{ selectedObject?.kind === 'solarSystemBody' ? t('skyMap.distance') : selectedObject?.kind === 'featuredPattern' ? t('skyMap.memberStars') : t('skyMap.dataSource') }}</dt>
          <dd :title="formatSelectedData()">{{ formatSelectedData() }}</dd>
        </div>
        <div>
          <dt>{{ t('skyMap.position') }}</dt>
          <dd :title="`${selectedObject?.kind === 'cultureFigure' || selectedObject?.kind === 'featuredPattern' ? '—' : formatCoordinate(selectedObject?.object.azimuthDeg, '°')} / ${selectedObject?.kind === 'cultureFigure' || selectedObject?.kind === 'featuredPattern' ? '—' : formatCoordinate(selectedObject?.object.altitudeDeg, '°')}`">{{ selectedObject?.kind === 'cultureFigure' || selectedObject?.kind === 'featuredPattern' ? '—' : formatCoordinate(selectedObject?.object.azimuthDeg, '°') }} / {{ selectedObject?.kind === 'cultureFigure' || selectedObject?.kind === 'featuredPattern' ? '—' : formatCoordinate(selectedObject?.object.altitudeDeg, '°') }}</dd>
        </div>
      </dl>
    </footer>
  </section>
</template>

<style scoped>
.sky-map-page { padding: 1rem 0 2rem; }

@media (min-width: 901px) {
  .sky-map-page {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: calc(100vh - 68px);
    height: calc(100dvh - 68px);
    min-height: 480px;
    padding: .5rem 0;
  }
}

.sky-map-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 40px;
  padding-bottom: .5rem;
}

.sky-map-kicker {
  margin: 0 0 .3rem;
  color: var(--color-blue);
  font-size: .78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.sky-map-header h1 {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.2;
}

.catalog-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .45rem 1rem;
  color: var(--color-text-muted);
  font-size: .82rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  margin-top: .3rem;
  border-radius: 50%;
  background: var(--color-gold);
}

.status-dot.ready { background: var(--color-success); }
.status-dot.error { background: var(--color-danger); }

.sky-map-workspace {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.sky-map-workspace.controls-collapsed { grid-template-columns: 0 minmax(0, 1fr); }
.sky-map-workspace.controls-collapsed .sky-controls { overflow: hidden; visibility: hidden; border-right: 0; }

.sky-controls {
  min-height: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.sky-controls form { display: grid; }

fieldset {
  display: grid;
  gap: .6rem;
  min-width: 0;
  margin: 0;
  padding: .8rem;
  border: 0;
  border-bottom: 1px solid var(--color-border);
}

legend {
  width: 100%;
  padding: 0 0 .15rem;
  color: var(--color-text);
  font-size: .82rem;
  font-weight: 700;
}

.field,
.range-field {
  display: grid;
  gap: .38rem;
  min-width: 0;
  color: var(--color-text-muted);
  font-size: .76rem;
}

.coordinate-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .55rem;
}

.time-presets,
.time-adjustments {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 9px;
}

.time-presets { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.time-adjustments { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.time-presets button,
.time-adjustments button {
  min-width: 0;
  min-height: 42px;
  border: 0;
  border-right: 1px solid var(--color-border);
  padding: .35rem .2rem;
  color: var(--color-text-muted);
  background: transparent;
  font-size: .68rem;
  line-height: 1.25;
  cursor: pointer;
}

.time-presets button:last-child,
.time-adjustments button:last-child { border-right: 0; }
.time-presets button.active { color: var(--color-on-accent); background: var(--color-blue); font-weight: 700; }
.time-presets button:hover:not(:disabled, .active),
.time-adjustments button:hover:not(:disabled) { color: var(--color-text); background: var(--color-surface-raised); }

input[type="datetime-local"],
input[type="number"],
input[type="search"],
select {
  width: 100%;
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 0 .55rem;
  color: var(--color-text);
  background: var(--color-bg);
}

select { color-scheme: inherit; }

.target-search-shell { position: relative; min-width: 0; }
.target-search { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: .4rem; }

.target-suggestions {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  right: 40px;
  left: 0;
  overflow: hidden;
  margin: 0;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  list-style: none;
  background: var(--color-bg);
  box-shadow: 0 10px 24px var(--color-shadow);
}

.target-suggestion {
  display: grid;
  gap: .18rem;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 2px;
  padding: .5rem .55rem;
  color: var(--color-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.target-suggestion:hover,
.target-suggestion.active { background: var(--color-surface-raised); }
.suggestion-name { overflow-wrap: anywhere; font-size: .78rem; line-height: 1.25; }
.suggestion-meta { color: var(--color-text-subtle); font-size: .65rem; line-height: 1.3; }

.icon-command {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 0;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}

.icon-command:hover:not(:disabled) { color: var(--color-on-accent); background: var(--color-blue); }
.target-message { margin: 0; color: var(--color-gold); font-size: .72rem; line-height: 1.45; }

.range-field { grid-template-columns: 1fr auto; }
.range-field input { grid-column: 1 / -1; width: 100%; accent-color: var(--color-blue); }
.range-field output { color: var(--color-gold); font-variant-numeric: tabular-nums; }

.toggle-row {
  display: flex;
  align-items: center;
  gap: .55rem;
  color: var(--color-text-muted);
  font-size: .82rem;
  cursor: pointer;
}

.toggle-row input { width: 15px; height: 15px; margin: 0; accent-color: var(--color-blue); }

.featured-pattern-menu {
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-bg);
}

.featured-pattern-menu summary {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto 18px;
  align-items: center;
  gap: .4rem;
  min-height: 36px;
  padding: 0 .55rem;
  color: var(--color-text-muted);
  font-size: .78rem;
  cursor: pointer;
  list-style: none;
}

.featured-pattern-menu summary::-webkit-details-marker { display: none; }
.featured-pattern-menu summary:hover { color: var(--color-text); background: var(--color-surface-raised); }
.featured-pattern-menu[open] .menu-chevron { transform: rotate(180deg); }
.menu-chevron { transition: transform .16s ease; }

.pattern-count {
  min-width: 20px;
  border-radius: 10px;
  padding: .08rem .35rem;
  color: var(--color-on-accent);
  background: var(--color-gold);
  font-size: .65rem;
  font-weight: 700;
  text-align: center;
}

.featured-pattern-options {
  display: grid;
  gap: .65rem;
  border-top: 1px solid var(--color-border);
  padding: .7rem .55rem;
}

.secondary-command {
  min-height: 36px;
  border-radius: 9px;
  cursor: pointer;
}

.secondary-command {
  border: 1px solid var(--color-border);
  padding: 0 .7rem;
  color: var(--color-text);
  background: transparent;
}

button:disabled { cursor: wait; opacity: .55; }

.sky-map-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #030609;
}

.controls-toggle {
  position: absolute;
  z-index: 7;
  top: 12px;
  left: 12px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 0;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  cursor: pointer;
}

.controls-toggle:hover { color: var(--color-on-accent); background: var(--color-blue); }

.sky-map-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #030609;
}

.sky-map-stage::backdrop { background: #030609; }

.sky-map-stage:fullscreen :deep(.sky-canvas) {
  width: min(100vw, 100vh);
  height: auto;
}

@media (min-width: 901px) {
  .sky-map-workspace { min-height: 0; overflow: hidden; }

  .sky-controls {
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-color: var(--color-border) var(--color-bg);
    scrollbar-width: thin;
  }

  .sky-map-stage { container-type: size; }

  .sky-map-stage :deep(.sky-canvas) {
    width: min(100cqw, 100cqh);
    height: auto;
  }

  .sky-map-kicker { display: none; }
  .sky-readout { height: 66px; overflow: hidden; }
  .sky-readout dl { height: 100%; }
  .sky-readout dl > div {
    display: grid;
    grid-template-rows: 15px 22px;
    align-content: center;
    min-height: 0;
    padding: .35rem .65rem;
  }
  .sky-readout dt { margin: 0; line-height: 15px; }
  .sky-readout dd {
    display: block;
    overflow: hidden;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.stage-state {
  /* Status text stays legible over the astronomical canvas in either interface theme. */
  --color-text: #edf1fa;
  --color-text-muted: #a6b2c9;
  --color-border: #28344b;
  --color-blue: #8abcf4;
  --color-surface-raised: #172238;
  --color-danger: #f0aaa2;
  color-scheme: dark;
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: .75rem;
  padding: 2rem;
  color: var(--color-text-muted);
  background: rgb(3 6 9 / 82%);
  text-align: center;
}

.loading-indicator {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-blue);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.error-state { color: var(--color-danger); }
.error-state span { max-width: 34rem; color: var(--color-text-muted); font-size: .82rem; }

.sky-readout {
  border: 1px solid var(--color-border);
  border-top: 0;
  background: var(--color-surface);
}

.sky-readout dl {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  margin: 0;
}

.sky-readout dl > div { min-width: 0; padding: .8rem 1rem; border-right: 1px solid var(--color-border); }
.sky-readout dl > div:last-child { border-right: 0; }
.sky-readout dt { margin-bottom: .25rem; color: var(--color-text-subtle); font-size: .68rem; }
.sky-readout dd {
  margin: 0;
  color: var(--color-text);
  font-size: .82rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .sky-map-workspace,
  .sky-map-workspace.controls-collapsed { grid-template-columns: 1fr; }
  .sky-controls { border-right: 0; border-bottom: 1px solid var(--color-border); }
  .sky-map-workspace.controls-collapsed .sky-controls { overflow: visible; visibility: visible; border-bottom: 1px solid var(--color-border); }
  .controls-toggle { display: none; }
  .sky-controls form { grid-template-columns: repeat(3, 1fr); }
  fieldset { border-right: 1px solid var(--color-border); border-bottom: 0; }
  .sky-readout dl { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sky-readout dl > div:nth-child(4) { border-right: 0; }
  .sky-readout dl > div:nth-child(-n + 4) { border-bottom: 1px solid var(--color-border); }
}

@media (max-width: 620px) {
  .sky-map-page { padding-top: 1rem; }
  .sky-map-header { align-items: start; flex-direction: column; gap: .65rem; }
  .catalog-meta { justify-content: flex-start; }
  .sky-controls form { grid-template-columns: 1fr; }
  fieldset { border-right: 0; border-bottom: 1px solid var(--color-border); }
  .sky-readout dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sky-readout dl > div { border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
  .sky-readout dl > div:nth-child(even) { border-right: 0; }
  .sky-readout dl > div:nth-last-child(-n + 2) { border-bottom: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-indicator { animation: none; }
}
.sky-map-workspace { border-radius: var(--radius-card) var(--radius-card) 0 0; }
.sky-controls { border-radius: var(--radius-card) 0 0 0; }
.sky-readout { border-radius: 0 0 var(--radius-card) var(--radius-card); overflow: hidden; }
.sky-map-stage { border-top-right-radius: var(--radius-card); }
.sky-map-stage:fullscreen { border-radius: 0; }
input:focus-visible, select:focus-visible { outline: 2px solid var(--color-blue); outline-offset: 2px; }
.secondary-command:hover:not(:disabled) { border-color: var(--color-blue); background: var(--color-surface-raised); }
@media (max-width: 900px) {
  .sky-controls { border-radius: var(--radius-card) var(--radius-card) 0 0; }
  .sky-map-stage { border-top-right-radius: 0; }
}
</style>
