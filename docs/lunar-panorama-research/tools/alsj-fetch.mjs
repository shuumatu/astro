/**
 * Fetch pages slowly, with retries, and print their visible text. The Apollo Lunar Surface Journal
 * answers 429 if it is hit quickly, so this paces itself and gives up gracefully.
 *
 * Usage: node docs/lunar-panorama-research/tools/alsj-fetch.mjs <url> [<url> ...]
 */
const urls = process.argv.slice(2)
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; moon-demo-research/1.0; contact: repo maintainer)' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function grab(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: UA })
      if (res.status === 429) {
        const wait = 6000 * attempt
        console.log(`  [429 on attempt ${attempt}, waiting ${wait / 1000}s]`)
        await sleep(wait)
        continue
      }
      return { status: res.status, html: await res.text() }
    } catch (err) {
      console.log(`  [${err.cause?.code ?? err.message} on attempt ${attempt}]`)
      await sleep(4000 * attempt)
    }
  }
  return { status: 0, html: '' }
}

function toLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(tr|p|div|h\d|li|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&deg;/g, '°')
    .replace(/&#176;/g, '°')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

for (const url of urls) {
  const { status, html } = await grab(url)
  console.log(`\n================ ${status} ${url} (${html.length} bytes)`)
  if (!html) continue
  const lines = toLines(html)
  // Print the lines most likely to carry a heading, then the opening lines for context.
  const directional = lines.filter((line) =>
    /azimuth|bearing|heading|\b(N|S|E|W){1,3}\b|toward|looking|pan(?:orama)?/i.test(line),
  )
  console.log(`--- ${lines.length} lines, ${directional.length} directional ---`)
  for (const line of directional.slice(0, 45)) console.log('  ' + line.slice(0, 240))
  await sleep(6000)
}
