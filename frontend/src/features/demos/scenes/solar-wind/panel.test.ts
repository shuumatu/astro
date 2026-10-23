// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import Panel from './WindControlPanel.vue'
import zh from './zh.json'
import en from './en.json'
import { INITIAL, LABELS, reduceWind } from './model'
import { findDemo } from '../../registry'

let app: App | undefined
afterEach(() => { app?.unmount(); document.body.innerHTML = '' })
function mount(locale = 'en', ready = true) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const props = reactive({ state: ready ? { ...INITIAL } : {}, send: vi.fn((command: unknown) => { props.state = reduceWind(props.state as typeof INITIAL, command) }) })
  app = createApp({ render: () => h(Panel, props) })
  app.use(createI18n({ legacy:false, locale, messages:{en:{demos:{items:{solarWind:en}}},zh:{demos:{items:{solarWind:zh}}}} }))
  app.mount(host)
  return { host, props }
}
function leaves(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === 'string' ? [prefix + key] : leaves(child, prefix + key + '.'))
}
it('has complete nonempty bilingual strings and a lazy registry entry', async () => {
  expect(leaves(zh).sort()).toEqual(leaves(en).sort())
  for (const bundle of [zh,en]) {
    for (const id of LABELS) expect(bundle.labels[id].length).toBeGreaterThan(0)
    for (const key of leaves(bundle)) {
      const value = key.split('.').reduce<unknown>((v, part) => (v as Record<string, unknown>)[part], bundle)
      expect(value).toEqual(expect.any(String)); expect(value).not.toBe('')
    }
  }
  const demo = findDemo('solar-wind')!
  expect(typeof (await demo.loadScene()).createScene).toBe('function')
  expect((await demo.controlPanel!()).default).toBeDefined()
  expect(demo.transport).toBe(false)
})
it.each(['en','zh'])('mounts translated, labeled native controls in %s', async locale => {
  const {host, props} = mount(locale)
  expect(host.textContent).not.toContain('demos.items.')
  const input = host.querySelector('input')!
  expect(host.querySelector(`label[for="${input.id}"]`)).not.toBeNull()
  expect(host.querySelector(`#${input.getAttribute('aria-describedby')}`)).not.toBeNull()
  input.value = '85'; input.dispatchEvent(new Event('input', {bubbles:true})); await nextTick()
  expect(props.send).toHaveBeenLastCalledWith({type:'intensity',value:85})
  const select = host.querySelector('select')!
  select.value = 'south'; select.dispatchEvent(new Event('change', {bubbles:true})); await nextTick()
  expect(props.send).toHaveBeenLastCalledWith({type:'direction',value:'south'})
  host.querySelector<HTMLButtonElement>('[aria-controls="wind-learn"]')!.click(); await nextTick()
  expect((host.querySelector('#wind-experiment') as HTMLElement).style.display).toBe('none')
  const steps = host.querySelectorAll<HTMLButtonElement>('nav button')
  steps[2]!.click(); await nextTick()
  expect(props.send).toHaveBeenLastCalledWith({type:'step',value:2})
  expect(host.querySelector('nav button[aria-pressed="true"]')?.textContent).toBe('03')
  expect(host.querySelector('output')?.textContent).toBe('85/ 100')
  expect(host.querySelectorAll('a[href^="https://"]').length).toBe(4)
})
it('keeps native control keyboard events away from shared scene shortcuts', () => {
  const {host} = mount()
  const globalKey = vi.fn()
  window.addEventListener('keydown', globalKey)
  try {
    const key = new KeyboardEvent('keydown', {key:' ',code:'Space',bubbles:true,cancelable:true})
    host.querySelector('button')!.dispatchEvent(key)
    expect(globalKey).not.toHaveBeenCalled()
    expect(key.defaultPrevented).toBe(false) // Native Space activation remains available.
  } finally { window.removeEventListener('keydown', globalKey) }
})
it('disables controls when WebGL did not initialize and retains source material', () => {
  const {host} = mount('en', false)
  expect(host.querySelector('fieldset')!.disabled).toBe(true)
  expect(host.textContent).toContain('WebGL is unavailable')
  expect(host.querySelector('.panel-body > details')?.textContent).toContain('not to scale')
})
it('sends view and camera commands through keyboard-accessible buttons', async () => {
  const {host,props} = mount()
  host.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click(); await nextTick()
  expect(props.send).toHaveBeenLastCalledWith({type:'view',value:'earth'})
  expect(host.querySelector('.view-switch button[aria-pressed="true"]')?.textContent).toContain('Aurora close-up')
  host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click()
  expect(props.send).toHaveBeenLastCalledWith({type:'camera',value:'in'})
})
