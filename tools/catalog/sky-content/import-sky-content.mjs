import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { validateCulturePack } from "./sky-content-lib.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "../../..");
const CULTURE_DIR = join(SCRIPT_DIR, "cultures");
const CACHE_DIR = join(ROOT_DIR, "data/catalog-cache/sky-content");
const STELLARIUM_DIR = join(ROOT_DIR, "data/catalog-cache/stellarium-skycultures");
const NAKED_EYE_PATH = join(
  ROOT_DIR,
  "backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/catalog.json.gz",
);

const PACK_VERSION = "2026.07.1";
const IMPORTED_AT = "2026-07-24";
const STELLARIUM_COMMIT = "014fbb5e59233d133c22f9811af96b67d05a95c9";
const D3_CELESTIAL_COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0";
const IAU_WGSN_URL = "https://iauarchive.eso.org/public/themes/naming_stars/";
const D3_BOUNDARIES_URL =
  `https://raw.githubusercontent.com/ofrohn/d3-celestial/${D3_CELESTIAL_COMMIT}/data/constellations.bounds.json`;

const MANSION_NUMBERS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 34,
]);
const ENCLOSURE_WALLS = new Map([
  [19, "supreme-palace-enclosure"],
  [20, "supreme-palace-enclosure"],
  [21, "heavenly-market-enclosure"],
  [22, "heavenly-market-enclosure"],
  [32, "purple-forbidden-enclosure"],
  [33, "purple-forbidden-enclosure"],
]);

async function main() {
  const refresh = process.argv.includes("--refresh");
  await Promise.all([mkdir(CULTURE_DIR, { recursive: true }), mkdir(CACHE_DIR, { recursive: true })]);
  await verifyStellariumCheckout();

  const [chineseIndex, westernIndex, zhCnPo, zhTwPo, boundaries, iauHtml, nakedEye] =
    await Promise.all([
      readJson(join(STELLARIUM_DIR, "chinese/index.json")),
      readJson(join(STELLARIUM_DIR, "western/index.json")),
      readFile(join(STELLARIUM_DIR, "chinese/po/zh_CN.po"), "utf8"),
      readFile(join(STELLARIUM_DIR, "chinese/po/zh_TW.po"), "utf8"),
      loadCachedText("constellations.bounds.json", D3_BOUNDARIES_URL, refresh).then(JSON.parse),
      loadCachedText("iau-wgsn.html", IAU_WGSN_URL, refresh),
      readFile(NAKED_EYE_PATH).then((bytes) => JSON.parse(gunzipSync(bytes).toString("utf8"))),
    ]);

  const chineseResult = buildChineseCulture(
    chineseIndex,
    parsePo(zhCnPo),
    parsePo(zhTwPo),
  );
  const westernResult = buildWesternCulture(westernIndex, boundaries, iauHtml, nakedEye.stars);
  const physicalObjectIds = new Set(nakedEye.stars.map((star) => star.id));
  const referencedObjectIds = new Set([
    ...collectCultureObjectIds(chineseResult.pack),
    ...collectCultureObjectIds(westernResult.pack),
  ]);
  const supplementalObjectIds = [...referencedObjectIds]
    .filter((objectId) => !physicalObjectIds.has(objectId))
    .sort(compareHipIds);
  const knownObjectIds = new Set([...physicalObjectIds, ...supplementalObjectIds]);
  validateCulturePack(chineseResult.pack, { knownObjectIds });
  validateCulturePack(westernResult.pack, { knownObjectIds });

  await Promise.all([
    writeJson(join(CULTURE_DIR, "chinese-traditional.json"), chineseResult.pack),
    writeJson(join(CULTURE_DIR, "western-iau.json"), westernResult.pack),
    writeJson(join(SCRIPT_DIR, "supplemental-hipparcos-ids.json"), {
      schemaVersion: 1,
      id: "supplemental-hipparcos-ids",
      version: PACK_VERSION,
      sourceId: "stellarium-skycultures",
      sourceVersion: STELLARIUM_COMMIT,
      objectIds: supplementalObjectIds,
    }),
    writeJson(join(SCRIPT_DIR, "import-report.json"), {
      schemaVersion: 1,
      importedAt: IMPORTED_AT,
      upstreams: [
        {
          id: "stellarium-skycultures",
          version: STELLARIUM_COMMIT,
          url: `https://github.com/Stellarium/stellarium-skycultures/tree/${STELLARIUM_COMMIT}`,
        },
        {
          id: "d3-celestial-boundaries",
          version: D3_CELESTIAL_COMMIT,
          url: D3_BOUNDARIES_URL,
        },
        {
          id: "iau-wgsn",
          version: `retrieved-${IMPORTED_AT}`,
          url: IAU_WGSN_URL,
          snapshotSha256: sha256(Buffer.from(iauHtml, "utf8")),
        },
      ],
      counts: {
        chinese: chineseResult.counts,
        western: westernResult.counts,
        supplementalHipparcosIds: supplementalObjectIds.length,
      },
      modifications: [
        "Excluded Stellarium illustrations, thumbnails and long-form mythology.",
        "Converted Stellarium integer HIP paths to HIP:<id> object references.",
        "Expanded Chinese generated star names into explicit zh-CN and zh-TW records.",
        "Added explicit searchable aliases 织女星 and 織女星 for HIP:91262.",
        "Omitted Chinese figures with no HIP path; their count is recorded above.",
        "Merged the two D3-Celestial Serpens polygons into one ICRS MultiPolygon.",
        "Matched IAU WGSN coordinates to the physical catalogue and omitted names without a safe match.",
        "Recorded source-backed HIP references outside the physical catalogue in a pinned supplemental whitelist.",
      ],
    }),
  ]);

  console.log(JSON.stringify({ chinese: chineseResult.counts, western: westernResult.counts }, null, 2));
}

function buildChineseCulture(index, zhCn, zhTw) {
  const sourceId = "stellarium-chinese";
  const source = {
    id: sourceId,
    title: "Stellarium Chinese sky culture",
    authors: ["Karrie Berglund", "Sun Shuwei", "Stellarium contributors"],
    url: `https://github.com/Stellarium/stellarium-skycultures/tree/${STELLARIUM_COMMIT}/chinese`,
    version: STELLARIUM_COMMIT,
    license: "CC-BY-SA (version not specified upstream)",
    attribution:
      "Based on Hong Kong Space Museum star maps and Yi Shitong's Chinese and Western Contrast Star Chart and Catalogue 1950.0; text and lines adapted from Stellarium Sky Cultures.",
  };
  const upstreamToLocalId = new Map();
  const figureTranslations = new Map();
  for (const figure of index.constellations) {
    const number = chineseFigureNumber(figure.id);
    upstreamToLocalId.set(figure.id, `asterism-${String(number).padStart(3, "0")}`);
    if (figure.common_name?.english) {
      figureTranslations.set(figure.common_name.english, {
        zhCn: zhCn.get(figure.common_name.english) || figure.common_name.native,
        zhTw: zhTw.get(figure.common_name.english) || figure.common_name.native,
      });
    }
  }

  const omittedFigures = [];
  const figures = [];
  for (const figure of index.constellations) {
    const number = chineseFigureNumber(figure.id);
    const paths = normalizeHipPaths(figure.lines);
    if (paths.length === 0) {
      omittedFigures.push(figure.id);
      continue;
    }
    const english = figure.common_name?.english || figure.id;
    const groupIds = [];
    let type = "asterism";
    let rank = 2;
    if (MANSION_NUMBERS.has(number)) {
      type = "lunar-mansion";
      rank = 1;
      groupIds.push("twenty-eight-mansions");
    }
    const enclosureId = ENCLOSURE_WALLS.get(number);
    if (enclosureId) {
      type = "enclosure-wall";
      rank = 1;
      groupIds.push(enclosureId, "three-enclosures");
    }
    figures.push({
      id: upstreamToLocalId.get(figure.id),
      type,
      names: cultureNames({
        english,
        native: zhCn.get(english) || figure.common_name?.native,
        traditional: zhTw.get(english) || figure.common_name?.native,
        transliteration: figure.common_name?.pronounce,
        sourceId,
      }),
      paths,
      labelAnchor: { objectId: chooseAnchor(paths) },
      rank,
      groupIds,
      sourceIds: [sourceId],
    });
  }

  const starNames = [];
  for (const [key, upstreamNames] of Object.entries(index.common_names ?? {})) {
    const match = /^HIP (\d+)$/.exec(key);
    if (!match || !Array.isArray(upstreamNames)) continue;
    const names = [];
    for (const [indexInRecord, upstreamName] of upstreamNames.entries()) {
      const english = upstreamName.english;
      if (!english) continue;
      names.push(name("en", english, indexInRecord === 0 ? "translation" : "alias", indexInRecord === 0, sourceId));
      addLocalizedChineseName(names, "zh-CN", translateChineseStarName(english, zhCn, figureTranslations, "zhCn"), sourceId);
      addLocalizedChineseName(names, "zh-TW", translateChineseStarName(english, zhTw, figureTranslations, "zhTw"), sourceId);
    }
    const objectId = `HIP:${match[1]}`;
    if (objectId === "HIP:91262") {
      names.push(name("zh-CN", "织女星", "alias", false, sourceId));
      names.push(name("zh-TW", "織女星", "alias", false, sourceId));
    }
    deduplicateNames(names);
    assignPreferredNamePerLanguage(names);
    if (names.length > 0) {
      starNames.push({
        objectId,
        labelPriority: objectId === "HIP:91262" || objectId === "HIP:95947" ? 100 : 40,
        names,
      });
    }
  }
  starNames.sort(compareObjectIds);

  const mansionMembers = figures
    .filter((figure) => figure.groupIds.includes("twenty-eight-mansions"))
    .map((figure) => ({ type: "figure", id: figure.id }));
  const enclosureGroups = [
    enclosureGroup("purple-forbidden-enclosure", "紫微垣", "紫微垣", "Purple Forbidden Enclosure", figures, sourceId),
    enclosureGroup("supreme-palace-enclosure", "太微垣", "太微垣", "Supreme Palace Enclosure", figures, sourceId),
    enclosureGroup("heavenly-market-enclosure", "天市垣", "天市垣", "Heavenly Market Enclosure", figures, sourceId),
  ];
  const groups = [
    {
      id: "twenty-eight-mansions",
      type: "lunar-mansions",
      names: cultureNames({
        english: "Twenty-Eight Mansions",
        native: "二十八宿",
        traditional: "二十八宿",
        sourceId,
      }),
      members: mansionMembers,
      sourceIds: [sourceId],
    },
    ...enclosureGroups,
    {
      id: "three-enclosures",
      type: "system",
      names: cultureNames({
        english: "Three Enclosures",
        native: "三垣",
        traditional: "三垣",
        sourceId,
      }),
      members: enclosureGroups.map((group) => ({ type: "group", id: group.id })),
      sourceIds: [sourceId],
    },
  ];

  const pack = {
    schemaVersion: 1,
    id: "chinese-traditional",
    version: PACK_VERSION,
    names: cultureNames({
      english: "Chinese Traditional",
      native: "中国传统星空",
      traditional: "中國傳統星空",
      sourceId,
    }),
    defaultLanguage: "zh-CN",
    descriptions: [
      { language: "zh-CN", value: "中国传统三垣、二十八宿与星官体系。", sourceId },
      { language: "zh-TW", value: "中國傳統三垣、二十八宿與星官體系。", sourceId },
      { language: "en", value: "The traditional Chinese Three Enclosures, Twenty-Eight Mansions and asterisms.", sourceId },
    ],
    sources: [source],
    starNames,
    figures,
    groups,
    regions: [],
  };
  return {
    pack,
    counts: {
      starNameRecords: starNames.length,
      figures: figures.length,
      groups: groups.length,
      regions: 0,
      omittedFiguresWithoutHipPaths: omittedFigures.length,
    },
  };
}

function buildWesternCulture(index, boundaries, iauHtml, physicalStars) {
  const stellariumSourceId = "stellarium-western";
  const d3SourceId = "d3-celestial-boundaries";
  const iauSourceId = "iau-wgsn";
  const sources = [
    {
      id: stellariumSourceId,
      title: "Stellarium Western sky culture",
      authors: ["Stellarium contributors"],
      url: `https://github.com/Stellarium/stellarium-skycultures/tree/${STELLARIUM_COMMIT}/western`,
      version: STELLARIUM_COMMIT,
      license: "CC-BY-SA (version not specified upstream)",
      attribution: "Western constellation names and line data adapted from Stellarium Sky Cultures.",
    },
    {
      id: d3SourceId,
      title: "D3-Celestial constellation boundaries",
      authors: ["Olaf Frohn", "D3-Celestial contributors"],
      url: D3_BOUNDARIES_URL,
      version: D3_CELESTIAL_COMMIT,
      license: "BSD-3-Clause",
      attribution: "IAU constellation boundary geometry from D3-Celestial.",
    },
    {
      id: iauSourceId,
      title: "IAU Working Group on Star Names catalogue",
      authors: ["International Astronomical Union Working Group on Star Names"],
      url: IAU_WGSN_URL,
      version: `retrieved-${IMPORTED_AT}`,
      license: "LicenseRef-Citation-Only",
      attribution: "Official star names and coordinates from the IAU WGSN catalogue.",
    },
  ];

  const canonicalIauByLowercase = new Map(
    (boundaries.features ?? []).map((feature) => [feature.id.toLowerCase(), feature.id]),
  );
  const figures = index.constellations.map((figure) => {
    const paths = normalizeHipPaths(figure.lines);
    if (paths.length === 0) throw new Error(`Western constellation ${figure.id} has no HIP path`);
    const iauCode = canonicalIauByLowercase.get(figure.iau.toLowerCase());
    if (!iauCode) throw new Error(`No canonical IAU abbreviation for ${figure.iau}`);
    return {
      id: westernFigureId(iauCode),
      type: "constellation",
      iauCode,
      names: westernNames(figure.common_name, stellariumSourceId),
      paths,
      labelAnchor: { objectId: chooseAnchor(paths) },
      rank: 1,
      groupIds: ["iau-constellations"],
      sourceIds: [stellariumSourceId],
    };
  }).sort((left, right) => left.iauCode.localeCompare(right.iauCode));
  const figureByIau = new Map(figures.map((figure) => [figure.iauCode, figure]));

  const polygonsByIau = new Map();
  for (const feature of boundaries.features ?? []) {
    if (feature.geometry?.type !== "Polygon") throw new Error(`Unexpected boundary geometry for ${feature.id}`);
    const polygons = polygonsByIau.get(feature.id) ?? [];
    polygons.push(feature.geometry.coordinates);
    polygonsByIau.set(feature.id, polygons);
  }
  const regions = [...figureByIau].map(([iauCode, figure]) => {
    const polygons = polygonsByIau.get(iauCode);
    if (!polygons) throw new Error(`No boundary geometry for ${iauCode}`);
    return {
      id: `region-${iauCode.toLowerCase()}`,
      figureId: figure.id,
      names: figure.names,
      referenceFrame: "ICRS",
      geometry: { type: "MultiPolygon", coordinates: polygons },
      sourceIds: [d3SourceId],
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const officialRows = parseIauRows(iauHtml);
  const starNamesByObject = new Map();
  let unmatchedIauNames = 0;
  for (const row of officialRows) {
    const match = nearestPhysicalStar(row.raDeg, row.decDeg, row.visualMagnitude, physicalStars);
    if (!match || match.distanceDeg > 0.08) {
      unmatchedIauNames += 1;
      continue;
    }
    const objectId = `HIP:${match.star.hipId}`;
    const names = starNamesByObject.get(objectId) ?? [];
    names.push(name("en", row.name, "official", names.length === 0, iauSourceId));
    starNamesByObject.set(objectId, names);
  }
  const starNames = [...starNamesByObject]
    .map(([objectId, names]) => ({ objectId, labelPriority: 80, names: deduplicateNames(names) }))
    .sort(compareObjectIds);
  const vega = starNames.find((record) => record.objectId === "HIP:91262");
  if (!vega?.names.some((record) => record.value === "Vega")) {
    throw new Error("IAU WGSN import did not resolve Vega to HIP:91262");
  }

  const pack = {
    schemaVersion: 1,
    id: "western-iau",
    version: PACK_VERSION,
    names: [
      name("en", "Western IAU", "official", true, stellariumSourceId),
      name("zh-CN", "西方 IAU 星空", "translation", true, stellariumSourceId),
      name("zh-TW", "西方 IAU 星空", "translation", true, stellariumSourceId),
    ],
    defaultLanguage: "en",
    descriptions: [
      { language: "en", value: "The 88 modern IAU constellations, their line figures, boundaries and official bright-star names.", sourceId: stellariumSourceId },
      { language: "zh-CN", value: "现代 IAU 88 星座、连线、边界与正式亮星名称。", sourceId: stellariumSourceId },
    ],
    sources,
    starNames,
    figures,
    groups: [
      {
        id: "iau-constellations",
        type: "constellation-set",
        names: [
          name("en", "IAU Constellations", "official", true, stellariumSourceId),
          name("zh-CN", "IAU 星座", "translation", true, stellariumSourceId),
        ],
        members: figures.map((figure) => ({ type: "figure", id: figure.id })),
        sourceIds: [stellariumSourceId],
      },
    ],
    regions,
  };
  return {
    pack,
    counts: {
      starNameRecords: starNames.length,
      officialIauNames: starNames.reduce((count, record) => count + record.names.length, 0),
      unmatchedIauNames,
      figures: figures.length,
      groups: 1,
      regions: regions.length,
      upstreamBoundaryFeatures: boundaries.features?.length ?? 0,
    },
  };
}

function cultureNames({ english, native, traditional, transliteration, sourceId }) {
  const names = [];
  if (native) names.push(name("zh-CN", native, "native", true, sourceId));
  if (traditional) names.push(name("zh-TW", traditional, "native", true, sourceId));
  if (english) names.push(name("en", english, "translation", true, sourceId));
  if (transliteration) names.push(name("zh-Latn", transliteration, "transliteration", true, sourceId));
  return deduplicateNames(names);
}

function westernNames(commonName, sourceId) {
  const names = [name("la", commonName.native, "official", true, sourceId)];
  if (commonName.english !== commonName.native) {
    names.push(name("en", commonName.english, "translation", true, sourceId));
  } else {
    names.push(name("en", commonName.english, "official", true, sourceId));
  }
  return names;
}

function enclosureGroup(id, simplified, traditional, english, figures, sourceId) {
  return {
    id,
    type: "enclosure",
    names: cultureNames({ english, native: simplified, traditional, sourceId }),
    members: figures
      .filter((figure) => figure.groupIds.includes(id))
      .map((figure) => ({ type: "figure", id: figure.id })),
    sourceIds: [sourceId],
  };
}

function addLocalizedChineseName(names, language, value, sourceId) {
  if (!value) return;
  names.push(name(language, value, "native", false, sourceId));
}

function translateChineseStarName(english, translations, figureTranslations, script) {
  const direct = translations.get(english);
  if (direct) return direct;
  const bases = [...figureTranslations.keys()].sort((left, right) => right.length - left.length);
  for (const base of bases) {
    if (!english.startsWith(`${base} `)) continue;
    const suffix = english.slice(base.length + 1);
    const match = /^(?:(Added) )?([IVXLCDM]+)$/.exec(suffix);
    if (!match) continue;
    const localizedBase = figureTranslations.get(base)?.[script];
    if (!localizedBase) continue;
    return `${localizedBase}${match[1] ? "增" : ""}${chineseNumber(romanToInteger(match[2]))}`;
  }
  return undefined;
}

function parsePo(text) {
  const translations = new Map();
  for (const block of text.replaceAll("\r\n", "\n").split(/\n{2,}/)) {
    const msgid = readPoString(block, "msgid");
    const msgstr = readPoString(block, "msgstr");
    if (msgid && msgstr) translations.set(msgid, msgstr);
  }
  return translations;
}

function readPoString(block, keyword) {
  const lines = block.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${keyword} `));
  if (index < 0) return undefined;
  let value = parsePoQuoted(lines[index].slice(keyword.length + 1));
  for (let cursor = index + 1; cursor < lines.length && lines[cursor].startsWith('"'); cursor += 1) {
    value += parsePoQuoted(lines[cursor]);
  }
  return value;
}

function parsePoQuoted(value) {
  return JSON.parse(value);
}

function parseIauRows(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => decodeHtml(stripTags(match[1])).trim());
    if (cells.length < 10) continue;
    const raDeg = Number(cells[7]);
    const decDeg = Number(cells[8]);
    const visualMagnitude = Number(cells[6]);
    if (!cells[0] || !Number.isFinite(raDeg) || !Number.isFinite(decDeg) || !Number.isFinite(visualMagnitude)) continue;
    rows.push({ name: cells[0], raDeg, decDeg, visualMagnitude });
  }
  if (rows.length < 400) throw new Error(`Expected at least 400 IAU WGSN rows, got ${rows.length}`);
  return rows;
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeHtml(value) {
  const named = new Map([
    ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["nbsp", " "],
  ]);
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named.get(entity.toLowerCase()) ?? `&${entity};`;
  });
}

function nearestPhysicalStar(raDeg, decDeg, visualMagnitude, stars) {
  let nearest;
  for (const star of stars) {
    if (Math.abs(star.decDeg - decDeg) > 0.15) continue;
    if (Math.abs(star.visualMagnitude - visualMagnitude) > 1) continue;
    const distanceDeg = angularDistanceDeg(raDeg, decDeg, star.raDeg, star.decDeg);
    if (!nearest || distanceDeg < nearest.distanceDeg) nearest = { star, distanceDeg };
  }
  return nearest;
}

function angularDistanceDeg(ra1, dec1, ra2, dec2) {
  const radians = Math.PI / 180;
  const dec1Rad = dec1 * radians;
  const dec2Rad = dec2 * radians;
  const deltaRa = (ra1 - ra2) * radians;
  const cosine =
    Math.sin(dec1Rad) * Math.sin(dec2Rad) +
    Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / radians;
}

function normalizeHipPaths(lines = []) {
  return lines
    .map((line) => line.filter(Number.isInteger).map((hipId) => `HIP:${hipId}`))
    .map((path) => path.filter((objectId, index) => index === 0 || objectId !== path[index - 1]))
    .filter((path) => path.length > 0);
}

function chooseAnchor(paths) {
  const longest = paths.reduce((selected, path) => path.length > selected.length ? path : selected, paths[0]);
  return longest[Math.floor((longest.length - 1) / 2)];
}

function westernFigureId(iauCode) {
  return `constellation-${iauCode.toLowerCase()}`;
}

function chineseFigureNumber(value) {
  const match = /^CON chinese (\d{3})$/.exec(value);
  if (!match) throw new Error(`Unexpected Chinese figure ID: ${value}`);
  return Number(match[1]);
}

function name(language, value, type, preferred, sourceId) {
  return { language, value, type, preferred, searchable: true, sourceId };
}

function deduplicateNames(names) {
  const keys = new Set();
  let writeIndex = 0;
  for (const candidate of names) {
    const key = [candidate.language, candidate.type, candidate.value].join("\u0000");
    if (keys.has(key)) continue;
    keys.add(key);
    names[writeIndex] = candidate;
    writeIndex += 1;
  }
  names.length = writeIndex;
  return names;
}

function assignPreferredNamePerLanguage(names) {
  const seen = new Set();
  for (const candidate of names) {
    candidate.preferred = !seen.has(candidate.language);
    seen.add(candidate.language);
  }
}

function compareObjectIds(left, right) {
  return Number(left.objectId.slice(4)) - Number(right.objectId.slice(4));
}

function compareHipIds(left, right) {
  return Number(left.slice(4)) - Number(right.slice(4));
}

function collectCultureObjectIds(culture) {
  const objectIds = new Set(culture.starNames.map((record) => record.objectId));
  for (const figure of culture.figures) {
    for (const path of figure.paths) {
      for (const objectId of path) objectIds.add(objectId);
    }
  }
  return objectIds;
}

function romanToInteger(value) {
  const digits = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    const current = digits[value[index]];
    const next = digits[value[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

function chineseNumber(value) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value];
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  if (value < 100) return `${digits[Math.floor(value / 10)]}十${value % 10 === 0 ? "" : digits[value % 10]}`;
  return String(value);
}

async function verifyStellariumCheckout() {
  try {
    const shallow = await readFile(join(STELLARIUM_DIR, ".git/shallow"), "utf8");
    if (!shallow.split(/\s+/).includes(STELLARIUM_COMMIT)) {
      throw new Error(`checkout is not pinned to ${STELLARIUM_COMMIT}`);
    }
  } catch (error) {
    throw new Error(
      `Expected a sparse Stellarium checkout at ${STELLARIUM_DIR} pinned to ${STELLARIUM_COMMIT}: ${error.message}`,
    );
  }
}

async function loadCachedText(cacheName, url, refresh) {
  const path = join(CACHE_DIR, cacheName);
  if (!refresh) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const response = await fetch(url, {
    headers: { "User-Agent": "astro-sky-content-importer/1.0" },
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  const text = await response.text();
  await writeFile(path, text, "utf8");
  return text;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
