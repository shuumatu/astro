/**
 * Establish, with evidence, whether requests actually traverse the local proxy.
 * Usage: node docs/lunar-panorama-research/tools/proxy-audit.mjs
 *
 * Two things are checked per URL:
 *  1. whether the request succeeds;
 *  2. whether it went through the proxy — proven by pointing at a dead proxy port. If a
 *     request still succeeds with HTTP_PROXY aimed at a closed port, Node ignored the env
 *     var and went direct.
 */
const urls = [
  'https://images-assets.nasa.gov/image/jsc2008e040725/jsc2008e040725~orig.jpg',
  'https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=File:Test.jpg',
  'https://www.lpi.usra.edu/resources/apollopanoramas/',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Apollo_11_Flag.jpg/320px-Apollo_11_Flag.jpg',
]

async function probe(url, note) {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-2047' } })
    const buf = Buffer.from(await res.arrayBuffer())
    const magic = buf.slice(0, 4).toString('hex')
    const ct = (res.headers.get('content-type') ?? '-').split(';')[0]
    console.log(`  ${res.status} | ${ct} | ${buf.length} B | ${magic} | ${note}`)
  } catch (err) {
    console.log(`  ERR | ${err.cause?.code ?? err.code ?? ''} ${err.message} | ${note}`)
  }
}

console.log(`node ${process.version}  NODE_USE_ENV_PROXY=${process.env.NODE_USE_ENV_PROXY ?? '(unset)'}`)
console.log(`HTTP_PROXY=${process.env.HTTP_PROXY ?? '(unset)'}  HTTPS_PROXY=${process.env.HTTPS_PROXY ?? '(unset)'}`)

console.log('\n-- pass 1: whatever the current environment says --')
for (const url of urls) await probe(url, new URL(url).host)

console.log('\n-- pass 2: proxy aimed at a CLOSED port (7891). Success here means env was ignored --')
process.env.HTTP_PROXY = 'http://127.0.0.1:7891'
process.env.HTTPS_PROXY = 'http://127.0.0.1:7891'
for (const url of urls) await probe(url, new URL(url).host)
