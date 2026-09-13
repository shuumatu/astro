/**
 * Check the Moon demo's new single-angle Sun control: one slider, its readout, and that moving it
 * actually moves the terminator.
 *
 * Usage: node docs/lunar-panorama-research/tools/verify-sun-control.mjs <devtoolsPort> <appUrl>
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const port = process.argv[2] ?? '9222'
const appUrl = process.argv[3] ?? 'http://localhost:5199/demos/moon'
mkdirSync('.cache/shots', { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 1
const send = (method, params = {}) => {
  const i = id++
  return new Promise((res, rej) => {
    const h = (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== i) return
      ws.removeEventListener('message', h)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    }
    ws.addEventListener('message', h)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
}
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
  return r.result.value
}
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join('.cache/shots', name), Buffer.from(data, 'base64'))
  console.log(`shot ${name}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: appUrl })
await sleep(12000)
await sleep(8000)

console.log('light-angle sliders:', await evaluate(`
  document.querySelectorAll('.display-controls input[type=range]').length
`))
console.log('controls present:', await evaluate(`
  JSON.stringify([...document.querySelectorAll('.display-controls .chip')].map((c) => ({
    title: c.getAttribute('title'),
    kind: c.querySelector('input') ? c.querySelector('input').type : 'button',
    value: c.querySelector('output') ? c.querySelector('output').innerText : null,
  })))
`))
console.log('readout:', await evaluate(`
  (document.querySelector('.demo-readout')||{innerText:'none'}).innerText
`))
await shot('sun-1-default.png')

// Move the single Sun-position slider and confirm the readout follows.
const moved = await evaluate(`(() => {
  const slider = document.querySelector('.display-controls .light-slider input[type=range]')
  if (!slider) {
    return 'sun slider not found; chip classes were: ' +
      [...document.querySelectorAll('.display-controls .chip')].map((c) => c.className).join(' | ')
  }
  const next = Number(slider.value) + 90
  slider.value = String((next + 360) % 360)
  slider.dispatchEvent(new Event('input', { bubbles: true }))
  return 'moved to ' + slider.value
})()`)
console.log(moved)
await sleep(3000)
console.log('readout after:', await evaluate(`
  (document.querySelector('.demo-readout')||{innerText:'none'}).innerText
`))
await shot('sun-2-moved.png')

ws.close()
