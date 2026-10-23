<script setup lang="ts">
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Compass, Orbit, ScanLine, Sparkles } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import AlbireoArtwork from '../components/AlbireoArtwork.vue'

const { t } = useI18n()
const pathways = [
  { key: 'catalog', to: '/catalog', icon: BookOpen, number: '01', color: 'gold' },
  { key: 'demos', to: '/demos', icon: Orbit, number: '02', color: 'blue' },
  { key: 'skyMap', to: '/sky-map', icon: ScanLine, number: '03', color: 'lilac' },
  { key: 'explore', to: '/explore', icon: Compass, number: '04', color: 'silver' }
]
</script>

<template>
  <div class="home-page">
    <section class="home-hero" aria-labelledby="home-heading">
      <div class="hero-content">
        <p class="eyebrow"><span class="eyebrow-line" aria-hidden="true"></span>{{ t('home.eyebrow') }}</p>
        <h1 id="home-heading">{{ t('theme.titleFirst') }}<br><span>{{ t('theme.titleSecond') }}</span></h1>
        <p class="hero-copy">{{ t('theme.description') }}</p>
        <div class="hero-actions">
          <RouterLink class="button primary" to="/demos">{{ t('home.start') }}<ArrowUpRight :size="18" aria-hidden="true" /></RouterLink>
          <RouterLink class="button secondary" to="/sky-map"><ScanLine :size="17" aria-hidden="true" />{{ t('theme.openSky') }}</RouterLink>
        </div>
        <a class="hero-scroll" href="#discovery"><span><ArrowDown :size="13" aria-hidden="true" /></span>{{ t('theme.scroll') }}</a>
      </div>
      <figure class="hero-observation">
        <div class="observation-topline"><span class="observation-dot" aria-hidden="true"></span>{{ t('theme.observation') }}<span>01 / CYGNUS</span></div>
        <AlbireoArtwork />
        <figcaption class="observation-caption">
          <div><span class="observation-name">{{ t('theme.albireo') }}</span><span class="observation-latin">Albireo</span></div>
          <p><span class="star-key gold" aria-hidden="true"></span>{{ t('theme.gold') }}<span class="star-key blue" aria-hidden="true"></span>{{ t('theme.blue') }}<span class="observation-separator">/</span>{{ t('theme.doubleStar') }}</p>
        </figcaption>
        <span class="observation-note">{{ t('theme.illustration') }}</span>
      </figure>
    </section>

    <section id="discovery" class="discovery-section" aria-labelledby="discovery-heading">
      <header class="section-heading">
        <div><p class="eyebrow">{{ t('theme.discoveryKicker') }}</p><h2 id="discovery-heading">{{ t('theme.discoveryTitle') }}</h2></div>
        <p>{{ t('theme.discoveryNote') }}</p>
      </header>
      <div class="pathway-grid">
        <RouterLink v-for="pathway in pathways" :key="pathway.key" :to="pathway.to" class="pathway-card" :class="`pathway-${pathway.color}`">
          <div class="pathway-top"><component :is="pathway.icon" :size="25" :stroke-width="1.3" aria-hidden="true" /><span>{{ pathway.number }}</span></div>
          <h3>{{ t(`nav.${pathway.key}`) }}</h3>
          <p>{{ t(`theme.pathways.${pathway.key}`) }}</p>
          <span class="pathway-action">{{ t(`theme.actions.${pathway.key}`) }}<ArrowRight :size="16" aria-hidden="true" /></span>
        </RouterLink>
      </div>
    </section>

    <aside class="star-story" aria-labelledby="star-story-heading">
      <div class="story-emblem" aria-hidden="true"><Sparkles :size="28" :stroke-width="1" /></div>
      <div class="story-copy"><p class="eyebrow">{{ t('theme.storyKicker') }}</p><h2 id="star-story-heading">{{ t('theme.storyTitle') }}</h2><p>{{ t('theme.storyDescription') }}</p></div>
      <a class="story-link" href="https://science.nasa.gov/image-article/apod-2022-february-24-beautiful-albireo-ab/" target="_blank" rel="noopener noreferrer">{{ t('theme.storyLink') }}<ArrowUpRight :size="16" aria-hidden="true" /><span class="sr-only">{{ t('theme.newWindow') }}</span></a>
    </aside>
  </div>
</template>

<style scoped>
.home-page { padding-bottom: 64px; }
.home-hero { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 3%; min-height: min(730px, calc(100svh - 68px)); padding: 48px 0 58px; }
.hero-content { position: relative; z-index: 1; padding: 15px 0; }
.eyebrow { display: flex; align-items: center; gap: 12px; margin: 0 0 20px; color: var(--color-gold); font-size: 11px; font-weight: 500; letter-spacing: .18em; line-height: 1.7; text-transform: uppercase; }
.eyebrow-line { width: 28px; height: 1px; background: var(--color-gold); opacity: .7; }
.home-hero h1 { margin: 0; font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', Georgia, serif; font-size: clamp(42px, 4.7vw, 68px); font-weight: 500; letter-spacing: .025em; line-height: 1.35; }
.home-hero h1 span { color: var(--color-gold); }
.hero-copy { max-width: 410px; margin: 25px 0 0; color: var(--color-text-muted); font-size: 15px; line-height: 1.95; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.hero-scroll { display: inline-flex; align-items: center; gap: 10px; margin-top: 46px; color: var(--color-text-subtle); font-size: 11px; letter-spacing: .06em; }
.hero-scroll span { display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid var(--color-border); border-radius: 50%; }
.hero-scroll:hover { color: var(--color-gold); }
.hero-observation { position: relative; min-width: 0; margin: 0; }
.observation-topline { display: flex; align-items: center; gap: 8px; padding: 0 18px; color: var(--color-text-muted); font-size: 10px; letter-spacing: .12em; }
.observation-topline > span:last-child { margin-left: auto; color: var(--color-text-subtle); font-family: var(--font-mono); font-size: 9px; }
.observation-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--color-gold); box-shadow: 0 0 10px #e9c58245; }
.observation-caption { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin: -12px 18px 0; padding-top: 20px; border-top: 1px solid var(--color-border); }
.observation-name { color: var(--color-text); font-size: 15px; letter-spacing: .1em; }
.observation-latin { display: block; margin-top: 7px; color: var(--color-text-subtle); font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; }
.observation-caption p { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; color: var(--color-text-muted); font-size: 10px; }
.star-key { width: 5px; height: 5px; margin-left: 9px; border-radius: 50%; }
.star-key.gold { background: var(--color-gold); }.star-key.blue { background: var(--color-blue); }
.observation-separator { padding: 0 6px; color: var(--color-border); }
.observation-note { display: block; margin: 12px 18px 0; color: var(--color-text-subtle); font-size: 9px; text-align: right; }
.discovery-section { scroll-margin-top: 28px; padding: 35px 0 42px; border-top: 1px solid var(--color-border); }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 26px; }
.section-heading .eyebrow { margin-bottom: 10px; font-size: 10px; }
.section-heading h2 { margin: 0; font-size: 25px; font-weight: 500; letter-spacing: .03em; line-height: 1.4; }
.section-heading > p { margin: 0 0 3px; color: var(--color-text-subtle); font-size: 12px; }
.pathway-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.pathway-card { --pathway-accent: var(--color-gold); display: flex; flex-direction: column; min-width: 0; padding: 25px 23px 21px; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: linear-gradient(145deg, color-mix(in srgb, var(--color-surface-raised) 50%, var(--color-surface)), var(--color-surface)); transition: transform .2s ease, border-color .2s ease, background .2s ease; }
.pathway-blue { --pathway-accent: var(--color-blue); }.pathway-lilac { --pathway-accent: var(--color-lilac); }.pathway-silver { --pathway-accent: var(--color-text-muted); }
.pathway-card:hover { transform: translateY(-4px); border-color: var(--pathway-accent); background: var(--color-surface); }
.pathway-top { display: flex; align-items: center; justify-content: space-between; color: var(--pathway-accent); }
.pathway-top span { color: var(--color-text-subtle); font-family: var(--font-mono); font-size: 10px; }
.pathway-card h3 { margin: 27px 0 10px; font-size: 17px; font-weight: 550; }
.pathway-card > p { flex: 1; margin: 0 0 26px; color: var(--color-text-muted); font-size: 12px; line-height: 1.9; }
.pathway-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--color-border); color: var(--pathway-accent); font-size: 11px; }
.star-story { display: flex; align-items: center; gap: 25px; padding: 28px 30px; border: 1px solid color-mix(in srgb, var(--color-gold) 22%, var(--color-border)); border-radius: var(--radius-card); background: linear-gradient(110deg, color-mix(in srgb, var(--color-gold) 4%, var(--color-bg)), color-mix(in srgb, var(--color-blue) 3%, var(--color-bg))); }
.story-emblem { display: grid; flex: none; place-items: center; width: 65px; height: 65px; color: var(--color-gold); border: 1px solid color-mix(in srgb, var(--color-gold) 25%, transparent); border-radius: 50%; }
.story-copy { flex: 1; }.story-copy .eyebrow { margin: 0 0 8px; font-size: 9px; }
.story-copy h2 { margin: 0 0 8px; font-size: 17px; font-weight: 500; }.story-copy > p:last-child { max-width: 650px; margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.8; }
.story-link { display: inline-flex; align-items: center; flex: none; gap: 8px; color: var(--color-gold); font-size: 11px; }.story-link:hover { text-decoration: underline; text-underline-offset: 4px; }
@media (min-width: 1500px) { .home-hero { gap: 8%; } }
@media (max-width: 1000px) { .pathway-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.home-hero { gap: 0; }.home-hero h1 { font-size: 44px; }.hero-copy { font-size: 14px; }.observation-caption { align-items: start; flex-direction: column; }.observation-caption p { margin-left: -9px; }.star-story { flex-wrap: wrap; }.story-link { margin-left: 90px; } }
@media (max-width: 760px) { .home-hero { grid-template-columns: 1fr; gap: 28px; padding: 50px 0 36px; }.home-hero h1 { font-size: clamp(40px, 8vw, 58px); }.hero-content { padding: 0; }.hero-copy { max-width: 470px; }.hero-scroll { margin-top: 26px; }.hero-observation { width: min(100%, 500px); justify-self: center; }.observation-caption { flex-direction: row; }.section-heading { align-items: start; flex-direction: column; gap: 10px; }.section-heading h2 { font-size: 23px; }.home-page { padding-bottom: 36px; } }
@media (max-width: 420px) { .pathway-grid { gap: 10px; }.pathway-card { padding: 20px 15px 16px; }.pathway-card h3 { font-size: 16px; }.pathway-card > p { font-size: 11px; }.star-story { padding: 23px 20px; gap: 16px; }.story-emblem { display: none; }.story-link { margin-left: 0; }.story-copy { flex-basis: 100%; }.observation-caption { margin-inline: 8px; }.observation-caption p { font-size: 9px; }.hero-actions .button { padding-inline: 17px; } }
@media (prefers-reduced-motion: reduce) { .pathway-card { transition: none; }.pathway-card:hover { transform: none; } }
</style>
