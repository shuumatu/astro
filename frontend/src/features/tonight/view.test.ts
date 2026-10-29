// @vitest-environment jsdom
import { createApp, h, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TonightView from '../../views/TonightView.vue'
import type { TonightRecommendation, TonightRequest, TonightResult } from './types'
import { tonightSession } from './session'

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), plan: vi.fn(), dispose: vi.fn() }))
vi.mock('../sky-map/workerClient', () => ({ SkyMapWorkerClient: class {
  initialize = mocks.initialize
  planTonight = mocks.plan
  dispose = mocks.dispose
} }))
let app: App, root: HTMLDivElement
const flush = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await nextTick() } }
function result(request: TonightRequest): TonightResult {
  return { request, night: { status: 'normal', sunsetUtc: null, sunriseUtc: null, astronomicalDuskUtc: null, moonsetUtc: null }, timeline: { bounds: { startUtc: `${request.nightDate}T08:00:00Z`, endUtc: `${request.nightDate}T23:59:00Z` }, bands: [], bodies: [] }, moon: { phaseDeg: 180, phaseFraction: 1 }, featuredIds: [], recommendations: [], excluded: [] } as unknown as TonightResult
}
function populatedResult(request: TonightRequest): TonightResult {
  const plan = result(request)
  const window = { startUtc: `${request.nightDate}T12:00:00Z`, endUtc: `${request.nightDate}T15:00:00Z` }
  plan.timeline.bodies = [
    { targetId: 'moon', name: '月球', windows: [window], riseUtc: window.startUtc, setUtc: window.endUtc, phaseFraction: .5 },
    { targetId: 'neptune', name: '海王星', windows: [window], riseUtc: null, setUtc: window.endUtc, phaseFraction: 1 },
  ]
  plan.recommendations = [{ targetId: 'moon', targetType: 'moon', name: '月球', cultureId: 'western-iau', windows: [window], recommendedWindow: window, bestAtUtc: `${request.nightDate}T13:00:00Z`, positionAtBest: { altitudeDeg: 55, azimuthDeg: 180 }, reasons: [{ code: 'high-altitude', facts: { altitude: 55 } }], limitations: [], samples: [{ atUtc: window.startUtc, altitudeDeg: 25, eligible: true }, { atUtc: window.endUtc, altitudeDeg: 55, eligible: true }] } as unknown as TonightRecommendation]
  return plan
}
async function mount() {
  root = document.createElement('div'); document.body.append(root)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tonight', component: TonightView }, { path: '/sky-map', component: { template: '<div />' } }] })
  await router.push('/tonight'); await router.isReady()
  app = createApp({ render: () => h(TonightView) }).use(router).use(createI18n({ legacy: false, locale: 'zh-CN', messages: {} }))
  app.mount(root); await flush()
}
async function setDate(value: string) {
  const input = root.querySelector('input[type="date"]') as HTMLInputElement
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await flush()
  await vi.advanceTimersByTimeAsync(200); await flush()
}
beforeEach(() => {
  tonightSession.request = null; tonightSession.preset = 'shenzhen'; tonightSession.filter = 'all'
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T08:00:00Z'))
  mocks.initialize.mockReset().mockResolvedValue({}); mocks.plan.mockReset().mockImplementation(async request => result(request)); mocks.dispose.mockClear()
})
afterEach(() => { app?.unmount(); root?.remove(); vi.useRealTimers() })
describe('tonight page request lifecycle', () => {
  it('renders empty results truthfully and includes the clear-sky assumption', async () => {
    await mount()
    expect(root.textContent).toContain('这个时段没有合适的目标')
    expect(root.textContent).toContain('尚未接入天气预报')
    expect(root.querySelectorAll('.target-card')).toHaveLength(0)
  })
  it('does not let an old calculation replace the newer selected date', async () => {
    const pending: { request: TonightRequest; resolve: (value: TonightResult) => void }[] = []
    mocks.plan.mockImplementation(request => new Promise(resolve => pending.push({ request, resolve })))
    await mount(); await setDate('2026-11-01')
    expect(pending).toHaveLength(2)
    pending[1].resolve(result(pending[1].request)); await flush()
    pending[0].resolve(result(pending[0].request)); await flush()
    expect(root.querySelector('.summary-footnote')?.textContent).toContain('2026-11-01')
  })
  it('allows a failed catalog initialization to retry successfully', async () => {
    mocks.initialize.mockRejectedValueOnce(new Error('Catalog unavailable'))
    await mount()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Catalog unavailable')
    const retry = [...root.querySelectorAll('button')].find(button => button.textContent?.trim() === '重试')!
    retry.click(); await flush()
    expect(root.querySelector('[role="alert"]')).toBeNull()
    expect(mocks.initialize).toHaveBeenCalledTimes(2)
  })
  it('rejects cleared coordinates instead of treating an empty input as zero', async () => {
    await mount()
    const input = root.querySelector('input[type="number"]') as HTMLInputElement
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); await flush()
    await vi.advanceTimersByTimeAsync(200); await flush()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('请填写有效的经纬度')
    expect(mocks.plan).toHaveBeenCalledTimes(1)
  })
  it('restores the selected night after returning from the sky map', async () => {
    await mount(); await setDate('2026-11-07')
    app.unmount(); root.remove(); await mount()
    expect((root.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-11-07')
    expect(mocks.plan.mock.calls.at(-1)?.[0].nightDate).toBe('2026-11-07')
  })
  it('shows the current night instead of an old date when switching to next hour', async () => {
    await mount(); await setDate('2026-11-07')
    const select = [...root.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'next-hour'))!
    select.value = 'next-hour'; select.dispatchEvent(new Event('change', { bubbles: true })); await flush()
    await vi.advanceTimersByTimeAsync(200); await flush()
    const input = root.querySelector('input[type="date"]') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.value).toBe('2026-10-28')
    expect(mocks.plan.mock.calls.at(-1)?.[0].nightDate).toBe(input.value)
  })
  it('expands advice immediately under its timeline row and preserves the exact sky-map instant', async () => {
    mocks.plan.mockImplementation(async request => populatedResult(request))
    await mount()
    const moonRow = root.querySelector('.timeline-row') as HTMLButtonElement
    expect(root.querySelector('.timeline-details')).toBeNull()
    expect(root.querySelectorAll('.visibility-bar.recommended')).toHaveLength(1)
    moonRow.click(); await flush()
    expect(moonRow.getAttribute('aria-expanded')).toBe('true')
    const details = moonRow.nextElementSibling!
    expect(details.textContent).toContain('高出地平线约 55°')
    const link = details.querySelector('a')!
    const url = new URL(link.href)
    expect(url.searchParams.get('targetId')).toBe('moon')
    expect(url.searchParams.get('at')).toBe('2026-10-28T13:00:00Z')
    moonRow.click(); await flush()
    expect(root.querySelector('.timeline-details')).toBeNull()
  })
  it('keeps optical targets in the calendar without inventing naked-eye advice or rise times', async () => {
    mocks.plan.mockImplementation(async request => populatedResult(request))
    await mount()
    const row = root.querySelectorAll<HTMLButtonElement>('.timeline-row')[1]
    row.click(); await flush()
    const details = root.querySelector('.timeline-details')!
    expect(details.textContent).toContain('未列入裸眼推荐')
    expect(details.querySelector('.rise-set dd')?.textContent).toBe('—')
    expect(details.querySelector('a')).toBeNull()
  })
  it('changes nights across a month boundary and keeps the default all-night view', async () => {
    await mount(); await setDate('2026-10-31')
    root.querySelector<HTMLButtonElement>('[aria-label="后一晚"]')!.click(); await flush()
    await vi.advanceTimersByTimeAsync(200); await flush()
    expect(mocks.plan.mock.calls.at(-1)?.[0]).toMatchObject({ nightDate: '2026-11-01', windowMode: 'all-night' })
    expect(root.querySelector('.date-heading h2')?.textContent).toContain('11月1–2日')
  })
})
