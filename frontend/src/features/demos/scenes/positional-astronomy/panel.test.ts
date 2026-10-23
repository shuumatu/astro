// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import Panel from './AstronomyPanel.vue'
import { CHAPTERS, INITIAL, type AstronomyState } from './model'
import en from './en.json'
import zh from './zh.json'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function mount(locale = 'en', state: Partial<AstronomyState> = { ...INITIAL }) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const props = reactive({ state, send: vi.fn() })
  const missing = vi.fn()
  app = createApp({ render: () => h(Panel, props) })
  app.use(createI18n({
    legacy: false,
    locale,
    missing,
    missingWarn: false,
    fallbackWarn: false,
    messages: {
      en: { demos: { items: { positionalAstronomy: en } } },
      zh: { demos: { items: { positionalAstronomy: zh } } },
    },
  }))
  app.mount(host)
  return { host, props, missing }
}

function button(host: Element, selector: string) {
  const result = host.querySelector<HTMLButtonElement>(selector)
  expect(result, selector).not.toBeNull()
  return result!
}

async function change(input: HTMLInputElement | HTMLSelectElement, value: string, event = 'change') {
  input.value = value
  input.dispatchEvent(new Event(event, { bubbles: true }))
  await nextTick()
}

describe('positional astronomy panel', () => {
  it.each(['en', 'zh'])('renders every lesson, perspective, step and answer in %s without missing translations', async locale => {
    const { host, props, missing } = mount(locale)
    button(host, '[aria-controls="astronomy-learn"]').click()
    await nextTick()
    for (const chapter of CHAPTERS) {
      for (const perspective of ['earth', 'observer'] as const) {
        for (const step of [0, 1, 2]) {
          props.state = { ...INITIAL, chapter, perspective, step }
          await nextTick()
          expect(host.innerHTML).not.toContain('demos.items.')
          expect(host.querySelector('.caption-heading h2')?.textContent?.trim()).not.toBe('')
          for (const input of host.querySelectorAll<HTMLInputElement>('.slider input[type="range"]')) {
            expect(host.querySelector(`label[for="${input.id}"]`)).not.toBeNull()
            expect(host.querySelector(`#${input.getAttribute('aria-describedby')}`)).not.toBeNull()
          }
        }
        const answerButton = button(host, '[aria-controls="astronomy-answer"]')
        if (answerButton.getAttribute('aria-expanded') !== 'true') answerButton.click()
        await nextTick()
        expect(host.querySelector('#astronomy-answer')?.textContent?.trim()).not.toBe('')
        expect(host.innerHTML).not.toContain('demos.items.')
      }
    }
    expect(missing).not.toHaveBeenCalled()
  })

  it('sends chapter, perspective and lesson navigation commands, including the final restart', async () => {
    const { host, props } = mount()
    const chapters = host.querySelectorAll<HTMLButtonElement>('.chapters button')
    chapters[2]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'chapter', value: 'daily' })
    props.state = { ...INITIAL, chapter: 'daily' }
    await nextTick()
    expect(chapters[2]!.getAttribute('aria-pressed')).toBe('true')

    host.querySelectorAll<HTMLButtonElement>('.perspectives button')[1]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'perspective', value: 'observer' })
    props.state = { ...props.state, perspective: 'observer' }
    await nextTick()
    expect(host.querySelector('.perspectives button[aria-pressed="true"]')?.textContent).toContain(en.perspectives.observer)

    button(host, '.caption-actions .primary').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'step', value: 1 })
    props.state = { ...props.state, step: 1 }
    await nextTick()
    button(host, '.caption-actions button:first-child').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'step', value: 0 })
    host.querySelectorAll<HTMLButtonElement>('.lesson-steps button')[2]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'step', value: 2 })
    props.state = { ...props.state, step: 2 }
    await nextTick()
    const compareView = [...host.querySelectorAll<HTMLButtonElement>('.caption-actions button')].find(control => control.textContent?.includes(en.ui.compareView))
    expect(compareView).toBeDefined()
    compareView!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'perspective', value: 'earth' })
    button(host, '.caption-actions .primary').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'chapter', value: 'ecliptic' })

    props.state = { ...INITIAL, chapter: 'precession', step: 2 }
    await nextTick()
    button(host, '.caption-actions .primary').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'chapter', value: 'horizon' })
  })

  it('restores empty and invalid number fields, clamps extremes and retains valid fractions', async () => {
    const { host, props } = mount('en', { ...INITIAL, chapter: 'equatorial' })
    const latitude = host.querySelector<HTMLInputElement>('#astro-number-latitude')!
    await change(latitude, '')
    expect(props.send).not.toHaveBeenCalled()
    expect(latitude.value).toBe('40')
    await change(latitude, 'not a number')
    expect(props.send).not.toHaveBeenCalled()
    expect(latitude.value).toBe('40')
    await change(latitude, '900')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'latitude', value: 90 })
    expect(latitude.value).toBe('90')
    await change(latitude, '-900')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'latitude', value: -90 })
    expect(latitude.value).toBe('-90')

    const ra = host.querySelector<HTMLInputElement>('#astro-number-ra')!
    await change(ra, '6.3')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'ra', value: 6.3 })
    await change(ra, '25')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'ra', value: 24 })
    const range = host.querySelector<HTMLInputElement>('#astro-range-dec')!
    await change(range, '-20', 'input')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'dec', value: -20 })
    expect(props.send.mock.calls.every(([command]) => Number.isFinite(command.value))).toBe(true)
  })

  it('sends playback, speed, display and example commands through native controls', async () => {
    const { host, props } = mount('en', { ...INITIAL, chapter: 'daily' })
    button(host, '.play-button').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'playing' })
    props.state = { ...props.state, playing: true }
    await nextTick()
    expect(button(host, '.play-button').getAttribute('aria-pressed')).toBe('true')
    await change(host.querySelector<HTMLSelectElement>('.playback select')!, '0.5')
    expect(props.send).toHaveBeenLastCalledWith({ type: 'speed', value: 0.5 })
    host.querySelector<HTMLInputElement>('.grid-toggle input')!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'grid' })
    host.querySelectorAll<HTMLButtonElement>('.views button')[1]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'view', value: 'top' })
    host.querySelectorAll<HTMLButtonElement>('.zoom-buttons button')[1]!.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'camera', value: 'in' })
    button(host, '[aria-controls="astronomy-learn"]').click()
    await nextTick()
    expect((host.querySelector('#astronomy-explore') as HTMLElement).style.display).toBe('none')
    button(host, '.example-buttons button').click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'example', value: 'circumpolar' })
  })

  it('pauses playback when an exact number receives focus and leaves paused lessons paused', async () => {
    const { host, props } = mount('en', { ...INITIAL, chapter: 'daily', playing: true })
    const input = host.querySelector<HTMLInputElement>('#astro-number-lst')!
    input.focus()
    expect(document.activeElement).toBe(input)
    expect(props.send).toHaveBeenCalledExactlyOnceWith({ type: 'playing', value: false })

    props.state = { ...props.state, playing: false }
    await nextTick()
    input.blur()
    props.send.mockClear()
    input.focus()
    expect(props.send).not.toHaveBeenCalled()
  })

  it.each(['daily', 'precession'] as const)('keeps %s playback accessible from the caption when controls are folded', async chapter => {
    vi.stubGlobal('innerWidth', 390)
    const { host, props } = mount('en', { ...INITIAL, chapter })
    expect(button(host, '.heading').getAttribute('aria-expanded')).toBe('false')
    const play = button(host, '.caption-play')
    expect(play.getAttribute('aria-label')).toBe(en.ui.play)
    expect(play.getAttribute('aria-pressed')).toBe('false')
    expect(play.matches(':disabled')).toBe(false)
    play.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'playing' })
    props.state = { ...props.state, playing: true }
    await nextTick()
    expect(play.getAttribute('aria-label')).toBe(en.ui.pause)
    expect(play.getAttribute('aria-pressed')).toBe('true')
    play.click()
    expect(props.send).toHaveBeenLastCalledWith({ type: 'playing' })
  })

  it('folds controls and captions independently without sending scene commands', async () => {
    vi.stubGlobal('innerWidth', 1440)
    const { host, props } = mount()
    const heading = button(host, '.heading')
    expect(heading.getAttribute('aria-expanded')).toBe('true')
    heading.click()
    await nextTick()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect((host.querySelector('#astronomy-controls') as HTMLElement).style.display).toBe('none')
    heading.click()
    await nextTick()
    expect((host.querySelector('#astronomy-controls') as HTMLElement).style.display).not.toBe('none')
    const caption = button(host, '.caption-toggle')
    caption.click()
    await nextTick()
    expect(caption.getAttribute('aria-expanded')).toBe('false')
    expect((host.querySelector('#astro-caption-content') as HTMLElement).style.display).toBe('none')
    props.state = { ...INITIAL, chapter: 'daily' }
    await nextTick()
    expect(caption.getAttribute('aria-expanded')).toBe('true')
    expect(props.send).not.toHaveBeenCalled()
  })

  it('starts compact controls folded and makes room for them when opened on mobile', async () => {
    vi.stubGlobal('innerWidth', 390)
    const { host } = mount()
    expect(button(host, '.heading').getAttribute('aria-expanded')).toBe('false')
    expect((host.querySelector('.lesson-caption') as HTMLElement).style.display).not.toBe('none')
    button(host, '.heading').click()
    await nextTick()
    expect((host.querySelector('.lesson-caption') as HTMLElement).style.display).toBe('none')
    button(host, '.heading').click()
    await nextTick()
    expect((host.querySelector('.lesson-caption') as HTMLElement).style.display).not.toBe('none')
  })

  it('keeps Space and range keys away from shared scene shortcuts without preventing native behavior', async () => {
    const { host, props } = mount('en', { ...INITIAL, chapter: 'daily' })
    const globalKey = vi.fn()
    window.addEventListener('keydown', globalKey)
    try {
      for (const selector of ['.heading', '#astro-number-latitude', '#astro-range-latitude', '.inline-readout .time-range', '.caption-actions .primary']) {
        for (const [key, code] of [[' ', 'Space'], ['ArrowRight', 'ArrowRight']]) {
          const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })
          const control = host.querySelector(selector)
          expect(control, selector).not.toBeNull()
          control!.dispatchEvent(event)
          expect(globalKey).not.toHaveBeenCalled()
          expect(event.defaultPrevented).toBe(false)
        }
      }
      props.state = { ...INITIAL, chapter: 'precession' }
      await nextTick()
      const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      button(host, '.astronomy-hud .cycle-stops button').dispatchEvent(event)
      expect(globalKey).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    } finally {
      window.removeEventListener('keydown', globalKey)
    }
  })

  it.each(['en', 'zh'])('disables all scene controls before initialization while retaining readable material in %s', locale => {
    const { host, props, missing } = mount(locale, {})
    expect(host.querySelector('[role="status"]')?.textContent?.trim()).not.toBe('')
    expect(host.querySelector('.astronomy-hud')).toBeNull()
    const fieldsets = host.querySelectorAll<HTMLFieldSetElement>('fieldset')
    expect(fieldsets.length).toBeGreaterThan(0)
    for (const fieldset of fieldsets) {
      expect(fieldset.disabled).toBe(true)
      for (const control of fieldset.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select')) {
        expect(control.matches(':disabled')).toBe(true)
        control.click()
      }
    }
    expect(props.send).not.toHaveBeenCalled()
    expect(host.querySelector('.model-notes')?.textContent).toContain((locale === 'en' ? en : zh).notes)
    expect(host.querySelectorAll('.model-notes a[href^="https://"]').length).toBe(2)
    expect(missing).not.toHaveBeenCalled()
  })
})
