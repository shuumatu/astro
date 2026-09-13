/**
 * Verify the final round of Chang'e claims:
 *  - CE-6 official panorama: is the CNSA master really 800x421 while People's Daily is a 1024x539 upscale?
 *  - CE-3: does a 15743x3505 stitched panorama exist, and what does its licence actually say?
 *  - CE-5: is the 7500x4053 file really from cnsa.gov.cn?
 *  - Zenodo 10.5281/zenodo.11150203: is the licence genuinely cc-by-4.0 and open?
 * Run with NODE_USE_ENV_PROXY=1.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

if (process.env.NODE_USE_ENV_PROXY !== '1') {
  console.error('set NODE_USE_ENV_PROXY=1 first')
  process.exit(2)
}

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; moon-demo-research/1.0)' }
const outDir = '.cache/research/samples'

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

const files = [
  ['ce6-cnsa-master.jpg', 'https://www.cnsa.gov.cn/n6758823/n6758842/c10543340/part/10543423.jpg'],
  ['ce6-peoples-1024.jpg', 'https://en.people.cn/mediafile/pic/BIG/20240604/13/5277548329692745417.png'],
  ['ce3-planetary-stitch.jpg', 'https://planetary.s3.amazonaws.com/web/assets/pictures/20160129_TCAM-I-001_SCI_P_20131217113548_0004_A_2C_stitch.jpg'],
  ['ce5-cnsa-7500.jpg', 'https://www.cnsa.gov.cn/n6758823/n6758838/c6810752/part/6785488.jpg'],
]

console.log('== measuring candidate files ==')
const got = {}
for (const [name, url] of files) {
  try {
    const res = await fetch(url, { headers: UA })
    const buf = Buffer.from(await res.arrayBuffer())
    const head = buf.slice(0, 4).toString('hex')
    let dims = null
    if (head.startsWith('ffd8ff')) dims = jpegSize(buf)
    else if (head === '89504e47') dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    const ratio = dims ? (dims.width / dims.height).toFixed(3) : '-'
    console.log(`  ${res.status} | ${dims ? `${dims.width}x${dims.height}` : '?'} | ratio ${ratio} | ${buf.length} B | ${name}`)
    if (res.status === 200) {
      writeFileSync(join(outDir, name), buf)
      got[name] = { buf, dims }
    }
  } catch (err) {
    console.log(`  ERR ${err.cause?.code ?? err.message} | ${name}`)
  }
}

// The "padded upscale" claim: if People's Daily is an upscale of the CNSA master, their aspect
// ratios should match closely and the upscale should carry no additional detail.
const a = got['ce6-cnsa-master.jpg']?.dims
const b = got['ce6-peoples-1024.jpg']?.dims
if (a && b) {
  console.log(`\n  CE-6 aspect: CNSA ${(a.width / a.height).toFixed(4)} vs People's ${(b.width / b.height).toFixed(4)}`)
  console.log(`  CE-6 pixel scale: People's is ${(b.width / a.width).toFixed(3)}x the CNSA master`)
}

console.log('\n== Zenodo record 10.5281/zenodo.11150203 ==')
try {
  const res = await fetch('https://zenodo.org/api/records/11150203', { headers: UA })
  const json = await res.json()
  console.log(`  status=${res.status}`)
  console.log(`  metadata.license = ${JSON.stringify(json.metadata?.license)}`)
  console.log(`  access_right     = ${json.access_right ?? json.metadata?.access_right}`)
  console.log(`  title            = ${json.metadata?.title}`)
  for (const f of json.files ?? []) {
    console.log(`  file: ${f.key} | ${f.size} B | ${f.links?.self}`)
  }
} catch (err) {
  console.log(`  ERR ${err.cause?.code ?? err.message}`)
}

console.log('\n== DataCite licence cross-check ==')
try {
  const res = await fetch('https://api.datacite.org/dois/10.5281/zenodo.11150203', { headers: UA })
  const json = await res.json()
  const rights = json.data?.attributes?.rightsList ?? []
  console.log(`  status=${res.status} rightsList=${JSON.stringify(rights)}`)
} catch (err) {
  console.log(`  ERR ${err.cause?.code ?? err.message}`)
}
