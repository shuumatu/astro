/**
 * Measure which way the panorama moves when the pointer is dragged, in both axes.
 *
 * The sign of the pitch mapping was got wrong twice by reasoning about the camera basis, so this
 * measures it: two screenshots, aligned by cross-correlation on a central band.
 *
 * Usage: node docs/lunar-panorama-research/tools/measure-drag.mjs <devtoolsPort> <appUrl> <featureText> <outPrefix>
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const port = process.argv[2] ?? '9222'
const appUrl = process.argv[3] ?? 'http://localhost:5199/demos/moon'
const feature = process.argv[4] ?? '阿波罗 11'
const prefix = process.argv[5] ?? 'md'
const outDir = '.cache/shots'
mkdirSync(outDir, { recursive: true })
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
  writeFileSync(join(outDir, name), Buffer.from(data, 'base64'))
}

async function clickSelector(selector, text) {
  const box = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const node = ${text ? `nodes.find((n) => n.textContent.includes(${JSON.stringify(text)}))` : 'nodes[0]'}
    if (!node) return null
    node.scrollIntoView({ block: 'center' })
    const r = node.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })()`)
  if (!box) return null
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  return box
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: appUrl })
await sleep(11000)
await sleep(9000)

console.log('feature:', await clickSelector('button.panel-item', feature))
for (let attempt = 0; attempt < 30; attempt += 1) {
  if (await evaluate(`!!document.querySelector('.hotspot-card')`)) break
  await sleep(1000)
}
await sleep(3000)
console.log('open button:', await clickSelector('.panorama-button'))
for (let attempt = 0; attempt < 25; attempt += 1) {
  if (await evaluate(`(() => { const p = document.querySelector('.pano'); return p ? p.className.includes('pano-open') : false })()`)) break
  await sleep(1000)
}
await sleep(9000)

const box = await evaluate(`(() => {
  const c = document.querySelector('.pano canvas')
  const r = c.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})()`)

async function drag(dx, dy, name) {
  await shot(`${prefix}-${name}-before.png`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  const steps = 12
  for (let i = 1; i <= steps; i += 1) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: Math.round(box.x + (dx * i) / steps), y: Math.round(box.y + (dy * i) / steps),
      button: 'left', buttons: 1,
    })
    await sleep(30)
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: box.x + dx, y: box.y + dy, button: 'left', clickCount: 1,
  })
  // Let the glide settle, then screenshot the resting view.
  await sleep(3000)
  await shot(`${prefix}-${name}-after.png`)
}

await drag(0, 170, 'down')
await drag(300, 0, 'right')

// Also report the control sizes, which the review asked about.
console.log('close button geometry:', await evaluate(`(() => {
  const b = document.querySelector('.pano-exit')
  if (!b) return 'missing'
  const r = b.getBoundingClientRect()
  const cs = getComputedStyle(b)
  return JSON.stringify({
    w: Math.round(r.width), h: Math.round(r.height),
    rightGap: Math.round(window.innerWidth - r.right),
    fontSize: cs.fontSize, color: cs.color, background: cs.backgroundColor, border: cs.borderColor,
  })
})()`))
console.log('card button geometry:', await evaluate(`(() => {
  const b = document.querySelector('.panorama-button')
  if (!b) return 'missing'
  const r = b.getBoundingClientRect()
  const cs = getComputedStyle(b)
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), text: b.innerText.replace(/\\n/g,' '), fontSize: cs.fontSize, background: cs.backgroundColor })
})()`))

ws.close()
