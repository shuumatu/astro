import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSearchIndex,
  latinizeBayerDesignation,
  validateCulturePack,
  validateFeaturedPatternPack,
  verifyEncodedAsset,
} from "./sky-content-lib.mjs";

test("latinizes Greek Bayer designations for keyboard search", () => {
  assert.equal(latinizeBayerDesignation("α CMa"), "Alpha CMa");
  assert.equal(latinizeBayerDesignation("γ1 And"), "Gamma1 And");
  assert.equal(latinizeBayerDesignation("61 Cyg"), null);
});

test("canonical schemas and source packs parse and validate", async () => {
  const [cultureSchema, featuredSchema, chinese, western, featured, supplemental] = await Promise.all([
    readJson(new URL("./schema/sky-culture.schema.json", import.meta.url)),
    readJson(new URL("./schema/featured-patterns.schema.json", import.meta.url)),
    readJson(new URL("./cultures/chinese-traditional.json", import.meta.url)),
    readJson(new URL("./cultures/western-iau.json", import.meta.url)),
    readJson(new URL("./featured-patterns.json", import.meta.url)),
    readJson(new URL("./supplemental-hipparcos-ids.json", import.meta.url)),
  ]);
  assert.equal(cultureSchema.title, "SkyCulturePack");
  assert.equal(featuredSchema.title, "FeaturedPatternPack");
  assert.equal(supplemental.sourceVersion, "014fbb5e59233d133c22f9811af96b67d05a95c9");
  validateCulturePack(chinese);
  validateCulturePack(western);
  validateFeaturedPatternPack(featured, {
    cultureIds: new Set([chinese.id, western.id]),
  });
});

test("rejects an invalid HIP reference", () => {
  const pack = cultureFixture();
  pack.figures[0].paths[0][0] = "HIP:119999";
  assert.throws(
    () => validateCulturePack(pack, { knownObjectIds: new Set(["HIP:1", "HIP:2"]) }),
    /not present in the physical or supplemental Hipparcos reference set/,
  );
});

test("rejects duplicate preferred names in one language", () => {
  const pack = cultureFixture();
  pack.starNames[0].names.push(name("en", "Test alias", "alias", true));
  assert.throws(() => validateCulturePack(pack), /more than one preferred name/);
});

test("rejects a missing source reference", () => {
  const pack = cultureFixture();
  pack.starNames[0].names[0].sourceId = "missing-source";
  assert.throws(() => validateCulturePack(pack), /references missing source/);
});

test("rejects illegal or unclosed region geometry", () => {
  const pack = cultureFixture();
  pack.regions[0].geometry.coordinates[0][0][1] = [181, 0];
  assert.throws(() => validateCulturePack(pack), /number from -180 to 180/);

  const unclosed = cultureFixture();
  unclosed.regions[0].geometry.coordinates[0][0][3] = [1, 1];
  assert.throws(() => validateCulturePack(unclosed), /must be closed/);
});

test("rejects a normalized search conflict on the same object", () => {
  const pack = cultureFixture();
  pack.starNames[0].names.push(name("en", "Test-Star", "official", false));
  assert.throws(() => buildSearchIndex([pack], "test-1"), /Normalized search conflict/);
});

test("preserves homonyms on different objects as explicit collisions", () => {
  const first = cultureFixture();
  const second = cultureFixture("other-culture", "HIP:2");
  const index = buildSearchIndex([first, second], "test-1");
  assert.deepEqual(index.collisions, [{ normalizedTerm: "teststar", objectIds: ["HIP:1", "HIP:2"] }]);
});

test("rejects a featured member absent from the physical catalogue", () => {
  const patterns = patternFixture();
  assert.throws(
    () => validateFeaturedPatternPack(patterns, {
      catalogObjectIds: new Set(["HIP:1", "HIP:2"]),
      cultureIds: new Set(["test-culture"]),
    }),
    /not in the physical star catalogue/,
  );
});

test("rejects an encoded asset checksum mismatch", () => {
  assert.throws(
    () => verifyEncodedAsset(Buffer.from("test"), {
      assetId: "test-asset",
      contentLength: 4,
      sha256: "0".repeat(64),
    }),
    /checksum does not match/,
  );
});

function cultureFixture(id = "test-culture", objectId = "HIP:1") {
  const source = {
    id: "test-source",
    title: "Test source",
    authors: ["Test author"],
    url: "https://example.com/source",
    version: "1",
    license: "CC0-1.0",
    attribution: "Test attribution",
  };
  return {
    schemaVersion: 1,
    id,
    version: "test-1",
    names: [name("en", "Test Culture", "official", true)],
    defaultLanguage: "en",
    descriptions: [{ language: "en", value: "Test description", sourceId: source.id }],
    sources: [source],
    starNames: [{ objectId, labelPriority: 10, names: [name("en", "Test Star", "official", true)] }],
    figures: [{
      id: "test-figure",
      type: "constellation",
      iauCode: "Tst",
      names: [name("en", "Test Figure", "official", true)],
      paths: [[objectId, "HIP:2"]],
      labelAnchor: { objectId },
      rank: 1,
      groupIds: ["test-group"],
      sourceIds: [source.id],
    }],
    groups: [{
      id: "test-group",
      type: "constellation-set",
      names: [name("en", "Test Group", "official", true)],
      members: [{ type: "figure", id: "test-figure" }],
      sourceIds: [source.id],
    }],
    regions: [{
      id: "test-region",
      figureId: "test-figure",
      names: [name("en", "Test Region", "official", true)],
      referenceFrame: "ICRS",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
      },
      sourceIds: [source.id],
    }],
  };
}

function patternFixture() {
  return {
    schemaVersion: 1,
    id: "featured-patterns",
    version: "test-1",
    sources: [cultureFixture().sources[0]],
    patterns: [{
      id: "test-pattern",
      names: [name("en", "Test Pattern", "official", true)],
      memberObjectIds: ["HIP:1", "HIP:2", "HIP:3"],
      paths: [["HIP:1", "HIP:2", "HIP:3", "HIP:1"]],
      labelAnchor: { objectId: "HIP:1" },
      cultureIds: ["test-culture"],
      sourceIds: ["test-source"],
    }],
  };
}

function name(language, value, type, preferred) {
  return { language, value, type, preferred, searchable: true, sourceId: "test-source" };
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}
