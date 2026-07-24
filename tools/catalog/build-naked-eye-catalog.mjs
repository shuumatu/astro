import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "../..");
const CACHE_DIR = join(ROOT_DIR, "data/catalog-cache");
const OUTPUT_DIR = join(
  ROOT_DIR,
  "backend/services/astronomy-service/src/main/resources/catalogs/naked-eye",
);

const CATALOG_VERSION = "2026.07.2";
const PUBLISHED_AT = "2026-07-24T00:00:00Z";
const VISUAL_MAGNITUDE_LIMIT = 6.5;
const GAIA_MAGNITUDE_LIMIT = 7.5;

const HIPPARCOS_QUERY = `
SELECT
  HIP AS hip_id,
  Vmag AS visual_magnitude,
  RAICRS AS hip_ra_deg,
  DEICRS AS hip_dec_deg,
  Plx AS hip_parallax_mas,
  pmRA AS hip_pmra_mas_per_year,
  pmDE AS hip_pmdec_mas_per_year,
  "B-V" AS color_index,
  HD AS hd_id,
  SpType AS spectral_type
FROM "I/239/hip_main"
WHERE Vmag <= ${VISUAL_MAGNITUDE_LIMIT}
ORDER BY HIP
`.trim();

const HIPPARCOS_2_QUERY = `
SELECT
  HIP AS hip_id,
  RArad AS hip2_ra_deg,
  DErad AS hip2_dec_deg,
  Plx AS hip2_parallax_mas,
  pmRA AS hip2_pmra_mas_per_year,
  pmDE AS hip2_pmdec_mas_per_year
FROM "I/311/hip2"
ORDER BY HIP
`.trim();

const GAIA_QUERY = `
SELECT
  gs.source_id AS gaia_dr3_id,
  gs.ra AS gaia_ra_deg,
  gs.dec AS gaia_dec_deg,
  gs.pmra AS gaia_pmra_mas_per_year,
  gs.pmdec AS gaia_pmdec_mas_per_year,
  gs.parallax AS gaia_parallax_mas,
  hip.original_ext_source_id AS hip_id,
  hip.angular_distance AS hip_angular_distance
FROM gaiadr3.hipparcos2_best_neighbour AS hip
INNER JOIN gaiadr3.gaia_source AS gs
  ON hip.source_id = gs.source_id
WHERE gs.phot_g_mean_mag <= ${GAIA_MAGNITUDE_LIMIT}
`.trim();

const TYCHO_QUERY = `
SELECT
  hip.original_ext_source_id AS hip_id,
  hip.source_id AS gaia_dr3_id,
  tyc.original_ext_source_id AS tycho2_id,
  tyc.angular_distance AS tycho_angular_distance
FROM gaiadr3.hipparcos2_best_neighbour AS hip
INNER JOIN gaiadr3.tycho2tdsc_merge_best_neighbour AS tyc
  ON hip.source_id = tyc.source_id
`.trim();

const VIZIER_TAP_URL = createTapUrl(
  "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync",
  HIPPARCOS_QUERY,
);
const VIZIER_HIPPARCOS_2_TAP_URL = createTapUrl(
  "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync",
  HIPPARCOS_2_QUERY,
);
const GAIA_TAP_URL = createTapUrl(
  "https://gea.esac.esa.int/tap-server/tap/sync",
  GAIA_QUERY,
);
const GAIA_TYCHO_TAP_URL = createTapUrl(
  "https://gea.esac.esa.int/tap-server/tap/sync",
  TYCHO_QUERY,
);
const inputs = {
  hipparcos: {
    cacheName: "hipparcos-bright.csv",
    url: VIZIER_TAP_URL,
    validate: (text) => validateCsv(text, ["hip_id", "visual_magnitude", "color_index"]),
  },
  hipparcos2: {
    cacheName: "hipparcos-2.csv",
    url: VIZIER_HIPPARCOS_2_TAP_URL,
    validate: (text) => validateCsv(text, ["hip_id", "hip2_ra_deg", "hip2_pmra_mas_per_year"]),
  },
  gaia: {
    cacheName: "gaia-dr3-hipparcos-bright.csv",
    url: GAIA_TAP_URL,
    validate: (text) => validateCsv(text, ["gaia_dr3_id", "hip_id", "hip_angular_distance"]),
  },
  tycho: {
    cacheName: "gaia-dr3-hipparcos-tycho.csv",
    url: GAIA_TYCHO_TAP_URL,
    validate: (text) => validateCsv(text, ["hip_id", "gaia_dr3_id", "tycho2_id", "tycho_angular_distance"]),
  },
};

async function main() {
  const refresh = process.argv.includes("--refresh");
  await Promise.all([mkdir(CACHE_DIR, { recursive: true }), mkdir(OUTPUT_DIR, { recursive: true })]);

  const [hipparcosText, hipparcos2Text, gaiaText, tychoText] = await Promise.all(
    Object.values(inputs).map((input) => loadInput(input, refresh)),
  );

  const hipparcosRows = parseCsv(hipparcosText);
  const hipparcos2Rows = parseCsv(hipparcos2Text);
  const gaiaRows = parseCsv(gaiaText);
  const tychoRows = parseCsv(tychoText);
  const stars = buildStars(hipparcosRows, hipparcos2Rows, gaiaRows, tychoRows);

  assert(stars.length > 8_000 && stars.length < 10_000, `Unexpected star count: ${stars.length}`);

  const catalog = {
    schemaVersion: 2,
    catalogId: "naked-eye",
    referenceFrame: "ICRS",
    visualMagnitudeLimit: VISUAL_MAGNITUDE_LIMIT,
    stars,
  };
  const catalogBytes = Buffer.from(`${JSON.stringify(catalog)}\n`, "utf8");
  const decodedSha256 = createHash("sha256").update(catalogBytes).digest("hex");
  const encodedBytes = gzipSync(catalogBytes, { level: 9, mtime: 0 });
  const sha256 = createHash("sha256").update(encodedBytes).digest("hex");
  const catalogPath = join(OUTPUT_DIR, "catalog.json.gz");
  await writeFile(catalogPath, encodedBytes);

  const sourceCredits = [
    {
      catalog: "Hipparcos Catalogue",
      release: "I/239 (ESA 1997)",
      url: "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239",
      credit: "ESA, 1997, The Hipparcos and Tycho Catalogues",
    },
    {
      catalog: "Hipparcos-2",
      release: "I/311 (van Leeuwen 2007)",
      url: "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311",
      credit: "F. van Leeuwen, 2007, Hipparcos, the New Reduction",
    },
    {
      catalog: "Gaia",
      release: "DR3",
      url: "https://www.cosmos.esa.int/web/gaia/dr3",
      credit: "ESA/Gaia/DPAC",
    },
  ];
  const manifest = {
    schemaVersion: 2,
    catalogId: "naked-eye",
    version: CATALOG_VERSION,
    downloadUrl: `/api/astronomy/catalogs/naked-eye/${CATALOG_VERSION}`,
    mediaType: "application/json",
    contentEncoding: "gzip",
    sha256,
    contentLength: encodedBytes.length,
    decodedSha256,
    decodedContentLength: catalogBytes.length,
    starCount: stars.length,
    sources: sourceCredits,
    publishedAt: PUBLISHED_AT,
  };
  await writeFile(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const sourceCounts = stars.reduce((counts, star) => {
    counts[star.astrometrySource] ??= [];
    counts[star.astrometrySource].push(star);
    return counts;
  }, {});
  console.log(
    JSON.stringify(
      {
        version: CATALOG_VERSION,
        stars: stars.length,
        astrometry: Object.fromEntries(
          Object.entries(sourceCounts).map(([source, records]) => [source, records.length]),
        ),
        uncompressedBytes: catalogBytes.length,
        compressedBytes: encodedBytes.length,
        sha256,
        decodedSha256,
      },
      null,
      2,
    ),
  );
}

function createTapUrl(endpoint, query) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    REQUEST: "doQuery",
    LANG: "ADQL",
    FORMAT: "csv",
    QUERY: query,
  }).toString();
  return url.toString();
}

async function loadInput(input, refresh) {
  const cachePath = join(CACHE_DIR, input.cacheName);
  if (!refresh) {
    try {
      const cached = await readFile(cachePath, "utf8");
      input.validate(cached);
      return cached;
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`Ignoring invalid cache ${input.cacheName}: ${error.message}`);
      }
    }
  }

  console.log(`Downloading ${input.cacheName}`);
  const text = await fetchText(input.url);
  input.validate(text);
  await writeFile(cachePath, text, "utf8");
  return text;
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "astro-catalog-builder/1.0" },
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) {
        const details = (await response.text()).slice(0, 500).replaceAll(/\s+/g, " ");
        throw new Error(`HTTP ${response.status}: ${details}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_000));
      }
    }
  }
  throw lastError;
}

function validateCsv(text, requiredColumns) {
  const [header = ""] = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1);
  const columns = new Set(parseCsvRow(header));
  for (const required of requiredColumns) {
    assert(columns.has(required), `CSV is missing required column ${required}`);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  assert(!quoted, "CSV ended inside a quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows;
  assert(headers?.length > 0, "CSV is empty");
  return records.map((values, rowIndex) => {
    assert(
      values.length === headers.length,
      `CSV row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}`,
    );
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}

function parseCsvRow(line) {
  const parsed = parseCsv(`${line}\n`);
  if (parsed.length === 0) {
    // parseCsv treats the first row as headers, which is exactly what is needed here.
    return parseHeader(line);
  }
  throw new Error("Expected a single CSV header row");
}

function parseHeader(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function buildStars(hipparcosRows, hipparcos2Rows, gaiaRows, tychoRows) {
  const hipparcos2ByHip = new Map(
    hipparcos2Rows.map((row) => [requiredInteger(row.hip_id, "Hipparcos-2 HIP identifier"), row]),
  );
  const gaiaByHip = new Map();
  for (const row of gaiaRows) {
    const hipId = integerOrNull(row.hip_id);
    if (hipId === null || !hasGaiaFiveParameterAstrometry(row)) {
      continue;
    }
    const existing = gaiaByHip.get(hipId);
    if (
      existing === undefined ||
      numberOrInfinity(row.hip_angular_distance) < numberOrInfinity(existing.hip_angular_distance)
    ) {
      gaiaByHip.set(hipId, row);
    }
  }
  const tychoByHip = new Map();
  const tychoByGaia = new Map();
  for (const row of tychoRows) {
    const hipId = integerOrNull(row.hip_id);
    if (hipId === null || row.tycho2_id === "") {
      continue;
    }
    const existing = tychoByHip.get(hipId);
    if (
      existing === undefined ||
      numberOrInfinity(row.tycho_angular_distance) < numberOrInfinity(existing.tycho_angular_distance)
    ) {
      tychoByHip.set(hipId, row);
    }
    const gaiaDr3Id = row.gaia_dr3_id;
    const gaiaExisting = tychoByGaia.get(gaiaDr3Id);
    if (
      gaiaDr3Id !== "" &&
      (gaiaExisting === undefined ||
        numberOrInfinity(row.tycho_angular_distance) <
          numberOrInfinity(gaiaExisting.tycho_angular_distance))
    ) {
      tychoByGaia.set(gaiaDr3Id, row);
    }
  }

  const excludedHipIds = [];
  const coordinateRows = hipparcosRows.filter((row) => {
    const hipId = requiredInteger(row.hip_id, "HIP identifier");
    const hipparcos2 = hipparcos2ByHip.get(hipId);
    const hasHip2Position = hipparcos2 !== undefined && [
      hipparcos2.hip2_ra_deg,
      hipparcos2.hip2_dec_deg,
    ].every(isFiniteText);
    if (gaiaByHip.has(hipId) || hasHip2Position || [row.hip_ra_deg, row.hip_dec_deg].every(isFiniteText)) {
      return true;
    }
    excludedHipIds.push(hipId);
    return false;
  });
  assert(excludedHipIds.length <= 10, `Too many bright records lack coordinates: ${excludedHipIds.length}`);
  if (excludedHipIds.length > 0) {
    console.warn(`Excluded HIP records without coordinates: ${excludedHipIds.join(", ")}`);
  }

  const ids = new Set();
  const stars = coordinateRows.map((row) => {
    const hipId = requiredInteger(row.hip_id, "HIP identifier");
    assert(!ids.has(hipId), `Duplicate HIP identifier ${hipId}`);
    ids.add(hipId);

    const hipparcos2 = hipparcos2ByHip.get(hipId);
    const gaia = gaiaByHip.get(hipId);
    const hasHip2 = hipparcos2 !== undefined && [
      hipparcos2.hip2_ra_deg,
      hipparcos2.hip2_dec_deg,
      hipparcos2.hip2_pmra_mas_per_year,
      hipparcos2.hip2_pmdec_mas_per_year,
    ].every(isFiniteText);
    const astrometry = gaia
      ? {
          source: "GAIA_DR3",
          epochYear: 2016,
          raDeg: requiredNumber(gaia.gaia_ra_deg, `Gaia RA for HIP ${hipId}`),
          decDeg: requiredNumber(gaia.gaia_dec_deg, `Gaia Dec for HIP ${hipId}`),
          pmRa: numberOrNull(gaia.gaia_pmra_mas_per_year),
          pmDec: numberOrNull(gaia.gaia_pmdec_mas_per_year),
          parallax: numberOrNull(gaia.gaia_parallax_mas),
        }
      : hasHip2
        ? {
            source: "HIPPARCOS_2",
            epochYear: 1991.25,
            raDeg: requiredNumber(hipparcos2.hip2_ra_deg, `Hipparcos-2 RA for HIP ${hipId}`),
            decDeg: requiredNumber(hipparcos2.hip2_dec_deg, `Hipparcos-2 Dec for HIP ${hipId}`),
            pmRa: numberOrNull(hipparcos2.hip2_pmra_mas_per_year),
            pmDec: numberOrNull(hipparcos2.hip2_pmdec_mas_per_year),
            parallax: numberOrNull(hipparcos2.hip2_parallax_mas),
          }
        : {
            source: "HIPPARCOS",
            epochYear: 1991.25,
            raDeg: requiredNumber(row.hip_ra_deg, `Hipparcos RA for HIP ${hipId}`),
            decDeg: requiredNumber(row.hip_dec_deg, `Hipparcos Dec for HIP ${hipId}`),
            pmRa: numberOrNull(row.hip_pmra_mas_per_year),
            pmDec: numberOrNull(row.hip_pmdec_mas_per_year),
            parallax: numberOrNull(row.hip_parallax_mas),
          };

    assert(astrometry.raDeg >= 0 && astrometry.raDeg < 360, `RA out of range for HIP ${hipId}`);
    assert(astrometry.decDeg >= -90 && astrometry.decDeg <= 90, `Dec out of range for HIP ${hipId}`);

    return {
      id: `HIP:${hipId}`,
      hipId,
      gaiaDr3Id: gaia?.gaia_dr3_id || null,
      tycho2Id: gaia
        ? tychoByGaia.get(gaia.gaia_dr3_id)?.tycho2_id || null
        : tychoByHip.get(hipId)?.tycho2_id || null,
      hdId: integerOrNull(row.hd_id),
      raDeg: round(astrometry.raDeg, 8),
      decDeg: round(astrometry.decDeg, 8),
      epochYear: astrometry.epochYear,
      pmRaMasPerYear: roundOrNull(astrometry.pmRa, 5),
      pmDecMasPerYear: roundOrNull(astrometry.pmDec, 5),
      parallaxMas: roundOrNull(astrometry.parallax, 5),
      visualMagnitude: round(requiredNumber(row.visual_magnitude, `V magnitude for HIP ${hipId}`), 3),
      colorIndex: roundOrNull(numberOrNull(row.color_index), 3),
      spectralType: row.spectral_type || null,
      astrometrySource: astrometry.source,
    };
  });

  return stars.sort((left, right) => left.hipId - right.hipId);
}

function hasGaiaFiveParameterAstrometry(row) {
  return [
    row.gaia_ra_deg,
    row.gaia_dec_deg,
    row.gaia_pmra_mas_per_year,
    row.gaia_pmdec_mas_per_year,
  ].every(isFiniteText);
}

function isFiniteText(value) {
  return value !== "" && Number.isFinite(Number(value));
}

function numberOrNull(value) {
  return isFiniteText(value) ? Number(value) : null;
}

function numberOrInfinity(value) {
  return isFiniteText(value) ? Number(value) : Number.POSITIVE_INFINITY;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && Number.isSafeInteger(number) ? number : null;
}

function requiredInteger(value, label) {
  const number = integerOrNull(value);
  assert(number !== null, `Invalid ${label}: ${value}`);
  return number;
}

function requiredNumber(value, label) {
  const number = numberOrNull(value);
  assert(number !== null, `Invalid ${label}: ${value}`);
  return number;
}

function round(value, decimalPlaces) {
  return Number(value.toFixed(decimalPlaces));
}

function roundOrNull(value, decimalPlaces) {
  return value === null ? null : round(value, decimalPlaces);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
