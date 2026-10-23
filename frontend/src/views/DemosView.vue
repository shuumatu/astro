<script setup lang="ts">
import { ArrowUpRight, MousePointer2, Orbit } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { demos } from '../features/demos/registry'

const { t } = useI18n({ useScope: 'global' })
const { t: copy } = useI18n({
  useScope: 'local',
  messages: {
    'zh-CN': {
      eyebrow: '在星空中，寻找答案',
      intro: '从月面的一道阴影，到恒星的一生。转动视角、改变条件，让宇宙的规律在眼前展开。',
      count: '{count} 个互动体验',
      mode: '三维探索',
      note: '选择一个感兴趣的主题，开始你的探索。每个演示都有独立的观察与操作指引。',
    },
    en: {
      eyebrow: 'Find answers among the stars',
      intro: 'From a shadow on the Moon to the lifetime of a star. Change your perspective, adjust the conditions, and see the universe unfold.',
      count: '{count} interactive experiences',
      mode: 'Explore in 3D',
      note: 'Choose a topic that sparks your curiosity. Each experience includes its own viewing and control guide.',
    },
  },
})

function accent(slug: string) {
  if (['solar-wind', 'eclipses', 'telescope-newtonian'].includes(slug)) return 'gold'
  if (['supernova-remnant', 'stellar-evolution', 'telescope-refractor'].includes(slug)) return 'lilac'
  return 'blue'
}
</script>

<template>
  <section class="demos-page">
    <header class="demos-header">
      <div class="demos-heading">
        <p class="demos-kicker"><span aria-hidden="true"></span>{{ copy('eyebrow') }}</p>
        <h1>{{ t('demos.title') }}<span aria-hidden="true">.</span></h1>
        <p class="demos-intro">{{ copy('intro') }}</p>
      </div>
      <p class="demos-count"><Orbit :size="17" aria-hidden="true" />{{ copy('count', { count: demos.length }) }}</p>
    </header>

    <ul class="demo-grid">
      <li v-for="(demo, index) in demos" :key="demo.slug">
        <RouterLink class="demo-card" :class="`accent-${accent(demo.slug)}`" :to="`/demos/${demo.slug}`">
          <div class="demo-cover" aria-hidden="true">
            <span class="demo-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <svg class="demo-illustration" viewBox="0 0 320 192" fill="none" focusable="false">
              <defs>
                <radialGradient :id="`demo-glow-${demo.slug}`">
                  <stop stop-color="currentColor" stop-opacity=".3" />
                  <stop offset="1" stop-color="currentColor" stop-opacity="0" />
                </radialGradient>
                <linearGradient :id="`demo-body-${demo.slug}`" x1="0" y1="0" x2="1" y2="1">
                  <stop stop-color="var(--color-text)" />
                  <stop offset=".45" stop-color="currentColor" />
                  <stop offset="1" stop-color="var(--color-surface)" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="96" r="102" :fill="`url(#demo-glow-${demo.slug})`" />
              <g class="cover-stars" fill="var(--color-text)">
                <circle cx="40" cy="58" r="1" /><circle cx="278" cy="42" r="1.3" />
                <circle cx="256" cy="155" r="1" /><circle cx="70" cy="151" r=".8" />
                <circle cx="202" cy="26" r=".8" /><circle cx="298" cy="106" r=".7" />
              </g>

              <g v-if="demo.slug === 'solar-wind'" stroke="currentColor">
                <circle cx="78" cy="96" r="37" stroke-opacity=".22" />
                <circle cx="78" cy="96" r="26" :fill="`url(#demo-body-${demo.slug})`" stroke="none" />
                <path d="M120 67C155 67 160 36 211 42M120 85C165 85 165 61 213 62M120 107C165 107 165 132 213 132M120 125C155 125 160 156 211 152" stroke-opacity=".65" stroke-linecap="round" />
                <path d="M271 46C172 37 169 155 271 148M281 65C206 57 205 135 281 129" stroke="var(--color-blue)" stroke-opacity=".65" />
                <circle cx="227" cy="97" r="15" fill="var(--color-blue)" fill-opacity=".22" stroke="var(--color-blue)" />
                <path d="M221 84L219 94 227 100 223 110M234 87L229 94 240 98" stroke="var(--color-blue)" stroke-opacity=".65" />
              </g>

              <g v-else-if="demo.slug === 'positional-astronomy'" stroke="currentColor">
                <circle cx="160" cy="96" r="61" stroke-opacity=".55" />
                <ellipse cx="160" cy="96" rx="61" ry="21" stroke-opacity=".6" transform="rotate(-20 160 96)" />
                <ellipse cx="160" cy="96" rx="26" ry="61" stroke-opacity=".35" transform="rotate(-20 160 96)" />
                <path d="M127 15L194 176M78 123L242 68" stroke-opacity=".35" stroke-dasharray="3 5" />
                <path d="M160 96L194 46" stroke="var(--color-gold)" />
                <circle cx="194" cy="46" r="4" fill="var(--color-gold)" stroke="none" />
                <circle cx="160" cy="96" r="5" fill="currentColor" stroke="none" />
              </g>

              <g v-else-if="demo.slug === 'supernova-remnant'" stroke="currentColor">
                <path d="M102 57L126 43 146 48 171 33 195 53 221 61 218 88 231 109 212 128 207 149 178 145 158 159 134 142 111 141 106 116 88 94Z" fill="currentColor" fill-opacity=".06" stroke-opacity=".4" />
                <path d="M120 68L135 57 154 66 177 52 192 70 207 81 198 101 207 118 186 129 168 124 153 141 138 124 118 122 124 101 107 89Z" fill="currentColor" fill-opacity=".12" stroke-opacity=".7" />
                <path d="M139 79L154 75 170 67 178 84 192 91 181 107 180 119 161 115 149 124 140 108 126 95Z" stroke="var(--color-gold)" stroke-opacity=".75" />
                <path d="M160 82V110M146 96H174" stroke="var(--color-text)" />
                <circle cx="160" cy="96" r="4" fill="var(--color-text)" stroke="none" />
              </g>

              <g v-else-if="demo.slug === 'meteor-shower'">
                <path d="M36 202C91 137 223 126 293 187" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-opacity=".5" />
                <g stroke="currentColor" stroke-linecap="round">
                  <path d="M90 41L142 88M168 27L218 72M188 88L225 121" stroke-opacity=".75" />
                  <path d="M59 84L92 114M237 36L257 55" stroke-opacity=".35" />
                </g>
                <g fill="var(--color-text)"><circle cx="142" cy="88" r="2" /><circle cx="218" cy="72" r="2.5" /><circle cx="225" cy="121" r="1.5" /></g>
              </g>

              <g v-else-if="demo.slug === 'moon'">
                <circle cx="160" cy="96" r="58" stroke="currentColor" stroke-opacity=".15" />
                <circle cx="160" cy="96" r="49" :fill="`url(#demo-body-${demo.slug})`" />
                <g fill="var(--color-surface)" fill-opacity=".25" stroke="var(--color-text)" stroke-opacity=".15">
                  <circle cx="143" cy="78" r="13" /><circle cx="177" cy="84" r="8" />
                  <circle cx="154" cy="113" r="17" /><circle cx="131" cy="105" r="6" />
                  <circle cx="181" cy="120" r="10" /><circle cx="163" cy="60" r="5" />
                </g>
                <path d="M181 51C153 61 153 131 181 141A49 49 0 0 0 181 51" fill="var(--color-bg)" fill-opacity=".5" />
              </g>

              <g v-else-if="demo.slug === 'eclipses'" stroke="currentColor">
                <circle cx="160" cy="96" r="58" stroke-opacity=".12" />
                <circle cx="160" cy="96" r="49" stroke-opacity=".3" stroke-width="6" />
                <circle cx="160" cy="96" r="44" stroke-width="2" fill="var(--color-bg)" />
                <path d="M160 29V36M160 156V163M93 96H100M220 96H227M113 49L118 54M202 138L207 143M113 143L118 138M202 54L207 49" stroke-opacity=".5" />
                <circle cx="191" cy="64" r="3" fill="var(--color-text)" stroke="none" />
              </g>

              <g v-else-if="demo.slug.startsWith('telescope-')" transform="rotate(-23 160 94)" stroke="currentColor">
                <path d="M90 64H230V119H90Z" fill="currentColor" fill-opacity=".07" stroke-opacity=".6" />
                <path d="M166 120L149 151M166 120L184 151M166 120V157" stroke-opacity=".4" />
                <ellipse cx="230" cy="91.5" rx="8" ry="27.5" fill="var(--color-blue)" fill-opacity=".16" />
                <g v-if="demo.slug === 'telescope-newtonian'">
                  <path d="M100 69Q89 91 100 114M225 77L100 77 174 95 174 50M225 106L100 106 174 95" stroke="var(--color-gold)" stroke-opacity=".75" />
                  <path d="M165 86L182 103M165 64V50H183V64" />
                </g>
                <g v-else>
                  <path d="M267 77H230L88 94M267 106H230L88 94" stroke="var(--color-gold)" stroke-opacity=".75" />
                  <path d="M90 82H72V105H90" stroke-opacity=".7" />
                </g>
              </g>

              <g v-else-if="demo.slug === 'stellar-evolution'">
                <path d="M73 96H247" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 5" />
                <circle cx="85" cy="96" r="12" fill="var(--color-blue)" />
                <circle cx="151" cy="96" r="24" fill="var(--color-gold)" />
                <circle cx="235" cy="96" r="38" :fill="`url(#demo-body-${demo.slug})`" />
                <circle cx="235" cy="96" r="47" stroke="currentColor" stroke-opacity=".25" />
              </g>

              <g v-else stroke="currentColor">
                <circle cx="160" cy="96" r="25" :fill="`url(#demo-body-${demo.slug})`" stroke="none" />
                <ellipse cx="160" cy="96" rx="75" ry="31" transform="rotate(-25 160 96)" stroke-opacity=".5" />
                <circle cx="222" cy="61" r="5" fill="var(--color-gold)" stroke="none" />
              </g>
            </svg>
            <span class="demo-mode"><Orbit :size="12" />{{ copy('mode') }}</span>
          </div>
          <div class="demo-card-content">
            <h2>{{ t(demo.titleKey) }}</h2>
            <p>{{ t(demo.summaryKey) }}</p>
            <span class="demo-card-action">{{ t('demos.open') }}<ArrowUpRight :size="18" aria-hidden="true" /></span>
          </div>
        </RouterLink>
      </li>
    </ul>

    <p class="demos-note"><MousePointer2 :size="15" aria-hidden="true" />{{ copy('note') }}</p>
  </section>
</template>

<style scoped>
.demos-page { padding: 4rem 0 4.5rem; }
.demos-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; }
.demos-heading { max-width: 650px; }
.demos-kicker { display: flex; align-items: center; gap: .7rem; margin: 0; color: var(--color-gold); font-size: .78rem; letter-spacing: .1em; }
.demos-kicker span { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 15px color-mix(in srgb, var(--color-gold) 40%, transparent); }
.demos-header h1 { margin: .8rem 0 1.1rem; color: var(--color-text); font-size: clamp(2rem, 4.5vw, 3.25rem); letter-spacing: -.045em; font-weight: 600; line-height: 1.15; }
.demos-header h1 > span { color: var(--color-gold); }
.demos-intro { margin: 0; color: var(--color-text-muted); font-size: .95rem; line-height: 1.9; }
.demos-count { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .6rem; margin: 0 0 .3rem; color: var(--color-text-muted); font-size: .8rem; }
.demos-count svg { color: var(--color-blue); }
.demo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin: 2.5rem 0 0; padding: 0; list-style: none; }
.demo-grid > li { min-width: 0; }
.demo-card { --card-accent: var(--color-blue); display: flex; flex-direction: column; height: 100%; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); color: var(--color-text); background: var(--color-surface); text-decoration: none; transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
.accent-gold { --card-accent: var(--color-gold); }
.accent-lilac { --card-accent: var(--color-lilac); }
.demo-cover { position: relative; overflow: hidden; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent); color: var(--card-accent); background: linear-gradient(145deg, color-mix(in srgb, var(--card-accent) 5%, var(--color-bg)), var(--color-bg)); }
.demo-number { position: absolute; top: 1rem; left: 1.15rem; color: var(--color-text-subtle); font: .68rem ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .08em; }
.demo-illustration { display: block; width: 100%; height: 190px; transition: transform .4s ease; }
.cover-stars { opacity: .5; }
.demo-mode { position: absolute; right: 1rem; bottom: .85rem; display: inline-flex; align-items: center; gap: .35rem; color: var(--color-text-muted); font-size: .65rem; letter-spacing: .04em; }
.demo-card-content { display: flex; flex: 1; flex-direction: column; padding: 1.4rem 1.4rem 1.15rem; }
.demo-card h2 { margin: 0; font-size: 1.06rem; font-weight: 600; line-height: 1.55; letter-spacing: -.015em; }
.demo-card p { margin: .7rem 0 1.5rem; color: var(--color-text-muted); font-size: .83rem; line-height: 1.85; }
.demo-card-action { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: auto; padding-top: .95rem; border-top: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent); color: var(--card-accent); font-size: .77rem; }
.demo-card-action svg { transition: transform .2s ease; }
.demo-card:focus-visible { outline: 2px solid var(--card-accent); outline-offset: 4px; }
.demos-note { display: flex; align-items: flex-start; justify-content: center; gap: .65rem; margin: 2rem 0 0; color: var(--color-text-subtle); font-size: .78rem; line-height: 1.8; }
.demos-note svg { flex: 0 0 auto; margin-top: .2rem; }
@media (hover: hover) {
  .demo-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--card-accent) 55%, var(--color-border)); box-shadow: 0 16px 36px var(--color-shadow); }
  .demo-card:hover .demo-illustration { transform: scale(1.04); }
  .demo-card:hover .demo-card-action svg { transform: translate(2px, -2px); }
}
@media (max-width: 960px) {
  .demo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .demos-header { align-items: flex-start; flex-direction: column; gap: 1.25rem; }
}
@media (max-width: 580px) {
  .demos-page { padding: 2.5rem 0 3rem; }
  .demos-intro { font-size: .88rem; }
  .demo-grid { grid-template-columns: minmax(0, 1fr); gap: 1.1rem; margin-top: 1.75rem; }
  .demo-illustration { height: 180px; }
  .demo-card-content { padding: 1.2rem; }
  .demos-note { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .demo-card, .demo-illustration, .demo-card-action svg { transition: none; }
  .demo-card:hover, .demo-card:hover .demo-illustration, .demo-card:hover .demo-card-action svg { transform: none; }
}
</style>
