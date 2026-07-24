import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  buildSearchIndex,
  normalizeSearchTerm,
  validateCulturePack,
  validateFeaturedPatternPack,
  verifyEncodedAsset,
} from "./sky-content/sky-content-lib.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, "../..");
const SOURCE_DIR = join(SCRIPT_DIR, "sky-content");
const OUTPUT_DIR = join(
  ROOT_DIR,
  "backend/services/astronomy-service/src/main/resources/catalogs/sky-content",
);
const NAKED_EYE_PATH = join(
  ROOT_DIR,
  "backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/catalog.json.gz",
);

const VERSION = "2026.07.1";
const PUBLISHED_AT = "2026-07-24T00:00:00Z";

async function main() {
  const [chinese, western, featuredPatterns, supplementalHipparcos, nakedEye] = await Promise.all([
    readJson(join(SOURCE_DIR, "cultures/chinese-traditional.json")),
    readJson(join(SOURCE_DIR, "cultures/western-iau.json")),
    readJson(join(SOURCE_DIR, "featured-patterns.json")),
    readJson(join(SOURCE_DIR, "supplemental-hipparcos-ids.json")),
    readFile(NAKED_EYE_PATH).then((bytes) => JSON.parse(gunzipSync(bytes).toString("utf8"))),
  ]);
  const culturePacks = [chinese, western];
  assert(supplementalHipparcos.version === VERSION, "Supplemental HIP version does not match build version");
  assert(
    supplementalHipparcos.sourceVersion === "014fbb5e59233d133c22f9811af96b67d05a95c9",
    "Supplemental HIP references are not pinned to the expected Stellarium commit",
  );
  const catalogObjectIds = new Set(nakedEye.stars.map((star) => star.id));
  const knownObjectIds = new Set([...catalogObjectIds, ...supplementalHipparcos.objectIds]);
  for (const culture of culturePacks) {
    validateCulturePack(culture, { knownObjectIds });
    assert(culture.version === VERSION, `${culture.id} version does not match build version ${VERSION}`);
  }
  const cultureIds = new Set(culturePacks.map((culture) => culture.id));
  validateFeaturedPatternPack(featuredPatterns, { catalogObjectIds, cultureIds });
  assert(featuredPatterns.version === VERSION, "Featured-pattern version does not match build version");

  const searchIndex = buildSearchIndex(culturePacks, VERSION);
  assertSearchTarget(searchIndex, "织女星", "HIP:91262");
  assertSearchTarget(searchIndex, "辇道增七", "HIP:95947");
  assertSearchTarget(searchIndex, "Vega", "HIP:91262");

  await mkdir(OUTPUT_DIR, { recursive: true });
  const assets = [];
  assets.push(await writeAsset({
    assetId: "culture-chinese-traditional",
    assetType: "culture",
    cultureId: chinese.id,
    value: chinese,
    recordCounts: cultureCounts(chinese),
  }));
  assets.push(await writeAsset({
    assetId: "culture-western-iau",
    assetType: "culture",
    cultureId: western.id,
    value: western,
    recordCounts: cultureCounts(western),
  }));
  assets.push(await writeAsset({
    assetId: "search-index",
    assetType: "search-index",
    value: searchIndex,
    recordCounts: { entries: searchIndex.entries.length, collisions: searchIndex.collisions.length },
  }));
  assets.push(await writeAsset({
    assetId: "featured-patterns",
    assetType: "featured-patterns",
    value: featuredPatterns,
    recordCounts: { patterns: featuredPatterns.patterns.length },
  }));

  const manifest = {
    schemaVersion: 1,
    catalogId: "sky-content",
    version: VERSION,
    defaultCultureId: "chinese-traditional",
    cultureIds: ["chinese-traditional", "western-iau"],
    searchIndexAssetId: "search-index",
    featuredPatternsAssetId: "featured-patterns",
    nameFallbackOrder: [
      "exact-interface-language",
      "base-interface-language",
      "culture-default-language",
      "en",
      "first-name",
    ],
    assets,
    publishedAt: PUBLISHED_AT,
  };
  await writeFile(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    version: VERSION,
    cultures: Object.fromEntries(culturePacks.map((culture) => [culture.id, cultureCounts(culture)])),
    searchEntries: searchIndex.entries.length,
    searchCollisions: searchIndex.collisions.length,
    featuredPatterns: featuredPatterns.patterns.length,
    assets: assets.map(({ assetId, contentLength, decodedContentLength, sha256 }) => ({
      assetId,
      contentLength,
      decodedContentLength,
      sha256,
    })),
  }, null, 2));
}

async function writeAsset({ assetId, assetType, cultureId, value, recordCounts }) {
  const decodedBytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  const encodedBytes = gzipSync(decodedBytes, { level: 9, mtime: 0 });
  const descriptor = {
    assetId,
    assetType,
    ...(cultureId ? { cultureId } : {}),
    version: VERSION,
    downloadUrl: `/api/astronomy/catalogs/sky-content/${assetId}/${VERSION}`,
    mediaType: "application/json",
    contentEncoding: "gzip",
    sha256: sha256(encodedBytes),
    contentLength: encodedBytes.length,
    decodedSha256: sha256(decodedBytes),
    decodedContentLength: decodedBytes.length,
    recordCounts,
  };
  verifyEncodedAsset(encodedBytes, descriptor);
  const decodedRoundTrip = gunzipSync(encodedBytes);
  assert(decodedRoundTrip.equals(decodedBytes), `${assetId} gzip round trip changed the source bytes`);
  await writeFile(join(OUTPUT_DIR, `${assetId}.json.gz`), encodedBytes);
  return descriptor;
}

function cultureCounts(culture) {
  return {
    starNameRecords: culture.starNames.length,
    figures: culture.figures.length,
    groups: culture.groups.length,
    regions: culture.regions.length,
  };
}

function assertSearchTarget(searchIndex, term, expectedObjectId) {
  const normalizedTerm = normalizeSearchTerm(term);
  const objectIds = new Set(
    searchIndex.entries
      .filter((entry) => entry.normalizedTerm === normalizedTerm)
      .map((entry) => entry.objectId),
  );
  assert(
    objectIds.has(expectedObjectId),
    `Search acceptance term ${term} did not resolve to ${expectedObjectId}`,
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
