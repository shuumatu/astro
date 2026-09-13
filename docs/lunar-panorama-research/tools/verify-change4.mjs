/**
 * Independently re-verify the highest-value non-Apollo candidate: the IAU/CNSA Chang'e 4
 * farside panorama. Measures the file and checks the licence statement's own raw text.
 * Run with NODE_USE_ENV_PROXY=1 and HTTP(S)_PROXY set.
 */
const targets = [
  'https://iauarchive.eso.org/static/archives/images/large/iau1901a.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/1/1b/The_first_panorama_from_the_far_side_of_the_moon.jpg',
  'http://www.chinanews.com/cr/2019/0111/3478659747.png',
  'https://en.people.cn/mediafile/pic/BIG/20240604/13/5277548329692745417.png',
]

if (process.env.NODE_USE_ENV_PROXY !== '1') {
  console.error('set NODE_USE_ENV_PROXY=1 first')
  process.exit(2)
}
console.log(`proxy=${process.env.HTTPS_PROXY}`)

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

for (const url of targets) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'astro-moon-demo/1.0 (research; contact: repo maintainer)' },
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const head = buf.slice(0, 4).toString('hex')
    let dims = null
    let kind = 'other'
    if (head.startsWith('ffd8ff')) { kind = 'jpeg'; dims = jpegSize(buf) }
    else if (head === '89504e47') { kind = 'png'; dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } }
    console.log(
      `${res.status} | ${kind} ${dims ? `${dims.width}x${dims.height}` : '?'} | ${buf.length} B | ${(buf.length / 1048576).toFixed(2)} MB | ${url}`,
    )
  } catch (err) {
    console.log(`ERR ${err.cause?.code ?? err.message} | ${url}`)
  }
}

// The licence claim: read the Wikimedia raw wikitext for the CE-4 panorama.
try {
  const res = await fetch(
    'https://commons.wikimedia.org/w/index.php?title=File:The_first_panorama_from_the_far_side_of_the_moon.jpg&action=raw',
    { headers: { 'user-agent': 'astro-moon-demo/1.0 (research)' } },
  )
  const text = await res.text()
  console.log(`\nwikitext status=${res.status} len=${text.length}`)
  for (const line of text.split('\n')) {
    if (/license|cc-by|IAU-source|Author|Source/i.test(line)) console.log('  | ' + line.trim())
  }
} catch (err) {
  console.log(`wikitext ERR ${err.cause?.code ?? err.message}`)
}
