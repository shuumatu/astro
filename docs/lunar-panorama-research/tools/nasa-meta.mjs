/**
 * Read the descriptive metadata NASA publishes for an image asset.
 * Usage: node docs/lunar-panorama-research/tools/nasa-meta.mjs <nasaId> [<nasaId> ...]
 * Prints the title, description, date, centre and true dimensions for each.
 *
 * Requires NODE_USE_ENV_PROXY=1 in this environment, or the request bypasses the proxy.
 */
if (process.env.NODE_USE_ENV_PROXY !== '1' && process.env.MOON_ALLOW_DIRECT !== '1') {
  console.error('Refusing to run: set NODE_USE_ENV_PROXY=1 (and HTTP(S)_PROXY) first.')
  process.exit(2)
}

const ids = process.argv.slice(2)

for (const id of ids) {
  const url = `https://images-assets.nasa.gov/image/${id}/metadata.json`
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DSH-probe/1.0)' } })
    if (!res.ok) {
      console.log(`=== ${id}: HTTP ${res.status}`)
      continue
    }
    const json = await res.json()
    const pick = (key) => json[key] ?? json[`AVAIL:${key}`] ?? json[`IPTC:${key}`]
    console.log(`\n=== ${id}`)
    console.log(`  size   : ${pick('ImageSize') ?? pick('Composite:ImageSize') ?? `${pick('ImageWidth')}x${pick('ImageHeight')}`}`)
    console.log(`  bytes  : ${pick('FileSize') ?? '-'}`)
    console.log(`  date   : ${pick('DateCreated') ?? pick('FileModifyDate') ?? '-'}`)
    console.log(`  center : ${pick('Center') ?? '-'}  photographer: ${pick('Photographer') ?? '-'}`)
    console.log(`  title  : ${(pick('Title') ?? '').slice(0, 400)}`)
    console.log(`  desc   : ${(pick('Description') ?? pick('Caption-Abstract') ?? '').slice(0, 900)}`)
  } catch (err) {
    console.log(`=== ${id}: ERR ${err.message}`)
  }
}
