/**
 * NASA images API helper: search, then list asset variants for the first N results.
 * Usage: node docs/lunar-panorama-research/tools/nasa-search.mjs "<query>" [limit]
 */
const API = 'https://images-api.nasa.gov'
const query = process.argv[2] ?? 'apollo panorama'
const limit = Number(process.argv[3] ?? 5)

const url = `${API}/search?q=${encodeURIComponent(query)}&media_type=image&page_size=100`
const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DSH-probe/1.0)' } })
const json = await res.json()
const items = json.collection?.items ?? []
console.log(`# query="${query}" total=${json.collection?.metadata?.total_hits} returned=${items.length}`)
for (const item of items.slice(0, limit)) {
  const d = item.data?.[0] ?? {}
  console.log(`\n## ${d.nasa_id} | ${d.title}`)
  console.log(`   date=${d.date_created} center=${d.center}`)
  console.log(`   desc=${(d.description ?? '').replace(/\s+/g, ' ').slice(0, 220)}`)
  const assetRes = await fetch(d.id ? `${API}/asset/${d.nasa_id}` : item.href, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DSH-probe/1.0)' },
  })
  const asset = await assetRes.json()
  for (const href of asset) console.log(`   asset: ${href}`)
}
