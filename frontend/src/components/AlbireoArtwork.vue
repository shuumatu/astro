<script setup lang="ts">
// Fixed positions keep this decorative field stable across renders and locales.
const stars = Array.from({ length: 100 }, (_, index) => ({
  x: (index * 137.508 + 23) % 600,
  y: (index * index * 17.37 + 41) % 540,
  radius: index % 13 === 0 ? 1.5 : .55 + (index % 4) * .18,
  opacity: .2 + (index % 6) * .1
}))
</script>

<template>
  <svg class="albireo-artwork" viewBox="0 0 600 540" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="albireo-nebula">
        <stop stop-color="#6371a9" stop-opacity=".16" />
        <stop offset="1" stop-color="#6371a9" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="albireo-amber-glow">
        <stop stop-color="#fff4da" />
        <stop offset=".045" stop-color="#f5d49a" stop-opacity=".95" />
        <stop offset=".14" stop-color="#e6b769" stop-opacity=".32" />
        <stop offset=".45" stop-color="#dbac69" stop-opacity=".08" />
        <stop offset="1" stop-color="#dbac69" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="albireo-blue-glow">
        <stop stop-color="#f0f7ff" />
        <stop offset=".05" stop-color="#acdaff" stop-opacity=".95" />
        <stop offset=".15" stop-color="#7aaff8" stop-opacity=".32" />
        <stop offset=".5" stop-color="#7aaff8" stop-opacity=".08" />
        <stop offset="1" stop-color="#7aaff8" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="albireo-connection" x1="249" y1="247" x2="375" y2="309" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e9c582" stop-opacity=".5" />
        <stop offset="1" stop-color="#8abcf4" stop-opacity=".5" />
      </linearGradient>
      <radialGradient id="albireo-gold-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="115">
        <stop stop-color="#fffdf4" />
        <stop offset=".06" stop-color="#fff1cf" stop-opacity=".95" />
        <stop offset=".18" stop-color="var(--star-gold-ray)" stop-opacity=".7" />
        <stop offset=".38" stop-color="var(--star-gold-ray)" stop-opacity=".32" />
        <stop offset=".68" stop-color="var(--star-gold-ray)" stop-opacity=".1" />
        <stop offset="1" stop-color="var(--star-gold-ray)" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="albireo-blue-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="115">
        <stop stop-color="#ffffff" />
        <stop offset=".06" stop-color="#e5f3ff" stop-opacity=".95" />
        <stop offset=".18" stop-color="var(--star-blue-ray)" stop-opacity=".7" />
        <stop offset=".38" stop-color="var(--star-blue-ray)" stop-opacity=".32" />
        <stop offset=".68" stop-color="var(--star-blue-ray)" stop-opacity=".1" />
        <stop offset="1" stop-color="var(--star-blue-ray)" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="albireo-ray-core" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="85">
        <stop stop-color="#ffffff" />
        <stop offset=".08" stop-color="#ffffff" stop-opacity=".85" />
        <stop offset=".3" stop-color="#ffffff" stop-opacity=".2" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <!-- CD-inspired dispersion: preserve wavelength order as the fringe drifts.
           This is an optical design reference, not a simulated telescope PSF. -->
      <radialGradient id="albireo-spectrum" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="115">
        <stop stop-color="var(--spectral-blue)" stop-opacity="0" />
        <stop offset=".12" stop-color="var(--spectral-blue)" stop-opacity="0" />
        <stop offset=".22" stop-color="var(--spectral-blue)" stop-opacity=".48" />
        <stop offset=".32" stop-color="var(--spectral-cyan)" stop-opacity=".85" />
        <stop offset=".43" stop-color="var(--spectral-green)" stop-opacity=".95" />
        <stop offset=".53" stop-color="var(--spectral-yellow)" stop-opacity=".9" />
        <stop offset=".63" stop-color="var(--spectral-amber)" stop-opacity=".78" />
        <stop offset=".74" stop-color="var(--spectral-red)" stop-opacity=".4" />
        <stop offset=".9" stop-color="var(--spectral-red)" stop-opacity=".08" />
        <stop offset="1" stop-color="var(--spectral-red)" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="albireo-round-core">
        <stop stop-color="#ffffff" />
        <stop offset=".55" stop-color="#ffffff" stop-opacity=".98" />
        <stop offset=".78" stop-color="#ffffff" stop-opacity=".7" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <!-- Photographic diffraction: hairline streaks around a round, softly saturated core. -->
      <path id="albireo-diffraction" d="M-98 0H98M0-115V115" />
      <path id="albireo-corona" d="M-22-12 23 12M-14 25 15-27M-27 7 24-6" />
      <filter id="albireo-ray-bloom" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
    </defs>
    <ellipse cx="332" cy="272" rx="298" ry="225" fill="url(#albireo-nebula)" transform="rotate(-32 332 272)" />
    <g fill="var(--color-text-subtle)">
      <circle v-for="(star, index) in stars" :key="index" :cx="star.x" :cy="star.y" :r="star.radius" :opacity="star.opacity" />
    </g>
    <!-- An eyepiece reticle, not an assertion about the stars' physical orbits. -->
    <g stroke="var(--color-blue)" stroke-width=".7">
      <circle cx="300" cy="270" r="210" opacity=".17" />
      <circle cx="300" cy="270" r="185" opacity=".08" stroke-dasharray="2 7" />
      <path d="M300 51v18m0 402v18M81 270h18m402 0h18" opacity=".45" />
      <path d="M151 121l8 8m282 282 8 8M151 419l8-8m282-282 8-8" opacity=".28" />
    </g>
    <path d="m249 247 126 62" stroke="url(#albireo-connection)" stroke-dasharray="3 5" />
    <circle class="star-halo" cx="249" cy="247" r="115" fill="url(#albireo-amber-glow)" />
    <circle class="star-halo star-halo-blue" cx="375" cy="309" r="86" fill="url(#albireo-blue-glow)" />
    <g transform="translate(249 247) rotate(-3)">
      <g class="star-diffraction">
        <use href="#albireo-diffraction" stroke="url(#albireo-gold-rays)" stroke-width="3" filter="url(#albireo-ray-bloom)" opacity=".3" />
        <use href="#albireo-diffraction" stroke="url(#albireo-gold-rays)" stroke-width="1.15" />
        <g class="spectral-rays" stroke="url(#albireo-spectrum)">
          <use href="#albireo-diffraction" stroke-width="3.6" filter="url(#albireo-ray-bloom)" opacity=".32" />
          <use href="#albireo-diffraction" stroke-width="1.8" />
        </g>
        <use href="#albireo-diffraction" stroke="url(#albireo-ray-core)" stroke-width=".45" />
        <use href="#albireo-corona" stroke="url(#albireo-gold-rays)" stroke-width=".65" opacity=".12" />
      </g>
      <circle r="6.2" fill="url(#albireo-round-core)" />
    </g>
    <g transform="translate(375 309) rotate(-3) scale(.68)">
      <g class="star-diffraction">
        <use href="#albireo-diffraction" stroke="url(#albireo-blue-rays)" stroke-width="3" filter="url(#albireo-ray-bloom)" opacity=".3" />
        <use href="#albireo-diffraction" stroke="url(#albireo-blue-rays)" stroke-width="1.15" />
        <g class="spectral-rays spectral-rays-blue" stroke="url(#albireo-spectrum)">
          <use href="#albireo-diffraction" stroke-width="3.6" filter="url(#albireo-ray-bloom)" opacity=".32" />
          <use href="#albireo-diffraction" stroke-width="1.8" />
        </g>
        <use href="#albireo-diffraction" stroke="url(#albireo-ray-core)" stroke-width=".45" />
        <use href="#albireo-corona" stroke="url(#albireo-blue-rays)" stroke-width=".65" opacity=".1" />
      </g>
      <circle r="6.2" fill="url(#albireo-round-core)" />
    </g>
    <g font-family="ui-monospace, monospace" font-size="10" letter-spacing="1.7">
      <path d="m234 228-27-35h-55" stroke="var(--color-gold)" stroke-opacity=".4" stroke-width=".7" />
      <text x="152" y="181" fill="var(--color-gold)">ALBIREO A</text>
      <path d="m388 323 25 29h54" stroke="var(--color-blue)" stroke-opacity=".4" stroke-width=".7" />
      <text x="414" y="371" fill="var(--color-blue)">ALBIREO B</text>
      <text x="301" y="32" text-anchor="middle" fill="var(--color-text-subtle)" font-size="9">β CYGNI</text>
    </g>
  </svg>
</template>

<style scoped>
.albireo-artwork {
  --star-gold-ray: #f0c879;
  --star-blue-ray: #8ec6ff;
  --spectral-blue: #4d83ef;
  --spectral-cyan: #42d4e5;
  --spectral-green: #88dd68;
  --spectral-yellow: #f1e66d;
  --spectral-amber: #ffb34e;
  --spectral-red: #eb6c3e;
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
:root[data-theme='light'] .star-diffraction {
  display: none;
}
.spectral-rays {
  opacity: .4;
  transform: scale(.88);
  transform-box: fill-box;
  transform-origin: center;
}

/* Keep the faint, compact spectrum and slowly fade it in and out.
   The underlying photographic rays and star centers remain fixed. */
@media (prefers-reduced-motion: no-preference) {
  .spectral-rays { animation: spectrum-fade 18s ease-in-out -9s infinite; }
  .spectral-rays-blue { animation-duration: 22s; animation-delay: -5.5s; }
  .star-halo { animation: halo-breathe 18s ease-in-out infinite; }
  .star-halo-blue { animation-duration: 22s; animation-delay: -9s; }
}
@keyframes spectrum-fade {
  0%, 100% { opacity: 0; }
  50% { opacity: .4; }
}
@keyframes halo-breathe {
  0%, 100% { opacity: .68; }
  50% { opacity: 1; }
}
</style>
