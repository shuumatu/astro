# Sky content source data

This directory contains the canonical, reviewable source data for sky cultures and
featured star patterns. Runtime assets are generated from these files; clients never
contact the upstream projects.

## Layout

```text
schema/                         JSON Schema contracts
cultures/chinese-traditional.json
cultures/western-iau.json
featured-patterns.json
supplemental-hipparcos-ids.json  pinned valid HIP references outside the physical catalogue
import-report.json              pinned upstream versions and import changes
```

Every astronomical object reference uses `HIP:<number>`. Physical astrometry stays in
the naked-eye catalogue. A culture pack contains names, figure paths, hierarchy and
source-backed boundaries only. In particular, the Chinese pack intentionally has no
invented region polygons.

Names carry a BCP 47 language tag and one of `native`, `official`, `translation`,
`transliteration` or `alias`. Consumers resolve a label in this order:

1. exact interface language;
2. base interface language;
3. culture default language;
4. English;
5. first available name.

Simplified and traditional Chinese forms are stored explicitly. Consumers must not
perform automatic script conversion.

The supplemental HIP set allows source-backed names for targets outside the 6.5-magnitude
physical catalogue to remain searchable as unavailable targets. The builder rejects any
culture reference absent from both the physical catalogue and this pinned set.

## Updating upstream data

The importer is intentionally separate from the normal build. It reads a sparse clone
of Stellarium Sky Cultures at the commit recorded in `import-sky-content.mjs`, the IAU
WGSN page snapshot and D3-Celestial boundaries. Run it only when deliberately reviewing
an upstream update:

```powershell
node tools/catalog/sky-content/import-sky-content.mjs --refresh
```

Review all generated JSON and `import-report.json` before committing. Stellarium image
assets and long-form mythology are never imported.

The normal offline build validates source references, HIP identifiers, preferred-name
uniqueness, path geometry, coordinate ranges, closed polygons, search normalization and
checksums, then emits deterministic gzip resources:

```powershell
node tools/catalog/build-sky-content.mjs
node --test tools/catalog/sky-content/sky-content-validation.test.mjs
```

Published files are written below
`backend/services/astronomy-service/src/main/resources/catalogs/sky-content/`.
