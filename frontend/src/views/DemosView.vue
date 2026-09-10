<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { demos } from '../features/demos/registry'

const { t } = useI18n()
</script>

<template>
  <section class="demos-page">
    <header class="demos-header">
      <p class="demos-kicker">{{ t('demos.kicker') }}</p>
      <h1>{{ t('demos.title') }}</h1>
      <p class="demos-intro">{{ t('demos.intro') }}</p>
    </header>

    <ul class="demo-grid">
      <li v-for="demo in demos" :key="demo.slug">
        <RouterLink class="demo-card" :to="`/demos/${demo.slug}`">
          <h2>{{ t(demo.titleKey) }}</h2>
          <p>{{ t(demo.summaryKey) }}</p>
          <span class="demo-card-action">{{ t('demos.open') }}</span>
        </RouterLink>
      </li>
    </ul>

    <p class="demos-note">{{ t('placeholder.demos') }}</p>
  </section>
</template>

<style scoped>
.demos-page { padding: 3rem 0 4rem; }
.demos-header { max-width: 720px; }
.demos-kicker {
  margin: 0;
  color: #72d4d8;
  font-size: .85rem;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.demos-header h1 { margin: .35rem 0 .8rem; font-size: 2.8rem; }
.demos-intro { margin: 0; color: #aabbd0; line-height: 1.7; }

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin: 2rem 0 0;
  padding: 0;
  list-style: none;
}

.demo-card {
  display: grid;
  gap: .6rem;
  height: 100%;
  padding: 1.25rem;
  border: 1px solid #1c2d43;
  border-radius: 6px;
  background: #0a1728;
  transition: border-color .15s, transform .15s;
}

.demo-card:hover { border-color: #72d4d8; transform: translateY(-2px); }
.demo-card h2 { margin: 0; font-size: 1.2rem; }
.demo-card p { margin: 0; color: #aabbd0; font-size: .92rem; line-height: 1.6; }
.demo-card-action { color: #72d4d8; font-size: .86rem; }
.demos-note { margin: 2rem 0 0; color: #7d90a8; font-size: .86rem; }

@media (max-width: 680px) {
  .demos-header h1 { font-size: 2.1rem; }
}
</style>
