/**
 * Fetch a URL through the local proxy and report the true image dimensions.
 * Usage: node docs/lunar-panorama-research/tools/img-info.mjs <url> [<url> ...]
 * For JPEG it walks the SOF markers; for PNG it reads IHDR. Enough to prove a
 * candidate panorama really is as large as its host claims.
 *
 * Requires NODE_USE_ENV_PROXY=1, otherwise Node ignores the proxy env vars and this
 * script measures a different network path than the one the report describes.
 */
if (process.env.NODE_USE_ENV_PROXY !== '1' && process.env.MOON_ALLOW_DIRECT !== '1') {
  console.error(
    'Refusing to run: set NODE_USE_ENV_PROXY=1 so the proxy is actually used\n' +
      '  $env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"\n' +
      'Set MOON_ALLOW_DIRECT=1 to bypass the proxy deliberately.',
  )
  process.exit(2)
}

const urls = process.argv.slice(2)

function jpegSize(buf) {
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
    const len = buf.readUInt16BE(i + 2)
    if (len <= 0) break
    i += 2 + len
  }
  return null
}

function webpSize(buf) {
  const fourcc = buf.toString('ascii', 12, 16)
  if (fourcc === 'VP8X') {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
    return { width: w, height: h }
  }
  if (fourcc === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (fourcc === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return null
}

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DSH-probe/1.0)' } })
    const buf = Buffer.from(await res.arrayBuffer())
    const head = buf.slice(0, 4).toString('hex')
    let size = null
    let kind = 'unknown'
    if (head.startsWith('ffd8ff')) { kind = 'jpeg'; size = jpegSize(buf) }
    else if (head === '89504e47') {
      kind = 'png'
      size = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    } else if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
      kind = 'webp'
      size = webpSize(buf)
    }
    const mb = (buf.length / 1048576).toFixed(2)
    console.log(
      `${res.status} | ${kind} | ${size ? `${size.width}x${size.height}` : 'dims?'} | ${buf.length} B (${mb} MB) | ${url}`,
    )
  } catch (err) {
    console.log(`ERR | ${err.cause?.code ?? ''} ${err.message} | ${url}`)
  }
}
