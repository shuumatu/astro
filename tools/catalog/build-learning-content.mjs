import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

// This subset is intentionally bundled: the learning course must not depend
// on a running catalog service. Run from any directory after rebuilding catalogs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const base = 'backend/services/astronomy-service/src/main/resources/catalogs/naked-eye'
const [manifest, western, chinese, compressed, supplement] = await Promise.all([
  readJson(`${base}/manifest.json`),
  readJson('tools/catalog/sky-content/cultures/western-iau.json'),
  readJson('tools/catalog/sky-content/cultures/chinese-traditional.json'),
  readFile(resolve(root, `${base}/catalog.json.gz`)),
  readJson('tools/catalog/learning-star-supplement.json'),
])
const catalog = JSON.parse(gunzipSync(compressed).toString('utf8'))
// Preserve the original core order, then follow the neighboring-sky and
// southern-sky sequence in docs/sky-memory-curriculum.md.
const codes = [
  'UMa', 'UMi', 'Cas', 'Ori', 'CMa', 'CMi', 'Tau', 'Aur', 'Gem', 'Boo', 'Vir', 'Leo', 'Lyr', 'Cyg', 'Aql', 'Sco', 'Sgr', 'Peg', 'And', 'Per', 'PsA',
  'Cep', 'Dra', 'Cam', 'Lyn',
  'CVn', 'Com', 'CrB', 'Crv', 'Crt', 'Hya', 'Sex', 'LMi',
  'Her', 'Oph', 'Ser', 'Lib', 'Sct', 'Sge', 'Del', 'Vul', 'CrA',
  'Ari', 'Tri', 'Psc', 'Aqr', 'Cap', 'Equ', 'Lac', 'Cet',
  'Cnc', 'Mon', 'Lep', 'Col', 'Eri',
  'Cru', 'Cen', 'Mus', 'TrA', 'Cir', 'Lup', 'Ara', 'Nor',
  'Car', 'Vel', 'Pup', 'Pyx', 'Ant', 'Vol', 'Pic',
  'Phe', 'Scl', 'For', 'Hor', 'Cae', 'Ret', 'Dor', 'Hyi',
  'Gru', 'Tuc', 'Pav', 'Ind', 'Mic', 'Tel', 'Aps', 'Cha', 'Oct', 'Men',
]
if (codes.length !== 88 || new Set(codes).size !== 88) throw new Error('Expected all 88 distinct IAU constellations')
const figures = codes.map((code) => {
  const figure = western.figures.find((entry) => entry.iauCode === code)
  if (!figure) throw new Error(`Missing constellation ${code}`)
  return { code, name: figure.names.find((entry) => entry.language === 'zh-CN').value, paths: figure.paths }
})
const representatives = new Set([39, 40, 41, 65, 83, 93, 149, 213, 232, 234, 263, 266, 268, 304]
  .map(id => `asterism-${String(id).padStart(3, '0')}`))
const chineseFigures = chinese.figures.filter(figure => ['lunar-mansion', 'enclosure-wall'].includes(figure.type) || representatives.has(figure.id))
  .map(figure => ({ id: figure.id, name: figure.names.find(entry => entry.language === 'zh-CN').value, type: figure.type, paths: figure.paths }))
if (chineseFigures.length !== 48) throw new Error('Expected 28 mansions, 6 enclosure walls and 14 representative asterisms')
const vertexIds = new Set([...figures, ...chineseFigures].flatMap((figure) => figure.paths.flat()))
const catalogIds = new Set(catalog.stars.map((star) => star.id))
for (const star of supplement.stars) {
  if (catalogIds.has(star.id)) throw new Error(`Learning supplement duplicates catalog star ${star.id}`)
  if (![star.raDeg, star.decDeg, star.visualMagnitude, star.colorIndex, star.epochYear].every(Number.isFinite)) throw new Error(`Invalid supplement ${star.id}`)
  catalog.stars.push(star)
  catalogIds.add(star.id)
}
for (const id of vertexIds) {
  if (!catalogIds.has(id)) throw new Error(`Missing figure star ${id}`)
}
const westernNames = new Map(western.starNames.map((entry) => [entry.objectId, entry.names]))
const chineseNames = new Map(chinese.starNames.map((entry) => [entry.objectId, entry.names]))
const primaryNames = {
  'HIP:11767': '北极星', 'HIP:54061': '天枢', 'HIP:53910': '天璇',
  'HIP:58001': '天玑', 'HIP:59774': '天权', 'HIP:62956': '玉衡',
  'HIP:65378': '开阳', 'HIP:67301': '摇光',
  'HIP:27989': '参宿四', 'HIP:24436': '参宿七', 'HIP:32349': '天狼星',
  'HIP:37279': '南河三', 'HIP:21421': '毕宿五', 'HIP:24608': '五车二',
  'HIP:36850': '北河二', 'HIP:37826': '北河三', 'HIP:69673': '大角星',
  'HIP:65474': '角宿一', 'HIP:49669': '轩辕十四', 'HIP:57632': '五帝座一',
  'HIP:91262': '织女一', 'HIP:102098': '天津四', 'HIP:97649': '河鼓二',
  'HIP:80763': '心宿二', 'HIP:113368': '北落师门',
  'HIP:30438': '老人星',
}
const courseAliases = { 'HIP:91262': ['织女星'], 'HIP:97649': ['牛郎星'], 'HIP:69673': ['大角'], 'HIP:32349': ['天狼'] }
const stars = catalog.stars
  .filter((star) => star.visualMagnitude <= 5 || vertexIds.has(star.id))
  .map((star) => {
    const westernEntries = westernNames.get(star.id) ?? []
    const chineseEntries = chineseNames.get(star.id) ?? []
    const preferred = westernEntries.find((entry) => entry.language === 'zh-CN' && entry.preferred)
      ?? chineseEntries.find((entry) => entry.language === 'zh-CN' && entry.preferred)
      ?? westernEntries.find((entry) => entry.language === 'en' && entry.preferred)
    const name = primaryNames[star.id] ?? preferred?.value ?? star.id
    const traditionalName = chineseEntries.find(entry => entry.language === 'zh-CN' && entry.preferred)?.value
    const aliases = [...new Set([...westernEntries, ...chineseEntries]
      .filter((entry) => ['zh-CN', 'zh-TW', 'en'].includes(entry.language))
      .map((entry) => entry.value).concat(courseAliases[star.id] ?? []))].filter((value) => value !== name)
    return {
      id: star.id, name, ...(traditionalName ? { traditionalName } : {}), aliases, raDeg: star.raDeg, decDeg: star.decDeg,
      magnitude: star.visualMagnitude,
      colorIndex: Number.isFinite(star.colorIndex) ? star.colorIndex : null,
      epochYear: star.epochYear,
    }
  })

const data = {
  schemaVersion: 1,
  sourceVersion: { catalog: manifest.version, western: western.version, chinese: chinese.version },
  referenceFrame: catalog.referenceFrame,
  coordinateNote: '坐标保留各星目录历元，仅用于静态形状学习；不表示此时此地的可见天空。',
  sources: [
    ...manifest.sources.map((source) => ({ title: source.catalog, url: source.url, attribution: source.credit, version: source.release })),
    ...western.sources.filter((source) => ['stellarium-western', 'iau-wgsn', 'hkspm-bright-stars', 'hkspm-western-constellations'].includes(source.id)),
    ...chinese.sources.filter((source) => source.id === 'stellarium-chinese'),
    ...supplement.sources,
  ],
  figures,
  chineseFigures,
  stars,
}
const output = resolve(root, 'frontend/src/features/sky-learning/learning-stars.json')
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
console.log(`Wrote ${stars.length} catalog stars, ${figures.length} constellation figures and ${chineseFigures.length} Chinese figures to ${output}`)
