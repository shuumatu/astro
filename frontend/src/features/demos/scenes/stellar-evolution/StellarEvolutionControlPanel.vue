<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-vue-next'
import { MASS_LIMITS } from './config'
import { VISUAL_REFERENCES } from './references'
import { CATEGORY_KEYS, STELLAR_EVOLUTION_KEYS as K, TRACK_KEYS } from './messages'
import {
  massiveTrackStages,
  STAGES,
  solarTrackStages,
  TRACK_BRANCH_AFTER_INDEX,
  type StageDefinition,
} from './stages'
import type { StellarEvolutionCommand, StellarEvolutionSceneState } from './types'

/**
 * The stellar-evolution demo's own control surface.
 *
 * It is mounted by the shared shell inside the stage and given two things: the state the scene
 * published and a way to send commands back. Neither the shell nor `DemoSceneSettings` knows what is
 * in either - which is what lets this demo carry a stage timeline, its own transport, a card about
 * the Sun and a comparison of two evolutionary tracks without a single astronomy-shaped field
 * leaking into every other demo.
 *
 * It is laid out as two panels rather than one, because the demo has two jobs and they are not the
 * same job: navigating a sequence of nine stages, and reading about the one on screen. A single
 * column long enough to hold both would push the card - the actual content - below the fold of its
 * own panel. The nav sits on the left and the reading matter on the right, framing the star between
 * them; on a phone they stack at the bottom with the nav folded away.
 *
 * The science is not in here. Stage data comes from `stages.ts`, and the panel only decides how to
 * print it.
 */
const props = defineProps<{
  state: StellarEvolutionSceneState
  send: (command: StellarEvolutionCommand) => void
  guided?: boolean
}>()

const { t, locale } = useI18n()

/**
 * Whether the timeline starts folded away.
 *
 * On the stacked layout both panels are the full width of the stage, so an open timeline plus the
 * card would cover the star entirely - and the star is the reason the page exists. The transport
 * stays out of the fold either way, so playing and stepping never need a tap to reach.
 */
const collapsed = ref(
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(max-width: 1180px)').matches,
)
const timelineElement = ref<HTMLElement | null>(null)
const infoCollapsed = ref(collapsed.value)
function toggleTimeline() {
  collapsed.value = !collapsed.value
  if (!collapsed.value && window.matchMedia('(max-width: 1180px)').matches) infoCollapsed.value = true
}
function toggleInfo() {
  infoCollapsed.value = !infoCollapsed.value
  if (!infoCollapsed.value && window.matchMedia('(max-width: 1180px)').matches) collapsed.value = true
}

/**
 * Whether the scene has published anything yet.
 *
 * The shell hands the panel its state a moment after the panel itself is mounted, and the shell
 * deliberately does not know what a populated state looks like, so it cannot withhold the panel
 * until then. Guarding here keeps the first render off an empty object, where `STAGES[undefined]`
 * would be undefined and every number a NaN.
 */
const ready = computed(() => typeof (props.state as Partial<StellarEvolutionSceneState>)?.index === 'number')

const index = computed(() => (ready.value ? props.state.index : 0))
const stage = computed<StageDefinition>(() => STAGES[index.value] ?? STAGES[0]!)
const playing = computed(() => Boolean(props.state.playing))
const dwellProgress = computed(() => {
  if (!ready.value) return 0
  const dwell = props.state.dwellMs
  if (!Number.isFinite(dwell) || dwell <= 0) return 0
  return Math.min(1, Math.max(0, props.state.elapsedMs / dwell))
})
const isSunStage = computed(() => stage.value.id === 'main-sequence')

// ------------------------------------------------------------------ formatting

/** Superscript digits, so an exponent reads as an exponent rather than as "E-5". */
const SUPERSCRIPTS: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

function toSuperscript(value: number): string {
  return String(value).split('').map((character) => SUPERSCRIPTS[character] ?? character).join('')
}

/**
 * A number in scientific notation with a real superscript.
 *
 * Used for the two figures that cannot be written out: a neutron star's radius is 1.7e-5 of the
 * Sun's and a supernova's shock front is around a billion kelvin. `Intl` has a scientific notation
 * but prints it as "1.7E-5", which is a programming notation rather than a scientific one.
 */
function scientific(value: number, digits = 1): string {
  const exponent = Math.floor(Math.log10(Math.abs(value)))
  const mantissa = value / 10 ** exponent
  const formatted = new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(mantissa)
  return `${formatted} × 10${toSuperscript(exponent)}`
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: digits }).format(value)
}

/** A radius in solar radii, in whatever notation keeps it readable. */
function formatRadius(radiusSolar: number | null): string {
  if (radiusSolar === null || !Number.isFinite(radiusSolar)) return '—'
  if (radiusSolar >= 1) return `${formatNumber(radiusSolar, radiusSolar >= 10 ? 0 : 2)} R☉`
  if (radiusSolar >= 0.01) return `${formatNumber(radiusSolar, 3)} R☉`
  return `${scientific(radiusSolar, 1)} R☉`
}

function formatTemperature(kelvin: number | null): string {
  if (kelvin === null || !Number.isFinite(kelvin)) return '—'
  if (kelvin >= 1e6) return `${scientific(kelvin, 1)} K`
  return `${formatNumber(kelvin, 0)} K`
}

/**
 * A duration in years.
 *
 * The compact form is `Intl`'s, so it reads as "100亿 年" in Chinese and "10B years" in English
 * rather than as one language's scale words pasted into the other.
 */
function formatYears(years: number | null): string {
  if (years === null || !Number.isFinite(years)) return '—'
  const value = new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(years)
  return `${value} ${t(K.unitYears)}`
}

function formatMass(massSolar: number): string {
  return `${formatNumber(massSolar, massSolar < 10 ? 1 : 0)} M☉`
}

/** The four numbers the card quotes, each with the label that fits the stage it describes. */
const facts = computed(() => [
  { label: t(K.factRadius), value: formatRadius(stage.value.radiusSolar) },
  {
    label: stage.value.id === 'molecular-cloud' ? t(K.factCloudTemperature)
      : stage.value.id === 'supernova' ? t(K.factShockTemperature) : t(K.factTemperature),
    value: stage.value.temperatureK === null
      ? t(K.factNoSurface)
      : formatTemperature(stage.value.temperatureK),
  },
  {
    label: t(stage.value.id === 'supernova' ? K.factRemnantDuration : K.factDuration),
    value: stage.value.durationYears === null
      ? t(K.factOngoing)
      : formatYears(stage.value.durationYears),
  },
  {
    label: stage.value.category === 'remnant' ? t(K.factMassRemnant) : t(K.factMass),
    value: formatMass(stage.value.massSolar),
  },
])

/** The Sun's own numbers, as the data card lists them. Values live in the locale bundle. */
const sunRows = computed(() => [
  { label: t(K.sunCardMass), value: t(K.sunCardMassValue) },
  { label: t(K.sunCardAge), value: t(K.sunCardAgeValue) },
  { label: t(K.sunCardTemperature), value: t(K.sunCardTemperatureValue) },
  { label: t(K.sunCardCoreTemperature), value: t(K.sunCardCoreTemperatureValue) },
  { label: t(K.sunCardDiameter), value: t(K.sunCardDiameterValue) },
  { label: t(K.sunCardLifetime), value: t(K.sunCardLifetimeValue) },
  { label: t(K.sunCardSpectralType), value: t(K.sunCardSpectralTypeValue) },
])

/** Each track's path, built from the stage names so it cannot drift from the timeline. */
function trackPath(track: 'solar' | 'massive'): string {
  const stages = track === 'solar' ? solarTrackStages() : massiveTrackStages()
  return stages.map((entry) => t(entry.nameKey)).join(' → ')
}

const solarPath = computed(() => trackPath('solar'))
const massivePath = computed(() => trackPath('massive'))

const commonStages = computed(() => STAGES.filter((entry) => entryIndex(entry.id) <= TRACK_BRANCH_AFTER_INDEX))
const solarBranchStages = computed(() => solarTrackStages().filter((entry) => entryIndex(entry.id) > TRACK_BRANCH_AFTER_INDEX))
const massiveBranchStages = computed(() => massiveTrackStages())
const massiveCollapseStage = computed(() => massiveBranchStages.value.find((entry) => entry.id === 'supernova'))
const massiveRemnantStages = computed(() => massiveBranchStages.value.filter((entry) => entry.id !== 'supernova'))

const sharedPath = computed(() => commonStages.value.map((entry) => t(entry.nameKey)).join(' → '))
const solarBranchPath = computed(() => solarBranchStages.value.map((entry) => t(entry.nameKey)).join(' → '))
const massiveRemnantPath = computed(() => massiveRemnantStages.value.map((entry) => t(entry.nameKey)).join(' / '))

function entryIndex(id: StageDefinition['id']): number {
  return STAGES.findIndex((entry) => entry.id === id)
}

/** A node is on the highlighted route when it is shared, or belongs to the selected branch. */
function isOnCurrentPath(entry: StageDefinition): boolean {
  const current = stage.value
  if (entryIndex(entry.id) <= TRACK_BRANCH_AFTER_INDEX) return true
  if (current.track !== entry.track) return false
  return entryIndex(entry.id) <= index.value
}

function nodeClasses(entry: StageDefinition) {
  return [
    `se-cat-${entry.category}`,
    {
      'se-tree-node-active': entryIndex(entry.id) === index.value,
      'se-tree-node-path': isOnCurrentPath(entry),
      'se-tree-node-massive': entry.track === 'massive',
    },
  ]
}

const progressPercent = computed(() => `${Math.round(dwellProgress.value * 100)}%`)

// ------------------------------------------------------------------ interaction

function select(target: number): void {
  props.send({ type: 'stage', index: target })
}

function focusTimelineNode(target: number): void {
  const nodes = timelineElement.value?.querySelectorAll<HTMLElement>('[data-stage-node]')
  nodes?.[target]?.focus()
}

/**
 * Arrow keys walk the timeline, Home and End jump to its ends.
 *
 * The shell leaves the arrow keys alone for this demo - it only binds them when the shared speed
 * slider is on screen, and this demo turns that off - so the timeline is free to use them, which is
 * what a list of steps is expected to do.
 *
 * Space is deliberately *not* handled here: the shell binds it to play/pause for every demo, and
 * binding it again would toggle twice. Enter still activates whichever button has focus.
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return
  let next: number | null = null
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(STAGES.length - 1, index.value + 1)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, index.value - 1)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = STAGES.length - 1
  if (next === null || next === index.value) return
  event.preventDefault()
  select(next)
  // Keep the keyboard where the eye is: stepping with the arrows while the timeline has focus
  // should move the focus ring along with the selection.
  if (timelineElement.value?.contains(document.activeElement)) focusTimelineNode(next)
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="se-overlay">
    <!-- Navigation: where in the sequence we are, and how to move. -->
    <section class="se-panel se-nav" :aria-label="t(K.panelTitle)">
      <header class="se-head">
        <h2 class="se-title">{{ t(K.panelTitle) }}</h2>
        <button
          type="button"
          class="se-ghost se-collapse"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? t(K.panelExpand) : t(K.panelCollapse)"
          :title="collapsed ? t(K.panelExpand) : t(K.panelCollapse)"
          @click="toggleTimeline"
        >
          <ChevronUp v-if="collapsed" :size="16" aria-hidden="true" />
          <ChevronDown v-else :size="16" aria-hidden="true" />
        </button>
      </header>

      <div class="se-transport">
        <button
          type="button"
          class="se-ghost"
          :disabled="index === 0"
          :aria-label="t(K.panelPrevious)"
          :title="t(K.panelPrevious)"
          @click="send({ type: 'previous' })"
        >
          <SkipBack :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="se-primary"
          :aria-label="playing ? t(K.panelPause) : t(K.panelPlay)"
          :title="playing ? t(K.panelPause) : t(K.panelPlay)"
          :aria-pressed="playing"
          @click="send({ type: 'toggle-playing' })"
        >
          <Pause v-if="playing" :size="18" aria-hidden="true" />
          <Play v-else :size="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="se-ghost"
          :disabled="index >= STAGES.length - 1"
          :aria-label="t(K.panelNext)"
          :title="t(K.panelNext)"
          @click="send({ type: 'next' })"
        >
          <SkipForward :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="se-ghost"
          :aria-label="t(K.panelRestart)"
          :title="t(K.panelRestart)"
          @click="send({ type: 'restart' })"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </button>
        <p class="se-counter">{{ t(K.panelStageCounter, { index: index + 1, total: STAGES.length }) }}</p>
      </div>

      <div
        class="se-progress"
        role="progressbar"
        :aria-label="t(K.panelProgressAria)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(dwellProgress * 100)"
      >
        <span class="se-progress-fill" :style="{ width: progressPercent }" />
      </div>

      <!-- The order is still playable, but the geometry shows which stages are shared and which
           are reached only after a mass-dependent fork. -->
      <nav v-if="!collapsed" ref="timelineElement" class="se-timeline" :aria-label="t(K.panelTimelineAria)">
        <p class="se-path-note">{{ t('demos.items.stellarEvolution.panel.readingGuide') }}</p>
        <div class="se-tree" role="tree" :aria-label="t(K.panelTimelineAria)">
          <div class="se-tree-label">{{ t(K.panelSharedPath) }}</div>
          <div class="se-tree-main" role="group">
            <template v-for="(entry, branchIndex) in commonStages" :key="entry.id">
              <span v-if="branchIndex > 0" class="se-tree-link se-tree-link-vertical" aria-hidden="true" />
              <button
                type="button"
                class="se-tree-node"
                :class="nodeClasses(entry)"
                :data-stage-node="entryIndex(entry.id)"
                :aria-current="entryIndex(entry.id) === index ? 'step' : undefined"
                :aria-label="`${t(entry.nameKey)} · ${t(CATEGORY_KEYS[entry.category])}`"
                :title="`${t(entry.nameKey)} · ${t(CATEGORY_KEYS[entry.category])}`"
                role="treeitem"
                @click="select(entryIndex(entry.id))"
              >
                <span class="se-step-index" aria-hidden="true">{{ entryIndex(entry.id) + 1 }}</span>
                <span class="se-step-name">{{ t(entry.nameKey) }}</span>
              </button>
            </template>
          </div>

          <div class="se-tree-fork" aria-hidden="true">
            <span class="se-tree-fork-stem" />
            <span class="se-tree-fork-copy">{{ t(K.panelTrack) }}</span>
            <span class="se-tree-fork-stem" />
          </div>

          <div class="se-tree-branches" role="group">
            <section class="se-tree-branch se-tree-branch-solar" :aria-label="t(K.panelSolarBranch)">
              <h4 class="se-tree-branch-title">{{ t(K.panelSolarBranch) }}</h4>
              <div class="se-tree-branch-path" role="group">
                <template v-for="(entry, branchIndex) in solarBranchStages" :key="entry.id">
                  <span v-if="branchIndex > 0" class="se-tree-link se-tree-link-vertical" aria-hidden="true" />
                  <button
                    type="button"
                    class="se-tree-node"
                    :class="nodeClasses(entry)"
                    :data-stage-node="entryIndex(entry.id)"
                    :aria-current="entryIndex(entry.id) === index ? 'step' : undefined"
                    :aria-label="`${t(entry.nameKey)} · ${t(TRACK_KEYS[entry.track])}`"
                    :title="`${t(entry.nameKey)} · ${t(TRACK_KEYS[entry.track])}`"
                    role="treeitem"
                    @click="select(entryIndex(entry.id))"
                  >
                    <span class="se-step-index" aria-hidden="true">{{ entryIndex(entry.id) + 1 }}</span>
                    <span class="se-step-name">{{ t(entry.nameKey) }}</span>
                  </button>
                </template>
              </div>
            </section>

            <section class="se-tree-branch se-tree-branch-massive" :aria-label="t(K.panelMassiveBranch)">
              <h4 class="se-tree-branch-title">{{ t(K.panelMassiveBranch) }}</h4>
              <p class="se-path-note se-before-collapse">{{ t('demos.items.stellarEvolution.panel.beforeCollapse') }}</p>
              <div class="se-tree-branch-path" role="group">
                <button
                  v-if="massiveCollapseStage"
                  type="button"
                  class="se-tree-node"
                  :class="nodeClasses(massiveCollapseStage)"
                  :data-stage-node="entryIndex(massiveCollapseStage.id)"
                  :aria-current="entryIndex(massiveCollapseStage.id) === index ? 'step' : undefined"
                  :aria-label="`${t(massiveCollapseStage.nameKey)} · ${t(TRACK_KEYS[massiveCollapseStage.track])}`"
                  :title="`${t(massiveCollapseStage.nameKey)} · ${t(TRACK_KEYS[massiveCollapseStage.track])}`"
                  role="treeitem"
                  @click="select(entryIndex(massiveCollapseStage.id))"
                >
                  <span class="se-step-index" aria-hidden="true">{{ entryIndex(massiveCollapseStage.id) + 1 }}</span>
                  <span class="se-step-name">{{ t(massiveCollapseStage.nameKey) }}</span>
                </button>
                <div class="se-tree-subfork" role="group">
                  <span class="se-tree-subfork-stem" aria-hidden="true" />
                  <span class="se-tree-subfork-label">{{ t(K.panelRemnantFork) }}</span>
                  <div class="se-tree-subbranches">
                    <template v-for="entry in massiveRemnantStages" :key="entry.id">
                      <button
                        type="button"
                        class="se-tree-node"
                        :class="nodeClasses(entry)"
                        :data-stage-node="entryIndex(entry.id)"
                        :aria-current="entryIndex(entry.id) === index ? 'step' : undefined"
                        :aria-label="`${t(entry.nameKey)} · ${t(TRACK_KEYS[entry.track])}`"
                        :title="`${t(entry.nameKey)} · ${t(TRACK_KEYS[entry.track])}`"
                        role="treeitem"
                        @click="select(entryIndex(entry.id))"
                      >
                        <span class="se-step-index" aria-hidden="true">{{ entryIndex(entry.id) + 1 }}</span>
                        <span class="se-step-name">{{ t(entry.nameKey) }}</span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </nav>
    </section>

    <!-- Reading matter: everything about the stage on screen and about the Sun. -->
    <section class="se-panel se-info" :aria-label="t(K.panelFacts)">
      <button class="se-info-toggle" type="button" :aria-expanded="!infoCollapsed"
        :aria-label="`${t(K.panelFacts)} · ${infoCollapsed ? t(K.panelExpand) : t(K.panelCollapse)}`"
        @click="toggleInfo">
        <span>{{ t(stage.nameKey) }} · {{ t(K.panelFacts) }}</span>
        <ChevronDown v-if="infoCollapsed" :size="15" aria-hidden="true" />
        <ChevronUp v-else :size="15" aria-hidden="true" />
      </button>
      <div v-show="!infoCollapsed" class="se-info-body">
      <!-- The card follows the stage, so a screen reader hears the change. -->
      <article class="se-card" :class="`se-cat-${stage.category}`" aria-live="polite">
        <p class="se-card-kicker">
          <span class="se-chip se-chip-track">{{ t(TRACK_KEYS[stage.track]) }}</span>
          <span class="se-card-category">{{ t(CATEGORY_KEYS[stage.category]) }}</span>
          <span v-if="isSunStage" class="se-chip se-chip-sun">{{ t(K.panelSunCurrent) }}</span>
        </p>
        <h3 class="se-card-name">{{ t(stage.nameKey) }}</h3>
        <p class="se-card-tagline">{{ t(stage.taglineKey) }}</p>
        <p class="se-card-body">{{ t(stage.bodyKey) }}</p>

        <div class="se-appearance">
          <h4>{{ t(K.appearanceTitle) }}</h4>
          <RouterLink v-if="stage.id === 'supernova' || stage.id === 'neutron-star'" to="/demos/supernova-remnant">
            {{ t('demos.items.supernovaRemnant.explore') }} →
          </RouterLink>
          <p>{{ t(`demos.items.stellarEvolution.appearance.${stage.id}`) }}</p>
          <a :href="VISUAL_REFERENCES[stage.id].url" target="_blank" rel="noopener noreferrer">
            {{ t(K.appearanceSource) }} · {{ VISUAL_REFERENCES[stage.id].label }} ↗
          </a>
        </div>

        <h4 class="se-sub">{{ t(K.panelKeyFeatures) }}</h4>
        <ul class="se-features">
          <li v-for="key in stage.featureKeys" :key="key">{{ t(key) }}</li>
        </ul>

        <h4 class="se-sub">{{ t(K.panelFacts) }}</h4>
        <dl class="se-facts">
          <div v-for="fact in facts" :key="fact.label">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </div>
        </dl>

        <p class="se-sun-note">
          <strong class="se-sun-note-label">{{ t(K.panelSunNote) }}</strong>
          {{ t(stage.sunKey) }}
        </p>
      </article>

      <section class="se-block">
        <h3 class="se-block-title">{{ t(K.sunCardTitle) }}</h3>
        <dl class="se-sun-rows">
          <div v-for="row in sunRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="se-branch-map" :aria-label="t(K.panelForkTitle)">
        <div class="se-branch-heading">
          <h3 class="se-block-title">{{ t(K.panelForkTitle) }}</h3>
          <span class="se-branch-badge">{{ t(K.panelForkHint, { limit: MASS_LIMITS.coreCollapseSupernovaSolar }) }}</span>
        </div>
        <p class="se-branch-path se-branch-shared">{{ sharedPath }}</p>
        <div class="se-branch-split" aria-hidden="true"><span /><i /><span /></div>
        <div class="se-branch-grid">
          <button
            type="button"
            class="se-branch-card se-branch-solar"
            :class="{ 'se-branch-current': stage.track === 'solar' && index > TRACK_BRANCH_AFTER_INDEX }"
            @click="select(entryIndex(solarBranchStages[0]?.id ?? 'white-dwarf'))"
          >
            <strong>{{ t(K.panelSolarBranch) }}</strong>
            <span>{{ solarBranchPath }}</span>
          </button>
          <button
            type="button"
            class="se-branch-card se-branch-massive"
            :class="{ 'se-branch-current': stage.track === 'massive' }"
            @click="select(entryIndex(massiveBranchStages[0]?.id ?? 'supernova'))"
          >
            <strong>{{ t(K.panelMassiveBranch) }}</strong>
            <span>{{ t(massiveCollapseStage?.nameKey ?? 'demos.items.stellarEvolution.stages.supernova.name') }}</span>
            <small class="se-branch-subpath">
              <span class="se-branch-subpath-label">{{ t(K.panelRemnantFork) }}</span>
              {{ massiveRemnantPath }}
            </small>
          </button>
        </div>
        <p class="se-branch-current-note">{{ t(K.panelBranchCurrent, { track: t(TRACK_KEYS[stage.track]) }) }}</p>
      </section>

      <details class="se-details">
        <summary class="se-summary">{{ t(K.tracksTitle) }}</summary>
        <div class="se-track">
          <p class="se-track-head">
            <span class="se-chip se-chip-solar">{{ t(K.tracksSolar) }}</span>
            <span class="se-track-range">{{ t(K.tracksSolarRange, { limit: MASS_LIMITS.coreCollapseSupernovaSolar }) }}</span>
          </p>
          <p class="se-track-path">{{ solarPath }}</p>
          <p class="se-track-ending">{{ t(K.tracksSolarEnding) }}</p>
        </div>
        <div class="se-track">
          <p class="se-track-head">
            <span class="se-chip se-chip-massive">{{ t(K.tracksMassive) }}</span>
            <span class="se-track-range">{{ t(K.tracksMassiveRange, { limit: MASS_LIMITS.coreCollapseSupernovaSolar }) }}</span>
          </p>
          <p class="se-track-path">{{ massivePath }}</p>
          <p class="se-track-ending">{{ t(K.tracksMassiveEnding) }}</p>
        </div>
        <p class="se-track-warning">{{ t(K.tracksSunNeverSupernova, { limit: MASS_LIMITS.coreCollapseSupernovaSolar }) }}</p>
      </details>

      <p class="se-note">{{ t(K.panelScaleNote) }}</p>
      <p class="se-note se-note-quiet">{{ t(K.panelAutoplayNote) }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/**
 * The two panels are laid out by a wrapper that spans the safe area of the stage: below the shared
 * top bar, above the shared hint and the data credit, and clear of the edges. The wrapper itself
 * never takes pointer events, so a drag that starts on its empty middle still rotates the star.
 */
.se-overlay {
  /* Category hues follow the theme while retaining distinct evolutionary tracks. */
  --se-solar: color-mix(in srgb, var(--color-blue) 60%, var(--color-success));
  --se-birth: var(--color-lilac);
  --se-main: var(--color-gold);
  --se-late: color-mix(in srgb, var(--color-warning) 65%, var(--color-danger));
  --se-remnant: var(--color-blue);
  position: absolute;
  z-index: 5;
  top: var(--demo-panels-top, 100px);
  right: clamp(12px, 2vw, 22px);
  bottom: clamp(104px, 13.5vh, 128px);
  left: clamp(12px, 2vw, 22px);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  justify-content: space-between;
  pointer-events: none;
}

.se-panel {
  display: flex;
  flex-direction: column;
  gap: .55rem;
  max-height: 100%;
  min-height: 0;
  padding: .7rem .8rem .8rem;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 97%, transparent);
  box-shadow: 0 14px 38px var(--color-shadow);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.se-nav { width: min(340px, 29vw); }

.se-appearance {
  margin: .8rem 0;
  padding: .65rem .7rem;
  border-left: 2px solid var(--color-blue);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--color-blue) 8%, var(--color-surface));
}
.se-appearance h4 { margin: 0 0 .35rem; color: var(--color-text); font-size: .7rem; }
.se-appearance p { margin: 0; color: var(--color-text-muted); font-size: .67rem; line-height: 1.7; }
.se-appearance a { display: inline-block; margin-top: .45rem; color: var(--color-blue); font-size: .63rem; }
.se-appearance a:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }

.se-info {
  width: min(360px, 30vw);
  overflow: hidden;
}
.se-info-body {
  display: flex;
  flex-direction: column;
  gap: .65rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.se-info-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: .5rem;
  border: 0;
  padding: .2rem 0;
  color: var(--color-text);
  background: transparent;
  font-size: .72rem;
  cursor: pointer;
}
.se-info-toggle:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }

.se-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: .5rem;
}

.se-title {
  flex: 1;
  margin: 0;
  color: var(--color-text);
  font-size: .84rem;
  font-weight: 650;
  letter-spacing: .05em;
}

.se-collapse { width: 26px; height: 26px; }

/* ------------------------------------------------------------------ timeline */

.se-timeline {
  flex: 1 1 auto;
  min-height: 0;
  padding-right: .1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.se-path-note { margin: .2rem 0 .6rem; color: var(--color-text-muted); font-size: .66rem; line-height: 1.65; }
.se-before-collapse { padding: .4rem; border-left: 2px solid var(--se-late); background: color-mix(in srgb, var(--se-late) 7%, var(--color-surface)); }

.se-tree {
  display: grid;
  gap: .28rem;
  margin: 0;
  padding: .1rem .05rem .35rem;
}

.se-tree-label,
.se-tree-fork-copy,
.se-tree-subfork-label {
  color: var(--color-text-subtle);
  font-size: .58rem;
  letter-spacing: .08em;
  line-height: 1.35;
  text-align: center;
}

.se-tree-main,
.se-tree-branch-path {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.se-tree-link-vertical {
  width: 1px;
  height: .52rem;
  margin: 0 auto;
  background: color-mix(in srgb, var(--color-text-subtle) 54%, transparent);
}

.se-tree-fork {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: .42rem;
  margin: .05rem .8rem .12rem;
}

.se-tree-fork-stem {
  height: 1px;
  background: color-mix(in srgb, var(--color-text-subtle) 52%, transparent);
}

.se-tree-branches {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .48rem;
  padding-top: .65rem;
}

.se-tree-branches::before {
  position: absolute;
  top: .1rem;
  right: 25%;
  left: 25%;
  height: 1px;
  content: '';
  background: color-mix(in srgb, var(--color-text-subtle) 55%, transparent);
}

.se-tree-branch {
  position: relative;
  min-width: 0;
  padding-top: .22rem;
}

.se-tree-branch::before {
  position: absolute;
  top: -.55rem;
  left: 50%;
  width: 1px;
  height: .75rem;
  content: '';
  background: color-mix(in srgb, var(--color-text-subtle) 55%, transparent);
}

.se-tree-branch-title {
  min-height: 2.1em;
  margin: 0 0 .25rem;
  color: var(--se-solar);
  font-size: .61rem;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
}

.se-tree-branch-massive .se-tree-branch-title { color: var(--se-late); }

.se-tree-node {
  position: relative;
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr);
  gap: .34rem;
  align-items: center;
  width: 100%;
  min-height: 29px;
  padding: .18rem .28rem;
  border: 1px solid var(--color-border);
  border-left: 2px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-muted);
  text-align: left;
  background: var(--color-bg);
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease;
}

.se-tree-node:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
  transform: translateY(-1px);
}

.se-tree-node:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 1px; }

.se-tree-node-path {
  color: var(--color-text);
  background: color-mix(in srgb, var(--se-solar) 6%, var(--color-surface));
}

.se-tree-node-active {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--se-solar) 72%, transparent);
  border-left-color: var(--se-solar);
  background: color-mix(in srgb, var(--se-solar) 15%, var(--color-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-solar) 18%, transparent), 0 0 14px color-mix(in srgb, var(--se-solar) 12%, transparent);
}

.se-tree-node-massive.se-tree-node-path { border-left-color: var(--se-late); }
.se-tree-node-massive.se-tree-node-active {
  border-color: color-mix(in srgb, var(--se-late) 72%, transparent);
  border-left-color: var(--se-late);
  background: color-mix(in srgb, var(--se-late) 12%, var(--color-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-late) 18%, transparent), 0 0 14px color-mix(in srgb, var(--se-late) 12%, transparent);
}

.se-tree-node .se-step-index {
  width: 1.18rem;
  height: 1.18rem;
  font-size: .6rem;
}

.se-tree-node-active .se-step-index {
  color: var(--color-on-accent);
  border-color: var(--se-solar);
  background: var(--se-solar);
}

.se-tree-node-massive.se-tree-node-active .se-step-index {
  border-color: var(--se-late);
  background: var(--se-late);
}

.se-tree-subfork {
  position: relative;
  display: grid;
  gap: .25rem;
  margin-top: .38rem;
  padding-top: .45rem;
}

.se-tree-subfork-stem {
  position: absolute;
  top: 0;
  left: 50%;
  width: 1px;
  height: .45rem;
  background: color-mix(in srgb, var(--se-late) 55%, transparent);
}

.se-tree-subfork-label { color: var(--se-late); font-size: .54rem; }

.se-tree-subbranches {
  margin-left: .25rem;
  padding-left: .35rem;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: .35rem;
  padding-top: .45rem;
}

.se-tree-subbranches::before {
  position: absolute;
  top: .12rem;
  bottom: 0;
  left: 0;
  width: 1px;
  content: '';
  background: color-mix(in srgb, var(--se-late) 48%, transparent);
}

.se-tree-subbranches .se-tree-node::before {
  position: absolute;
  top: 50%;
  left: -.35rem;
  width: .35rem;
  height: 1px;
  content: '';
  background: color-mix(in srgb, var(--se-late) 48%, transparent);
}

.se-steps {
  display: grid;
  gap: .12rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.se-step {
  display: grid;
  grid-template-columns: 1.3rem 1fr;
  gap: .42rem;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: .16rem .36rem;
  border: 1px solid transparent;
  border-left: 2px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-muted);
  text-align: left;
  background: transparent;
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, color .16s ease;
}

.se-step:hover { color: var(--color-text); background: var(--color-surface-raised); }

.se-step:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 1px; }

.se-step-active {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--se-solar) 55%, transparent);
  border-left-color: var(--se-solar);
  background: color-mix(in srgb, var(--se-solar) 15%, var(--color-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-solar) 18%, transparent);
}

.se-step-index {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  font-size: .64rem;
  font-variant-numeric: tabular-nums;
}

.se-step-active .se-step-index {
  color: var(--color-on-accent);
  border-color: var(--se-solar);
  background: var(--se-solar);
}

.se-step-branch {
  position: relative;
  width: calc(100% - .62rem);
  margin-left: .62rem;
}

.se-step-branch::before {
  position: absolute;
  top: -0.16rem;
  bottom: -0.16rem;
  left: -.48rem;
  width: 1px;
  content: '';
  background: color-mix(in srgb, var(--color-text-subtle) 32%, transparent);
}

.se-step-massive::before { background: color-mix(in srgb, var(--se-late) 42%, transparent); }

.se-step-name {
  overflow-wrap: anywhere;
  font-size: .76rem;
  font-weight: 600;
  white-space: normal;
  line-height: 1.4;
}

/* The category is carried by the step's left edge, so the list reads as four phases at a glance.
   The track is in the button's tooltip; the card spells both out for the stage on screen. */
.se-cat-birth { border-left-color: var(--se-birth); }
.se-cat-main { border-left-color: var(--se-main); }
.se-cat-late { border-left-color: var(--se-late); }
.se-cat-remnant { border-left-color: var(--se-remnant); }

.se-tree-node.se-tree-node-active { border-left-color: var(--se-solar); }
.se-tree-node.se-tree-node-massive.se-tree-node-active { border-left-color: var(--se-late); }

/* The fork: where a star's mass starts to decide how its life ends. */
.se-fork {
  display: flex;
  align-items: center;
  gap: .4rem;
  margin: .3rem 0 .18rem;
  padding: 0 .36rem;
}

.se-fork-line { flex: 1; height: 1px; background: var(--color-border); }

.se-fork-label {
  color: var(--color-text-subtle);
  font-size: .58rem;
  letter-spacing: .1em;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ transport */

.se-transport {
  display: flex;
  flex: none;
  align-items: center;
  gap: .32rem;
}

.se-ghost,
.se-primary {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, color .16s ease;
}

.se-ghost:hover:not(:disabled) { color: var(--color-on-accent); background: var(--se-solar); border-color: var(--se-solar); }

.se-ghost:disabled { opacity: .35; cursor: default; }

.se-primary { color: var(--color-on-accent); border-color: var(--se-solar); background: var(--se-solar); }

.se-primary:hover { border-color: color-mix(in srgb, var(--se-solar) 88%, var(--color-text)); background: color-mix(in srgb, var(--se-solar) 88%, var(--color-text)); }

.se-ghost:focus-visible,
.se-primary:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }

.se-counter {
  margin: 0 0 0 auto;
  color: var(--color-text-subtle);
  font-size: .66rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.se-progress {
  flex: none;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--color-border);
}

.se-progress-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--se-solar), var(--se-solar));
  transition: width .12s linear;
}

/* ------------------------------------------------------------------ card */

.se-card {
  flex: none;
  padding: .7rem .75rem .75rem;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--se-solar);
  border-radius: 7px;
  background: var(--color-bg);
}

.se-card.se-cat-birth { border-left-color: var(--se-birth); }
.se-card.se-cat-main { border-left-color: var(--se-main); }
.se-card.se-cat-late { border-left-color: var(--se-late); }
.se-card.se-cat-remnant { border-left-color: var(--se-remnant); }

.se-card-kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .32rem;
  margin: 0 0 .3rem;
}

.se-card-category {
  color: var(--color-text-subtle);
  font-size: .6rem;
  letter-spacing: .1em;
}

.se-chip {
  display: inline-block;
  padding: .08rem .36rem;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: .56rem;
  letter-spacing: .05em;
  line-height: 1.5;
}

.se-chip-track { color: var(--se-birth); }
.se-chip-solar { color: var(--se-solar); }
.se-chip-massive { color: var(--se-late); }
.se-chip-sun { color: var(--se-main); background: color-mix(in srgb, var(--se-main) 10%, var(--color-surface)); }

.se-card-name { margin: 0; color: var(--color-text); font-size: 1.04rem; }

.se-card-tagline {
  margin: .16rem 0 .4rem;
  color: var(--se-solar);
  font-size: .72rem;
  line-height: 1.5;
}

.se-card-body { margin: 0; color: var(--color-text-muted); font-size: .74rem; line-height: 1.6; }

.se-sub {
  margin: .62rem 0 .28rem;
  color: var(--se-solar);
  font-size: .64rem;
  font-weight: 650;
  letter-spacing: .1em;
}

.se-features {
  display: grid;
  gap: .18rem;
  margin: 0;
  padding-left: .95rem;
  color: var(--color-text-muted);
  font-size: .7rem;
  line-height: 1.48;
}

.se-features li::marker { color: var(--se-solar); }

/* Two columns: four short figures stacked would cost more height than they are worth, and the
   card is the part of the panel that has to stay above the fold. */
.se-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .3rem .5rem;
  margin: 0;
}

.se-facts > div { display: grid; gap: .05rem; min-width: 0; }

.se-facts dt { color: var(--color-text-subtle); font-size: .62rem; }

.se-facts dd {
  margin: 0;
  color: var(--color-text);
  font-size: .72rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.se-sun-note {
  margin: .6rem 0 0;
  padding: .45rem .5rem;
  border-left: 2px solid color-mix(in srgb, var(--se-main) 55%, transparent);
  border-radius: 0 4px 4px 0;
  color: var(--color-text);
  font-size: .7rem;
  line-height: 1.56;
  background: color-mix(in srgb, var(--se-main) 10%, var(--color-surface));
}

.se-sun-note-label {
  display: block;
  margin-bottom: .16rem;
  color: var(--se-main);
  font-size: .62rem;
  font-weight: 650;
  letter-spacing: .08em;
}

/* ------------------------------------------------------------------ reference blocks */

.se-block,
.se-details {
  flex: none;
  padding: .5rem .55rem .55rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
}

.se-block-title {
  margin: 0 0 .4rem;
  color: var(--color-blue);
  font-size: .72rem;
  font-weight: 650;
  letter-spacing: .04em;
}

.se-summary {
  color: var(--color-blue);
  font-size: .72rem;
  font-weight: 600;
  letter-spacing: .04em;
  cursor: pointer;
}

.se-summary:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }

.se-details[open] .se-summary { margin-bottom: .45rem; }

.se-sun-rows,
.se-facts { margin: 0; }

.se-sun-rows { display: grid; gap: .2rem; }

.se-sun-rows > div {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  justify-content: space-between;
  padding-bottom: .16rem;
  border-bottom: 1px solid var(--color-border);
}

.se-sun-rows dt { flex: none; color: var(--color-text-subtle); font-size: .66rem; }

.se-sun-rows dd {
  margin: 0;
  color: var(--color-text);
  font-size: .7rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.se-track + .se-track { margin-top: .55rem; }

.se-track-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .35rem;
  margin: 0 0 .22rem;
}

.se-track-range { color: var(--color-text-subtle); font-size: .62rem; }

.se-track-path {
  margin: 0;
  color: var(--color-text);
  font-size: .68rem;
  line-height: 1.55;
}

.se-track-ending { margin: .16rem 0 0; color: var(--color-text-subtle); font-size: .66rem; line-height: 1.5; }

.se-track-warning {
  margin: .55rem 0 0;
  padding: .4rem .48rem;
  border-left: 2px solid var(--se-late);
  border-radius: 0 4px 4px 0;
  color: var(--se-late);
  font-size: .68rem;
  line-height: 1.55;
  background: color-mix(in srgb, var(--se-late) 12%, var(--color-surface));
}

.se-branch-map {
  flex: none;
  padding: .55rem .6rem .62rem;
  border: 1px solid color-mix(in srgb, var(--se-solar) 32%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--se-solar) 6%, var(--color-surface));
}

.se-branch-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .55rem;
}

.se-branch-heading .se-block-title { margin-bottom: .1rem; }

.se-branch-badge {
  color: var(--color-text-subtle);
  font-size: .58rem;
  line-height: 1.4;
  text-align: right;
}

.se-branch-path {
  margin: 0;
  color: var(--color-text);
  font-size: .68rem;
  line-height: 1.5;
}

.se-branch-shared {
  padding: .38rem .45rem;
  border: 1px solid color-mix(in srgb, var(--color-text-subtle) 45%, transparent);
  border-radius: 5px;
  background: var(--color-surface-raised);
}

.se-branch-split {
  display: grid;
  grid-template-columns: 1fr 10px 1fr;
  align-items: center;
  height: 14px;
  margin: 0 .7rem;
}

.se-branch-split span { height: 1px; background: color-mix(in srgb, var(--color-text-subtle) 60%, transparent); }

.se-branch-split i {
  display: block;
  width: 7px;
  height: 7px;
  border: 1px solid var(--se-solar);
  border-radius: 50%;
  background: var(--color-surface);
}

.se-branch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .45rem;
}

.se-branch-card {
  display: grid;
  gap: .2rem;
  min-width: 0;
  padding: .42rem .45rem;
  border: 1px solid color-mix(in srgb, var(--se-solar) 28%, transparent);
  border-radius: 5px;
  color: var(--color-text);
  text-align: left;
  background: var(--color-bg);
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, transform .16s ease;
}

.se-branch-card:hover { transform: translateY(-1px); background: var(--color-surface-raised); }
.se-branch-card:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
.se-branch-card strong { font-size: .66rem; }
.se-branch-card span { color: var(--color-text-subtle); font-size: .62rem; line-height: 1.45; }
.se-branch-subpath { color: var(--color-text-subtle); font-size: .6rem; line-height: 1.4; }
.se-branch-subpath-label { color: var(--se-late); }
.se-branch-solar { border-left: 2px solid var(--se-solar); }
.se-branch-massive { border-left: 2px solid var(--se-late); }
.se-branch-current { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-solar) 30%, transparent); background: color-mix(in srgb, var(--se-solar) 15%, var(--color-surface)); }
.se-branch-current.se-branch-massive { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-late) 34%, transparent); background: color-mix(in srgb, var(--se-late) 12%, var(--color-surface)); }

.se-branch-current-note { margin: .45rem 0 0; color: var(--se-solar); font-size: .62rem; }

@keyframes se-branch-current-pulse {
  from { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-solar) 25%, transparent), 0 0 0 color-mix(in srgb, var(--se-solar) 0%, transparent); }
  to { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-solar) 52%, transparent), 0 0 16px color-mix(in srgb, var(--se-solar) 12%, transparent); }
}

.se-branch-current { animation: se-branch-current-pulse 1.8s ease-in-out infinite alternate; }
.se-branch-current.se-branch-massive { animation-name: se-branch-current-pulse-massive; }

@keyframes se-branch-current-pulse-massive {
  from { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-late) 25%, transparent), 0 0 0 color-mix(in srgb, var(--se-late) 0%, transparent); }
  to { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--se-late) 55%, transparent), 0 0 16px color-mix(in srgb, var(--se-late) 14%, transparent); }
}

.se-note {
  flex: none;
  margin: 0;
  color: var(--color-text-subtle);
  font-size: .62rem;
  line-height: 1.5;
}

.se-note-quiet { color: var(--color-text-subtle); }

/* ------------------------------------------------------------------ narrow */

/**
 * One column at the bottom of the stage, reading order unchanged: controls, then content. The
 * timeline folds away by default so the card and the star both have room.
 *
 * The breakpoint is where the two panels would stop leaving a usable band of stage between them -
 * a narrower viewport would put the card and the timeline on top of the star and of each other's
 * captions. It matches `SCENE.labelSafeBand` in `config.ts`, which holds the captions clear of the
 * panels in the two-column layout.
 */
@media (max-width: 1180px) {
  .se-overlay {
    top: var(--demo-panels-top, 100px);
    bottom: 10px;
    flex-direction: column;
    justify-content: flex-end;
    max-height: min(64vh, calc(100% - var(--demo-panels-top, 100px) - 10px));
  }

  .se-nav,
  .se-info { width: 100%; box-sizing: border-box; }

  .se-nav { flex: 0 1 auto; min-height: 100px; }

  .se-info { flex: 0 1 auto; min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .se-panel,
  .se-step,
  .se-ghost,
  .se-primary,
  .se-progress-fill,
  .se-branch-current { transition: none; animation: none; }
}
</style>
