// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import AstronomyReadout from './AstronomyReadout.vue'
import { CHAPTERS, INITIAL, type AstronomyState } from './model'
import zh from './zh.json'
import en from './en.json'

let app: App | undefined
afterEach(() => { app?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks() })
function mount(state: Partial<AstronomyState> = {}, locale = 'en') {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const props = reactive({ state: { ...INITIAL, ...state }, send: vi.fn() })
  app = createApp({ render: () => h(AstronomyReadout, props) })
  app.use(createI18n({ legacy: false, locale, messages: { en: { demos: { items: { positionalAstronomy: en } } }, zh: { demos: { items: { positionalAstronomy: zh } } } } }))
  app.mount(host)
  return { host, props }
}
function pointer(svg: SVGSVGElement, type: string, x: number, y: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType }, isPrimary: { value: true } })
  svg.dispatchEvent(event)
}
function chart(host: HTMLElement) {
  const svg = host.querySelector<SVGSVGElement>('svg')!
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 316, height: 147, right: 316, bottom: 147, x: 0, y: 0, toJSON: () => ({}) })
  return svg
}

describe('live astronomy readings', () => {
  it.each(['zh', 'en'])('renders localized readings for every chapter and perspective in %s', async locale => {
    const { host, props } = mount({}, locale)
    for (const chapter of CHAPTERS) for (const perspective of ['earth', 'observer'] as const) {
      props.state = { ...props.state, chapter, perspective }
      await nextTick()
      expect(host.textContent).not.toContain('demos.items.')
      expect(host.textContent).not.toContain('NaN')
      expect(host.querySelector('section')?.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('handles equatorial poles and undefined zenith azimuth explicitly', async () => {
    const { host, props } = mount({ latitude: 0 })
    expect(host.textContent).toContain('Both celestial poles on the horizon')
    props.state = { ...props.state, perspective: 'observer', latitude: 40, ra: 6, dec: 40, lst: 6 }
    await nextTick()
    expect(host.textContent).toContain('Azimuth undefined')
    expect(host.querySelectorAll('.metric strong')[1]?.textContent).toBe('—')
  })

  it('exposes native time input and pauses once while jumping to transits', async () => {
    const { host, props } = mount({ chapter: 'daily', playing: true })
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(range.min).toBe('0'); expect(range.max).toBe('24')
    range.value = '11.5'; range.dispatchEvent(new Event('input', { bubbles: true }))
    expect(props.send.mock.calls.map(([value]) => value)).toEqual([{ type: 'playing' }, { type: 'lst', value: 11.5 }])
    host.querySelectorAll<HTMLButtonElement>('.transit-controls button')[1]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'lst', value: 18 })
    expect(props.send.mock.calls.filter(([value]) => value.type === 'playing')).toHaveLength(1)
    props.state = { ...props.state, lst: 11.5, playing: false }
    await nextTick()
    expect(range.getAttribute('aria-valuetext')).toBe('11.50 hours')
    const windowKey = vi.fn()
    window.addEventListener('keydown', windowKey)
    try {
      const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      range.dispatchEvent(key)
      expect(windowKey).not.toHaveBeenCalled()
      expect(key.defaultPrevented).toBe(false)
    } finally { window.removeEventListener('keydown', windowKey) }
  })

  it('selects and clamps chart positions while preserving vertical touch scrolling', () => {
    const { host, props } = mount({ chapter: 'daily' })
    const svg = chart(host)
    pointer(svg, 'pointerdown', 166, 60)
    expect(props.send).toHaveBeenLastCalledWith({ type: 'lst', value: 12 })
    pointer(svg, 'pointermove', 400, 60)
    expect(props.send).toHaveBeenLastCalledWith({ type: 'lst', value: 24 })
    pointer(svg, 'pointerup', -20, 60)
    expect(props.send).toHaveBeenLastCalledWith({ type: 'lst', value: 0 })
    props.send.mockClear()
    pointer(svg, 'pointerdown', 166, 60, 'touch')
    pointer(svg, 'pointermove', 168, 95, 'touch')
    pointer(svg, 'pointerup', 168, 95, 'touch')
    expect(props.send).not.toHaveBeenCalled()
    pointer(svg, 'pointerdown', 166, 60, 'touch')
    pointer(svg, 'pointermove', 234, 62, 'touch')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'lst', value: 18 })
  })

  it('shows a completed precession cycle and lets the reader return to its midpoint', () => {
    const { host, props } = mount({ chapter: 'precession', years: 26000 })
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100')
    expect(host.textContent).toContain('26,000')
    host.querySelectorAll<HTMLButtonElement>('.cycle-stops button')[1]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'years', value: 13000 })
  })
})
