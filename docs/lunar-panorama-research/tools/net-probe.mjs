/**
 * Probe helper: fetch URLs through the local proxy and report status, size, content-type, magic bytes.
 * Usage: node docs/lunar-panorama-research/tools/net-probe.mjs <url> [<url> ...]
 *
 * Node 24 ignores HTTP_PROXY / HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set as well. Without it
 * this script goes direct, which silently produces different (and misleading) results. It refuses
 * to run in that state unless MOON_ALLOW_DIRECT=1 is set explicitly.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const proxy = process.env.MOON_PROXY || 'http://127.0.0.1:7890'
const urls = process.argv.slice(2)

if (process.env.NODE_USE_ENV_PROXY !== '1' && process.env.MOON_ALLOW_DIRECT !== '1') {
  console.error(
    'Refusing to run: Node will not use HTTP_PROXY/HTTPS_PROXY without NODE_USE_ENV_PROXY=1.\n' +
      'Re-run as:  $env:NODE_USE_ENV_PROXY="1"; node docs/lunar-panorama-research/tools/net-probe.mjs <url>\n' +
      'Set MOON_ALLOW_DIRECT=1 to bypass the proxy deliberately.',
  )
  process.exit(2)
}

let dispatcher
try {
  const { ProxyAgent } = require('undici')
  dispatcher = new ProxyAgent(proxy)
} catch {
  dispatcher = undefined
}

function describe(url, res, buf) {
  const hex = Buffer.from(buf.slice(0, 12)).toString('hex')
  let magic = hex
  if (hex.startsWith('ffd8ff')) magic = 'JPEG'
  else if (hex.startsWith('89504e47')) magic = 'PNG'
  else if (hex.startsWith('52494646')) magic = 'RIFF/WEBP?'
  else if (hex.startsWith('47494638')) magic = 'GIF'
  else if (hex.startsWith('3c21444') || hex.startsWith('3c68746d') || hex.startsWith('3c48544d')) magic = 'HTML'
  else if (hex.startsWith('25504446')) magic = 'PDF'
  console.log(
    [
      res.status,
      (res.headers.get('content-type') ?? '-').split(';')[0],
      res.headers.get('content-length') ?? '-',
      magic,
      url,
    ].join(' | '),
  )
}

for (const url of urls) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-4095', 'user-agent': 'Mozilla/5.0 (compatible; DSH-probe/1.0)' },
      ...(dispatcher ? { dispatcher } : {}),
      redirect: 'follow',
    })
    const buf = new Uint8Array(await res.arrayBuffer())
    describe(url, res, buf)
  } catch (err) {
    console.log(`ERR  | ${err.cause?.code ?? err.code ?? ''} ${err.message} | ${url}`)
  }
}
