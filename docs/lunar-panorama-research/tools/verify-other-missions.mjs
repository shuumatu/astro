/**
 * Reconstruct-and-verify pass for the "other missions" sweep, whose subagent failed before
 * writing its deliverables. I measure the headline URLs myself rather than presenting
 * subagent-reported numbers as verified.
 * Run with NODE_USE_ENV_PROXY=1.
 */
if (process.env.NODE_USE_ENV_PROXY !== '1') {
  console.error('set NODE_USE_ENV_PROXY=1 first')
  process.exit(2)
}

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; moon-demo-research/1.0)' }

function jpegSize(buf) {
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue }
    const m = buf[i + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
    const len = buf.readUInt16BE(i + 2)
    if (len <= 0) break
    i += 2 + len
  }
  return null
}

const targets = [
  ['Surveyor 7 panorama printout mosaic', 'http://nssdc.gsfc.nasa.gov/planetary/image/surveyor/surveyor7_01_mos_0712.jpg'],
  ['Lunokhod 1 horizontal pan (mentallandscape)', 'http://www.mentallandscape.com/C_CatalogMoon.htm'],
  ['Lunokhod 2 panorama (planetary.org)', 'https://www.planetary.org/space-images/lunokhod-2-panorama'],
  ['Luna 9 panorama (mentallandscape)', 'http://mentallandscape.com/C_CatalogMoon.htm'],
  ['Artemis II Earthset (NASA)', 'https://images-assets.nasa.gov/image/KSC-20260410-PH-JNV01_0001/KSC-20260410-PH-JNV01_0001~orig.jpg'],
]

for (const [name, url] of targets) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45000) })
    const buf = Buffer.from(await res.arrayBuffer())
    const head = buf.slice(0, 4).toString('hex')
    let dims = null
    let kind = 'html/other'
    if (head.startsWith('ffd8ff')) { kind = 'jpeg'; dims = jpegSize(buf) }
    else if (head === '89504e47') { kind = 'png'; dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } }
    console.log(`${res.status} | ${kind} ${dims ? `${dims.width}x${dims.height}` : ''} | ${buf.length} B | ${name}`)
  } catch (err) {
    console.log(`ERR ${err.cause?.code ?? err.message} | ${name}`)
  }
}

console.log('\n== mentallandscape licence statement ==')
try {
  const res = await fetch('http://www.mentallandscape.com/C_CatalogMoon.htm', { headers: UA, signal: AbortSignal.timeout(30000) })
  const text = await res.text()
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const i = flat.search(/copyright|all rights reserved/i)
  console.log(i >= 0 ? '  ' + flat.slice(Math.max(0, i - 250), i + 350) : '  no copyright statement found')
} catch (err) {
  console.log(`  ERR ${err.cause?.code ?? err.message}`)
}
