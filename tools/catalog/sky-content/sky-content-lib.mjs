const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const HIP_PATTERN = /^HIP:([1-9][0-9]*)$/;
const NAME_TYPES = new Set(["native", "official", "translation", "transliteration", "alias"]);
const MAX_HIP_ID = 120_404;

export function normalizeSearchTerm(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function validateCulturePack(pack, { knownObjectIds } = {}) {
  requireRecord(pack, "culture pack");
  equal(pack.schemaVersion, 1, "culture pack.schemaVersion");
  requireId(pack.id, "culture pack.id");
  requireVersion(pack.version, "culture pack.version");
  requireLanguage(pack.defaultLanguage, "culture pack.defaultLanguage");

  const sources = validateSources(pack.sources, `${pack.id}.sources`);
  validateNames(pack.names, sources, `${pack.id}.names`);
  requireArray(pack.descriptions, `${pack.id}.descriptions`, 1);
  for (const [index, description] of pack.descriptions.entries()) {
    requireRecord(description, `${pack.id}.descriptions[${index}]`);
    requireLanguage(description.language, `${pack.id}.descriptions[${index}].language`);
    requireText(description.value, `${pack.id}.descriptions[${index}].value`);
    requireSource(description.sourceId, sources, `${pack.id}.descriptions[${index}].sourceId`);
  }

  const starIds = new Set();
  requireArray(pack.starNames, `${pack.id}.starNames`);
  for (const [index, record] of pack.starNames.entries()) {
    const label = `${pack.id}.starNames[${index}]`;
    requireRecord(record, label);
    requireHip(record.objectId, `${label}.objectId`);
    requireKnownObject(record.objectId, knownObjectIds, `${label}.objectId`);
    unique(starIds, record.objectId, `${pack.id} has duplicate star-name record ${record.objectId}`);
    requireIntegerInRange(record.labelPriority, 0, 1000, `${label}.labelPriority`);
    validateNames(record.names, sources, `${label}.names`);
  }

  const figures = new Map();
  requireArray(pack.figures, `${pack.id}.figures`);
  for (const [index, figure] of pack.figures.entries()) {
    const label = `${pack.id}.figures[${index}]`;
    requireRecord(figure, label);
    requireId(figure.id, `${label}.id`);
    unique(figures, figure.id, `${pack.id} has duplicate figure ${figure.id}`, figure);
    includes(
      ["constellation", "asterism", "enclosure-wall", "lunar-mansion"],
      figure.type,
      `${label}.type`,
    );
    if (figure.iauCode !== undefined && !/^[A-Z][A-Za-z]{2}$/.test(figure.iauCode)) {
      fail(`${label}.iauCode is invalid`);
    }
    validateNames(figure.names, sources, `${label}.names`);
    requireArray(figure.paths, `${label}.paths`, 1);
    const memberIds = new Set();
    for (const [pathIndex, path] of figure.paths.entries()) {
      const pathLabel = `${label}.paths[${pathIndex}]`;
      requireArray(path, pathLabel, 1);
      let previous;
      for (const [objectIndex, objectId] of path.entries()) {
        requireHip(objectId, `${pathLabel}[${objectIndex}]`);
        requireKnownObject(objectId, knownObjectIds, `${pathLabel}[${objectIndex}]`);
        if (objectId === previous) {
          fail(`${pathLabel} contains adjacent duplicate ${objectId}`);
        }
        memberIds.add(objectId);
        previous = objectId;
      }
    }
    requireRecord(figure.labelAnchor, `${label}.labelAnchor`);
    requireHip(figure.labelAnchor.objectId, `${label}.labelAnchor.objectId`);
    requireKnownObject(figure.labelAnchor.objectId, knownObjectIds, `${label}.labelAnchor.objectId`);
    if (!memberIds.has(figure.labelAnchor.objectId)) {
      fail(`${label}.labelAnchor must reference a figure member`);
    }
    requireIntegerInRange(figure.rank, 1, 3, `${label}.rank`);
    requireArray(figure.groupIds, `${label}.groupIds`);
    for (const groupId of figure.groupIds) requireId(groupId, `${label}.groupIds`);
    validateSourceIds(figure.sourceIds, sources, `${label}.sourceIds`);
  }

  const groups = new Map();
  requireArray(pack.groups, `${pack.id}.groups`);
  for (const [index, group] of pack.groups.entries()) {
    const label = `${pack.id}.groups[${index}]`;
    requireRecord(group, label);
    requireId(group.id, `${label}.id`);
    unique(groups, group.id, `${pack.id} has duplicate group ${group.id}`, group);
    includes(["system", "enclosure", "lunar-mansions", "constellation-set"], group.type, `${label}.type`);
    validateNames(group.names, sources, `${label}.names`);
    requireArray(group.members, `${label}.members`, 1);
    validateSourceIds(group.sourceIds, sources, `${label}.sourceIds`);
  }
  for (const [groupId, group] of groups) {
    for (const [index, member] of group.members.entries()) {
      const label = `${pack.id}.groups.${groupId}.members[${index}]`;
      requireRecord(member, label);
      includes(["figure", "group"], member.type, `${label}.type`);
      requireId(member.id, `${label}.id`);
      const collection = member.type === "figure" ? figures : groups;
      if (!collection.has(member.id)) fail(`${label} references missing ${member.type} ${member.id}`);
      if (member.type === "group" && member.id === groupId) fail(`${label} cannot reference itself`);
    }
  }
  for (const [figureId, figure] of figures) {
    for (const groupId of figure.groupIds) {
      if (!groups.has(groupId)) fail(`${pack.id}.figures.${figureId} references missing group ${groupId}`);
    }
  }

  const regionIds = new Set();
  requireArray(pack.regions, `${pack.id}.regions`);
  for (const [index, region] of pack.regions.entries()) {
    const label = `${pack.id}.regions[${index}]`;
    requireRecord(region, label);
    requireId(region.id, `${label}.id`);
    unique(regionIds, region.id, `${pack.id} has duplicate region ${region.id}`);
    requireId(region.figureId, `${label}.figureId`);
    if (!figures.has(region.figureId)) fail(`${label} references missing figure ${region.figureId}`);
    validateNames(region.names, sources, `${label}.names`);
    equal(region.referenceFrame, "ICRS", `${label}.referenceFrame`);
    validateMultiPolygon(region.geometry, `${label}.geometry`);
    validateSourceIds(region.sourceIds, sources, `${label}.sourceIds`);
  }

  return pack;
}

export function validateFeaturedPatternPack(pack, { catalogObjectIds, cultureIds } = {}) {
  requireRecord(pack, "featured pattern pack");
  equal(pack.schemaVersion, 1, "featured pattern pack.schemaVersion");
  equal(pack.id, "featured-patterns", "featured pattern pack.id");
  requireVersion(pack.version, "featured pattern pack.version");
  const sources = validateSources(pack.sources, "featured-patterns.sources");
  const patternIds = new Set();
  requireArray(pack.patterns, "featured-patterns.patterns", 1);
  for (const [index, pattern] of pack.patterns.entries()) {
    const label = `featured-patterns.patterns[${index}]`;
    requireRecord(pattern, label);
    requireId(pattern.id, `${label}.id`);
    unique(patternIds, pattern.id, `featured-patterns has duplicate pattern ${pattern.id}`);
    validateNames(pattern.names, sources, `${label}.names`);
    requireArray(pattern.memberObjectIds, `${label}.memberObjectIds`, 3);
    const memberIds = new Set();
    for (const objectId of pattern.memberObjectIds) {
      requireHip(objectId, `${label}.memberObjectIds`);
      unique(memberIds, objectId, `${label} has duplicate member ${objectId}`);
      if (catalogObjectIds && !catalogObjectIds.has(objectId)) {
        fail(`${label} member ${objectId} is not in the physical star catalogue`);
      }
    }
    requireArray(pattern.paths, `${label}.paths`, 1);
    for (const [pathIndex, path] of pattern.paths.entries()) {
      const pathLabel = `${label}.paths[${pathIndex}]`;
      requireArray(path, pathLabel, 4);
      if (path[0] !== path.at(-1)) fail(`${pathLabel} must be closed`);
      for (const objectId of path) {
        requireHip(objectId, pathLabel);
        if (!memberIds.has(objectId)) fail(`${pathLabel} references non-member ${objectId}`);
      }
    }
    requireRecord(pattern.labelAnchor, `${label}.labelAnchor`);
    if (!memberIds.has(pattern.labelAnchor.objectId)) fail(`${label}.labelAnchor must reference a member`);
    requireArray(pattern.cultureIds, `${label}.cultureIds`, 1);
    for (const cultureId of pattern.cultureIds) {
      requireId(cultureId, `${label}.cultureIds`);
      if (cultureIds && !cultureIds.has(cultureId)) fail(`${label} references missing culture ${cultureId}`);
    }
    validateSourceIds(pattern.sourceIds, sources, `${label}.sourceIds`);
  }
  return pack;
}

export function buildSearchIndex(culturePacks, version) {
  const entries = [];
  const exactKeys = new Set();
  for (const culture of culturePacks) {
    for (const record of culture.starNames) {
      for (const name of record.names) {
        if (!name.searchable) continue;
        const normalizedTerm = normalizeSearchTerm(name.value);
        if (normalizedTerm.length === 0) fail(`Search name ${name.value} normalizes to an empty string`);
        const key = [culture.id, record.objectId, name.language, normalizedTerm, name.type].join("\u0000");
        if (exactKeys.has(key)) {
          fail(`Normalized search conflict for ${name.value} on ${record.objectId} in ${culture.id}`);
        }
        exactKeys.add(key);
        entries.push({
          term: name.value,
          normalizedTerm,
          objectId: record.objectId,
          cultureId: culture.id,
          language: name.language,
          nameType: name.type,
          preferred: name.preferred,
          labelPriority: record.labelPriority,
          sourceId: name.sourceId,
        });
      }
      const hipTerm = record.objectId.replace(":", " ");
      entries.push({
        term: hipTerm,
        normalizedTerm: normalizeSearchTerm(hipTerm),
        objectId: record.objectId,
        cultureId: culture.id,
        language: "und",
        nameType: "identifier",
        preferred: false,
        labelPriority: record.labelPriority,
        sourceId: null,
      });
    }
  }

  entries.sort((left, right) =>
    left.normalizedTerm.localeCompare(right.normalizedTerm) ||
    left.objectId.localeCompare(right.objectId) ||
    left.cultureId.localeCompare(right.cultureId) ||
    left.term.localeCompare(right.term),
  );

  const objectsByTerm = new Map();
  for (const entry of entries) {
    const objectIds = objectsByTerm.get(entry.normalizedTerm) ?? new Set();
    objectIds.add(entry.objectId);
    objectsByTerm.set(entry.normalizedTerm, objectIds);
  }
  const collisions = [...objectsByTerm]
    .filter(([, objectIds]) => objectIds.size > 1)
    .map(([normalizedTerm, objectIds]) => ({ normalizedTerm, objectIds: [...objectIds].sort() }))
    .sort((left, right) => left.normalizedTerm.localeCompare(right.normalizedTerm));

  return {
    schemaVersion: 1,
    id: "sky-search-index",
    version,
    normalization: "Unicode NFKC, locale-independent lowercase, remove punctuation/symbols/whitespace",
    entries,
    collisions,
  };
}

export function verifyEncodedAsset(bytes, descriptor) {
  if (bytes.length !== descriptor.contentLength) {
    throw new Error(
      `Asset ${descriptor.assetId} content length ${bytes.length} does not match ${descriptor.contentLength}`,
    );
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== descriptor.sha256) {
    throw new Error(`Asset ${descriptor.assetId} checksum does not match its descriptor`);
  }
}

function validateSources(value, label) {
  requireArray(value, label, 1);
  const sources = new Map();
  for (const [index, source] of value.entries()) {
    const sourceLabel = `${label}[${index}]`;
    requireRecord(source, sourceLabel);
    requireId(source.id, `${sourceLabel}.id`);
    unique(sources, source.id, `${label} has duplicate source ${source.id}`, source);
    requireText(source.title, `${sourceLabel}.title`);
    requireArray(source.authors, `${sourceLabel}.authors`, 1);
    for (const author of source.authors) requireText(author, `${sourceLabel}.authors`);
    requireUrl(source.url, `${sourceLabel}.url`);
    requireText(source.version, `${sourceLabel}.version`);
    requireText(source.license, `${sourceLabel}.license`);
    requireText(source.attribution, `${sourceLabel}.attribution`);
  }
  return sources;
}

function validateNames(value, sources, label) {
  requireArray(value, label, 1);
  const preferredLanguages = new Set();
  const exactNames = new Set();
  const normalizedNames = new Set();
  for (const [index, name] of value.entries()) {
    const nameLabel = `${label}[${index}]`;
    requireRecord(name, nameLabel);
    requireLanguage(name.language, `${nameLabel}.language`);
    requireText(name.value, `${nameLabel}.value`);
    if (!NAME_TYPES.has(name.type)) fail(`${nameLabel}.type is invalid`);
    requireBoolean(name.preferred, `${nameLabel}.preferred`);
    requireBoolean(name.searchable, `${nameLabel}.searchable`);
    requireSource(name.sourceId, sources, `${nameLabel}.sourceId`);
    if (name.preferred) {
      unique(preferredLanguages, name.language, `${label} has more than one preferred name for ${name.language}`);
    }
    unique(
      exactNames,
      [name.language, name.type, name.value].join("\u0000"),
      `${label} contains duplicate name ${name.value}`,
    );
    if (name.searchable) {
      const normalized = normalizeSearchTerm(name.value);
      if (normalized.length === 0) fail(`${nameLabel} normalizes to an empty search term`);
      unique(
        normalizedNames,
        [name.language, normalized, name.type].join("\u0000"),
        `${label} contains a normalized search conflict for ${name.value}`,
      );
    }
  }
}

function validateSourceIds(value, sources, label) {
  requireArray(value, label, 1);
  const ids = new Set();
  for (const sourceId of value) {
    requireSource(sourceId, sources, label);
    unique(ids, sourceId, `${label} contains duplicate source ${sourceId}`);
  }
}

function validateMultiPolygon(value, label) {
  requireRecord(value, label);
  equal(value.type, "MultiPolygon", `${label}.type`);
  requireArray(value.coordinates, `${label}.coordinates`, 1);
  for (const [polygonIndex, polygon] of value.coordinates.entries()) {
    requireArray(polygon, `${label}.coordinates[${polygonIndex}]`, 1);
    for (const [ringIndex, ring] of polygon.entries()) {
      const ringLabel = `${label}.coordinates[${polygonIndex}][${ringIndex}]`;
      requireArray(ring, ringLabel, 4);
      for (const [positionIndex, position] of ring.entries()) {
        const positionLabel = `${ringLabel}[${positionIndex}]`;
        requireArray(position, positionLabel, 2);
        if (position.length !== 2) fail(`${positionLabel} must contain longitude and latitude`);
        requireNumberInRange(position[0], -180, 180, `${positionLabel}[0]`);
        requireNumberInRange(position[1], -90, 90, `${positionLabel}[1]`);
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) {
        fail(`${ringLabel} must be closed`);
      }
    }
  }
}

function requireHip(value, label) {
  if (typeof value !== "string") fail(`${label} must be a HIP object identifier`);
  const match = HIP_PATTERN.exec(value);
  if (!match || Number(match[1]) > MAX_HIP_ID) fail(`${label} is not a valid Hipparcos identifier`);
}

function requireKnownObject(value, knownObjectIds, label) {
  if (knownObjectIds && !knownObjectIds.has(value)) {
    fail(`${label} is not present in the physical or supplemental Hipparcos reference set`);
  }
}

function requireSource(value, sources, label) {
  requireId(value, label);
  if (!sources.has(value)) fail(`${label} references missing source ${value}`);
}

function requireId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) fail(`${label} is not a valid identifier`);
}

function requireVersion(value, label) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) fail(`${label} is not a valid version`);
}

function requireLanguage(value, label) {
  if (typeof value !== "string" || !LANGUAGE_PATTERN.test(value)) fail(`${label} is not a BCP 47 language tag`);
}

function requireUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") fail(`${label} must use HTTP or HTTPS`);
  } catch {
    fail(`${label} must be an absolute URL`);
  }
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
}

function requireArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s)`);
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be non-empty text`);
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") fail(`${label} must be a boolean`);
}

function requireIntegerInRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
}

function requireNumberInRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    fail(`${label} must be a number from ${minimum} to ${maximum}`);
  }
}

function includes(values, value, label) {
  if (!values.includes(value)) fail(`${label} must be one of ${values.join(", ")}`);
}

function equal(actual, expected, label) {
  if (actual !== expected) fail(`${label} must equal ${expected}`);
}

function unique(collection, key, message, mapValue = true) {
  if (collection.has(key)) fail(message);
  if (collection instanceof Map) collection.set(key, mapValue);
  else collection.add(key);
}

function fail(message) {
  throw new Error(message);
}
import { createHash } from "node:crypto";
