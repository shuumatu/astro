/**
 * Walk the real user path — click a landing site, then its panorama button — and screenshot the
 * result. Clicks go through CDP against freshly measured coordinates, with a re-measure right
 * before each click so a moving or animated panel cannot invalidate them.
 *
 * Usage: node docs/lunar-panorama-research/tools/walk-panorama.mjs <devtoolsPort> <appUrl> <featureText> <outPrefix>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const port = process.argv[2] ?? '9222'
const appUrl = process.argv[3] ?? 'http://localhost:5199/demos/moon'
const featureText = process.argv[4] ?? '阿波罗 11'
const prefix = process.argv[5] ?? 'walk'
const outDir = process.argv[6] ?? '.cache/shots'
mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

let nextId = 1
function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      ws.removeEventListener('message', onMessage)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
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
  console.log(`shot ${name}`)
}
/** Click the centre of an element, measured immediately before the click. */
async function clickSelector(selector, text) {
  const box = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const node = ${text ? `nodes.find((n) => n.textContent.includes(${JSON.stringify(text)}))` : 'nodes[0]'}
    if (!node) return null
    node.scrollIntoView({ block: 'center' })
    const r = node.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), label: node.textContent.trim().slice(0, 30) }
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

// Capture the page's own console, which the viewer logs its progress to.
const consoleLog = []
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data)
  if (m.method === 'Runtime.consoleAPICalled') {
    consoleLog.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
  }
})

// The intro camera move runs for several seconds before the globe settles.
console.log('waiting out the intro camera move…')
await sleep(9000)

const picked = await clickSelector('button.panel-item', featureText)
console.log('clicked feature:', picked)
// The flight down to a feature takes a couple of seconds; wait for the card rather than guess.
for (let attempt = 0; attempt < 20; attempt += 1) {
  const present = await evaluate(`!!document.querySelector('.hotspot-card')`)
  if (present) break
  await sleep(1000)
}
await sleep(2500)
await shot(`${prefix}-1-card.png`)
console.log('card:', await evaluate(`(document.querySelector('.hotspot-card')||{innerText:''}).innerText.replace(/\\n+/g,' | ').slice(0,200)`))

const browse = await clickSelector('button', '浏览月面全景')
console.log('clicked panorama button:', browse)
if (!browse) {
  console.log('no panorama button found; card text was:',
    await evaluate(`(document.querySelector('.hotspot-card')||{innerText:'none'}).innerText.slice(0,160)`))
  await shot(`${prefix}-2-failed.png`)
  ws.close()
  process.exit(1)
}
for (let attempt = 0; attempt < 25; attempt += 1) {
  const open = await evaluate(`(() => { const p = document.querySelector('.pano'); return p ? p.className.includes('pano-open') : false })()`)
  if (open) break
  await sleep(1000)
}
// Give the texture a moment to decode: a screenshot taken before it arrives is a grey rectangle.
await sleep(9000)
await shot(`${prefix}-2-panorama.png`)

console.log('state:', JSON.stringify(await evaluate(`(() => {
  const pano = document.querySelector('.pano')
  const canvas = pano ? pano.querySelector('canvas') : null
  return {
    cls: pano ? pano.className : 'none',
    canvas: canvas ? canvas.width + 'x' + canvas.height : 'none',
    text: (pano ? pano.innerText : '').replace(/\\n+/g, ' | ').slice(0, 300),
  }
})()`), null, 1))

// Drag to look around, which is the whole point of the viewer.
const centre = await evaluate(`(() => {
  const c = document.querySelector('.pano canvas')
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})()`)
if (centre) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: centre.x, y: centre.y, button: 'left', clickCount: 1 })
  for (let i = 1; i <= 24; i += 1) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: Math.round(centre.x - (centre.x * 0.8 * i) / 24), y: centre.y, button: 'left', buttons: 1,
    })
    await sleep(35)
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: centre.x, y: centre.y, button: 'left', clickCount: 1 })
  await sleep(2000)
  await shot(`${prefix}-3-turned.png`)
}

console.log('page console:', consoleLog.filter((line) => line.includes('[pano]')).slice(-14))
ws.close()
