/**
 * Switch to a named panorama inside the open viewer and screenshot it.
 * Usage: node docs/lunar-panorama-research/tools/pick-panorama.mjs <devtoolsPort> <buttonLabelFragment> <outPng>
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const port = process.argv[2] ?? '9222'
const label = process.argv[3] ?? '5 号站'
const out = process.argv[4] ?? '.cache/shots/picked.png'
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

const box = await evaluate(`(() => {
  const b = [...document.querySelectorAll('.pano-tab')].find((n) => n.textContent.includes(${JSON.stringify(label)}))
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: b.textContent.trim() }
})()`)
if (!box) {
  console.log('no such tab:', label)
  ws.close()
  process.exit(1)
}
console.log('clicking tab', box.text)
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
await sleep(9000)
const { data } = await send('Page.captureScreenshot', { format: 'png' })
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, Buffer.from(data, 'base64'))
console.log('shot', out)
ws.close()
