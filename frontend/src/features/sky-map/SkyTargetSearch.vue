<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkySearchSuggestion, SolarSystemBodyId } from './types'
import { SOLAR_SYSTEM_BODY_IDS } from './types'
import { normalizeSkyTargetSearchTerm } from './targetSearch'
import { SkyMapWorkerClient } from './workerClient'

const props = withDefaults(defineProps<{
  modelValue: string
  cultureId: string
  interfaceLanguage: string
  placeholder: string
  inputAriaLabel: string
  disabled?: boolean
  limit?: number
}>(), { disabled: false, limit: 8 })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [suggestion: SkySearchSuggestion]
  empty: []
  error: [error: unknown]
}>()

const { t } = useI18n({ useScope: 'global' })
const suggestions = ref<SkySearchSuggestion[]>([])
const open = ref(false)
const pending = ref(false)
const activeIndex = ref(-1)
let client: SkyMapWorkerClient | null = null
let initializationPromise: ReturnType<SkyMapWorkerClient['initialize']> | null = null
let timer: number | undefined
let sequence = 0

const activeId = computed(() => activeIndex.value >= 0 ? `sky-target-option-${activeIndex.value}` : undefined)

onMounted(() => { void ensureClient() })
onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
  client?.dispose()
})
watch(() => props.modelValue, scheduleSearch)
watch(() => [props.cultureId, props.interfaceLanguage], () => scheduleSearch())

function updateQuery(value: string): void {
  emit('update:modelValue', value)
}

function scheduleSearch(): void {
  if (timer) window.clearTimeout(timer)
  if (!normalizeSkyTargetSearchTerm(props.modelValue)) {
    suggestions.value = []
    open.value = false
    return
  }
  timer = window.setTimeout(() => void runSearch(), 80)
}

async function runSearch(selectExact = false): Promise<void> {
  const query = props.modelValue
  if (!normalizeSkyTargetSearchTerm(query)) {
    emit('empty')
    return
  }
  const requestSequence = ++sequence
  pending.value = true
  try {
    const worker = await ensureClient()
    const result = await worker.search({
      query,
      cultureId: props.cultureId,
      interfaceLanguage: props.interfaceLanguage,
      limit: props.limit,
      solarSystemBodies: SOLAR_SYSTEM_BODY_IDS.map((id) => ({ id, names: bodySearchNames(id) })),
    })
    if (requestSequence !== sequence) return
    suggestions.value = result.suggestions
    activeIndex.value = -1
    const exact = result.suggestions.filter((item) => item.matchType === 'exact')
    if (selectExact && exact.length > 0) choose(exact[0])
    else if (selectExact && result.suggestions.length === 0) emit('empty')
    else open.value = result.suggestions.length > 0
  } catch (error) {
    if (requestSequence === sequence) emit('error', error)
  } finally {
    if (requestSequence === sequence) pending.value = false
  }
}

async function ensureClient(): Promise<SkyMapWorkerClient> {
  if (!client) {
    client = new SkyMapWorkerClient()
    initializationPromise = client.initialize()
  }
  await initializationPromise
  return client
}

function bodySearchNames(id: SolarSystemBodyId): string[] {
  const names = [t(`skyMap.solarSystemBodies.${id}`), id]
  if (props.interfaceLanguage.toLowerCase().startsWith('zh') && id === 'moon') names.push('月', '月亮')
  return names
}

function choose(suggestion: SkySearchSuggestion): void {
  open.value = false
  activeIndex.value = -1
  emit('select', suggestion)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false
    activeIndex.value = -1
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (suggestions.value.length === 0) return
    event.preventDefault()
    open.value = true
    const direction = event.key === 'ArrowDown' ? 1 : -1
    activeIndex.value = (activeIndex.value + direction + suggestions.value.length) % suggestions.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const active = suggestions.value[activeIndex.value]
    if (open.value && active) choose(active)
    else void runSearch(true)
  }
}
</script>

<template>
  <div class="sky-target-search">
    <div class="search-row">
      <input
        :value="modelValue"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="sky-target-options"
        :aria-activedescendant="activeId"
        :aria-expanded="open"
        :aria-label="inputAriaLabel"
        :aria-busy="pending"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="updateQuery(($event.target as HTMLInputElement).value)"
        @focus="open = suggestions.length > 0"
        @blur="open = false"
        @keydown="handleKeydown"
      >
      <button type="button" :aria-label="inputAriaLabel" :title="inputAriaLabel" :disabled="disabled || pending" @mousedown.prevent @click="runSearch(true)">
        <Search :size="17" aria-hidden="true" />
      </button>
    </div>
    <ul v-if="open" id="sky-target-options" role="listbox">
      <li v-for="(suggestion, index) in suggestions" :id="`sky-target-option-${index}`" :key="suggestion.objectId" role="option" :aria-selected="index === activeIndex">
        <button type="button" :class="{ active: index === activeIndex }" @mousedown.prevent @click="choose(suggestion)">
          <span>{{ suggestion.term }}</span>
          <small>
            <template v-if="suggestion.targetType === 'star'">HIP {{ suggestion.hipId }} · </template>
            {{ t(`catalog.types.${suggestion.targetType === 'solarSystemBody' ? 'solar-system-body' : suggestion.targetType === 'cultureFigure' ? 'culture-figure' : 'star'}`) }}
          </small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sky-target-search { position: relative; min-width: 0; }
.search-row { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: 6px; }
input { width: 100%; min-width: 0; min-height: 36px; border: 1px solid #34444c; border-radius: 4px; padding: 0 9px; color: #e8efef; background: #090e12; }
.search-row > button { display: grid; width: 36px; min-height: 36px; place-items: center; border: 1px solid #3b5057; border-radius: 4px; color: #c6dddd; background: #10191d; cursor: pointer; }
ul { position: absolute; z-index: 30; top: calc(100% + 4px); right: 42px; left: 0; overflow: hidden; margin: 0; padding: 3px; border: 1px solid #3a4c54; border-radius: 4px; list-style: none; background: #0b1115; box-shadow: 0 10px 24px rgb(0 0 0 / 42%); }
li > button { display: grid; gap: 2px; width: 100%; border: 0; border-radius: 2px; padding: 7px 9px; color: #dce8e8; background: transparent; text-align: left; cursor: pointer; }
li > button:hover, li > button.active { background: #193039; }
small { color: #82999d; font-size: 11px; }
</style>
