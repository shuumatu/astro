<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  primaryName: string
  aliases?: string[]
  headingId?: string
}>(), { aliases: () => [], headingId: undefined })

const { t } = useI18n()
const visibleAliases = computed(() => props.aliases.slice(0, 6))
const aliasText = computed(() => props.aliases.join(' · '))
</script>

<template>
  <div class="object-name-block">
    <h2 :id="headingId">{{ primaryName }}</h2>
    <p v-if="visibleAliases.length" class="object-aliases" :title="aliasText">
      <span>{{ t('catalog.alsoKnownAs') }}</span>
      {{ visibleAliases.join(' · ') }}
    </p>
  </div>
</template>

<style scoped>
.object-name-block { min-width: 0; }
.object-name-block h2 { margin: 0; overflow-wrap: anywhere; color: var(--color-text); font-size: 20px; line-height: 1.2; }
.object-aliases { margin: 6px 0 0; overflow-wrap: anywhere; color: var(--color-text-muted); font-size: 11px; line-height: 1.45; }
.object-aliases span { color: var(--color-blue); }
</style>
