<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, List } from 'lucide-vue-next'
import type { DemoFeatureDefinition } from '../registry'

/**
 * Lists everything a demo can fly to. Features on the far side are invisible on the globe, so
 * this panel is the only reliable way to reach them, and it doubles as a table of contents.
 */
const props = defineProps<{
  titleKey: string
  items: DemoFeatureDefinition[]
  selected: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()

const { t } = useI18n()
const open = ref(true)

const groups = computed(() => {
  const byCategory = new Map<string, DemoFeatureDefinition[]>()
  for (const item of props.items) {
    const list = byCategory.get(item.categoryKey)
    if (list) list.push(item)
    else byCategory.set(item.categoryKey, [item])
  }
  return [...byCategory.entries()].map(([categoryKey, entries]) => ({ categoryKey, entries }))
})
</script>

<template>
  <div class="feature-panel" :class="{ open }">
    <button
      v-if="!open"
      type="button"
      class="panel-tab"
      :title="t(titleKey)"
      :aria-label="t(titleKey)"
      @click="open = true"
    >
      <List :size="16" aria-hidden="true" />
    </button>

    <template v-else>
      <header class="panel-head">
        <h2>{{ t(titleKey) }}</h2>
        <button type="button" class="panel-collapse" :aria-label="t(titleKey)" @click="open = false">
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </header>
      <div class="panel-body">
        <section v-for="group in groups" :key="group.categoryKey" class="panel-group">
          <p class="panel-category">{{ t(group.categoryKey) }}</p>
          <ul>
            <li v-for="item in group.entries" :key="item.id">
              <button
                type="button"
                class="panel-item"
                :class="{ selected: item.id === selected }"
                @click="emit('select', item.id)"
              >
                <ChevronLeft class="panel-bullet" :size="12" aria-hidden="true" />
                <span>{{ t(item.titleKey) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.feature-panel {
  position: absolute;
  z-index: 5;
  top: var(--demo-panels-top, 100px);
  right: clamp(10px, 2vw, 22px);
  width: min(230px, 46vw);
  max-height: min(62vh, 520px, calc(100% - var(--demo-panels-top, 100px) - 90px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  backdrop-filter: blur(6px);
  overflow: hidden;
}

.feature-panel:not(.open) {
  width: auto;
  border: none;
  background: none;
  backdrop-filter: none;
}

.panel-tab {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  cursor: pointer;
}

.panel-tab:hover { color: var(--color-on-accent); background: var(--color-blue); border-color: var(--color-blue); }

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .5rem .5rem .5rem .75rem;
  border-bottom: 1px solid var(--color-border);
}

.panel-head h2 {
  margin: 0;
  color: var(--color-text);
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .04em;
}

.panel-collapse {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}

.panel-collapse:hover { color: var(--color-text); background: var(--color-surface-raised); }

.panel-body {
  padding: .4rem .35rem .55rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.panel-group + .panel-group { margin-top: .45rem; }

.panel-category {
  margin: .25rem .5rem .2rem;
  color: var(--color-text-subtle);
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.panel-group ul { margin: 0; padding: 0; list-style: none; }

.panel-item {
  display: flex;
  align-items: center;
  gap: .3rem;
  width: 100%;
  padding: .32rem .45rem;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: .82rem;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.panel-item:hover { background: var(--color-surface-raised); color: var(--color-text); }
.panel-item.selected { background: color-mix(in srgb, var(--color-blue) 14%, var(--color-surface)); color: var(--color-blue); }

.panel-bullet { opacity: .45; flex: none; }
.panel-item.selected .panel-bullet { opacity: 1; }

@media (max-width: 720px) {
  .feature-panel { top: auto; bottom: 84px; max-height: min(42vh, calc(100% - var(--demo-panels-top, 100px) - 96px)); }
}
</style>
