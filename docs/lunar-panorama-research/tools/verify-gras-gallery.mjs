/**
 * Enumerate the GRAS education gallery for Chang'e 4 and measure every stitched panorama.
 * Run with NODE_USE_ENV_PROXY=1.
 *
 * The list endpoint is unauthenticated and returns { total, rows: [{ title, image, content, ... }] }.
 * `image` is a path under https://moon.bao.ac.cn that must be percent-encoded because the
 * filenames contain Chinese characters and full-width parentheses.
 */
if (process.env.NODE_USE_ENV_PROXY !== '1') {
  console.error('set NODE_USE_ENV_PROXY=1 first')
  process.exit(2)
}

const BASE = 'https://moon.bao.ac.cn'

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

const HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; moon-demo-research/1.0)' }

const loads = [
  [7, 372, 'CE-4 PCAM'],
  [7, 368, 'CE-4 TCAM'],
  [7, 366, 'CE-4 LCAM'],
]

const rows = []
for (const [task, load, label] of loads) {
  const url = `${BASE}/moon-admin/client/education/educationList?pageNum=1&pageSize=100&task=${task}&load=${load}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    const json = JSON.parse(await res.text())
    console.log(`\n== ${label} (task=${task} load=${load}) status=${res.status} total=${json.total} rows=${json.rows?.length ?? 0}`)
    for (const row of json.rows ?? []) {
      const file = `${BASE}${row.image.split('/').map(encodeURIComponent).join('/')}`
      rows.push({ label, title: row.title, content: row.content ?? '', file })
    }
  } catch (err) {
    console.log(`  ERR ${err.cause?.code ?? err.message}`)
  }
}

console.log(`\n== measuring ${rows.length} images (this downloads each one) ==`)
const seen = new Map()
for (const row of rows) {
  try {
    const res = await fetch(row.file, { headers: HEADERS })
    const buf = Buffer.from(await res.arrayBuffer())
    const dims = jpegSize(buf)
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 12)
    const dup = seen.get(hash)
    seen.set(hash, row.file)
    const size = dims ? `${dims.width}x${dims.height}` : '?'
    const ratio = dims ? (dims.width / dims.height).toFixed(2) : '-'
    console.log(
      `${row.label} | ${size} | ${ratio}:1 | ${buf.length} B | sha=${hash}${dup ? ' | DUPLICATE of an earlier file' : ''} | ${row.title}`,
    )
  } catch (err) {
    console.log(`ERR ${err.cause?.code ?? err.message} | ${row.title}`)
  }
}
